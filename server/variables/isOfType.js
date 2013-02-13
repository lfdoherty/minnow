"use strict";

var _ = require('underscorem')

//var Cache = require('./../variable_cache')
var listenerSet = require('./../variable_listeners')

var schema = require('./../../shared/schema')

function typeType(rel){
	return {type: 'primitive', primitive: 'boolean'}
}
schema.addFunction('isOfType', {
	schemaType: typeType,
	implementation: maker,
	minParams: 2,
	maxParams: 2,
	callSyntax: 'isOfType(object,string)'
})

function stub(){}

function maker(s, self, rel, typeBindings){
	var objGetter = self(rel.params[0], typeBindings)
	var typeNameGetter = self(rel.params[1], typeBindings)
	var cache = s.makeCache()//new Cache(s.analytics)
	var f = svgGeneral.bind(undefined, s, cache, typeNameGetter, objGetter)
	return f

}

function fixedIsOfType(s, obj, typeName, cache){

	var type = s.schema._byCode[s.objectState.getObjectType(obj.getObjectId())]
	var desiredType = s.schema[typeName.get()]

	_.assertObject(type)
	_.assertObject(desiredType)
	
	var isType = type === desiredType || (type.superTypes && type.superTypes[desiredType.name])//typeCode === desiredTypeCode

	var key = 'ft'+isType
	if(cache.has(key)) return cache.get(key)

	var handle = {
		name: 'isOfType[fixed]',
		attach: function(listener, editId){
			if(isType){
				listener.set(isType, undefined, editId)
			}
		},
		detach: function(listener, editId){
			if(editId && isType){
				listener.set(undefined, isType, editId)
			}
		},
		oldest: s.objectState.getCurrentEditId,
		key: key,
		isConstant: true,
		get: function(){
			return !!isType
		}
	}
	
	return cache.store(key, handle)
}


function svgGeneral(s, cache, typeNameGetter, objGetter, bindings, editId){

	var obj = objGetter(bindings, editId)
	var typeName = typeNameGetter(bindings, editId)
	
	//console.log('NAMES: ' + obj.name + ' ' + typeName.name)
	
	if(obj.name.indexOf('object-fixed (') === 0 && typeName.name.indexOf('primitive') === 0){
		return fixedIsOfType(s, obj, typeName, cache)
	}
	
	//if(!_.isFunction(obj.getType))_.errout('no getType: ' + obj.name)
	//_.assertFunction(element.getType)
	
	var key = typeName.key+':'+obj.key
	if(cache.has(key)) return cache.get(key)
	
	var listeners = listenerSet()
	
	var name;
	var objId
	
	var result = false
	
	function recomputeResult(editId){
		var old = result
		
		if(_.isString(name) && objId){
			var typeCode = s.objectState.getObjectType(objId)
			if(typeCode === undefined) _.errout('got no type: ' + typeCode)
			if(typeCode === false) _.errout('invalid result: ' + obj.getType)
			_.assertInt(typeCode)
			
			var objSchema = s.schema._byCode[typeCode]
			if(objSchema === undefined) _.errout('cannot find for type: ' + typeCode)
			result = objSchema.name === name || (objSchema.superTypes && objSchema.superTypes[name])
			//console.log('isOfType("'+name+'", '+objId+') -> ' + result)
		}else{
			//console.log('isOfType('+name+','+objId+') -> cannot run')
			result = false
		}
		
		if(old !== result){
			listeners.emitSet(result, old, editId)
		}
	}
	
	var handle = {
		name: 'isOfType',
		attach: function(listener, editId){
			listeners.add(listener)
			_.assertInt(editId)
			if(result){
				listener.set(true, undefined, editId)
			}
		},
		detach: function(listener, editId){
			listeners.remove(listener)
			if(editId){
				if(result){
					listener.set(undefined, true, editId)
				}
			}
		},
		oldest: oldest,
		key: key
	}
	
	function oldest(){
		var a = typeName.oldest()
		var b = obj.oldest()
		return a < b ? a : b
	}
	
	
	typeName.attach({
		set: function(v, oldV, editId){
			if(v !== undefined){
				_.assertString(v)
			}
			name = v
			recomputeResult()
		},
		includeView: stub,
		removeView: stub
	}, editId)
	
	obj.attach({
		set: function(v, oldV, editId){
			if(v !== undefined){
				_.assertInt(v)
			}
			objId = v
			recomputeResult()
		},
		includeView: function(){_.errout('TODO?');},
		removeView: function(){_.errout('TODO?');}
	}, editId)
	
	return cache.store(key, handle)
}

