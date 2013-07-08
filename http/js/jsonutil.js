"use strict";

/*

Some utility functions used by sync_api.js

TODO support inner objects
*/

exports.convertJsonToEdits = convertJsonToEdits;
var _ = require('underscorem')
var random = require('seedrandom')

var lookup = require('./lookup')
var editCodes = lookup.codes
var editNames = lookup.names

function valueOrId(value){
	if(value.__id){//if it is a handle to an externalized object (static or sync), reference by ID
		return value.__id;
	}else if(value.objectId){
		_.assertInt(value.objectId)
		return value.objectId
	}else{
		_.assertPrimitive(value)
		return value;
	}
}
function assertPrimitiveType(v,pt,name,p){
	_.assertString(name)
	
	if(pt === 'string'){ 
		if(!_.isString(v)){
			_.errout('wrong type for ' +name + ' (should be string): '+typeof(v) + ' (' + v + ')');
		}
	}
	else if(pt === 'int'){
		if(!_.isInteger(v)){
			_.errout('wrong type for ' +name + ' (should be int): '+typeof(v) + ' (' + v + ')');
		}
	}
}
var typeSuffix = {
	int: 'Int',
	long: 'Long',
	boolean: 'Boolean',
	string: 'String'
}
var mapSelect = {
	int: 'selectIntKey',
	long: 'selectLongKey',
	boolean: 'selectBooleanKey',
	string: 'selectStringKey'
}
var mapReselect = {
	int: 'reselectIntKey',
	long: 'reselectLongKey',
	boolean: 'reselectBooleanKey',
	string: 'reselectStringKey'
}
var mapPut = {
	int: 'putInt',
	long: 'putLong',
	boolean: 'putBoolean',
	string: 'putString'
}
var setOp = {
	int: 'setInt',
	long: 'setLong',
	boolean: 'setBoolean',
	string: 'setString',
	real: 'setReal'
}
function getTypeSuffix(primitive){
	var ts = typeSuffix[primitive]
	if(ts === undefined) _.errout('TODO: ' + primitive)
	return ts
}
function primitiveCast(value, type){
	if(type === 'int') return parseInt(value)
	if(type === 'string') return value+''
	if(type === 'boolean') return !!type
	if(type === 'real') return Number(value)
	if(type === 'long') return Number(value)
	_.errout('TODO: ' + JSON.stringify(type))
}

//var jsonConverters = {}

function convertJsonToEdits(dbSchema, type, json, makeTemporaryId, topTemporaryId){
	//_.assertInt(topTemporaryId)
	if(dbSchema.jsonConverters === undefined){
		dbSchema.jsonConverters = {}
	}
	var converter = dbSchema.jsonConverters[type]
	if(converter === undefined){
		converter = dbSchema.jsonConverters[type] = generateJsonConverter(dbSchema, type)
	}
	//console.log(JSON.stringify(json))
	return converter(json, makeTemporaryId, topTemporaryId)
}

