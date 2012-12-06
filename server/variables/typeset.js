"use strict";

var _ = require('underscorem')

var Cache = require('./../variable_cache')
var listenerSet = require('./../variable_listeners')

var schema = require('./../../shared/schema')

var fixedObject = require('./../fixed/object')


function typeType(rel, computeType){
	_.assertString(rel.params[0].value)
	return {type: 'set', members: {type: 'object', object: rel.params[0].value}};
}

schema.addFunction('typeset', {
	schemaType: typeType,
	implementation: typeMaker,
	minParams: 1,
	maxParams: 1,
	callSyntax: 'typeset(typename)'
})

function typeMaker(s, self, rel){
	var cache = new Cache(s.analytics)
	var typeName = rel.params[0].value
	if(s.schema[typeName] === undefined) _.errout('cannot recognize type: ' + typeName)
	var typeCode = s.schema[typeName].code

	var fixedObjGetter = fixedObject.make(s)
	var nf = svgGeneralType.bind(undefined, s, cache, typeCode)

	nf.wrapAsSet = function(id, editId, context){
		_.assertInt(editId)
		return fixedObjGetter(id, editId, context)
	}

	return nf
}

function svgGeneralType(s, cache, typeCode, bindings, editId){

	_.assertFunction(s.broadcaster.listenForNew)
	
	var key = typeCode
	if(cache.has(key)) return cache.get(key)

	var listeners = listenerSet()
	var idList
	
	//s.log('creating new typeset-general: ' + typeCode)
	
	var handle = {
		name: 'typeset-general',
		attach: function(listener, editId){
			_.assertInt(editId)
			//_.assertFunction(listener.shouldHaveObject)
			_.assertFunction(listener.add)
			_.assertFunction(listener.remove)
			listeners.add(listener)
			//console.log('attached to type ************ ' + JSON.stringify(idList) + ' ' + typeCode)
			//s.log(new Error().stack)
			if(idList){
				//console.log('adding ids: ' + idList.length)
				idList.forEach(function(id){
					listener.add(id, editId)
				})
			}
		},
		detach: function(listener, editId){
			listeners.remove(listener)
			if(editId !== undefined){
				if(idList){
					idList.forEach(function(id){
						listener.remove(id, editId)
					})
				}
			}
		},
		oldest: function(){
			if(idList){
				//console.log('id list ' + s.objectState.getCurrentEditId())
				return s.objectState.getCurrentEditId();
			}else{
				return -1;//until we've got the ids, we're just not ready at all
			}
		},
		key: key,
		isType: true,
		descend: function(path, editId, cb, continueListening){
			_.assertFunction(cb)
			//_.assertInt(path[0])
			//_.assertInt(path[1])
			//console.log('path: ' + JSON.stringify(path))
			_.assertArray(path)
			if(!s.objectState.isTopLevelObject(path[0].edit.id)) return false
			s.objectState.streamProperty(path, editId, cb, continueListening)
			return true
		},
		descendTypes: function(path, editId, cb, continueListening){
			if(!s.objectState.isTopLevelObject(path[0].edit.id)) return false
			s.objectState.streamPropertyTypes(path, editId, cb, continueListening)
			return true
		},
		getType: function(v){
			if(!s.objectState.isTopLevelObject(v)) return
			return s.objectState.getObjectType(v)
		}
	}

	s.objectState.getAllIdsOfType(typeCode, function(ids){
		
		idList = [].concat(ids)
		//s.log('TYPE got all ids', ids)
		//console.log('TYPE(' + typeCode + ') got all ids', ids)
		
		function listenCreated(typeCode, id, editId){
			idList.push(id)
			//console.log('type emitting created: ' + typeCode + ' ' + id + ' ' + editId)
			
			listeners.emitAdd(id, editId)
		}
		function listenDeleted(typeCode, id, editId){
			//console.log('got deleted: ' + id)
			idList.splice(idList.indexOf(id), 1)
			listeners.emitRemove(id, editId)
		}
		
		s.getAllSubtypes(typeCode).forEach(function(objSchema){
			//console.log('listening for new')
			s.broadcaster.listenForNew(objSchema.code, listenCreated)
			s.broadcaster.listenForDeleted(objSchema.code, listenDeleted)
		})		
		
		var currentEditId = handle.oldest()

		idList.forEach(function(id){
			_.assert(!s.objectState.isDeleted(id))
			listeners.emitAdd(id, currentEditId)
		})
	})
	
	return cache.store(key, handle)
}

