"use strict";

var fs = require('fs')

var _ = require('underscorem')

var keratin = require('keratin')
var baleen = require('baleen')

var editSchemaStr = fs.readFileSync(__dirname + '/edits.baleen', 'utf8')
var editSchema = keratin.parse(editSchemaStr, baleen.reservedTypeNames)
var clientSchemaStr = fs.readFileSync(__dirname + '/client.baleen', 'utf8')
var clientSchema = keratin.parse(clientSchemaStr, baleen.reservedTypeNames)
var responsesSchemaStr = fs.readFileSync(__dirname + '/responses.baleen', 'utf8')
var responsesSchema = keratin.parse(responsesSchemaStr, baleen.reservedTypeNames)

function makeExes(appSchema){

	//var appEx = baleen.makeFromSchema(appSchema, undefined, true, true);
	var editEx = baleen.makeFromSchema(editSchema);
	var clientEx = baleen.makeFromSchema(clientSchema, editEx);
	var responsesEx = baleen.makeFromSchema(responsesSchema, editEx);
	
	//console.log('clientEx: ' + clientSchemaStr)
	return {
		//app: appEx,
		edit: editEx,
		client: clientEx,
		responses: responsesEx,
		editSchema: editSchema
	}
}
exports.editSchema = editSchema
exports.makeExes = makeExes;

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
	return function(reselect, key, sendUpdate){
		//console.log('sending key update')
		sendUpdate((reselect?'reselect':'select')+keyOp, {key: key})
		function f(reselect, key, sendUpdate){
			primitiveMapNextFunction(reselect, key, sendUpdate)
		}
		f.isKeyAnObject = isObject
		return f
	}
}
function makePropertyReactor(schema, objSchema, propertyCode, translateTemporary){
	var propertySchema = objSchema.propertiesByCode[propertyCode]
	if((propertySchema.type.type === 'list' || propertySchema.type.type === 'set') && propertySchema.type.members.type === 'object'){
		
		var nextFunction = makeObjectReactor(schema, schema[propertySchema.type.members.object].code)
		return function(reselect, id, sendUpdate){
			console.log('id: ' + id)
			_.assert(id > 0)
			//if(id < 0) id = translateTemporary(id)
			sendUpdate(reselect?'reselectObject':'selectObject', {id: id})
			return nextFunction
		}
	}else if(propertySchema.type.type === 'object'){

		console.log('object: ' + propertySchema.type.object)
		var nextFunction = makeObjectReactor(schema, schema[propertySchema.type.object].code)
		return function(reselect, id, sendUpdate){
			_.assert(id > 0)
			//if(id < 0) id = translateTemporary(id)
			sendUpdate(reselect?'reselectObject':'selectObject', {id: id})
			return nextFunction			
		}
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
	console.log('typeCode: ' + typeCode)
	var objSchema = schema._byCode[typeCode]
	return function(reselect, propertyCode, sendUpdate){
		var propertySchema = objSchema.propertiesByCode[propertyCode]
		_.assert(propertyCode > 0)
		sendUpdate(reselect?'reselectProperty':'selectProperty', {typeCode: propertyCode})
		return makePropertyReactor(schema, objSchema, propertyCode, translateTemporary)
	}
}

//TODO make this schema-based
exports.makePathStateUpdater = function(schema, typeCode, translateTemporary){
	//_.assertLength(arguments, 2)
	_.assertInt(typeCode)

	var currentResponsePath = []
	var isNew = true
	
	var reactorStack = [makeObjectReactor(schema, typeCode, translateTemporary)]
	
	function f(path, sendUpdate){
	
		var difIndex = 0
		console.log(JSON.stringify(currentResponsePath) + ' -> ' + JSON.stringify(path))
		
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
						console.log('dist-sourced ascend1')
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
			if(_.isInt(p) && p < 0){
				p = translateTemporary(p)
			}
			currentResponsePath.push(p)
			r = r(reselect, p, sendUpdate)
			reselect = false
			reactorStack.push(r)
		}
		//currentResponsePath = path
	}
	f.getCurrentPath = function(){return [].concat(currentResponsePath);}
	f.isKeyAnObject = function(){
		return reactorStack[reactorStack.length-1].isKeyAnObject
	}
	f.getKey = function(){
		return currentResponsePath[currentResponsePath.length-1];
	}
	return f
}