function generatePropertyConverter(p, dbSchema){

	var converter
	
	if(p.type.type === 'primitive'){
		var primitiveSetOp = editCodes[setOp[p.type.primitive]]
		if(primitiveSetOp === undefined) _.errout('TODO: ' + p.type.primitive)
		converter = function(v, makeTemporaryId, edits){
			_.assertDefined(v)
			assertPrimitiveType(v,p.type.primitive, p.name,p);
			if(p.type.primitive === 'real'){
				value = value+''
			}
			edits.push({op: primitiveSetOp,  edit: {value: v}})
		}
	}else if(p.type.type === 'map'){
		
		if(p.type.key.type === 'primitive' && p.type.value.type === 'primitive'){
			if(!mapSelect[p.type.key.primitive]) _.errout('do not know what selector edit to use: ' +p.type.key.primitive)
			var select = editCodes[mapSelect[p.type.key.primitive]]
			_.assertInt(select)
			//var reselect = editCodes[mapReselect[p.type.key]]
			var putOp = editCodes[mapPut[p.type.key.primitive]]
			_.assertInt(putOp)
			var keyType = p.type.key
			converter = function(pv, makeTemporaryId, edits){
				var keys = Object.keys(pv)
				if(keys.length > 0){
					var next = select
					keys.forEach(function(key){
						var value = pv[key]
						if(value != undefined){
							edits.push({op: next, edit: {key: primitiveCast(key,keyType.primitive)}})
							edits.push({op: putOp, edit: {value: value}})
							//next = reselect
						}
					});
					//edits.push({op: editCodes.ascend1, edit: {}})
				}
			}
		}else{
			converter = function(pv, makeTemporaryId, edits){
				_.errout('TODO: ' + JSON.stringify(p))
			}
		}
	}else if(p.type.type === 'set'){
		if(p.type.members.type === 'primitive'){
		
			var primitiveType = p.type.members.primitive
			var ts = getTypeSuffix(p.type.members.primitive)
			var addOp = editCodes['add'+ts]
			converter = function(pv, makeTemporaryId, edits){

				pv.forEach(function(v){
					//var v = va//valueOrId(value);
					assertPrimitiveType(v,primitiveType,p.name,p);
					edits.push({op: addOp, edit: {value: v}})
				});
			}
		}else{
			converter = function(pv, makeTemporaryId, edits){
				pv.forEach(function(value){
					if(value === undefined) _.errout('invalid json set: ' + JSON.stringify(pv))//_.assertDefined(value)
					if(_.isInt(value) || _.isInt(value.objectId)){
						edits.push({op: editCodes.addExisting, edit: {id: valueOrId(value)}})
					}else{
						_.errout('TODO')
					}
				});
			}
		}
	}else if(p.type.type === 'list'){
		if(p.type.members.type === 'primitive'){

			var primitiveType = p.type.members.primitive
			var ts = getTypeSuffix(p.type.members.primitive)
			var addOp = editCodes['add'+ts]
			
			converter = function(pv, makeTemporaryId, edits){
				pv.forEach(function(v){
					if(v === undefined) _.errout('invalid data for property ' + p.name + ': ' + JSON.stringify(pv));
					assertPrimitiveType(v,primitiveType,p.name, p);
					edits.push({op: addOp, edit: {value: v}})
				});
			}
		}else{
			converter = function(pv, makeTemporaryId, edits, parentId, topObjectId){
				_.assertInt(parentId)
				_.assertInt(topObjectId)
				var lastWasNew = false
				pv.forEach(function(value){

					if(lastWasNew){
						//edits.push({op: editCodes.selectObject, edit: {id: parentId}})
						edits.push({op: editCodes.selectProperty, edit: {typeCode: p.code}})
					}
					
					if(_.isInt(value) || _.isInt(value.objectId)){
						edits.push({op: editCodes.addExisting, edit: {id: valueOrId(value)}})
					}else{
						lastWasNew = true
						//_.assertString(value.type)
						//_.errout('TODO addNew')
						if(value.type === undefined) _.errout('no type defined: ' + JSON.stringify(value))
						var objSchema = dbSchema[value.type]
						if(objSchema === undefined) _.errout('cannot find type: ' + value.type)
						var temporary = makeTemporaryId();

						//edits.push({op: editCodes.selectObject, edit: {id: parentId}})
						//if(parentId === topObjectId) edits.push({op: editCodes.clearObject, edit: {here: 'yes'}})
						//else 
						

						var moreEdits = convertJsonToEdits(dbSchema, value.type, value, makeTemporaryId, temporary, topObjectId)
						edits.push({op: editCodes.addNew, edit: {typeCode: objSchema.code, temporary: temporary, following: moreEdits.length}})

						if(moreEdits.length > 0){
							edits.push({op: editCodes.selectObject, edit: {id: temporary}})

							//console.log('moreEdits: ' + JSON.stringify(moreEdits))
							//edits = edits.concat(moreEdits)
							moreEdits.forEach(function(e){
								edits.push(e)
							})
							//edits.push({op: editCodes.ascend1, edit: {}})
							//edits.push({op: editCodes.selectObject, edit: {id: parentId}})
							//if(parentId === topObjectId) edits.push({op: editCodes.clearObject, edit: {}})
							//else 
							edits.push({op: editCodes.selectObject, edit: {id: parentId}})
								//edits.push({op: editCodes.clearObject, edit: {}})
						}
					}
				});
			}
		}
	}else if(p.type.type === 'object'){
		var typeCode = dbSchema[p.type.object].code
		converter = function(pv, makeTemporaryId, edits, parentId, topObjectId){
			if(_.isInteger(pv)){
				if(pv < 0) _.assert(pv < -1)
				//console.log('*using id: ' + pvId)
				edits.push({op: editCodes.setObject, edit: {id: pv}})
			}else{
				if(pv._internalId){
					var pvId = pv._internalId()
					if(pvId < 0) _.assert(pvId < -1)
					//console.log('using id: ' + pvId)
					edits.push({op: editCodes.setObject, edit: {id: pvId}})
				}else{
					var temporary = makeTemporaryId();
					edits.push({op: editCodes.setToNew, edit: {typeCode: typeCode, temporary: temporary}})
					if(Object.keys(pv).length > 0){
						_.errout('TODO: process object properly: ' + JSON.stringify(pv))
					}
					//edits.push({op: editCodes.selectObject, edit: {id: parentId}})
				}
			}
		}
	}else{
		_.errout('TODO: ' + p.type.type + ' (' + name + ')');
	}

	//console.log('pcode: ' + JSON.stringify(p))
	//process.exit(0)
	converter.code = p.code
	converter.propertyName = p.name
	converter.isOptional = (p.tags?!!p.tags.optional:false)||(p.type.primitive === 'boolean'&&(!p.tags||!p.tags.required))
	converter.isOptional = converter.isOptional||p.type.type ==='set'||p.type.type==='list'||p.type.type==='map'
	
	//console.log('conv.name: ' + converter.name)
	
	return converter
}

