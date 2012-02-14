"use strict";

var _ = require('underscorem');
var sys = require('sys');

var inmem = require('./inmem');
var schema = require('./../shared/schema');

var syncApi = require('./sync_api');
var clientConnection = require('./client_connection');

var matterhornService = require('./../http/matterhorn_service');

function capitalize(str){
	return str.substr(0,1).toUpperCase() + str.substr(1);
}

//copied from browserclient.js
function mergeSnapshots(snaps){

	var result = {version: snaps[snaps.length-1].version, objects: {}};
	
	var taken = {};
	for(var i=snaps.length-1;i>=0;--i){
		var m = snaps[i].objects;
		
		var typeCodes = Object.keys(m);
		for(var k=0;k<typeCodes.length;++k){
			var typeCode = typeCodes[k];
			var objs = m[typeCode];
			
			var t = taken[typeCode];
			if(t === undefined) t = taken[typeCode] = {};
			
			var resObjs = result.objects[typeCode];
			if(resObjs === undefined) resObjs = result.objects[typeCode] = {};
			
			var ids = _.keys(objs);
			for(var j=0;j<ids.length;++j){
				var id = ids[j];
				
				if(!t[id]){
					t[id] = true;
					resObjs[id] = objs[id];
				}
			}
		}
	}
	
	return result;
}

function isEditable(view){
	//TODO
	return false;
}

function recursivelyGetLeafTypes(objType, schema){
	if(_.size(objType.subTypes) === 0){
		return [objType.name];
	}
	
	var res = [];
	_.each(objType.subTypes, function(v, subType){
		res = res.concat(recursivelyGetLeafTypes(schema[subType], schema));
	});
	return res;
}
function valueOrId(value){
	if(value.__id){//if it is a handle to an externalized object (static or sync), reference by ID
		return value.__id;
	}else{
		return value;
	}
}

