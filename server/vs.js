"use strict";

var _ = require('underscorem');

var versions = require('./versions');

function varianceMag(v){
	var mag = Math.log(v/6)/Math.log(10);
	var m = Math.pow(10,Math.floor(mag));
	return m;
}

var twomap = require('structures').twomap;

function getNewestVersion(snapshot, latestId){
	//console.log('getting newest version: ' + JSON.stringify(snapshot))
	if(latestId === -1){
		return _.reduce(snapshot.objects, function(memo, objs){
			_.assertInt(memo);
			return _.reduce(objs, function(memo, obj){
				_.assertInt(memo);
				return Math.max(obj[0][1], memo);
			}, memo);
		}, -1);
	}else{
		return latestId;
	}
}

function getObjectVersions(snapshot){
	var result = [];
	_.each(snapshot.objects, function(objs, typeCode){
		var keys = Object.keys(objs);
		for(var i=0;i<keys.length;++i){
			var obj = objs[keys[i]];
			var version = obj[0][1];
			_.assertInt(version);
			result.push(version);
		}
	});
	result.sort(function(a, b){return a - b;});
	return result;
}

exports.make = function(schema, broadcaster, objectState){

	var sets = require('./sets').make(schema, broadcaster, objectState);
	
	function getSnapshotState(typeCode, params, latestId, previousId, cb){
		var paramsStr = JSON.stringify(params);
		function after(snapshot, addObject, tryToFinish, fail){
			sets.getView(typeCode, params,
				addObject,
				function(obj){
					//_.assertNot(_.isArray(obj));
					
					if(obj === undefined){
						//console.log('view constructed no object: ' + typeCode + ' ' + params);
						fail();
						_.errout('view constructed no object: ' + typeCode + ' ' + params);
					}else{
						_.assertArray(obj);
						obj = obj[1];
						
						obj[0][1] = snapshot.version = getNewestVersion(snapshot, latestId);
				
						addObject(typeCode, paramsStr, obj);
						tryToFinish(true);
					}
				}
			);
		}
		doGetSnapshotState(typeCode, params, latestId, previousId, cb, after,undefined);
	}
	
	function getSnapshotStateAndListen(typeCode, params, latestId, previousId, cb, listenerCb, stopListening){

		var paramsStr = JSON.stringify(params);

		function after(snapshot, addObject, tryToFinish, fail){
			sets.getViewAndListen(typeCode, params,
				addObject,
				function(obj){
					if(obj === undefined){
						fail();
					}else{
						obj[0][1] = snapshot.version = getNewestVersion(snapshot, latestId);
		
						addObject(typeCode, paramsStr, obj);
						tryToFinish(true);
					}
				},
				listenerCb,
				stopListening
			);
		}
		doGetSnapshotState(typeCode, params, latestId, previousId, cb, after,listenerCb);
	}
	
	function doGetSnapshotState(typeCode, params, latestId, previousId, cb, after,listenerCb){
		_.assertLength(arguments, 7);
		_.assertInt(latestId);
		_.assertInt(previousId);

		var failed = false;
		function fail(){
			failed = true;
			cb();
		}

		var paramsStr = JSON.stringify(params);

		var snapshot = {
			objects: {},
			version: -1
		};
	
		var loadingSnapshot = true;
	
		var stillNeedObject = true;
		var stillNeededIncludes = 0;
	
		function doneIncludingObject(){
			--stillNeededIncludes;
			tryToFinish();
		}
	
		function tryToFinish(gotObject){
			if(failed) return;
			
			_.assert(stillNeededIncludes >= 0);
			if(gotObject) stillNeedObject = false;
			if(stillNeededIncludes === 0 && !stillNeedObject){
				loadingSnapshot = false;
				//console.log('view object keys: ' + JSON.stringify(_.keys(snapshot.objects)));
				cb(snapshot);
			}else{
				//console.log('cannot finish yet: ' + stillNeededIncludes + ' ' + stillNeedObject + ' ' + gotObject);
			}
		}
		
		var alreadyAfterLoad = twomap.make();

		function addObject(typeCode, id, object){
			if(failed) return;
			_.assertPrimitive(id);
			_.assertObject(object);
		
			if(loadingSnapshot){
				//top-level objects to include (i.e. includeObject(...))

			
				var typeList = snapshot.objects[typeCode];
				if(typeList === undefined || typeList[id] === undefined){
				
					//FKed objects may belong in this version range even if
					//the object itself does, which is why we do this here rather than within the following if statement
					++stillNeededIncludes;
					objectState.includeContainedObjects(typeCode, id, object, addObject, doneIncludingObject);

					var version = object[0][1];
					if(version >= previousId && (latestId === -1 || version < latestId)){
		
						if(typeList === undefined) typeList = snapshot.objects[typeCode] = {};
					
						typeList[id] = object;
					}else{
						//console.log('IGNORING OBJECT: ' + typeCode + ' ' + id + ' ' + version + ' not in ' + previousId + ' ' + latestId);
					}
				
				}
			}else{
				if(listenerCb){

					var typeList = snapshot.objects[typeCode];

					if((typeList === undefined || typeList[id] ===undefined) && !alreadyAfterLoad.has(typeCode, id)){
						alreadyAfterLoad.set(typeCode, id, true);

						//++stillNeededIncludes;
						//objectState.includeContainedObjects(typeCode, id, object, addObject, doneIncludingObject);
						//TODO include contained objects?

						//console.log('sending object-snap post-snapshot');
						listenerCb(typeCode, id, [], {op: 'object-snap', 
							type: typeCode, id: id, value: object}, -1, -1);
					}
				}
			}
		}
		
		after(snapshot, addObject, tryToFinish, fail);
	}

	var stopLookup = [];

	var handle = {
		getSnapshots: function(typeCode, params, cb){
			//TODO do this more efficiently (without actually retrieving the entire snapshot.)
			handle.getSnapshotState(typeCode, params, -1, -1, function(snap){
				if(snap === undefined){
					cb();
				}else{
					var allVersions = getObjectVersions(snap);
					var v = versions.computeSnapshots(allVersions.length);
					var vm = varianceMag(snap.version);
					//console.log('v: ' + JSON.stringify(v) + ' (' + vm + ')');
					//console.log('all versions: ' + JSON.stringify(allVersions));
				
					var realVersions = [];
					for(var i=0;i<v.length;++i){
						var kv = v[i];
						var iv = allVersions[kv];
						//console.log('kv: ' + kv + ', ' + iv);
						realVersions[i] = iv - (iv % vm);
						//console.log(i + ': ' + iv + ' - ' + '(' + iv + '%' + vm + ')');
					}
					
					var prev = realVersions[0];
					for(var i=1;i<realVersions.length;++i){
						var rv = realVersions[i];
						if(rv === prev){
							realVersions.splice(i, 1);
							--i;
						}
						prev = rv;
					}

					realVersions.push(-1);
				
					//console.log('real: ' + JSON.stringify(realVersions));
				
					cb(realVersions, allVersions[allVersions.length-1]);
				}
			});
		},
		getSnapshotState: function(typeCode, params, snapshotId, previousSnapshotId, cb){
			_.assertLength(arguments, 5);
			_.assertFunction(cb);
			
			//console.log('getting snapshot state');
		
			_.assert(params.length === schema._byCode[typeCode].viewSchema.params.length);

			getSnapshotState(typeCode, params, snapshotId, previousSnapshotId, cb);			
		},
		getAllSnapshotStates: function(typeCode, params, snapshotIds, cb){
			_.assertArray(params);
			//if(snapshotIds.length !== 1 || snapshotIds[0] !== -1) _.errout('TODO implement: ' + JSON.stringify(snapshotIds));
			
			var list = [];
			var cdl = _.latch(snapshotIds.length, function(){
				cb(list);
			});
			_.each(snapshotIds, function(snId, index){
				var prevSnId = index > 0 ? snapshotIds[index-1] : -1;
				handle.getSnapshotState(typeCode, params, snId, prevSnId, function(snap){
					//cb([snap]);
					list[index] = snap;
					cdl();
				});
			})
		},
		
		beginSync: function(typeCode, params, latestSnapshotVersionId, listenerCb, readyCb){
			_.assertFunction(listenerCb);
			_.assertFunction(readyCb);
			
			var slfs = [];
			function stopListening(f){
				slfs.push(f);
			}
			var stopped = false;
			function doStop(){
				_.assertNot(stopped);
				stopped = true;
				for(var i=0;i<slfs.length;++i){
					slfs[i]();
				}
			}
			stopLookup.push([listenerCb, doStop]);
			
			getSnapshotStateAndListen(typeCode, params, -1, latestSnapshotVersionId, function(snap){
				console.log('HERE: ' + _.size(snap.objects));
				if(snap.version > latestSnapshotVersionId){
					_.each(snap.objects, function(k, tc){
						_.each(k, function(obj, id){
							_.assertObject(obj);
							//console.log('ID: ' + id);
							var version = obj[0][1];
							_.assertDefined(obj[0][2]);
							if(version > latestSnapshotVersionId){
								listenerCb(typeCode, id, [], {op: 'object-snap', 
									type: parseInt(tc), id: obj[0][2], value: obj}, -1, -1);
								//console.log('sent object-snap');
							}else{
								console.log('skipping ' + typeCode + ' ' + id + ' ' + version + ' <= ' + latestSnapshotVersionId);
							}
						});
					});
				}else{
					console.log('no changes since syncing snapshot: ' + snap.version + ' ' + latestSnapshotVersionId);
				}
				
				readyCb();
			}, listenerCb, stopListening);			

		},
		endSync: function(typeCode, params, listenerCb){

			for(var i=0;i<stopLookup.length;++i){
				var e = stopLookup[i];
				if(e[0] === listenerCb){
					e[1]();
					stopLookup.splice(i, 1);
					console.log('successfully stopped listeners');
					return;
				}
			}
			_.errout('listenerCb not found in stopLookup');
		}
	};
	
	return handle;
}
