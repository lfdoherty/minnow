
var _ = require('underscorem')

//var Cache = require('./../variable_cache')
var listenerSet = require('./../variable_listeners')
var fixedPrimitive = require('./../fixed/primitive')
var schema = require('./../../shared/schema')

var editFp = require('./../tcp_shared').editFp
var editCodes = editFp.codes
var editNames = editFp.names

function stub(){}

function type(rel){
	return rel.params[0].schemaType
}

schema.addFunction('allForked', {
	schemaType: type,
	implementation: maker,
	minParams: 1,
	maxParams: 1,
	callSyntax: 'allForked(object/s)',
	computeAsync: function(z, cb, set){
		var result = []
		var has = {}
		set.forEach(function(id){
			var forkedIds = z.objectState.getAllForked(id)//TODO take editId into account, perhaps also moving this to a wrap impl
			forkedIds.forEach(function(fid){
				if(has[fid]) return
				has[fid] = true
				result.push(fid)
			})
		})
		cb(result)
	}
})

function maker(s, self, rel, typeBindings){
	var elementGetter = self(rel.params[0], typeBindings)
	
	var cache = s.makeCache()//new Cache(s.analytics)

	var f
	if(rel.params[0].schemaType.type === 'object'){
		f = svgObject.bind(undefined, s, cache, elementGetter)
	}else{
		f = svgObjectCollection.bind(undefined, s, cache, elementGetter)
	}
	
	f.wrapAsSet = function(v, editId, context){return fixedPrimitive.make(s)(v, {}, editId);}
	
	return f
}

var isPathOp = require('./../editutil').isPathOp

function svgObject(s, cache, elementGetter, bindings, editId){

	_.errout('TODO')

	return cache.store(key, handle)
}


function svgObjectCollection(s, cache, elementGetter, bindings, editId){

	var element = elementGetter(bindings, editId)	
	var key = element.key
	if(cache.has(key)) return cache.get(key)
	
	var listeners = listenerSet()

	var ids = []
	var idCounts = {}
	
	var m = {}
	
	var handle = {
		name: 'allForked',
		attach: function(listener, editId){
			listeners.add(listener)
			_.assertInt(editId)
			for(var i=0;i<ids.length;++i){
				listener.add(ids[i], editId)
			}
		},
		detach: function(listener, editId){
			listeners.remove(listener)
			if(editId){
				for(var i=0;i<ids.length;++i){
					listener.remove(ids[i], editId)
				}
			}
		},
		oldest: s.objectState.getCurrentEditId,
		key: key,
		descend: function(){_.errout('TODO');},
		destroy: function(){
			handle.descend = handle.oldest = handle.attach = handle.detach = function(){_.errout('destroyed');}
			element.detach(elementsListener)
			listeners.destroyed()
		}
	}

	function addForked(fid, editId){
		if(idCounts[fid] === undefined){//TODO extract this pattern
			idCounts[fid] = 0
			ids.push(fid)
			listeners.emitAdd(fid, editId)
		}
		++idCounts[fid]
	}
	function removeForked(fid, editId){
		if(idCounts[fid] === 1){//TODO extract this pattern
			delete idCounts[fid]
			ids.splice(ids.indexOf(fid),1)
			listeners.emitRemove(fid, editId)
		}else{
			--idCounts[fid]
		}
	}
	function recomputeForked(id, newAll, editId){
		//console.log('recomputing forked: ' + id)
		var old = m[id]
		var newMap = {}
		for(var i=0;i<newAll.length;++i){
			var fid = newAll[i]
			if(!old[fid]){
				addForked(fid, editId)
			}
			newMap[fid] = true
		}
		Object.keys(old).forEach(function(oldId){
			if(!newMap[oldId]){
				removeForked(oldId, editId)
			}
		})
		m[id] = newMap
	}
	function editListener(state, op, edit, syncId, editId){
		if(op === editCodes.refork){
			_.assertEqual(state.top, state.object)
			var newAll = s.objectState.getAllForked(state.top)
			recomputeForked(state.object, newAll, editId)
		}
	}
	var elementsListener = {
		add: function(id, editId){
			m[id] = {}
			var newAll = s.objectState.getAllForked(id)
			recomputeForked(id, newAll, editId)
			s.broadcaster.listenByObject(id, editListener)
		},
		remove: function(id, editId){
			recomputeForked(id, {}, editId)
			delete m[id]
			s.broadcaster.stopListeningByObject(id, editListener)
		},
		includeView: stub,
		removeView: stub
	}
	element.attach(elementsListener, editId)
	return cache.store(key, handle)
}