function convertJsonToObject(dbSchema, type, json){
	_.assertLength(arguments, 3);
	_.assertObject(json);
	
	var t = dbSchema[type];
	
	var obj = {};
	var collections = {};
	
	var taken = {};
	_.each(t.properties, function(p, name){
		var pv = json[name];
		taken[name] = true;
		
		if(pv !== undefined && pv !== null){
			//console.log('t: ' + JSON.stringify(pv));
			if(p.type.type === 'primitive'){
				obj[p.code] = valueOrId(pv);
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
				console.log('arg: ' + JSON.stringify(p.type));
				if(p.type.members.type === 'primitive'){
					_.each(pv, function(value){
						c.push(valueOrId(value));
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
						c.push(valueOrId(value));
					});
				}else{
					var types = recursivelyGetLeafTypes(dbSchema[p.type.members.object], dbSchema);
					if(types.length !== 1) _.errout('TODO support type polymorphism in JSON'); 
					var actualType = dbSchema[types[0]];
				
					_.each(pv, function(value){
						c.push([actualType.code, valueOrId(value)]);
					});
				}
			}else if(p.type.type === 'object'){
				if(_.isInteger(pv)){
					//_.errout('TODO: ' + JSON.stringify(p));
					var typeCode = dbSchema[p.type.object].code;
					//obj.push([p.code, [typeCode, pv]]);
					obj[p.code] = [typeCode, pv];
				}else{
					_.errout('TODO: ' + JSON.stringify(pv) + ' (' + name + ')');
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
			
exports.db = function(dbName, schemaDir, clientCb){
	if(arguments.length === 2) {clientCb = schemaDir; schemaDir = undefined;}
	//TODO implement connection info retrieval, remote connection
	
	
	schema.load(dbName, schemaDir, function(dbSchema){
	
		inmem.db(dbName, dbSchema, function(serverHandle){
		
			var cc = clientConnection.make(serverHandle);

			
			function makeObjectFromJson(type, json, cb){
				//_.assertLength(arguments, 2);
				
				var obj = convertJsonToObject(dbSchema, type, json);
				var t = dbSchema[type];
				
				cc.makeObject(t.code, obj, cb);
			}
			function setObjectToJson(type, id, json){
				_.assertLength(arguments, 3);
				_.assertInt(id);
				_.assertObject(json);
				var obj = convertJsonToObject(dbSchema, type, json);
				var t = dbSchema[type];
				
				cc.setEntireObject(t.code, id, obj);
			}
			
			function convertProperty(typeCode, propertyName){
				return getProperty(typeCode, propertyName).code;
			}
			function getProperty(typeCode, propertyName){
				_.assertInt(typeCode);
				_.assertString(propertyName);
				return dbSchema._byCode[typeCode].properties[propertyName];
			}
			function convertCode(type, propertyCode){
				var t = dbSchema[type];
				var res;
				_.each(t.properties, function(v){
					if(v.code === propertyCode) res = v.name;
				});
				if(res == undefined){
					_.errout('cannot find name for property code ' + propertyCode + ' in type ' + type);
				}
				return res;
			}
			
			var stack = [];
			var cur;
			
			var serviceIsSetup = false;
		
			var handle = {
				//begins the creation process for an externally-accessible object of the given type
				schema: dbSchema,
				schemaName: dbName,
				internalClient: cc,
				serverInstanceUid: cc.serverInstanceUid,
				setupService: function(local){
					_.assertNot(serviceIsSetup);
					serviceIsSetup = true;
					return matterhornService.make(local, handle);
				},
				input: {
					makeObjectFromJson: makeObjectFromJson,
					setObjectToJson: setObjectToJson,
					makeEmptyObject: function(type, cb){
						var schema = dbSchema[type];
						if(schema === undefined) _.errout("unknown object type: " + type);
					
						cc.makeObject(schema.code, {}, cb);
					},
					makeObject: function(type){
			
						var schema = dbSchema[type];
						if(schema === undefined) _.errout("unknown object type: " + type);
					
						var obj = {};
						var collections = {};//TODO remove collections as it now duplicates the object hash
						cur = [obj, collections, schema.code];
						stack.push(cur);
					},
					set: function(propertyName, value){
						var propertyCode = convertProperty(cur[2], propertyName);
						//cur[0].push([propertyCode, valueOrId(value)]);
						cur[0][propertyCode] = valueOrId(value);
					},
					add: function(collectionName, value, typeCode){
						_.assertLength(arguments, 2);
						//var collectionCode = convertProperty(cur[2], collectionName);
						var prop = getProperty(cur[2], collectionName);
						var collectionCode = prop.code;
						var collections = cur[1];
						var c = collections[collectionCode];
						if(c === undefined){//TODO verify the collection name against the schema
							if(prop.type.type === 'list'){
								c = collections[collectionCode] = [];
							}else{
								c = collections[collectionCode] = {};
							}
							//cur[0].push([collectionCode, c]);
							cur[0][collectionCode] = c;
						}
						_.errout('TODO: support typeCodes, default type, etc.');
						if(prop.type.type === 'list'){						
							c.push(valueOrId(value));
						}else{
						}
					},
					map: function(collectionName, keyIfNeeded, value){
						_.assertLength(arguments, 3);
						var collectionCode = convertProperty(cur[2], collectionName);
						var collections = cur[1];
						var c = collections[collectionCode];
						if(c === undefined){//TODO verify the collection name against the schema
							c = collections[collectionCode] = [];
							//cur[0].push([collectionCode, c]);
							cur[0][collectionCode] = c;
						}
						c.push([valueOrId(keyIfNeeded), valueOrId(value)]);
					},
					init: function(propertyName){
						_.errout('what does this even do?');
						//var propertyCode = convertProperty(cur[2], propertyName);
						//cur[0].push([propertyCode]);
						//cur[0][propertyCode]
					},
					setComplex: function(propertyName, value){
						_.errout('TODO: implement recursive set');
					},
					addNew: function(collectionName){
						_.errout('TODO: implement addNew');
					},
					endObject: function(cb){
						//serverHandle.make(cur[2], cur[0], cb);
						cc.makeObject(cur[2], cur[0], cb);
					
						stack.pop();
						if(stack.length > 0){
							cur = stack[stack.length-1];
						}else{
							cur = undefined;
						}
					},
				},
				output: {
					exists: function(type, id, cb){
						var st = dbSchema[type];
						if(st === undefined) _.errout('unknown type: ' + type);
						cc.objectExists(st.code, id, cb);
					},
					//get externalized object
					//takes the format produced by endObject, provides it in a streaming manner
					get: function(type, id, cbs){
						var st = dbSchema[type];

						_.assertNot(st.superTypes.abstract);
						
						var first = true;
						cc.streamObject(st.code, id, function(typeCode, id, obj){
							if(first){
								cbs._start();
							}
							//TODO handle descent, multiple callbacks
							_.each(obj, function(r, propertyCodeStr){
								var n;
								
								//if(r[0] !== -1){
								if(propertyCodeStr != 0){
									 n = convertCode(type, parseInt(propertyCodeStr));//TODO use the schema instead of parsing
									//console.log('n: ' + n + ' ' + typeof(n));
									//console.log(JSON.stringify(st));
									var sr = st.properties[n];
									if(sr.type.type === 'primitive'){
										cbs[n](r);//TODO support complex types
									}else{
										//console.log(JSON.stringify(sr));
										var cn = capitalize(n);
										cbs['begin'+cn]();
										_.each(r, function(entry){
											if(sr.type.type === 'list'){
												cbs[n](entry[0]);//TODO support complex types
											}else{
												cbs[n](entry[0], entry[1]);//TODO support object keys
											}
										});
										cbs['end'+cn]();
									}
								}
							});
						}, function(){
							cbs._end();
						});
						//cbs._end();
					},
					//read all externalized objects of type
					//same as get but with multiple objects
					each: function(type, cbs){
					}
				},
				modify: {
					//produces a sync handle for the given object
					get: function(type, idOrParams, cb){
						
						var st = dbSchema[type];

						_.assertNot(st.superTypes.abstract);
						
						if(st === undefined){
							_.errout('unknown view: ' + type);
						}
						if(arguments.length === 2 && st.isView && st.viewSchema.params.length === 0){
							cb = idOrParams;
							idOrParams = [];
						}
						console.log(require('util').inspect(st));
						_.assertInt(st.code);
						cc.getSnapshots(st.code, idOrParams, function(snapshotIds){
							cc.getAllSnapshots(st.code, idOrParams, snapshotIds, function(snapshots){
								var snapshot = mergeSnapshots(snapshots);
								//console.log('got snapshot: ' + JSON.stringify(snapshot));

								//TODO: cache/reuse sync apis?
								//TODO: they would need to have different syncIds though...
								
								var api;
								function readyCb(){
									cb(api.getRoot());
								}
								
								var editable = true;
								if(editable){
									cc.getSyncId(function(syncId){
										var key = st.isView ? JSON.stringify(idOrParams) : idOrParams;
										api = syncApi.make(
											dbSchema, 
											cc, snapshot, st.code, key);
										api.setEditingId(syncId);
										_.assertFunction(api.changeListener);
										cc.beginSync(st.code, idOrParams, snapshot.version, api.changeListener, readyCb);
									});
								}else{
									api = syncApi.make(
										dbSchema, 
										cc, snapshot, st.code, idOrParams);
									cc.beginSync(st.code, idOrParams, snapshot.version, api.changeListener, readyCb);
								}
							});
						});
					}
				},
				close: function(){
					serverHandle.close();
				}
			};
			clientCb(handle);
		});
	});
}
