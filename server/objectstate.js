"use strict";

var _ = require('underscorem');

var versions = require('./versions');

var set = require('structures').set;

function couldHaveForeignKey(objSchema){
	return _.any(objSchema.properties, function(p){
		if(p.type.type === 'object') return true;
		if(p.type.type === 'list' || p.type.type === 'set'){
			_.assert(p.type.members.type === 'primitive' || p.type.members.type === 'object');
			return p.type.members.type === 'object';
		}
	});
}


function makeSelectByMultiplePropertyConstraints(indexing){

	return function(typeCode, descentPaths, filterFunctions, cb){
		var start = Date.now();
	
		var matchedList = [];
		var failed = false;
	
		var cdl = _.latch(descentPaths.length, finish);

		_.times(descentPaths.length, function(k){
			var descentPath = descentPaths[k];
			var filterFunction = filterFunctions[k];
			indexing.selectByPropertyConstraint(typeCode, descentPath, filterFunction, function(m){
				matchedList[k] = m;
				cdl();
			});
		})
	
		function finish(){
			if(!failed){
				cb(matchedList);
			}else{
				console.log('going slow, failed');
				handle.getAllObjects(typeCode, function(objs){
		
					var matchedList = [];
					for(var k=0; k<descentPaths.length;++k){
						var descentPath = descentPaths[k];
						var filterFunction = filterFunctions[k];
						var matched = new IdSet();
						_.each(objs, function(obj){
							//TODO use a more complete descent method that can descend along FKs to top-level objects
							var v = objutil.descendObject(schema, typeCode, obj, descentPath);
							if(filterFunction(v)){
								matched.add(obj.meta.id);
							}
						});
						matchedList.push(matched);
						console.log('slow result ' + k + ': ' + matched.size() + ' - ' + typeCode + ' ' + JSON.stringify(descentPath));
					}
						
					cb(matchedList);
				});
			}
		}
	}
}
exports.make = function(schema, ap, broadcaster, ol){
	_.assertLength(arguments, 4);
	
	var includeFunctions = {};
	
	function emptyIncludeFunction(id, obj, addObjectCb, endCb){endCb();}

	var indexing;
	
	function makeFullIncludeFunction(objSchema){
		var funcs = {};
		_.each(objSchema.properties, function(p){
			if(p.type.type === 'object'){
				var os = schema[p.type.object];
				funcs[p.code] = function(entry, addObjectCb, endCb){
					if(_.isInteger(entry[1])){
						//console.log('including ' + JSON.stringify(entry))
						handle.streamObjectState(entry[0], entry[1], function(tc, id, obj){
							//_.assertDefined(obj)
							if(obj === undefined){
								_.errout('got undefined object: ' + tc + ' ' + id);
							}
							addObjectCb(tc,id,obj);
						}, function(){
							endCb();
						});
						return 1;
					}
					return 0;
				}
			}else if(p.type.type === 'list'){
				var os = schema[p.type.members.object];
				funcs[p.code] = function(list, addObjectCb, endCb){
					var manyFound = 0;
					_.each(list, function(listEntry){
						//_.assertArray(listEntry);
						_.assertInt(listEntry);
						if(_.isInteger(listEntry)){
							handle.streamObjectState(listEntry, addObjectCb, endCb);
							++manyFound;
						}
					});
					return manyFound;
				}
			}else if(p.type.type === 'set'){
				var os = schema[p.type.members.object];
				funcs[p.code] = function(map, addObjectCb, endCb){
					var manyFound = 0;
					_.each(map, function(list, typeCodeStr){
						var typeCode = parseInt(typeCodeStr);
						_.each(list, function(v){
							if(_.isInteger(v)){
								handle.streamObjectState(typeCode, v, addObjectCb, endCb);
								++manyFound;
							}
						});
					});
					return manyFound;
				}
			}else{
				if(p.type.type !== 'primitive') _.errout('TODO: ' + JSON.stringify(p));
			}
		});
		var propertyCodes = [];
		_.each(objSchema.properties, function(p, pName){
			propertyCodes.push(p.code);
		});
		return function(id, obj, addObjectCb, endCb){				
			_.assertDefined(obj.meta);
			var remainingCount = 0;
			var finished = false;

			for(var i=0;i<propertyCodes.length;++i){
				var propertyCode = propertyCodes[i];
				var v = obj[propertyCode];
				if(v !== undefined){
					var f = funcs[propertyCode];
					if(f !== undefined){
						var manyToWait = f(v, addObjectCb, function(){
							--remainingCount;
							if(finished && remainingCount === 0){
								endCb();
								endCb = undefined;
							}
						});
						remainingCount += manyToWait;
					}
				}
			}
			finished = true;
			if(remainingCount === 0){
				endCb();
				endCb = undefined;
			}
		}
	}
	
	_.each(schema, function(objSchema){
		includeFunctions[objSchema.code] = emptyIncludeFunction;
		if(!objSchema.isView && couldHaveForeignKey(objSchema)){
			includeFunctions[objSchema.code] = makeFullIncludeFunction(objSchema);
		}
	});
	
	var handle = {
		setIndexing: _.once(function(i){
			_.assertUndefined(indexing);
			indexing = i;
			handle.selectByMultiplePropertyConstraints = makeSelectByMultiplePropertyConstraints(indexing);
		}),
		getSnapshots: function(typeCode, id, cb){
			cb([-1]);//TODO make this smarter
		},
		getSnapshotState: function(typeCode, id, snapshotId, cb){
			_.errout('TODO');
		},
		getAllSnapshotStates: function(typeCode, id, snapshotIds, cb){
			if(snapshotIds.length !== 1 || snapshotIds[0] !== -1) _.errout('TODO implement');
			
			handle.getObjectState(id, function(state){
				if(state === undefined){
					cb();
					return;
				}
				
				var snap = {objects: {}};
				snap.objects[typeCode] = {};
				snap.objects[typeCode][id] = state;
				snap.version = state.meta.editId

				//TODO retrieve FKs in state, include them
			
				cb([snap]);
			});
		},
		addEdit: function(id, path, op, edit, syncId, cb){
			_.assertLength(arguments, 6);
			_.assertInt(id);
			_.assertInt(syncId);
			_.assertString(op)
			//TODO support merge models
			ap.persistEdit(id, path, op, edit, syncId, cb);
		},
		
		//unlike getting a snapshot, performs no FK-following
		getObjectState: function(id, cb){
			_.assertLength(arguments, 2);
			/*
			var state = ap.getObjectState(id);
			if(state !== undefined){
				cb(state);
			}else{
				raf.getObject(id, function(state){
					//if(state === undefined) _.errout('unknown object: ' + typeCode + ' ' + id);
					cb(state);
				});
			}*/
			ol.get(id, function(state){
				_.assertObject(state)
				cb(state)
			})
		},
		streamObjectState: function(id, cb, endCb){
			handle.getObjectState(id, function(state){
			
				//TODO retrieve FKs in state, include them
				//making additional callbacks
				//as much as possible, proceed depth-first.
				//console.log('TODO STREAMING ' + typeCode + ' ' + id);
				//console.log(JSON.stringify(state));
			
				cb(id, state);
				
				endCb();
			});
		},
		
		includeContainedObjects: function(typeCode, id, obj, addObjectCb, endCb){
			includeFunctions[typeCode](id, obj, addObjectCb, endCb);
		},
		
		//Note that these method's implementations will always return a result that is up-to-date,
		//by fetching the async parts and then synchronously merging them with the AP parts
		getManyOfType: function(typeCode){
			_.assertLength(arguments, 1)
			/*raf.getManyOfType(typeCode, function(many){
				var apMany = ap.getManyCreatedOfType(typeCode);
				//console.log('getting many of type ' + typeCode + ' ' + many + ' ' + apMany)
				cb(many+apMany);
			});*/
			return ol.getMany(typeCode)
		},
		
		getObjects: function(typeCode, ids, cb){
			_.assertFunction(cb);
			_.assertArray(ids)
			
			if(ids.length === 0){
				cb({})
				return;
			}

			console.log('getting objects: ' + ids.length)

			var objs = {}
			var cdl = _.latch(ids.length, function(){
				console.log('got all objects, done')
				cb(objs)
			})
			ol.getSet(ids, function(obj){
				objs[obj.meta.id] = obj
				console.log('got obj')
				cdl()
			})
			/*raf.getObjects(typeCode, ids.get(), function(rafObjs){

				var apObjs = ap.getObjects(typeCode, ids);

				var keys = Object.keys(apObjs);
				for(var i=0;i<keys.length;++i){
					var obj = apObjs[keys[i]];
					_.assertObject(obj);
					rafObjs[obj.meta.id] = obj;
				}
				
				if(ids.size() !== _.size(rafObjs)){
					_.errout('expected ' + ids.size() + ', but got only ' + _.size(rafObjs) + ' from ids ' + JSON.stringify(ids.get()));
				}
				
				cb(rafObjs);
			});*/
		},
		getAllObjects: function(typeCode, cb){
			/*_.assertFunction(cb);
			raf.getAllObjects(typeCode, function(objs){
				var result = {};
				var apObjs = ap.getAllObjects(typeCode);
				//console.log('got ' + typeCode + ' ' + _.size(objs) + ' ' + _.size(apObjs));
				//console.log('rafObjs: ' + JSON.stringify(objs));
				//console.log('apObjs: ' + JSON.stringify(apObjs));
				
				var objsKeys = Object.keys(objs);
				for(var i=0;i<objsKeys.length;++i){
					var idStr = objsKeys[i];
					_.assertDefined(idStr);
					result[idStr] = objs[idStr];
				}

				var apObjsKeys = Object.keys(apObjs);
				for(var i=0;i<apObjsKeys.length;++i){
					var idStr = apObjsKeys[i];
					_.assertDefined(idStr);
					result[idStr] = apObjs[idStr];
				}

				cb(result);
			});*/
			ol.getAllOfType(typeCode, function(objs){
				cb(objs)
			})
		},
		//Returns the set of permutations of values for the given descent path, 
		//and the means for retrieving the objects belonging to each member of that set (i.e. each partition)
		//the descent paths must terminate in a primitive value for each object.
		//Effectively, we run each filter on the little bits of the objects it needs rather than the entire
		//object, but if those bits are the same for many objects we need only run the filter once,
		//and we can store the bits->ids mapping in an index.
		selectByPropertyConstraint: function(typeCode, descentPath, filterFunction, cb){
		
			handle.selectByMultiplePropertyConstraints(typeCode, [descentPath], [filterFunction], function(result){
				//console.log('result: ' + JSON.stringify(result))
				cb(result[0]);
			});
		},
		//selectByMultiplePropertyConstraints: selectByMultiplePropertyConstraints,
		getManyObjectsPassing: function(typeCode, filter, filterIsAsync, cb){
			_.assertLength(arguments, 4);
			handle.getAllObjectsPassing(typeCode, filter, filterIsAsync, function(objs){
				cb(objs.length);
			});
		},
		getAllObjectIdsPassing: function(typeCode, filter, filterIsAsync, cb){
			handle.getAllObjectsPassing(typeCode, filter, filterIsAsync, function(objs){
				var ids = [];
				for(var i=0;i<objs.length;++i){
					var obj = objs[i];
					ids.push([ obj.meta.typeCode, obj.meta.id ]);
				}
				cb(ids);
			});
		},
		/*getAllObjectsPassing: function(typeCode, filter, filterIsAsync, cb){
			_.assertLength(arguments, 4);
			handle.getAllObjects(typeCode, function(objs){
				var res = [];

				//console.log('filtering ' + objs.length + ' objects with filter ' + JSON.stringify(filter));
				//console.log(typeCode);
			
				if(filterIsAsync){

					var cdl = _.latch(objs.length, function(){
						//console.log(res.length + ' objects passed.');
						cb(res);
					});
				
					_.each(objs, function(obj){
						filter(obj, function(p){
							if(p) res.push(obj);
							cdl();
						});
					});
				}else{
					_.each(objs, function(obj){
						if(filter(obj)){
							res.push(obj);
						}
					});
					cb(res);
				}
			});
		},
		getObjectPasses: function(typeCode, id, filter, cb){
			handle.getObjectState(id, function(state){
				filter.passes(state, function(p){
					cb(p, state);
				});
			});
		},
		
		objectExists: function(typeCode, id, cb){
			var e = ap.objectExists(typeCode, id);
			if(e){
				cb(e);
			}else{
				raf.objectExists(typeCode, id, function(e){
					cb(e);
				});
			}
		}*/
	};
	
	return handle;
}
