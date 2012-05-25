"use strict";

/*

Some utility functions used by sync_api.js

*/

exports.convertJsonToObject = convertJsonToObject;
var _ = require('underscorem')

function valueOrId(value){
	if(value.__id){//if it is a handle to an externalized object (static or sync), reference by ID
		return value.__id;
	}else{
		return value;
	}
}
function assertPrimitiveType(v,pt,name){
	if(pt === 'string'){ if(!_.isString(v)) _.errout('wrong type for ' +name + ' (should be string): '+typeof(v) + ' (' + v + ')');}
	else if(pt === 'int'){ if(!_.isInteger(v))  _.errout('wrong type for ' +name + ' (should be int): '+typeof(v) + ' (' + v + ')');}
}

function convertJsonToObject(dbSchema, type, json){
	_.assertLength(arguments, 3);
	_.assertObject(json);
	
	var t = dbSchema[type];
	var allProperties = []
	function getProperties(t){
		_.each(t.properties, function(p){
			allProperties.push(p)
		})
		//console.log(JSON.stringify(t.superTypes))
		_.each(t.superTypes,function(dummy,sn){
			var st = dbSchema[sn]
			if(st) getProperties(st)
		})
	}
	getProperties(t)
	
	//console.log(JSON.stringify(allProperties))
	
	var obj = {meta: {typeCode: t.code, id: -10, editId: -10}};
	var collections = {};
	
	var taken = {};
	_.each(allProperties, function(p){
		var name = p.name;
		var pv = json[name];
		taken[name] = true;
		
		if(pv !== undefined && pv !== null){
			//console.log('t: ' + JSON.stringify(pv));
			if(p.type.type === 'primitive'){
				var v = valueOrId(pv);;
				assertPrimitiveType(v,p.type.primitive, p.name);
				obj[p.code] = v;
			}else if(p.type.type === 'map'){
				var c = collections[p.code];
				if(c === undefined){
					c = collections[p.code] = [];
					//obj.push([p.code, c]);
					obj[p.code] = c;
				}
				_.each(pv, function(value, key){
					if(value != undefined){
						c.push([valueOrId(key), valueOrId(value)]);
					}
				});
			}else if(p.type.type === 'set'){
				//console.log('arg: ' + JSON.stringify(p.type));
				if(p.type.members.type === 'primitive'){
					_.each(pv, function(value){
						var v = valueOrId(value);
						assertPrimitiveType(v,p.type.members.primitive);
						c.push(v);
					});
				}else{
					var types = recursivelyGetLeafTypes(dbSchema[p.type.members.object], dbSchema);
					if(types.length !== 1) _.errout('TODO support type polymorphism in JSON'); 
					var actualType = dbSchema[types[0]];
					
					var arr = c[actualType.code];
					if(arr === undefined) arr = c[actualType.code] = [];

					_.each(pv, function(value){
						arr.push(valueOrId(value));
					});
				}
			}else if(p.type.type === 'list'){
			
				var c = collections[p.code];
				if(c === undefined){
					c = collections[p.code] = [];
					//obj.push([p.code, c]);
					obj[p.code] = c;
				}

				if(p.type.members.type === 'primitive'){
					_.each(pv, function(value){
						if(value === undefined) _.errout('invalid data for property ' + p.name + ': ' + JSON.stringify(pv));
						//_.assertDefined(value);
						var v = valueOrId(value);
						assertPrimitiveType(v,p.type.members.primitive);
						c.push(v);
					});
				}else{
					var types = recursivelyGetLeafTypes(dbSchema[p.type.members.object], dbSchema);
					if(types.length !== 1) _.errout('TODO support type polymorphism in JSON'); 
					var actualType = dbSchema[types[0]];
				
					_.each(pv, function(value){
						c.push(valueOrId(value));
					});
				}
			}else if(p.type.type === 'object'){
				if(_.isInteger(pv)){
					//_.errout('TODO: ' + JSON.stringify(p));
					//var typeCode = dbSchema[p.type.object].code;
					//obj.push([p.code, [typeCode, pv]]);
					obj[p.code] = pv;
				}else{
					var typeCode = dbSchema[p.type.object].code;
					////obj.push([p.code, [typeCode, pv]]);
					obj[p.code] = pv.id()
					//_.errout('TODO: ' + JSON.stringify(pv) + ' (' + name + ')');
				}
			}else{
				_.errout('TODO: ' + p.type.type + ' (' + name + ')');
			}
		}
	});
	//console.log(JSON.stringify(json));
	_.each(json, function(value, attr){
		if(!taken[attr]){
			_.errout('unprocessed json attribute: ' + attr + '(' + value + ')');
		}
	});
	return obj;
}

