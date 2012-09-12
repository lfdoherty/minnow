"use strict";

var _ = require('underscorem')

var Cache = require('./../variable_cache')
var listenerSet = require('./../variable_listeners')

var schema = require('./../../shared/schema')

function typeType(rel){
	return {type: 'primitive', primitive: 'string'}//type: 'object', object: rel.params[0].schemaType.value}
}
schema.addFunction('type', {
	schemaType: typeType,
	implementation: maker,
	minParams: 1,
	maxParams: 1,
	callSyntax: 'type(object)'
})


function maker(s, self, rel, typeBindings){
	var elementGetter = self(rel.params[0], typeBindings)
	var cache = new Cache()
	var f = svgGeneral.bind(undefined, s, cache, elementGetter)
	return f
}

function svgGeneral(s, cache, elementGetter, bindings, editId){

	var element = elementGetter(bindings, editId)
	if(!_.isFunction(element.getType))_.errout('no getType: ' + element.name)
	_.assertFunction(element.getType)
	
	var key = element.key
	if(cache.has(key)) return cache.get(key)
	
	var listeners = listenerSet()
	
	var handle = {
		name: 'type',
		attach: function(listener, editId){
			listeners.add(listener)
			_.assertInt(editId)
			if(oldName !== undefined){
				listener.set(oldName, undefined, editId)
			}
		},
		detach: function(listener, editId){
			listeners.remove(listener)
			if(editId){
				if(oldName !== undefined){
					listener.set(undefined, oldName, editId)
				}
			}
		},
		oldest: oldest,
		key: key
	}
	
	//var ongoingEditId;
	function oldest(){
		var oldestEditId = element.oldest()
		//console.log('p(' + propertyCode + ') oldest ' + oldestEditId + ' ' + ongoingEditId)
		//if(ongoingEditId !== undefined) return Math.min(oldestEditId, ongoingEditId)
		//else 
		return oldestEditId
	}
	
	var oldName;
	element.attach({
		set: function(v, oldV, editId){
			if(v !== undefined){
				var typeCode = element.getType(v)
				
				var name = s.schema._byCode[typeCode].name;
				if(name !== oldName){
					listeners.emitSet(name, oldName, editId)
					oldName = name
				}
				/*
				//ongoingEditId = editId
				var typeCode = s.objectState.getObjectType(v)

				*/
			}
		}
	}, editId)
	return cache.store(key, handle)
}

