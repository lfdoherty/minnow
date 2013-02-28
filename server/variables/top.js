"use strict";

var _ = require('underscorem')

//var Cache = require('./../variable_cache')
var listenerSet = require('./../variable_listeners')

var buckets = require('./../../deps/buckets')

var schema = require('./../../shared/schema')
var _ = require('underscorem')

function topByValuesType(rel){
	if(rel.params[1].schemaType.type !== 'map') throw new Error('topByValues parameter 2 must be a map: ' + JSON.stringify(rel.params[1].type))
	if(rel.params[1].schemaType.value.type !== 'primitive') throw new Error('topByValues parameter 2 must be a map with primitive values: ' + JSON.stringify(rel.params[1].schemaType))
	return rel.params[1].schemaType
}
schema.addFunction('topByValues', {
	schemaType: topByValuesType,
	implementation: topByValuesMaker,
	minParams: 2,
	maxParams: 2,
	callSyntax: 'topByValues(many, map)',
	description: "Takes a map and produces a map with a most 'many' values, based on selecting the highest-valued key-value pairs.  The map's values must be primitive for comparison purposes."
})


function topByValuesMaker(s, self, rel, typeBindings){
	var manyGetter = self(rel.params[0], typeBindings)
	var elementsGetter = self(rel.params[1], typeBindings)
	var cache = s.makeCache()//new Cache(s.analytics)
	var f = svgTopByValues.bind(undefined, s, cache, manyGetter, elementsGetter)
	f.wrapAsSet = elementsGetter.wrapAsSet
	return f
}

function stub(){}