function generateJsonConverter(dbSchema, type){
	_.assertLength(arguments, 2);
	
	var propertyConverters = []
	
	var t = dbSchema[type];
	if(t === undefined) _.errout('invalid, unknown type: ' + type)
	var allProperties = t.allProperties
	if(allProperties === undefined){
		t.allProperties = allProperties = []
		if(t.properties){
			Object.keys(t.properties).forEach(function(key){
				var p = t.properties[key]
				allProperties.push(p)
			})
		}
	}
	
		
	for(var j=0;j<allProperties.length;++j){
		propertyConverters.push(generatePropertyConverter(allProperties[j], dbSchema))
	}
	
	function converter(json, makeTemporaryId, topTemporaryId){
		_.assertDefined(json)
		
		Object.keys(json).forEach(function(attr){
			if(!t.properties[attr] && attr !== 'type'){
				console.log(JSON.stringify(t))
				_.errout('unprocessable json attribute: ' + attr + '(' + json[attr] + ')');
			}
		});

		var edits = []

		for(var i=0;i<propertyConverters.length;++i){
			var pc = propertyConverters[i]
			var pv = json[pc.propertyName]
			if(pv != undefined && !(_.isArray(pv) && pv.length === 0)){
				edits.push({op: editCodes.selectProperty, edit: {typeCode: pc.code}})
				pc(pv, makeTemporaryId, edits, topTemporaryId, topTemporaryId)
			}else{
				if(!pc.isOptional){
					_.errout('json to create ' + type + ' object missing required attribute: ' + pc.propertyName)
				}
			}
		}
		
		//if(edits.length > 0) edits.push({op: editCodes.ascend1, edit: {}})

		if(t.superTypes && t.superTypes.uuided){
			edits.unshift({op: editCodes.initializeUuid, edit: {uuid: random.uid()}})
		}
	
		edits.forEach(function(e){
			e.editId = -2
		})

		/*console.log(type + ' -> ')
		edits.forEach(function(e){
			console.log(editNames[e.op] + ' ' + JSON.stringify(e))
		})*/
				
		return edits
	}
	
	return converter
}

