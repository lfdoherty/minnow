
var _ = require('underscorem')

var Cache = require('./../variable_cache')
var listenerSet = require('./../variable_listeners')
var fixedPrimitive = require('./../fixed/primitive')
var schema = require('./../../shared/schema')


function versionsType(rel){
	if(rel.params[0].schemaType.type === 'object'){
		return {type: 'list', members: {type: 'primitive', primitive: 'int'}}
	}else{
		return {type: 'set', members: {type: 'primitive', primitive: 'int'}}
	}
}

schema.addFunction('versions', {
	schemaType: versionsType,
	implementation: maker,
	minParams: 1,
	maxParams: 1,
	callSyntax: 'versions(object/s)'
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

function stub(){}

function svgObject(s, cache, elementGetter, bindings, editId){

	var element = elementGetter(bindings, editId)	
	var key = element.key
	if(cache.has(key)) return cache.get(key)
	
	var listeners = listenerSet()

	var oldVersions
	var oldValue
	
	var handle = {
		name: 'versions',
		attach: function(listener, editId){
			listeners.add(listener)
			_.assertInt(editId)
			if(oldVersions !== undefined){
				for(var i=0;i<oldVersions.length;++i){
					//console.log('adding: ' + oldVersions[i])
					listener.add(oldVersions[i], editId)
				}
			}
		},
		detach: function(listener, editId){
			listeners.remove(listener)
			if(editId){
				if(oldVersions !== undefined){
					for(var i=0;i<oldVersions.length;++i){
						listener.remove(oldVersions[i], editId)
					}
				}
			}
		},
		oldest: oldest,
		key: key,
		//getType: function(){_.errout('INVALID: NOT AN OBJECT TYPE');},
		descend: function(){_.errout('INVALID: NOT AN OBJECT TYPE');},
		destroy: function(){
			handle.descend = handle.oldest = handle.attach = handle.detach = function(){_.errout('destroyed');}
			element.detach(elementsListener)
			if(oldVersions){
				s.broadcaster.stopListeningByObject(oldValue, broadcastListener)
			}
			listeners.destroyed()
		}
	}
	
	
	var ongoingEditId;
	function oldest(){
		var oldestEditId = element.oldest()
		if(ongoingEditId !== undefined && ongoingEditId < oldestEditId) oldestEditId = ongoingEditId
		return oldestEditId
	}
	
	function broadcastListener(typeCode, id, editPath, op, edit, syncId, editId){
		_.assertInt(editId)
		if(isPathOp(op)) return
		
		if(oldVersions.indexOf(editId) === -1){
			oldVersions.push(editId)
			//console.log('added version: ' + JSON.stringify([op, edit, syncId, editId]))
			listeners.emitAdd(editId, editId)
		}
	}
	
	var elementsListener = {
		set: function(v, oldV, editId){
			
			if(oldVersions){
				s.broadcaster.stopListeningByObject(oldV, broadcastListener)
			}
			
			if(v !== undefined){
				ongoingEditId = editId
				
				s.objectState.getVersions(v, function(versions){
					//console.log('versions: ' + JSON.stringify(versions))

					if(ongoingEditId === editId){
						//console.log('from: ' + JSON.stringify(oldVersions))
						if(oldVersions){
							for(var i=0;i<oldVersions.length;++i){
								if(versions.indexOf(oldVersions[i]) === -1){
									listeners.emitRemove(oldVersions[i], editId)
								}
							}
							for(var i=0;i<versions.length;++i){
								if(oldVersions.indexOf(versions[i]) === -1){
									listeners.emitAdd(versions[i], editId)
								}
							}
						}else{
							for(var i=0;i<versions.length;++i){
								listeners.emitAdd(versions[i], editId)
							}
						}
						oldVersions = versions						
						ongoingEditId = undefined
						s.broadcaster.listenByObject(v, broadcastListener)
					}
				})
			}else if(oldVersions){
				ongoingEditId = undefined
				for(var i=0;i<oldVersions.length;++i){
					listeners.emitRemove(oldVersions[i], editId)
				}
				oldVersions = undefined
			}
			oldValue = v
		},
		includeView: stub,
		removeView: stub
	}
	element.attach(elementsListener, editId)
	
	return cache.store(key, handle)
}


function svgObjectCollection(s, cache, elementGetter, bindings, editId){

	var element = elementGetter(bindings, editId)	
	var key = element.key
	if(cache.has(key)) return cache.get(key)
	
	var listeners = listenerSet()

	var listeningIds = []
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
		descend: function(){_.errout('INVALID: NOT AN OBJECT TYPE');},
		destroy: function(){
			handle.descend = handle.oldest = handle.attach = handle.detach = function(){_.errout('destroyed');}
			element.detach(elementsListener)
			listeningIds.forEach(function(id){
				s.broadcaster.stopListeningByObject(id, editListener)
			})
			listeners.destroyed()
		}
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
	
	var elementsListener = {
		add: function(id, editId){
			ongoingEditIds.push(editId)
			s.objectState.getVersions(id, function(vs){
				ongoingEditIds.splice(ongoingEditIds.indexOf(editId), 1)
				for(var i=0;i<vs.length;++i){
					var v = vs[i]
					if(versionCounts[v] === undefined){
						versionCounts[v] = 1
						versions.push(v)
						listeners.emitAdd(v, editId)
					}
				}
				listeningIds.push(id)
				s.broadcaster.listenByObject(id, editListener)
			})
		},
		remove: function(id, editId){
			ongoingEditIds.push(editId)
			s.objectState.getVersions(id, function(vs){
				ongoingEditIds.splice(ongoingEditIds.indexOf(editId), 1)
				for(var i=0;i<vs.length;++i){
					var v = vs[i]
					if(versionCounts[v] === 1){
						delete versionCounts[v]
						versions.splice(versions.indexOf(v), 1)
						listeners.emitRemove(v, editId)
					}
				}
				listeningIds.splice(listeningIds.indexOf(id), 1)
				s.broadcaster.stopListeningByObject(id, editListener)
			})
		},
		includeView: stub,
		removeView: stub
	}
	element.attach(elementsListener, editId)
	return cache.store(key, handle)
}
