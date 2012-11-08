//"use strict";

var fparse = require('fparse')


var fs = require('fs')

var _ = require('underscorem')

var keratin = require('keratin')

var reservedTypeNames = ['type']

var editSchemaStr = fs.readFileSync(__dirname + '/edits.baleen', 'utf8')
var editSchema = keratin.parse(editSchemaStr, reservedTypeNames)
var clientSchemaStr = fs.readFileSync(__dirname + '/client.baleen', 'utf8')
var clientSchema = keratin.parse(clientSchemaStr, reservedTypeNames)
var responsesSchemaStr = fs.readFileSync(__dirname + '/responses.baleen', 'utf8')
var responsesSchema = keratin.parse(responsesSchemaStr, reservedTypeNames)

var fparse = require('fparse')

var editFp = fparse.makeFromSchema(editSchema)

var log = require('quicklog').make('minnow/tcp_shared')

exports.clientSchema = clientSchema
exports.responsesSchema = responsesSchema
exports.editSchema = editSchema
exports.editFp = editFp

exports.clientRequests = fparse.makeFromSchema(clientSchema)
exports.serverResponses = fparse.makeFromSchema(responsesSchema)

var lookup = require('./../http/js/lookup')

Object.keys(lookup).forEach(function(key){
	editFp[key] = lookup[key]
})
/*
var isKeyCode = {}
isKeyCode[editFp.codes.selectStringKey] = true
isKeyCode[editFp.codes.reselectStringKey] = true
isKeyCode[editFp.codes.selectIntKey] = true
isKeyCode[editFp.codes.reselectIntKey] = true
isKeyCode[editFp.codes.selectLongKey] = true
isKeyCode[editFp.codes.reselectLongKey] = true
isKeyCode[editFp.codes.selectBooleanKey] = true
isKeyCode[editFp.codes.reselectBooleanKey] = true
isKeyCode[editFp.codes.selectObjectKey] = true
isKeyCode[editFp.codes.reselectObjectKey] = true
editFp.isKeyCode = isKeyCode

var isKeySelectCode = {}
isKeySelectCode[editFp.codes.selectStringKey] = true
isKeySelectCode[editFp.codes.selectIntKey] = true
isKeySelectCode[editFp.codes.selectLongKey] = true
isKeySelectCode[editFp.codes.selectBooleanKey] = true
isKeySelectCode[editFp.codes.selectObjectKey] = true
editFp.isKeySelectCode = isKeySelectCode

var isKeyReselectCode = {}
Object.keys(isKeyCode).forEach(function(key){
	if(!isKeySelectCode[key]){
		isKeyReselectCode[key] = true
	}
})
editFp.isKeyReselectCode = isKeyReselectCode

var isPrimitiveSetCode = {}
isPrimitiveSetCode[editFp.codes.setString] = true
isPrimitiveSetCode[editFp.codes.setLong] = true
isPrimitiveSetCode[editFp.codes.setInt] = true
isPrimitiveSetCode[editFp.codes.setBoolean] = true
isPrimitiveSetCode[editFp.codes.setReal] = true
editFp.isPrimitiveSetCode = isPrimitiveSetCode

var isSetCode = {}
isSetCode[editFp.codes.setString] = true
isSetCode[editFp.codes.setLong] = true
isSetCode[editFp.codes.setInt] = true
isSetCode[editFp.codes.setBoolean] = true
isSetCode[editFp.codes.setReal] = true
isSetCode[editFp.codes.setObject] = true
editFp.isSetCode = isSetCode

var isPrimitiveAddCode = {}
isPrimitiveAddCode[editFp.codes.addString] = true
isPrimitiveAddCode[editFp.codes.addLong] = true
isPrimitiveAddCode[editFp.codes.addInt] = true
isPrimitiveAddCode[editFp.codes.addBoolean] = true
isPrimitiveAddCode[editFp.codes.addReal] = true
editFp.isPrimitiveAddCode = isPrimitiveAddCode

var isAddCode = {}
isAddCode[editFp.codes.addString] = true
isAddCode[editFp.codes.addLong] = true
isAddCode[editFp.codes.addInt] = true
isAddCode[editFp.codes.addBoolean] = true
isAddCode[editFp.codes.addReal] = true
isAddCode[editFp.codes.addExisting] = true
isAddCode[editFp.codes.addedNew] = true
editFp.isAddCode = isAddCode

var isRemoveCode = {}
isRemoveCode[editFp.codes.removeString] = true
isRemoveCode[editFp.codes.removeLong] = true
isRemoveCode[editFp.codes.removeInt] = true
isRemoveCode[editFp.codes.removeBoolean] = true
isRemoveCode[editFp.codes.removeReal] = true
isRemoveCode[editFp.codes.remove] = true
editFp.isRemoveCode = isRemoveCode

var isPrimitiveRemoveCode = {}
isPrimitiveRemoveCode[editFp.codes.removeString] = true
isPrimitiveRemoveCode[editFp.codes.removeLong] = true
isPrimitiveRemoveCode[editFp.codes.removeInt] = true
isPrimitiveRemoveCode[editFp.codes.removeBoolean] = true
isPrimitiveRemoveCode[editFp.codes.removeReal] = true
editFp.isPrimitiveRemoveCode = isPrimitiveRemoveCode

var isPutCode = {}
isPutCode[editFp.codes.putString] = true
isPutCode[editFp.codes.putLong] = true
isPutCode[editFp.codes.putInt] = true
isPutCode[editFp.codes.putBoolean] = true
isPutCode[editFp.codes.putReal] = true
isPutCode[editFp.codes.didPutNew] = true
editFp.isPutCode = isPutCode

var flipType = {}
flipType[editFp.codes.selectObject] = editFp.codes.reselectObject
flipType[editFp.codes.selectProperty] = editFp.codes.reselectProperty
flipType[editFp.codes.reselectObject] = editFp.codes.selectObject
flipType[editFp.codes.reselectProperty] = editFp.codes.selectProperty

flipType[editFp.codes.selectStringKey] = editFp.codes.reselectStringKey
flipType[editFp.codes.selectIntKey] = editFp.codes.reselectIntKey
flipType[editFp.codes.selectLongKey] = editFp.codes.reselectLongKey
flipType[editFp.codes.selectBooleanKey] = editFp.codes.reselectBooleanKey
flipType[editFp.codes.selectObjectKey] = editFp.codes.reselectObjectKey

flipType[editFp.codes.reselectStringKey] = editFp.codes.selectStringKey
flipType[editFp.codes.reselectIntKey] = editFp.codes.selectIntKey
flipType[editFp.codes.reselectLongKey] = editFp.codes.selectLongKey
flipType[editFp.codes.reselectBooleanKey] = editFp.codes.selectBooleanKey
flipType[editFp.codes.reselectObjectKey] = editFp.codes.selectObjectKey

editFp.flipType = flipType
*/
/*
function findDifferenceIndex(cp, p){
	var m = Math.min(cp.length, p.length)
	for(var i=0;i<m;++i){
		if(cp[i] !== p[i]) return i
	}
	return i
}

function primitiveMapNextFunction(reselect, key, sendUpdate){
	_.errout('cannot descend into primitive map value')
}

function makeKeySelect(keyOp, isObject){
	function keySelector(reselect, key, sendUpdate){
		//console.log('sending key update')
		sendUpdate((reselect?'reselect':'select')+keyOp, {key: key})
		function f(reselect, key, sendUpdate){
			primitiveMapNextFunction(reselect, key, sendUpdate)
		}
		f.isKeyAnObject = isObject
		return f
	}
	keySelector.type = 'key'
	return keySelector
}
function makePropertyReactor(schema, objSchema, propertyCode, translateTemporary){
	var propertySchema = objSchema.propertiesByCode[propertyCode]
	if(propertySchema === undefined) _.errout('internal error: ' + propertyCode + ' (' + objSchema.name + ')')
	_.assertDefined(propertySchema)
	//console.log('propertySchema(' + propertyCode + '): ' + JSON.stringify(propertySchema))
	if((propertySchema.type.type === 'list' || propertySchema.type.type === 'set') && propertySchema.type.members.type === 'object'){
		
		var nextFunction = makeObjectReactor(schema, schema[propertySchema.type.members.object].code)
		function objectCollectionSelector(reselect, id, sendUpdate){
			//console.log('id: ' + id)
			_.assert(id > 0)
			//if(id < 0) id = translateTemporary(id)
			sendUpdate(reselect?'reselectObject':'selectObject', {id: id})
			return nextFunction
		}
		objectCollectionSelector.type = 'object'
		return objectCollectionSelector
	}else if(propertySchema.type.type === 'object'){

		//console.log('object: ' + propertySchema.type.object)
		var nextFunction = makeObjectReactor(schema, schema[propertySchema.type.object].code)
		function objectPropertySelector(reselect, id, sendUpdate){
			_.assert(id > 0)
			//if(id < 0) id = translateTemporary(id)
			sendUpdate(reselect?'reselectObject':'selectObject', {id: id})
			return nextFunction			
		}
		objectPropertySelector.type = 'object'
		return objectPropertySelector
	}else if(propertySchema.type.type === 'map'){
		if(propertySchema.type.value.type === 'object'){
			//var nextFunction = makeObjectReactor(schema, schema[propertySchema.type.object].code)
			_.errout('TODO')
		}else{
			var keyOp
			var p = propertySchema.type.key.primitive
			
			var isObject = false
			
			if(p === 'string'){
				keyOp = 'String'
			}else if(p === 'int'){
				keyOp = 'Int'
			}else if(p === 'long'){
				keyOp = 'Long'
			}else if(p === 'boolean'){
				keyOp = 'Boolean'
			}else if(p === 'real'){
				keyOp = 'Real'
			}else if(propertySchema.type.key.type === 'object'){
				keyOp = 'Int'
				isObject = true
			}else{
				_.errout('TODO: ' + JSON.stringify(propertySchema.type))
			}
			keyOp += 'Key'

			var selectKey = makeKeySelect(keyOp, isObject)
			
			return selectKey
		}
	}else{
		return function(){
			_.errout('cannot descend into primitive property or collection')
		}
	}
}
function makeObjectReactor(schema, typeCode, translateTemporary){
	//console.log('typeCode: ' + typeCode)
	var objSchema = schema._byCode[typeCode]
	function propertySelector(reselect, propertyCode, sendUpdate){
		var propertySchema = objSchema.propertiesByCode[propertyCode]
		_.assert(propertyCode > 0)
		sendUpdate(reselect?'reselectProperty':'selectProperty', {typeCode: propertyCode})
		return makePropertyReactor(schema, objSchema, propertyCode, translateTemporary)
	}
	propertySelector.type = 'property'
	return propertySelector
}*/
/*
//TODO make this schema-based
exports.makePathStateUpdater = function(schema, typeCode, translateTemporary){
	//_.assertLength(arguments, 2)
	_.errout('DEPRECATED')
	
	_.assertInt(typeCode)

	var currentResponsePath = []
	var isNew = true
	
	var reactorStack = [makeObjectReactor(schema, typeCode, translateTemporary)]
	
	function topSelector(path, sendUpdate){
	
		var difIndex = 0
		log(JSON.stringify(currentResponsePath) + ' -> ' + JSON.stringify(path))
		
		var reselect = false
		if(isNew){
			sendUpdate('reset', {})
			isNew = false
		}else{
			difIndex = findDifferenceIndex(currentResponsePath, path)
			var dist = currentResponsePath.length - difIndex
			if(dist > 0){
				//if the dist is only 1 and the path is just as long as the current, we can
				//use a reselect op
				if(dist === 1 && path.length >= currentResponsePath.length){
					reselect = true
				}else{
					if(dist === 1){
						//console.log('dist-sourced ascend1')
						sendUpdate('ascend1', {})
					}else if(dist === 2){
						sendUpdate('ascend2', {})
					}else if(dist === 3){
						sendUpdate('ascend3', {})
					}else if(dist === 4){
						sendUpdate('ascend4', {})
					}else if(dist === 5){
						sendUpdate('ascend5', {})
					}else{
						sendUpdate('ascend', {many: dist})
					}
				}
			}
		}
		reactorStack = reactorStack.slice(0, difIndex+1)
		
		currentResponsePath = currentResponsePath.slice(0, difIndex)
		
		var r = reactorStack[reactorStack.length-1]
		for(var i=difIndex;i<path.length;++i){
			var p = path[i]
			console.log('descending: ' + p)
			if(_.isInt(p) && p < 0){
				if(p === -1) _.errout('bad path: ' + JSON.stringify(path))
				p = translateTemporary(p)
				_.assertEqual(r.type, 'object')
			}
			currentResponsePath.push(p)
			r = r(reselect, p, sendUpdate)
			reselect = false
			reactorStack.push(r)
		}
		//currentResponsePath = path
	}
	topSelector.getCurrentPath = function(){return [].concat(currentResponsePath);}
	topSelector.isKeyAnObject = function(){
		return reactorStack[reactorStack.length-1].isKeyAnObject
	}
	topSelector.getKey = function(){
		return currentResponsePath[currentResponsePath.length-1];
	}
	topSelector.type = 'top'
	return topSelector
}*/
