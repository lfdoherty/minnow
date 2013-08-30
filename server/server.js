"use strict";

Error.stackTraceLimit = 300

var _ = require('underscorem');

//var viewstate = require('./vs');
var viewStateModule = require('./viewstate')
var newViewSequencer = require('./new_view_sequencer')

var fs = require('fs')
var path = require('path')
var exists = fs.exists ? fs.exists : path.exists

var pathmerger = require('./pathmerger')

var seedrandom = require('seedrandom')


var editFp = require('./tcp_shared').editFp
var editCodes = editFp.codes
var editNames = editFp.names


var log = require('quicklog').make('minnow/server')

/*
var old = Array.prototype.indexOf
var ccc = 0
Array.prototype.indexOf = function(v){
	++ccc
	if(ccc < 2000) return old.call(this, v)
	
	_.errout('TODO')	
}*/

function openUid(dataDir, cb){
	var fn = dataDir + '/minnow_data/server.uid'
	exists(fn, function(exists){
		if(exists){
			fs.readFile(fn, 'utf8', function(err, uid){
				if(err) throw err;
				cb(uid)
			})
		}else{
			var uid =  seedrandom.uid()
			fs.writeFileSync(fn, uid, 'utf8');
			cb(uid)
		}
	})
}

exports.make = function(schema, globalMacros, dataDir, config, loadedListeners, facades, cb){
	_.assertLength(arguments, 7);
	
	var serverUid;
	
	function makeDirIfNecessary(cb){
		var p = dataDir + '/minnow_data'
		exists(p, function(exists){
			if(!exists){
				fs.mkdir(p, function(err){
					if(err) throw err;
					cb()
				})
			}else{
				cb()
			}
		})
	}
	
	makeDirIfNecessary(function(){
		require('./ol').make(dataDir, schema, _.assureOnce(function(ol){
			log('got ol')
			var viewSequencer = newViewSequencer.make(schema, ol)
			require('./ap').make(dataDir, schema, ol, function(ap, apClose){
				log('got ap')
				_.assertLength(arguments, 2);
				openUid(dataDir, function(uid){
					serverUid = uid
					log('got uid')
					var objectState = require('./objectstate').make(schema, ap, ol);
					viewSequencer.initialize(objectState, config)
					//objectState.setIndexing(indexing)
					load(ap, objectState, apClose, ol, viewSequencer);
				})
			});
		}));
	})

	function load(ap, objectState, apClose, ol, viewSequencer){
		//console.log('loading...');
		_.assertFunction(ol.close)

	
		var viewState = viewStateModule.make(schema, globalMacros, objectState, viewSequencer);


		//TODO the ap should initialize the sync handle counter to avoid using the same one multiple times
		//var syncHandleCounter = 1;
	
		function stub(){}
		
		var listenerCbs = {}
		
		var ended = false
		
		var handle = {
			serverInstanceUid: function(){return serverUid;},
			objectState: objectState,
			schema: schema,
			close: function(cb){
				console.log('closing server...')
				var cdl = _.latch(2, function(){
					//console.log('closed server')
					cb()
				})
				try{
					_.each(listenerCbs, function(value){
						value.seq.end()
					})
					apClose(function(){
						//console.log('closed ap');
						cdl()
					})
					ol.close(function(){
						//console.log('closed ol');
						cdl()
					})
				}catch(e){
					console.log(e.stack)
				}

				
			},
		
			beginView: function(e, readyCb){
				//_.assertFunction(listenerCb);
				_.assertLength(arguments, 2)
				_.assertFunction(readyCb);
				_.assertString(e.syncId)
				console.log('syncId: ' + e.syncId)
				console.log(JSON.stringify(Object.keys(listenerCbs)))
				var listenerCb = listenerCbs[e.syncId]
				_.assertFunction(listenerCb)
				//log('beginView: ', e)
				return viewState.beginView(e, listenerCb.seq, readyCb)
			},
			afterNextSyncHandleUpdate: function(syncId, cb){
				var backHandle = listenerCbs[syncId]
				if(backHandle){
					backHandle.seq.afterNextUpdate(cb)
				}
			},
			persistEdit: function(op, state, edit, syncId, computeTemporaryId, reifyCb){//(typeCode, id, path, op, edit, syncId, cb){
				//_.assertLength(arguments, 7);
				//_.assertInt(id);
				//_.assertInt(id)
				_.assertInt(op)				
				//_.assertArray(path)
				_.assertString(syncId);
				_.assert(syncId.length > 0)
				//console.log('persistEdit syncId: ' + syncId)
				//_.assertFunction(cb)

				if(op === editCodes.make || op === editCodes.copy){
					var id = objectState.addEdit(op, state, edit, syncId, computeTemporaryId)

					if(!edit.forget){
						var backHandle = listenerCbs[syncId]
						if(backHandle){
							backHandle.seq.subscribeToObject(id)
						}
					}
					_.assertInt(id)
					return id
				}else{
					objectState.addEdit(op, state, edit, syncId, computeTemporaryId, reifyCb);
				}
			},
			updatePath: function(id, path, syncId){
				objectState.updatePath(id, path, syncId)
			},
			getVersionTimestamps: function(versions, cb){
				var timestamps = ol.getVersionTimestamps(versions)
				cb(timestamps)
			},
			forgetTemporary: function(temporary, syncId){
				_.assertString(syncId)
				objectState.forgetTemporary(temporary, syncId)
			},
			/*makeSyncId: function(){
				var syncId = ap.makeNewSyncId();
				return syncId
			},*/
			syncIdUpTo: function(syncId, editId){
				ap.syncIdUpTo(syncId, editId)
			},
			endSync: function(syncId){
				if(listenerCbs[syncId]){
					listenerCbs[syncId].seq.end()
					delete listenerCbs[syncId]
					console.log('deleted seq for: ' + syncId)
				}else{
					console.log('WARNING: tried to end sync handle that does not exist or was already ended: ' + syncId)
					console.log(new Error().stack)
				}
			},
			beginSync: function(syncId, blockChangesCb){//listenerCb, objectCb, viewObjectCb){
				_.assertLength(arguments, 2)
				_.assertString(syncId)
				//_.assertFunction(listenerCb)
				//_.assertFunction(objectCb)
				//_.assertFunction(viewObjectCb)
				_.assertFunction(blockChangesCb)
				
				var alreadySent = {}
				
				var currentSyncId
				var currentResponseId
				var curState = {}
				/*function sendEditUpdate(up){
					if(up.syncId === undefined){
						console.log('ERROR: no syncId: ' + JSON.stringify(up))
						return
					}
					if(up.editId === undefined){
						console.log('ERROR: no editId: ' + JSON.stringify(up))
						return
					}
					//_.assertInt(up.syncId)
					
					//console.log('sync sending edit update: ' + JSON.stringify(up))
					//console.log(new Error().stack)
					
					if(currentSyncId !== up.syncId){
						currentSyncId = up.syncId
						listenerCb(editCodes.setSyncId, {syncId: up.syncId}, up.editId)					
					}
					
					//_.assertUndefined(up.id)
					if(up.state){
						if(up.id) _.assertEqual(up.id, up.state.top)
						up.id = up.state.top
					}


					if(up.id !== -1){

						//console.log('currentResponseId: ' + currentResponseId + ' ' + up.id)
						if(currentResponseId !== up.id){
							if(_.isString(up.id)){
								//console.log('selecting: ' + JSON.stringify(up.id))
								listenerCb(editCodes.selectTopViewObject, {id: up.id}, up.editId)					
								curState = {}
							}else{
								listenerCb(editCodes.selectTopObject, {id: up.id},  up.editId)					
								//curPath = []
							}
						}
						currentResponseId = up.id
						
						if(_.isString(up.id)){
							
							if(up.state === undefined) _.errout('no up.state: ' + JSON.stringify(up))
							
							_.assertObject(up.state)
							var newState = up.state//[].concat(up.path)
							//console.log('editing to match: ' + JSON.stringify(curState) + ' -> ' + JSON.stringify(newState))
							pathmerger.editToMatch(curState, newState, function(op, edit){

								listenerCb(op, edit, up.editId)					
							})
							curState = newState
						}
					}
					//_.assertDefined(up.id)
					listenerCb(up.op, up.edit, up.editId)					
				}
				
				var sentBuffer = []
				function advanceSentBuffer(){
					while(true){
						if(sentBuffer.length === 0) return
						var e = sentBuffer[0]
						if(e.got === true){
							for(var i=0;i<e.edits.length;++i){
								var ek = e.edits[i]
								objectCb(ek)
							}
							//console.log('sending objects: ' + e.edits.length)
							if(e.edits.length === 0){
								log('0 objects actually sent')
							}
							sentBuffer.shift()
						}else if(e.got === false){
							return;
						}else{
							if(!(e.id === -1 || alreadySent[e.id] || _.isString(e.id))){
								_.errout('should have already send object we have edit for: ' + e.id + ' ' + JSON.stringify(e))
							}
							//log('sending edit: ', e)
							//console.log('sending edit: ' + JSON.stringify(e))
							sendEditUpdate(e)
							sentBuffer.shift()
						}
					}
				}
				
				function includeObjectCb(id, edits){//cb){
					_.assertInt(id)
					//_.assertArray(edits)
					//_.assertBuffer(objEditsBuffer)
					
					if(alreadySent[id]){
						return;
					}
					
					var pointer = {got: false, edits: []}
					sentBuffer.push(pointer)
						
					var objEditsBuffer = objectState.getObjectBuffer(id)//, function(objEditsBuffer){
					pointer.edits.push({id: id, edits: objEditsBuffer})
					pointer.got = true
					advanceSentBuffer()
					//})
					
				
				}
				function alreadyHasCb(id, editId){
					alreadySent[id] = true
				}
				function listenerCbWrapper(e){
					_.assertLength(arguments, 1);
					
					if(e.type) _.errout('wrong type of edit: ' + JSON.stringify(e))
					
					
					
					//console.log('got edit for object: ' + JSON.stringify(e))
					
					//if(e.op === editCodes.putLong) _.assertInt(e.state.property)
					
					if(e.state && e.state.key && e.state.keyIsObject){
						includeObjectCb(e.state.key, function(){//TODO also listen?
						})
					}
					if(e.state && e.state.inner){
						includeObjectCb(e.state.inner, function(){//TODO also listen?
						})
					}
					if(e.state && e.state.sub){
						if(_.isInt(e.state.sub)){
							includeObjectCb(e.state.sub, function(){//TODO also listen?
							})
						}
					}
							
					if(sentBuffer.length > 0){
						sentBuffer.push(e)
						//console.log('sentBuffer: ' + sentBuffer.length)
					}else{
						sendEditUpdate(e)
					}
				}
				
				function sendViewObjectCb(id, edits){
					//_.errout('TODO: ' + id + ' ' + JSON.stringify(edits))
					//console.log('sending view object: ' + id)
					viewObjectCb(id, edits, syncId)
				}*/
				
				//function blockChangesCb(diff){
					//_.errout('tODO')
				//	
				//}
				
				function maintainEditSequence(up, addEditCb){
					if(currentSyncId !== up.syncId){
						//console.log('syncId changed from ' + currentSyncId + ' to ' + up.syncId)
						currentSyncId = up.syncId
						addEditCb(editCodes.setSyncId, {syncId: up.syncId}, up.editId)					
					}
					
					//_.assertUndefined(up.id)
					if(up.state){
						if(up.id) _.assertEqual(up.id, up.state.top)
						up.id = up.state.top
					}


					if(up.id !== -1){

						//console.log('currentResponseId: ' + currentResponseId + ' ' + up.id)
						if(currentResponseId !== up.id){
							if(_.isString(up.id)){
								//console.log('selecting: ' + JSON.stringify(up.id))
								addEditCb(editCodes.selectTopViewObject, {id: up.id}, up.editId)					
								curState = {}
							}else{
								addEditCb(editCodes.selectTopObject, {id: up.id},  up.editId)					
								//curPath = []
							}
						}
						currentResponseId = up.id
						
						if(_.isString(up.id)){
							
							if(up.state === undefined) _.errout('no up.state: ' + JSON.stringify(up))
							
							_.assertObject(up.state)
							var newState = up.state//[].concat(up.path)
							//console.log('editing to match: ' + JSON.stringify(curState) + ' -> ' + JSON.stringify(newState))
							pathmerger.editToMatch(curState, newState, function(op, edit){

								addEditCb(op, edit, up.editId)					
							})
							curState = newState
						}
					}
				}
				
				function blockChangesCbWrapper(e){
				
					//console.log('sending block to ' + e.destinationSyncId + ' ' + syncId)
				
					var res = {
						destinationSyncId: e.destinationSyncId,
						endEditId: e.endEditId,
						addedObjects: e.addedObjects,
						addedViewObjects: e.addedViewObjects
					}
					var newEdits = []
					var i=0
					function addEditCb(op, edit, editId){
						newEdits.push({op: op, edit: edit, editId: editId})
					}
					for(;i<e.edits.length;++i){
						var ed = e.edits[i]
						maintainEditSequence(ed, addEditCb)
						//console.log('edit: ' + JSON.stringify(ed))
						newEdits.push(ed)
					}
					res.edits = newEdits
					blockChangesCb(res)

					//console.log('done sending block to ' + e.destinationSyncId + ' ' + syncId)

				}

				//listenerCbs[syncId] = listenerCbWrapper
				listenerCbs[syncId] = blockChangesCb

				//console.log('making sequencer')
				var seq = viewSequencer.makeStream(/*includeObjectCb, listenerCbWrapper, sendViewObjectCb*/blockChangesCbWrapper, syncId)
				blockChangesCb.seq = seq

				
				return syncId
			},
		
			getSnapshots: function(e, cb){
				_.assertLength(arguments, 2);
				var typeCode = e.typeCode;
				//var params = JSON.parse(e.params);
				//console.log('params: ' + e.params)
				var params = newViewSequencer.parseParams(e.params)
				
				_.assertInt(typeCode);

				if(schema._byCode[typeCode].isView){
					viewState.getSnapshots(typeCode, params, e.isHistorical, cb);
				}else{
					//_.errout('ERROR')
					cb(new Error('view does not exist: ' + schema._byCode[typeCode].name))
				}
			},
			getAllSnapshots: function(e, cb){
				_.assertLength(arguments, 2);
				var typeCode = e.typeCode;
				//var params = JSON.parse(e.params);
				var params = newViewSequencer.parseParams(e.params)
				//console.log(e.params + ' - > ' + JSON.stringify(params))
				var snapshotIds = e.snapshotVersionIds;
				_.assertArray(snapshotIds);

				if(schema._byCode[typeCode].isView){
					_.assertArray(params);
					try{
						viewState.getAllSnapshotStates(typeCode, params, snapshotIds, e.isHistorical, function(states){
							cb(undefined, states)
						}, function(e){
							console.log('ERROR: ' + e.stack)						
							cb(e)
						});
					}catch(e){
						console.log('ERROR: ' + e.stack)						
						cb(e)
					}
				}else{
					_.errout('ERROR')
				}			
			},
			getFullSnapshot: function(e, cb){
				_.assertLength(arguments, 2);
				
				
				var typeCode = e.typeCode;
				//var params = JSON.parse(e.params)

				//console.log('parsing params ' + e.params)

				var params = newViewSequencer.parseParams(e.params)
				//var snapshotId = e.latestVersionId;
				//var previousId = e.previousVersionId;

				//console.log('parsed params ' + e.params + ' -> ' + JSON.stringify(params))
				
				//_.assert(params.length === schema._byCode[typeCode].viewSchema.params.length);
				
				//console.log('getting snapshot: ' + e.isHistorical)
				//console.log(new Error().stack)
			
				if(schema._byCode[typeCode].isView){
					_.assertArray(params);
					viewState.getFullSnapshot(typeCode, params, function(res, endEditId){
						cb(undefined, res, endEditId)
					}, function(e){
						cb(e)
					});
				}else{
					_.errout('ERROR')
				}
			},
			getSnapshot: function(e, cb){
				_.assertLength(arguments, 2);
				
				
				var typeCode = e.typeCode;
				//var params = JSON.parse(e.params)

				//console.log('parsing params ' + e.params)

				var params = newViewSequencer.parseParams(e.params)
				var snapshotId = e.latestVersionId;
				var previousId = e.previousVersionId;

				//console.log('parsed params ' + e.params + ' -> ' + JSON.stringify(params))
				
				_.assert(params.length === schema._byCode[typeCode].viewSchema.params.length);
				
				//console.log('getting snapshot: ' + e.isHistorical)
				//console.log(new Error().stack)
			
				if(schema._byCode[typeCode].isView){
					_.assertArray(params);
					viewState.getSnapshotState(typeCode, params, snapshotId, previousId, e.isHistorical, function(res){
						cb(undefined, res)
					}, function(e){
						cb(e)
					});
				}else{
					_.errout('ERROR')
				}			
			}
		};
		//console.log('cbing')
		
		//var objectState = s.objectState
		facades.forEach(function(f){
			f.eachOfType = function(type, cb){
				//objectState.getAll
				var typeCode = schema[type].code
				var ids = objectState.getAllIdsOfType(typeCode)
				for(var i=0;i<ids.length;++i){
					var id = ids[i]
					cb(id)
				}
				//_.errout('TODO')
			}
			f.getObjectState = function(id){
				if(!id || id < 0) throw new Error('not a valid server-side id: ' + id)
				return objectState.getObjectState(id)
				//_.errout('TODO')
			}
			f.listenForEdits = function(typeName, cb){
				//_.errout('TODO')
				var typeCode = schema[typeName].code
				ol.propertyIndex.attachObjectIndex(typeCode, cb)
			}
			
		})
		loadedListeners.forEach(function(cb){cb()})
		
		cb(handle);
	}
}
