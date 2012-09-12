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
	string: 'String',
	timestamp: 'Long'
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
	//_.errout('TODO')
	_.assertLength(arguments, 4);
	_.assertFunction(makeTemporaryId)
	_.assertObject(json);
	
	var edits = []
	
	var t = dbSchema[type];
	var allProperties = t.allProperties
	if(allProperties === undefined){
		t.allProperties = allProperties = []
		Object.keys(t.properties).forEach(function(key){
			var p = t.properties[key]
			allProperties.push(p)
		})
	}
	
	var taken = {};
	//_.each(allProperties, function(p){
	//console.log('allProperties: ' + JSON.stringify(allProperties))
	var first = true
	
	//allProperties.forEach(function(p){
	for(var j=0;j<allProperties.length;++j){
		var p = allProperties[j]
		var name = p.name;
		var pv = json[name];
		//_.assertNot(taken[name])
		taken[name] = true;
		
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
				var ts = getTypeSuffix(p.type.primitive)
				edits.push({op: 'set'+ts,  edit: {value: v}})
			}else if(p.type.type === 'map'){

				if(_.size(pv) > 0){
					var ts = getTypeSuffix(p.type.key)
					var next = 'select'+ts+'Key'
					//_.each(pv, function(value, key){
					Object.keys(pv).forEach(function(key){
						var value = pv[key]
						if(value != undefined){
							edits.push({op: next, edit: {key: primitiveCast(key,p.type.key)}})
							edits.push({op: 'put'+ts, edit: {value: value}})
							next = 'reselect'+ts+'Key'
						}
					});
					//console.log('json map ascend1')
					edits.push({op: 'ascend1', edit: {}})
				}
			}else if(p.type.type === 'set'){
				if(p.type.members.type === 'primitive'){
					//_.each(pv, function(value){
					pv.forEach(function(value){
						var v = valueOrId(value);
						assertPrimitiveType(v,p.type.members.primitive);
						var ts = getTypeSuffix(p.type.members.primitive)
						edits.push({op: 'add'+ts, edit: {value: v}})
					});
				}else{
					/*var types = recursivelyGetLeafTypes(dbSchema[p.type.members.object], dbSchema);
					if(types.length !== 1) _.errout('TODO support type polymorphism in JSON'); 
					var actualType = dbSchema[types[0]];*/
					
					//_.each(pv, function(value){
					pv.forEach(function(value){
						edits.push({op: 'addExisting', edit: {id: valueOrId(value)}})
					});
				}
			}else if(p.type.type === 'list'){
				if(p.type.members.type === 'primitive'){
					//_.each(pv, function(value){
					pv.forEach(function(value){
						if(value === undefined) _.errout('invalid data for property ' + p.name + ': ' + JSON.stringify(pv));
						var v = valueOrId(value);
						assertPrimitiveType(v,p.type.members.primitive);
						var ts = getTypeSuffix(p.type.members.primitive)
						edits.push({op: 'add'+ts, edit: {value: v}})
					});
				}else{
					//var types = recursivelyGetLeafTypes(dbSchema[p.type.members.object], dbSchema);
					//if(types.length !== 1) _.errout('TODO support type polymorphism in JSON'); 
					//var actualType = dbSchema[types[0]];
				
					//_.each(pv, function(value){
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
					/*}else{
						var typeCode = dbSchema[p.type.object].code;//TODO assert uniqueness of type
						edits.push({op: 'setToNew', edit: {typeCode: typeCode}})
					}*/
				}
			}else{
				_.errout('TODO: ' + p.type.type + ' (' + name + ')');
			}
			//console.log('json property ascend1')
			//if(first) edits.push({op: 'ascend1', edit: {}})
			//first = false			
		}
	}
	
	if(!first) edits.push({op: 'ascend1', edit: {}})

	//_.each(json, function(value, attr){
	Object.keys(json).forEach(function(attr){
		if(!taken[attr]){
			_.errout('unprocessed json attribute: ' + attr + '(' + json[attr] + ')');
		}
	});
	
	edits.forEach(function(e){
		e.editId = -2
	})
	//console.log('resulting edits: ' + JSON.stringify(edits))
	//return obj;
	return edits
}

