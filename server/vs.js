"use strict";

var _ = require('underscorem');

var versions = require('./versions');

function varianceMag(v){
	var mag = Math.log(v/6)/Math.log(10);
	var m = Math.pow(10,Math.floor(mag));
	return m;
}

var old = console.log
console.log = function(msg){
	msg = msg + ''
	if(msg.length > 10000) _.errout('too long: ' + msg.slice(0, 300))
	old(msg)
}
function getNewestVersion(snapshot, latestId){
	//console.log('getting newest version: ' + JSON.stringify(snapshot))
	if(latestId === -1){
		var max = -1;
		_.each(snapshot.objects, function(obj){
			obj = obj.object;
			var version = obj.meta.editId
			if(version > max) max = version;
		})
		return max;
	}else{
		return latestId;
	}
}

function getObjectVersions(snapshot){
	var result = [];

	for(var i=0;i<snapshot.objects.length;++i){
		var obj = snapshot.objects[i];
		var version = obj.object.meta.editId
		_.assertInt(version);
		result.push(version);
	}
	result.sort(function(a, b){return a - b;});
	return result;
}

exports.make = function(schema, broadcaster, objectState){

	var sets = require('./sets').make(schema, broadcaster, objectState);
	
	function getSnapshotState(typeCode, params, latestId, previousId, cb){
		_.assertInt(latestId);
		_.assertInt(typeCode);
		var paramsStr = JSON.stringify(params);
		function after(snapshot, addObject, tryToFinish, fail){
			sets.getView(typeCode, params,
				addObject,
				function(obj){
					_.assertLength(arguments, 1);
					//_.assertNot(_.isArray(obj));
					
					if(obj === undefined){
						console.log('view constructed no object: ' + typeCode + ' ' + params);
						fail();
						_.errout('view constructed no object: ' + typeCode + ' ' + params);
					}else{
						//_.assertArray(obj);
						//obj = obj[1];
						
						obj = JSON.parse(JSON.stringify(obj));
						
						//console.log('obj: ' + JSON.stringify(obj))
						
						//TODO is this necessary?  it reduces the efficiency presumably (views getting unnecessarily re-sent.)
						obj.meta.editId = snapshot.latestVersionId = getNewestVersion(snapshot, latestId);
						_.assertInt(obj.meta.editId)
				
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

		//sometimes we have to execute async retrievals due to addExisting, replaceExisting, or setExisting
		//edits.  in that case we have to wait until we get the results back before sending subsequent edits.
		var waiting = false;
		var editStreamBuffer = []

		var knownIds = {};
		
		function continueEditStream(){
			while(editStreamBuffer.length > 0){
				var f = editStreamBuffer[0]
				
				if(f.got === false) return;

				editStreamBuffer.shift()
				if(f.got){
					listenerCb.apply(undefined, f.got)
				}else{
					listenerCb.apply(undefined, f)
				}
			}
			waiting = false
		}
		function listenerCbWrapper(typeCode, id, path, op, edit, syncId, editId){
		
			if(op === 'replaceExisting' || op === 'addExisting'){
				var newId = edit.newId || edit.id
				
				if(!knownIds[newId]){
					waiting = true
					var flag = {got: false}
					editStreamBuffer.push(flag)
					objectState.getObjectState(newId, function(obj){
						flag.got = [obj.meta.typeCode, obj.meta.id, [], 'objectSnap',
							{value: {type: obj.meta.typeCode, object: obj}}, -1, -1]
						continueEditStream()
					})
				}
			}
		
			if(waiting){
				editStreamBuffer.push([typeCode, id, path, op, edit, syncId, editId])
			}else{
				listenerCb(typeCode, id, path, op, edit, syncId, editId)
			}
		}

		function after(snapshot, addObject, tryToFinish, fail){
			sets.getViewAndListen(typeCode, params,
				addObject,
				function(obj){
					_.assertLength(arguments, 1);
					
					if(obj === undefined){
						fail();
					}else{

						obj = JSON.parse(JSON.stringify(obj));
						
						knownIds[obj.meta.id] = true

						snapshot.latestVersionId = getNewestVersion(snapshot, latestId);
						//console.log('obj: ' + JSON.stringify(obj))
						_.assertInt(obj.meta.editId);
						_.assertEqual(obj.meta.typeCode, typeCode);
		
						addObject(typeCode, paramsStr, obj);
						tryToFinish(true);
					}
				},
				listenerCbWrapper,
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
			objects: [],
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
		
		function addObject(typeCode, id, object){
			if(failed) return;
			_.assertPrimitive(id);
			_.assertObject(object);
			_.assertInt(typeCode);
			if(_.isArray(object)) _.errout('er')
			
			//console.log(loadingSnapshot + ' adding object ' + typeCode + ' ' + id + ' ' + JSON.stringify(object))

			object = JSON.parse(JSON.stringify(object));

			var hasAlready = {};
		
			if(loadingSnapshot){
				//top-level objects to include (i.e. includeObject(...))

			
				var typeList = snapshot.objects//[typeCode];
				///if(typeList === undefined){
				//	typeList = snapshot.objects[typeCode] = []
				//}
				_.assertArray(snapshot.objects)
				if(hasAlready[id] === undefined){
				
					//FKed objects may belong in this version range even if
					//the object itself does, which is why we do this here rather than within the following if statement
					++stillNeededIncludes;
					objectState.includeContainedObjects(typeCode, id, object, addObject, doneIncludingObject);
					
					//console.log('object: ' + JSON.stringify(object))

					var version = object.meta.editId
					_.assertInt(version);
					if(version >= previousId && (latestId === -1 || version < latestId)){
		
						typeList.push({type: typeCode, object: object});
						hasAlready[id] = true;
						if(version > snapshot.version) snapshot.version = version
					}
				}
			}else{
				if(listenerCb){

					var typeList = snapshot.objects//[typeCode];

					if(hasAlready[id] === undefined){
						hasAlready[id] = true;
						//typeList.push(object)//TODO? for reuse/caching of snapshot?
						
						console.log('sending object snap: ' + id)

						listenerCb(typeCode, id, [], 'objectSnap', {type: typeCode, id: id, value: {type: object.meta.typeCode, object: object}}, -1, -1);
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
				console.log('HERE');
				if(snap === undefined){
					cb();
				}else{
					var allVersions = getObjectVersions(snap);
					var v = versions.computeSnapshots(allVersions.length);
					var vm = varianceMag(snap.latestVersionId);
					//console.log('v: ' + JSON.stringify(v) + ' (' + vm + ')');
					//console.log('all versions: ' + JSON.stringify(allVersions));
				
					var realVersions = [];
					for(var i=0;i<v.length;++i){
						var kv = v[i];
						var iv = allVersions[kv];

						if(kv >= allVersions.length){
							//console.log('kv: ' + kv + ' >= ' + allVersions.length);
							iv = allVersions[allVersions.length-1];
							//_.assert(v.length === 1);
						}
						
						//console.log('kv: ' + kv + ', ' + iv);
						realVersions[i] = iv - (iv % vm);
						//console.log(i + ': ' + iv + ' - ' + '(' + iv + '%' + vm + ')');
						_.assertInt(realVersions[i])
					}
					
					var prev = realVersions[0];
					for(var i=1;i<realVersions.length;++i){
						var rv = realVersions[i];
						_.assertInt(rv)
						if(rv === prev){
							realVersions.splice(i, 1);
							--i;
						}
						prev = rv;
					}

					realVersions.push(-1);
				
					//console.log('real: ' + JSON.stringify(realVersions));
				
					cb({snapshotVersionIds: realVersions, lastVersionId: allVersions[allVersions.length-1]});
				}
			});
		},
		getSnapshotState: function(typeCode, params, snapshotId, previousSnapshotId, cb){
			_.assertLength(arguments, 5);
			_.assertFunction(cb);
			
			//console.log('getting snapshot state');
			var shouldBe = schema._byCode[typeCode].viewSchema.params.length;
			if(params.length !== shouldBe){
				_.errout('wrong number of parameters, should be ' + shouldBe + ', but is: ' + params.length);
			}
			_.assert(params.length === schema._byCode[typeCode].viewSchema.params.length);

			getSnapshotState(typeCode, params, snapshotId, previousSnapshotId, cb);			
		},
		getAllSnapshotStates: function(typeCode, params, snapshotIds, cb){
			_.assertArray(params);
			//if(snapshotIds.length !== 1 || snapshotIds[0] !== -1) _.errout('TODO implement: ' + JSON.stringify(snapshotIds));
			
			var list = [];
			var cdl = _.latch(snapshotIds.length, function(){
				cb({snapshots: list});
			});
			_.each(snapshotIds, function(snId, index){
				_.assertInt(snId);
				var prevSnId = index > 0 ? snapshotIds[index-1] : -1;
				handle.getSnapshotState(typeCode, params, snId, prevSnId, function(snap){
					list[index] = snap;
					cdl();
				});
			})
		},
		
		beginSync: function(e, listenerCb, readyCb){
			_.assertFunction(listenerCb);
			_.assertFunction(readyCb);
			
			var typeCode = e.typeCode;
			var params = JSON.parse(e.params)
			var latestSnapshotVersionId = e.latestSnapshotVersionId
			
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
				console.log('*******HERE: ' + _.size(snap.objects));
				var updatePacket = []
				console.log('snap.version: ' + snap.version)
				if(snap.version > latestSnapshotVersionId){
					//_.each(snap.objects, function(k, tc){
					_.each(snap.objects, function(obj, id){
						//_.each(k, function(obj, id){
						var originalObj = obj
						obj = obj.object
						console.log('obj: ' + JSON.stringify(obj))
							_.assertObject(obj);
							//console.log('ID: ' + id);
							
							//obj = JSON.parse(JSON.stringify(obj));

							var version = obj.meta.editId
							var tc = obj.meta.typeCode
							_.assertDefined(obj.meta.id);
							console.log('updating view from ' + latestSnapshotVersionId)
							if(version > latestSnapshotVersionId){
								//listenerCb(id, [], 'objectSnap', {type: parseInt(tc), id: obj.meta.id, value: obj}, -1, -1);
								updatePacket.push([id, [], 'objectSnap', {
									type: parseInt(tc), id: obj.meta.id, value: originalObj}, -1, -1])
								console.log('sent objectSnap: ' + tc + ' ' + id);
							}else{
								
								console.log('skipping ' + tc + ' ' + id + ' ' + version + ' <= ' + latestSnapshotVersionId);
							}
						//});
					});
				}else{
					//console.log('no changes since syncing snapshot: ' + snap.version + ' ' + latestSnapshotVersionId);
				}
				
				readyCb(updatePacket);
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
