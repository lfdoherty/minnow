
var _ = require('underscorem')

var Cache = require('./../variable_cache')
var listenerSet = require('./../variable_listeners')
var fixedPrimitive = require('./../fixed/primitive')
var schema = require('./../../shared/schema')


function sessionsType(rel){
	return {type: 'list', members: {type: 'primitive', primitive: 'int'}}
}

schema.addFunction('sessions', {
	schemaType: sessionsType,
	implementation: sessionsMaker,
	minParams: 1,
	maxParams: 1,
	callSyntax: 'sessions(object)'
})

function sessionsMaker(s, self, rel, typeBindings){
	var elementGetter = self(rel.params[0], typeBindings)
	
	var cache = new Cache()
	var f = svgSessions.bind(undefined, s, cache, elementGetter)
	
	f.wrapAsSet = function(v, editId, context){return fixedPrimitive.make(s)(v, {}, editId);}
	
	return f
}

function svgSessions(s, cache, elementGetter, bindings, editId){

	var element = elementGetter(bindings, editId)	
	var key = element.key
	if(cache.has(key)) return cache.get(key)
	
	var listeners = listenerSet()

	var oldSyncIds
	
	var handle = {
		name: 'sessions',
		attach: function(listener, editId){
			listeners.add(listener)
			_.assertInt(editId)
			if(oldSyncIds !== undefined){
				//console.log('old sync ids: ' + JSON.stringify(oldSyncIds))
				for(var i=0;i<oldSyncIds.length;++i){
					//console.log('adding: ' + oldSyncIds[i])
					listener.add(oldSyncIds[i], editId)
				}
			}
		},
		detach: function(listener, editId){
			listeners.remove(listener)
			if(editId){
				if(oldSyncIds !== undefined){
					for(var i=0;i<oldSyncIds.length;++i){
						listener.remove(oldSyncIds[i], editId)
					}
				}
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
				s.objectState.getSyncIds(v, function(syncIds){
					//console.log('syncIds: ' + JSON.stringify(syncIds))

					if(ongoingEditId === editId){
						//console.log('from: ' + JSON.stringify(oldSyncIds))
						if(oldSyncIds){
							for(var i=0;i<oldSyncIds.length;++i){
								if(syncIds.indexOf(oldSyncIds[i]) === -1){
									listeners.emitRemove(oldSyncIds[i], editId)
								}
							}
							for(var i=0;i<syncIds.length;++i){
								if(oldSyncIds.indexOf(syncIds[i]) === -1){
									listeners.emitAdd(syncIds[i], editId)
								}
							}
						}else{
							for(var i=0;i<syncIds.length;++i){
								listeners.emitAdd(syncIds[i], editId)
							}
						}
						oldSyncIds = syncIds						
						ongoingEditId = undefined
						s.broadcaster.listenByObject(v, function(subjTypeCode, subjId, typeCode, id, editPath, op, edit, syncId, editId){
							if(syncIds.indexOf(syncId) === -1){
								syncIds.push(syncId)
								listeners.emitAdd(syncId, editId)
							}
						})
					}
				})
			}else if(oldSyncIds){
				ongoingEditId = undefined
				for(var i=0;i<oldSyncIds.length;++i){
					listeners.emitRemove(oldSyncIds[i], editId)
				}
				oldSyncIds = undefined
			}
		}	
	}, editId)
	return cache.store(key, handle)
}
