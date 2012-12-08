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

function stub(){}

function maker(s, self, rel, typeBindings){
	var elementGetter = self(rel.params[0], typeBindings)
	var cache = new Cache(s.analytics)
	var f = svgGeneral.bind(undefined, s, cache, elementGetter)
	return f
}

function fixedType(s, element, cache){

	var type = s.objectState.getObjectType(element.getObjectId())
	var typeName = s.schema._byCode[type].name

	var key = 'ft'+type
	if(cache.has(key)) return cache.get(key)

	
	var handle = {
		name: 'type[fixed]',
		attach: function(listener, editId){
			listener.set(typeName, undefined, editId)
		},
		detach: function(listener, editId){
			if(editId){
				listener.set(undefined, typeName, editId)
			}
		},
		oldest: s.objectState.getCurrentEditId,
		key: key,
		isConstant: true,
		get: function(){
			return typeName
		}
	}
	
	return cache.store(key, handle)
}

function svgGeneral(s, cache, elementGetter, bindings, editId){

	var element = elementGetter(bindings, editId)
	//if(!_.isFunction(element.getType))_.errout('no getType: ' + element.name)
	//_.assertFunction(element.getType)
	
	if(element.name.indexOf('object-fixed (') === 0){
		return fixedType(s, element, cache)
	}
	
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
		oldest: element.oldest,
		key: key
	}
	
	//var ongoingEditId;
	/*function oldest(){
		var oldestEditId = element.oldest()
		//console.log('p(' + propertyCode + ') oldest ' + oldestEditId + ' ' + ongoingEditId)
		//if(ongoingEditId !== undefined) return Math.min(oldestEditId, ongoingEditId)
		//else 
		return oldestEditId
	}*/
	
	var oldName;
	element.attach({
		set: function(v, oldV, editId){
			if(v !== undefined){
				var typeCode = s.objectState.getObjectType(v)
				
				var name = s.schema._byCode[typeCode].name;
				if(name !== oldName){
					//console.log('type of ' + v + ' is ' + name)
					listeners.emitSet(name, oldName, editId)
					oldName = name
				}
				/*
				//ongoingEditId = editId
				var typeCode = s.objectState.getObjectType(v)

				*/
			}
		},
		includeView: stub,
		removeView: stub
	}, editId)
	return cache.store(key, handle)
}

