
var _ = require('underscorem')

var Cache = require('./../variable_cache')
var listenerSet = require('./../variable_listeners')
var fixedPrimitive = require('./../fixed/primitive')
var schema = require('./../../shared/schema')

function stub(){}

function versionType(rel){
	if(rel.params[0].schemaType.type === 'object'){
		return {type: 'primitive', primitive: 'int'}
	}else{
		return {type: 'set', members: {type: 'primitive', primitive: 'int'}}
	}
}

schema.addFunction('lastVersion', {
	schemaType: versionType,
	implementation: maker,
	minParams: 1,
	maxParams: 1,
	callSyntax: 'lastVersion(object/s)'
})

function maker(s, self, rel, typeBindings){
	var elementGetter = self(rel.params[0], typeBindings)
	
	var cache = new Cache(s.analytics)

	var f
	if(rel.params[0].schemaType.type === 'object'){
		f = svgObject.bind(undefined, s, cache, elementGetter)
	}else{
		//_.errout('TODO')
		f = svgObjectCollection.bind(undefined, s, cache, elementGetter)
	}
	
	f.wrapAsSet = function(v, editId, context){return fixedPrimitive.make(s)(v, {}, editId);}
	
	return f
}

var isPathOp = require('./../editutil').isPathOp

function svgObject(s, cache, elementGetter, bindings, editId){

	var element = elementGetter(bindings, editId)	
	var key = element.key
	if(cache.has(key)) return cache.get(key)
	
	var listeners = listenerSet()

	var oldVersion
	
	var handle = {
		name: 'lastVersion',
		attach: function(listener, editId){
			listeners.add(listener)
			_.assertInt(editId)
			if(oldVersion !== undefined){

				listener.set(oldVersion, undefined, editId)
			}
		},
		detach: function(listener, editId){
			listeners.remove(listener)
			if(editId && oldVersion){

				listener.set(undefined, oldVersion, editId)
			}
		},
		oldest: oldest,
		key: key,
		getType: function(){_.errout('INVALID: NOT AN OBJECT TYPE');},
		descend: function(){_.errout('INVALID: NOT AN OBJECT TYPE');}
	}
	
	
	var ongoingEditId;
	function oldest(){
		var oldestEditId = element.oldest()
		if(ongoingEditId !== undefined && ongoingEditId < oldestEditId) oldestEditId = ongoingEditId
		return oldestEditId
	}
	
	var oldName;
	element.attach({
		set: function(v, oldV, editId){
			if(v !== undefined){
				ongoingEditId = editId
				s.objectState.getLastVersion(v, function(version){
					//console.log('versions: ' + JSON.stringify(versions))

					if(ongoingEditId === editId){
						if(oldVersion !== version){
							listeners.emitSet(version, oldVersion, editId)
						}
						oldVersion = version					
						ongoingEditId = undefined
						s.broadcaster.listenByObject(v, function(typeCode, id, editPath, op, edit, syncId, editId){
							if(isPathOp(op)) return
							
							if(oldVersion < editId){
								listeners.emitSet(editId, oldVersion, editId)
								oldVersion = editId
							}
						})
					}
				})
			}else if(oldVersion){
				ongoingEditId = undefined

				listeners.emitSet(undefined, oldVersion, editId)
				oldVersion = undefined
			}
		},
		includeView: stub,
		removeView: stub
	}, editId)
	return cache.store(key, handle)
}


function svgObjectCollection(s, cache, elementGetter, bindings, editId){

	var element = elementGetter(bindings, editId)	
	var key = element.key
	if(cache.has(key)) return cache.get(key)
	
	var listeners = listenerSet()

	var versions = []
	var versionCounts = {}
	
	var handle = {
		name: 'versions',
		attach: function(listener, editId){
			listeners.add(listener)
			_.assertInt(editId)
			for(var i=0;i<versions.length;++i){
				//console.log('adding: ' + oldVersions[i])
				listener.add(versions[i], editId)
			}
		},
		detach: function(listener, editId){
			listeners.remove(listener)
			if(editId){
				for(var i=0;i<versions.length;++i){
					listener.remove(versions[i], editId)
				}
			}
		},
		oldest: oldest,
		key: key,
		getType: function(){_.errout('INVALID: NOT AN OBJECT TYPE');},
		descend: function(){_.errout('INVALID: NOT AN OBJECT TYPE');}
	}
	
	
	var ongoingEditIds = [];
	function oldest(){
		var oldestEditId = element.oldest()
		for(var i=0;i<ongoingEditIds.length;++i){
			var oe = ongoingEditIds[i]
			if(oe < oldestEditId) oldestEditId = oe
		}
		return oldestEditId
	}
	
	var oldName;
	
	function editListener(typeCode, id, editPath, op, edit, syncId, editId){
		if(isPathOp(op)) return
		
		if(versionCounts[editId] === undefined){
			versionCounts[editId] = 1
			versions.push(editId)
			listeners.emitAdd(editId, editId)
		}else{
			++versionCounts[editId]
		}
	}
	
	element.attach({
		add: function(id, editId){
			ongoingEditIds.push(editId)
			s.objectState.getLastVersion(id, function(lastVersion){
				ongoingEditIds.splice(ongoingEditIds.indexOf(editId), 1)
				if(versionCounts[lastVersion] === undefined){
					versionCounts[lastVersion] = 1
					versions.push(lastVersion)
					listeners.emitAdd(lastVersion, editId)
				}
				s.broadcaster.listenByObject(id, editListener)
			})
		},
		remove: function(id, editId){
			ongoingEditIds.push(editId)
			s.objectState.getLastVersion(id, function(lastVersion){
				ongoingEditIds.splice(ongoingEditIds.indexOf(editId), 1)
				if(versionCounts[lastVersion] === 1){
					delete versionCounts[lastVersion]
					versions.splice(versions.indexOf(lastVersion), 1)
					listeners.emitRemove(lastVersion, editId)
				}
				s.broadcaster.stopListeningByObject(id, editListener)
			})
		},
		includeView: stub,
		removeView: stub
	}, editId)
	return cache.store(key, handle)
}