function svgTopByValues(s, cache, manyGetter, elementsGetter, bindings, editId){

	var many = manyGetter(bindings, editId)
	//_.assertDefined(manyGetter.key)
	var elements = elementsGetter(bindings, editId)
	
	var key = elements.key+many.key//+Math.random()
	var variableKey = key
	if(cache.has(key)) return cache.get(key)

	
	var listeners = listenerSet()
	
	var uid = Math.random()
	
	var manyValue;
	
	function compareFunction(kva, kvb){
		return kvb.value - kva.value
	}
	function inverseCompareFunction(kva, kvb){
		return kva.value - kvb.value
	}
	var topHeap = new buckets.Heap(inverseCompareFunction)
	var bottomHeap = new buckets.Heap(compareFunction)
	function oldest(){
		var old = Math.min(many.oldest(), elements.oldest())
		if(old === 1187) console.log('top old: ' + many.oldest() + ' ' + elements.oldest() + ' ' + elements.name)
		return old
	}
	
	var manyListener = {
		set: function(value, oldValue, editId){
			var oldMany = many
			manyValue = value
			//s.log('many for top: ' + manyValue)
			//_.errout('TODO adjust size of top')
			if(value > oldValue){
				while(bottomHeap.size() > 0 && topHeap.size() < manyValue){
					var kv = bottomHeap.removeRoot()
					topHeap.add(kv)
					top[kv.key] = kv.value
					if(oldMany !== undefined){
						listeners.emitPut(kv.key, kv.value, undefined, editId)
					}
				}
			}else if(value < oldValue){
				while(topHeap.size() > manyValue){
					var kv = topHeap.removeRoot()
					bottomHeap.add(kv)
					delete top[kv.key]
					if(oldMany !== undefined){
						listeners.emitRemove(kv.key, editId)
					}
				}
			}
			if(oldMany === undefined){
				topHeap.forEach(function(kv){
					listeners.emitPut(kv.key, kv.value, undefined, editId)
				})			
			}
		},
		includeView: function(){
			_.errout('TODO')
		},
		removeView: function(){
			_.errout('TODO')
		}
	}
	many.attach(manyListener, editId)
	
	var handle = {
		name: 'topByValues (' + elements.name + ')',
		attach: function(listener, editId){
			listeners.add(listener)
			//console.log(JSON.stringify(Object.keys(listener)))
			_.assertFunction(listener.put)
			_.assertFunction(listener.remove)
			_.assertInt(editId)
			topHeap.forEach(function(kv){
				//console.log(uid+' attach putting: ' + kv.key + ' -> ' + kv.value)
				listener.put(kv.key, kv.value, undefined, editId)
			})
		},
		detach: function(listener, editId){
			listeners.remove(listener)
			//console.log(uid+' detaching from top')
			if(editId){
				//_.errout('TODO')
				topHeap.forEach(function(kv){
					listener.del(kv.key, editId)
				})
			}
		},
		descend: elements.descend,
		/*getType: function(v){
			if(elements.getType === undefined) _.errout('needs getType: ' + elements.name)

			return elements.getType(v)
		},
		descendTypes: function(path, editId, cb){
		//	if(elements.descend === undefined) _.errout('needs descend: ' + elements.name)
			if(elements.descendTypes === undefined) _.errout('needs descendTypes: ' + elements.name)

			return elements.descendTypes(path, editId, cb)
		},*/
		oldest: oldest,
		key: key,
		destroy: function(){
			elements.detach(elementListener)
			many.detach(manyListener)
			listeners.destroyed()
		}
	}
	
	var top = {}
	
	var uid = Math.random()+''
	
	function replaceInTop(key, value){
		var rkv
		topHeap.data.forEach(function(kvv){
			if(kvv.key === key){rkv = kvv}
		})
		_.assertObject(rkv)
		var before = topHeap.size()
		topHeap.remove(rkv)
		_.assertEqual(before - topHeap.size(), 1)
		topHeap.add({key: key, value: value})
		_.assert(topHeap.size() <= manyValue)
	}
	function removeFromTop(key){
		var rkv
		topHeap.data.forEach(function(kvv){
			if(kvv.key === key){rkv = kvv}
		})
		_.assertObject(rkv)
		topHeap.remove(rkv)
	}
	
	var elementListener = {
		put: function(key, value, oldValue, editId){
			_.assertInt(editId)
			_.assertPrimitive(value)
			_.assertDefined(key)
			
			if(value === undefined) return
			//s.log(uid+' top got put: ' + key + ' ' + value)
			//console.log(uid+' top got put: ' + key + ' ' + value)
			if(manyValue === undefined){
				bottomHeap.add({key: key, value: value})
				return
			}
			
			if(top[key] !== undefined){
				//s.log('*already got: ' + key)
				//console.log('already got: ' + top[key])
				if(bottomHeap.size() > 0){
					var b = bottomHeap.peek()
					//console.log('peeked ' + b.value + ' ' + value)
					if(b.value > value){
						var oldValue = top[key]
						delete top[key]
						top[b.key] = b.value


						removeFromTop(key)
						//console.log('top emitting del: ' + editId)
						listeners.emitRemove(key,editId)
						//console.log('full, del: ' + rkv.key)

						topHeap.add(b)
						_.assert(topHeap.size() <= manyValue)
						
						listeners.emitPut(b.key, b.value, oldValue, editId)
						bottomHeap.removeRoot()
						
					}else{
						top[key] = value
						replaceInTop(key, value)
						//console.log('inplace replace ' + oldValue + ' -> ' + value)
						listeners.emitPut(key, value, oldValue, editId)
					}
				}else{
					top[key] = value
					replaceInTop(key, value)
					listeners.emitPut(key, value, oldValue, editId)
				}
			}else{
				if(topHeap.size() === manyValue){
					//s.log('full: ' + topHeap.size() +'==='+ manyValue)
					var t = topHeap.peek()
					if(t.value < value){
						//s.log('replacing(' + t.key + '->'+key+') ' + t.value + ' ' + value)
						var kv
						bottomHeap.data.forEach(function(kvv){
							if(kvv.key === key){kv = kvv}
						})
						if(kv){
							_.assertDefined(kv)
							bottomHeap.remove(kv)
						}else{
							kv = {key: key, value: value}
						}
						top[key] = value
						
						var rkv = topHeap.removeRoot()
						_.assertEqual(t,rkv)
						delete top[rkv.key]
						
						topHeap.add(kv)
						_.assert(topHeap.size() <= manyValue)
						listeners.emitPut(kv.key, kv.value, undefined, editId)
						listeners.emitRemove(rkv.key, editId)
						bottomHeap.add(rkv)							
						//s.log('replaced ' + t.value + ' ' + rkv.value)
					}else{
						//s.log('too small: ' + t.value + '>' + value)
						var kv = {key: key, value: value}
						bottomHeap.add(kv)
					}
				}else{
					//console.log('topHeap: ' + topHeap.size() + ', bottomHeap: ' + bottomHeap.size())
					_.assertEqual(bottomHeap.size(), 0)
					var kv = {key: key, value: value}
					//s.log('adding to top: ' + key)
					top[key] = value
					topHeap.add(kv)
					_.assert(topHeap.size() <= manyValue)
					listeners.emitPut(kv.key, kv.value, undefined, editId)
				}
			}
		},
		remove: function(key, editId){
		
			//s.log(uid+' top got del: ' + key)
			//console.log(uid+' top got del: ' + key)
			delete top[key]
			
			if(bottomHeap.size() > 0){
				var kv;
				topHeap.data.forEach(function(kvv){
					if(kvv.key === key){kv = kvv}
				})
				if(kv){
					topHeap.remove(kv)
					listeners.emitDel(kv.key, editId)
					var rkv = bottomHeap.removeRoot()
					topHeap.add(rkv)
					//console.log('replacing removed: ' + listeners.many())
					listeners.emitPut(rkv.key, rkv.value, undefined, editId)
				}else{
					//console.log('removed from bottom: ' + key)
					bottomHeap.data.forEach(function(kvv){
						if(kvv.key === key){kv = kvv}
					})
					bottomHeap.remove(kv)
				}
			}else{
				var kv;
				topHeap.data.forEach(function(kvv){
					if(kvv.key === key){kv = kvv}
				})
				
				if(kv === undefined){
					_.errout('cannot find key: ' + key +'\n'+JSON.stringify(topHeap.data))
				}
				var before = topHeap.size()
				topHeap.remove(kv)
				var after = topHeap.size()
				//console.log(before + ' -- ' + after)
				//console.log(variableKey)
				//console.log(uid+ ' top emitted del: ' + kv.key)
				listeners.emitRemove(kv.key, editId)
			}
		},
		objectChange: listeners.emitObjectChange.bind(listeners),//Unfortunately, there's no easy way to optimize this
		includeView: listeners.emitIncludeView.bind(listeners),
		removeView: listeners.emitRemoveView.bind(listeners)
	}
	
	elements.attach(elementListener, editId)
	
	return cache.store(key, handle)
}

