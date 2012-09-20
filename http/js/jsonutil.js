"use strict";

/*

Some utility functions used by sync_api.js

TODO support inner objects
*/

exports.convertJsonToEdits = convertJsonToEdits;
var _ = require('underscorem')

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
function assertPrimitiveType(v,pt,name){
	if(pt === 'string'){ if(!_.isString(v)) _.errout('wrong type for ' +name + ' (should be string): '+typeof(v) + ' (' + v + ')');}
	else if(pt === 'int'){ if(!_.isInteger(v))  _.errout('wrong type for ' +name + ' (should be int): '+typeof(v) + ' (' + v + ')');}
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
	_.errout('TODO: ' + type)
}
function convertJsonToEdits(dbSchema, type, json, makeTemporaryId){

	_.assertLength(arguments, 4);
	_.assertFunction(makeTemporaryId)
	_.assertObject(json);


	var edits = []
	
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

	Object.keys(json).forEach(function(attr){
		if(!t.properties[attr]){
			_.errout('unprocessable json attribute: ' + attr + '(' + json[attr] + ')');
		}
	});
		
	//var taken = {};

	var first = true
	
	for(var j=0;j<allProperties.length;++j){
		var p = allProperties[j]
		var name = p.name;
		var pv = json[name];

		//taken[name] = true;
		
		if(pv !== undefined && pv !== null){
			if(first){
				edits.push({op: 'selectProperty', edit: {typeCode: p.code}})
			}else{
				edits.push({op: 'reselectProperty', edit: {typeCode: p.code}})
			}
			first = false
			
			if(p.type.type === 'primitive'){
				var v = valueOrId(pv);
				assertPrimitiveType(v,p.type.primitive, p.name);
				//var ts = getTypeSuffix(p.type.primitive)
				if(setOp[p.type.primitive] === undefined) _.errout('TODO: ' + p.type.primitive)
				edits.push({op: setOp[p.type.primitive],  edit: {value: v}})
				
			}else if(p.type.type === 'map'){

				if(_.size(pv) > 0){
					//var ts = getTypeSuffix(p.type.key)
					var next = mapSelect[p.type.key]//)'select'+ts+'Key'

					Object.keys(pv).forEach(function(key){
						var value = pv[key]
						if(value != undefined){
							edits.push({op: next, edit: {key: primitiveCast(key,p.type.key)}})
							edits.push({op: /*'put'+ts*/mapPut[p.type.key], edit: {value: value}})
							next = mapReselect[p.type.key]//'reselect'+ts+'Key'
						}
					});

					edits.push({op: 'ascend1', edit: {}})
				}
			}else if(p.type.type === 'set'){
				if(p.type.members.type === 'primitive'){

					pv.forEach(function(value){
						var v = valueOrId(value);
						assertPrimitiveType(v,p.type.members.primitive);
						var ts = getTypeSuffix(p.type.members.primitive)
						edits.push({op: 'add'+ts, edit: {value: v}})
					});
				}else{

					pv.forEach(function(value){
						edits.push({op: 'addExisting', edit: {id: valueOrId(value)}})
					});
				}
			}else if(p.type.type === 'list'){
				if(p.type.members.type === 'primitive'){

					pv.forEach(function(value){
						if(value === undefined) _.errout('invalid data for property ' + p.name + ': ' + JSON.stringify(pv));
						var v = valueOrId(value);
						assertPrimitiveType(v,p.type.members.primitive);
						var ts = getTypeSuffix(p.type.members.primitive)
						edits.push({op: 'add'+ts, edit: {value: v}})
					});
				}else{
					pv.forEach(function(value){
						edits.push({op: 'addExisting', edit: {id: valueOrId(value)}})
					});
				}
			}else if(p.type.type === 'object'){
				if(_.isInteger(pv)){
					edits.push({op: 'setObject', edit: {id: pv}})
				}else{
					if(pv._internalId){
						edits.push({op: 'setObject', edit: {id: pv._internalId()}})
					}else{
						var temporary = makeTemporaryId();
						var typeCode = dbSchema[p.type.object].code
						edits.push({op: 'setToNew', edit: {typeCode: typeCode, temporary: temporary}})
					}
				}
			}else{
				_.errout('TODO: ' + p.type.type + ' (' + name + ')');
			}
		}
	}
	
	if(!first) edits.push({op: 'ascend1', edit: {}})
	
	edits.forEach(function(e){
		e.editId = -2
	})
	//console.log('resulting edits: ' + JSON.stringify(edits))
	//return obj;
	return edits
}

