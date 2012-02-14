"use strict";

var _ = require('underscorem');

var compress = require('./../util/compress');

var appendlog = require('./appendlog');

//var viewstate = require('./viewstate');
var viewstate = require('./vs');

function copyJson(json){
	return JSON.parse(JSON.stringify(json));
}

console.log('FS: ' + JSON.stringify(Object.keys(require('fs'))));
/*
var old = Buffer.prototype.slice
Buffer.prototype.slice = function(){
	//_.errout('slice');
	console.log(new Error().stack);
	return old.apply(this, Array.prototype.slice.call(arguments));
}*/
/*
console.log = function(msg){
	if(msg.indexOf('"uid"') !== -1) _.errout(msg);
}*/

//takes a morlock application handle, the db schema, and the callback function
exports.make = function(m, schema, cb){

	require('./structure').make(m, _.assureOnce(function(structure){
		require('./raf').make(schema, m, structure, _.assureOnce(function(raf){
			require('./ap').make(schema, m, structure, raf, function(ap, indexing, objectState, broadcaster){
				_.assertLength(arguments, 4);
				//_.assertFunction(setIndexing);


				//require('./indexing').load(schema, m, ap, structure.getIndexing(), objectState, raf, function(indexing){
					//setIndexing(indexing);
					//objectState.setIndexing(indexing);
					load(raf, ap, indexing, objectState, broadcaster);
				//});
			});
		}));
	}));
	
	function load(raf, ap, indexing, objectState, broadcaster){
		console.log('loading');
	

		
	
		var viewState = viewstate.make(schema, broadcaster, objectState);

		//var syncHandles = {};
		//var currentHandle;

		//TODO the ap should initialize the sync handle counter to avoid using the same one multiple times
		var syncHandleCounter = 1;
	
		var handle = {
			serverInstanceUid: function(){return m.uid();},
			makeObject: function(typeCode, obj, cb){
				if(arguments.length < 2 || arguments.length > 3) _.errout('wrong number of arguments (type, obj, cb): ' + arguments.length);
				_.assertInt(typeCode);
				_.assertObject(obj);
				if(cb) _.assertFunction(cb);
			
				ap.inputObject(typeCode, obj, cb);
			},
			setEntireObject: function(typeCode, id, obj){
				_.assertLength(arguments, 3);
				objectState.getObjectState(typeCode, id, function(oldObj){
					ap.setEntireObject(typeCode, id, obj, oldObj);
				});
			},
			streamObject: function(typeCode, id, cb, endCb){
				_.assertLength(arguments, 4);
				_.assertInt(typeCode);
				//var obj = objects[typeCode][id];
				//cb(obj);
				//_.errout('TODO');
				//objectState.getDenormalizedState(typeCode, id, cb);

				//TODO support streaming views as well
				objectState.streamObjectState(typeCode, id, cb, endCb);
			},
			close: function(){
				m.close();
			},
		
			beginSync: function(typeCode, params, latestSnapshotVersionId, listenerCb, readyCb){
				_.assertFunction(listenerCb);
				_.assertFunction(readyCb);
				
				if(schema._byCode[typeCode].isView){
					viewState.beginSync(typeCode, params, latestSnapshotVersionId, listenerCb, readyCb);
				}else{
					//TODO bring up to date based on latestSnapshotVersionId
					broadcaster.output.listenByObject(typeCode, params, listenerCb);
				}
			},
			endSync: function(typeCode, params, listenerCb){
				_.assertInt(typeCode);
				if(schema._byCode[typeCode].isView){
					viewState.endSync(typeCode, params, listenerCb);
				}else{
					broadcaster.output.stopListeningByObject(typeCode, params, listenerCb);
				}
			},
			persistEdit: function(typeCode, id, path, edit, syncId){
				_.assertLength(arguments, 5);
				_.assertInt(id);
				_.assertInt(syncId);

				objectState.addEdit(typeCode, id, path, edit, syncId);
			},
		
			getSyncId: function(){
				var shId = syncHandleCounter;
				++syncHandleCounter;
			
				return shId;
			},
		
			getSnapshots: function(typeCode, params, cb){
				_.assertLength(arguments, 3);
				_.assertInt(typeCode);

				//console.log('getting snapshots');
				//var viewId = viewState.getViewId(viewCode, params);
				//cb(viewId, [-1]);//TODO make this smarter
				if(schema._byCode[typeCode].isView){
					viewState.getSnapshots(typeCode, params, cb);
				}else{
					objectState.getSnapshots(typeCode, params, cb);
				}
			},
			getAllSnapshots: function(typeCode, params, snapshotIds, cb){
				_.assertLength(arguments, 4);
			
				//if(snapshotIds.length !== 1 || snapshotIds[0] !== -1) _.errout('TODO: implement');
			

				//console.log('getting all snapshot');
				
				if(schema._byCode[typeCode].isView){
					_.assertArray(params);
					viewState.getAllSnapshotStates(typeCode, params, snapshotIds, cb);
				}else{
					objectState.getAllSnapshotStates(typeCode, params, snapshotIds, cb);
				}			
			},
			getSnapshot: function(typeCode, params, snapshotId, previousId, cb){
				_.assertLength(arguments, 5);
				
				_.assert(params.length === schema._byCode[typeCode].viewSchema.params.length);
			
				//if(snapshotId !== -1) _.errout('TODO: implement');
				//console.log('getting snapshot');
			
				if(schema._byCode[typeCode].isView){
					_.assertArray(params);
					viewState.getSnapshotState(typeCode, params, snapshotId, previousId, cb);
				}else{
					objectState.getSnapshotState(typeCode, params, snapshotId, previousId, cb);
				}			
			},
			objectExists: function(typeCode, id, cb){
				objectState.objectExists(typeCode, id, cb);
			}
		};
	
		//ap.load(handle, function(){
		//	cb(handle);
		//});
		cb(handle);
	}
}
