"use strict";

var _ = require('underscorem')

var olbuf = require('./olbuf')

var CACHE_SIZE = 10//MUST BE AT LEAST 2?

/*
olcache implements a cache of the CACHE_SIZE most recent objects, so as to avoid serializing objects undergoing ongoing editing repeatedly.

It uses a ring buffer of the ids, in order of most recently used.  This results in O(1) performance in the repeated case (when
the same id is used multiple times sequentially) and in the single-use case (when each id is used some number of times repeatedly,
and then never again.)

*/

exports.make = function(){

	var ob = olbuf.make()
	
	var cache = {}
	var order = []
	var first = 0

	var many = 0
	var cacheHasFilled = false
	
	function evict(newId){
		//var oldestIndex = first
		//if(oldestIndex === -1) oldestIndex = CACHE_SIZE-1
		
		var evictedId = order[first]
		
		if(evictedId !== -1){//means it has been destroyed
			// write new version of object
			var edits = cache[evictedId]
			if(edits === undefined) _.errout('cannot evict, bug: ' + evictedId + ' ' + JSON.stringify(order))
			_.assertArray(edits)
			/*if(edits[1].edit.id !== evictedId){
				_.errout(JSON.stringify(edits))
			}
			_.assertEqual(edits[1].edit.id, evictedId)*/
		
			if(ob.isNew(evictedId)){
				ob.write(evictedId, edits)
			}else{
				ob.append(evictedId, edits)
			}
			delete cache[evictedId]
			//console.log('evicted: ' + evictedId)
		}
		
		push(newId)
		
	//	console.log('should be full: ' + JSON.stringify(order))
		/*for(var i=0;i<order.length;++i){
			_.assertInt(order[i])
			_.assert(order[i] !== evictedId)
		}*/
	}
	function push(id){
		order[first] = id
		//console.log('pushed: ' + id)
		++first
		if(first === CACHE_SIZE) first = 0
	}
	
	function rot(f){return f === -1 ? CACHE_SIZE-1 : f;}
	
	function incr(id){
		if(order[rot(first-1)] === id){
			//console.log('repeated: ' + id)
			return
		}
	//	console.log('incr diff(' + id + ')[' + first + ' ' + rot(first-1) + ']: ' + JSON.stringify(order))
		//shift everything over one, overwriting the old position of the id, and moving the current 'first' id to second place
		var prev = order.indexOf(id)
		var distance = first > prev ? first-prev : first + (CACHE_SIZE-prev)
		for(var d=0;d<distance;++d){
			var off = d + prev + 1
			if(off >= CACHE_SIZE) off -= CACHE_SIZE
			var pOff = off - 1
			if(pOff === -1) pOff = CACHE_SIZE - 1
			
			order[pOff] = order[off]
		}
	//	console.log('preshift(' + id + ', old: ' + order[rot(first-1)] + '): ' + JSON.stringify(order))
		order[rot(first-1)] = id
	//	console.log('shifted: ' + id)
	}
	var handle = {
		addEdit: function(id, edit){
			_.assertInt(id)
			_.assertInt(edit.op)
					
			if(CACHE_SIZE === 0){
			
				if(ob.isNew(id)){
					ob.write(id, [edit])
				}else{
					ob.append(id, [edit])
				}
				return
			}
			
			//console.log('adding edit: ' + id + ' ' + JSON.stringify(edit))
		
			//console.log('id: ' + id)
			var list = cache[id]
			
			//if(!ob.isNew(id) && ob.get(id).length >= 2){
			//	_.assert(edit.op !== 'made')
			//}
			
			if(list === undefined){
				list = cache[id] = []
				if(cacheHasFilled){
					//console.log('evicting, cached filled')
					evict(id)
				}else{
					order[many] = id
					//console.log('filling(' + many + '): ' + JSON.stringify(order))
					++first
					++many
					if(many === CACHE_SIZE){
						cacheHasFilled = true
						first = 0
					}
				}
			}else{
				//console.log('incr')
				//if(list.length >= 2) _.assert(edit.op !== 'made')
				incr(id)
			}
			list.push(edit)
		},
		get: function(id){
			if(cache[id]){
				if(ob.isNew(id)){
					return [].concat(cache[id])
				}else{
					var res = ob.get(id).concat(cache[id])
					//console.log("returning combination: " + JSON.stringify(res))
					//_.errout('TODO?')
					return res
				}
			}else{
				return ob.get(id)
			}
		},
		serializeBinaryRange: function(id, startEditId, endEditId, w){
			if(cache[id]){
				if(ob.isNew(id)){
					var edits = cache[id]
					if(edits === undefined) _.errout('unknown object: ' + JSON.stringify([id, startEditId, endEditId]))
					var actual = []
					for(var i=0;i<edits.length;++i){
						var e = edits[i]
						_.assertInt(e.editId)
						if(startEditId <= e.editId && (endEditId === -1 || e.editId <= endEditId)){
							actual.push(e)
						}
					}
					//console.log('serializing('+id+')(' + startEditId+')(' + endEditId+'): ' + JSON.stringify(actual))
					if(actual.length === 0) return
					/*if(startEditId === -1){
						_.assert(actual.length >= 2)
					}*/
					ob.serializeEdits(actual, w)
					return true
				}else{
					var edits = ob.get(id).concat(cache[id])
					var actual = []
					for(var i=0;i<edits.length;++i){
						var e = edits[i]
						_.assertInt(e.editId)
						if(startEditId <= e.editId && (endEditId === -1 || e.editId <= endEditId)){
							actual.push(e)
						}
					}
					if(actual.length === 0) return
					ob.serializeEdits(actual, w)
					return true
					/*var res = ob.get(id).concat(cache[id])
					console.log("returning combination: " + JSON.stringify(res))
					_.errout('TODO?')
					return res*/
					//_.errout('TODO?')
					//ob.serializeBinaryRange(id, startEditId, endEditId, w)
				}
			}else{
				//ob.get(id)
				//_.errout('TODO')
				ob.serializeBinaryRange(id, startEditId, endEditId, w)				
				return true
			}
		},
		/*destroy: function(id){
			if(cache[id]){
				order[order.indexOf(id)] = -1
				delete cache[id]
			}
			if(!ob.isNew(id)){
				ob.destroy(id)
			}
		},*/
		assertUnknown: function(id){
			_.assert(ob.isNew(id))
		},
		isTopLevelObject: function(id){
			
			return cache[id] || ob.isTopLevelObject(id)
		}
	}
	
	return handle
}
