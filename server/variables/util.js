"use strict";

/*
TODO standardize edit names (e.g. remove, addExisting)
*/

var _ = require('underscorem')

var editFp = require('./../tcp_shared').editFp
var editCodes = editFp.codes
var editNames = editFp.names


var typeSuffix = {
	int: 'Int',
	long: 'Long',
	string: 'String',
	boolean: 'Boolean',
	real: 'Real',
	timestamp: 'Long'
}

exports.setOp = function(t){
	if(t.type === 'primitive'){
		var ts = typeSuffix[t.primitive]
		if(ts === undefined) _.errout('TODO: ' + t.primitive)
		return editCodes['set'+ts]
	}else{
		return editCodes.setObject
	}
}

exports.putOp = function(t){
	if(t.value.type === 'primitive'){
		var ts = typeSuffix[t.value.primitive]
		if(ts === undefined) _.errout('TODO: ' + t.value.primitive)
		return editCodes['put'+ts]
	}else{
		if(t.value.type === 'view'){
			return editCodes.putViewObject
		}else{
			return editCodes.putExisting
		}
	}
}

exports.putAddOp = function(t){
	_.assertDefined(t.value.members.primitive)
	var ts = typeSuffix[t.value.members.primitive]
	return editCodes['putAdd'+ts]
}
exports.putRemoveOp = function(t){
	_.assertDefined(t.value.members.primitive)
	var ts = typeSuffix[t.value.members.primitive]
	return editCodes['putRemove'+ts]
}
exports.selectKeyOp = function(t){
	var ts
	if(t.key.primitive) ts = typeSuffix[t.key.primitive]
	else if(t.key.type === 'object') ts = 'Object'
	else ts = 'ViewObject'
	var res = editCodes['select'+ts+'Key']
	if(res === undefined) _.errout('cannot compute key select op for type: ' + JSON.stringify(t))
	return res
}

exports.addOp = function(t){
	if(t.members.type === 'primitive'){
		var ts = typeSuffix[t.members.primitive]
		if(ts === undefined) _.errout('TODO: ' + t.members.primitive)
		return editCodes['add'+ts]
	}else{
		return editCodes.addExisting
	}
}
exports.removeOp = function(t){
	if(t.members.type === 'primitive'){
		var ts = typeSuffix[t.members.primitive]
		if(ts === undefined) _.errout('TODO: ' + t.members.primitive)
		return editCodes['remove'+ts]
	}else{
		return editCodes.remove
	}
}

exports.computeSharedObjectType = function(schema, objectNames){
	_.assert(objectNames.length > 0)
	
	if(objectNames.length === 1){
		return objectNames[0]
	}else{
		var currentBase = objectNames[0]
		var curSchema = schema[currentBase]
		
		if(curSchema === undefined) _.errout('cannot find object type named: ' + currentBase)
		_.assertDefined(curSchema)
		
		objectNames.slice(1).forEach(function(n){
			if(!curSchema) return
			
			var s = schema[n]
			_.assertDefined(s)
			if(currentBase === n) return
			if(s.superTypes && s.superTypes[currentBase]) return
			if(curSchema.superTypes && curSchema.superTypes[n]){
				currentBase = n
				curSchema = s
				if(!curSchema) _.errout('unknown: ' + n)
				return
			}
			
			if(curSchema.superTypes && s.superTypes){
				var found = false
				Object.keys(curSchema.superTypes).forEach(function(st){
					if(st === 'uuided') return
					if(s.superTypes[st]){
						currentBase = st
						curSchema = schema[currentBase]
						if(!curSchema) _.errout('unknown base: ' + currentBase)
						found = true
					}
				})
				//TODO descend to more specific subtype if possible
				if(found) return
			}
			
			currentBase = 'object'
			curSchema = undefined
			
			//console.log(JSON.stringify(curSchema))
			//console.log(JSON.stringify(s))
			//_.errout('cannot find shared supertype for: ' + currentBase + ' and ' + n)
		})
		return currentBase
	}
}
