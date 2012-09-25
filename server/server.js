"use strict";

Error.stackTraceLimit = 100

var _ = require('underscorem');

//var viewstate = require('./vs');
var viewStateModule = require('./viewstate')
var viewSequencer = require('./view_sequencer')

var fs = require('fs')
var path = require('path')
var exists = fs.exists ? fs.exists : path.exists

var pathmerger = require('./pathmerger')

var seedrandom = require('seedrandom')

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

exports.make = function(schema, globalMacros, dataDir, /*synchronousPlugins, */cb){
	_.assertLength(arguments, 4);
	
	//schema.name = appName;

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
			require('./ap').make(dataDir, schema, ol, function(ap, broadcaster, apClose){
				log('got ap')
				_.assertLength(arguments, 3);
				openUid(dataDir, function(uid){
					serverUid = uid
					log('got uid')
					var objectState = require('./objectstate').make(schema, ap, broadcaster, ol);
					//objectState.setIndexing(indexing)
					load(ap, objectState, broadcaster, apClose, ol);
				})
			});
		}));
	})

	function load(ap, objectState, broadcaster, apClose, ol){
		//console.log('loading...');
	
		var viewState = viewStateModule.make(schema, globalMacros, broadcaster, objectState);

		//TODO the ap should initialize the sync handle counter to avoid using the same one multiple times
		//var syncHandleCounter = 1;
	
		function stub(){}
		
		var listenerCbs = {}
		
		var objectSubscribers = {}
		
		var handle = {
			serverInstanceUid: function(){return serverUid;},

			close: function(cb){
				//m.close();
				var cdl = _.latch(2, function(){
					log('closed server')
					cb()
				})
				apClose(function(){log('closed ap');cdl()})
				ol.close(function(){log('closed ol');cdl()})
			},
		
			beginView: function(e, readyCb){
				//_.assertFunction(listenerCb);
				_.assertLength(arguments, 2)
				_.assertFunction(readyCb);
				
				var listenerCb = listenerCbs[e.syncId]
				_.assertFunction(listenerCb)
				log('beginView: ', e)
				return viewState.beginView(e, listenerCb.seq, readyCb)
			},
			persistEdit: function(id, op, path, edit, syncId, computeTemporaryId, cb){//(typeCode, id, path, op, edit, syncId, cb){
				//_.assertLength(arguments, 7);
				//_.assertInt(id);
				_.assertInt(id)
				_.assertString(op)				
				_.assertArray(path)
				_.assertInt(syncId);
				//_.assertFunction(cb)
				
				log.info('adding edit: ', [id, path, op, edit, syncId])
				//console.log('adding edit: ', JSON.stringify([id, path, op, edit, syncId]))
				
				if(op === 'make'){
					var id = objectState.addEdit(id, op, path, edit, syncId, computeTemporaryId)
					if(!edit.forget){
						//objectSubscribers[syncId](id)//, objectState.getCurrentEditId()-1)
						listenerCbs[syncId].seq.subscribeToObject(id)
					}
					return id
				}else{
					objectState.addEdit(id, op, path, edit, syncId, computeTemporaryId);
				}
			},
			getVersionTimestamps: function(versions, cb){
				var timestamps = ol.getVersionTimestamps(versions)
				cb(timestamps)
			},
			forgetTemporary: function(temporary, syncId){
				_.assertInt(syncId)
				objectState.forgetTemporary(temporary, syncId)
			},
			makeSyncId: function(){
				var syncId = ap.makeNewSyncId();
				return syncId
			},
			endSync: function(syncId){
				if(listenerCbs[syncId]){
					listenerCbs[syncId].seq.end()
					delete listenerCbs[syncId]
				}else{
					console.log('WARNING: tried to end sync handle that does not exist or was already ended: ' + syncId)
					console.log(new Error().stack)
				}
			},
			beginSync: function(syncId, listenerCb, objectCb, viewObjectCb){
				_.assertInt(syncId)
				_.assertFunction(listenerCb)
				_.assertFunction(objectCb)
				_.assertFunction(viewObjectCb)
				
				var alreadySent = {}
				
				var currentSyncId
				var currentResponseId
				var curPath = []
				function sendEditUpdate(up){
					if(up.syncId === undefined) _.errout('no syncId: ' + JSON.stringify(up))
					//_.assertInt(up.syncId)
					if(currentSyncId !== up.syncId){
						currentSyncId = up.syncId
						listenerCb('setSyncId', {syncId: up.syncId}, up.editId)					
					}


					if(up.id !== -1){

						if(currentResponseId !== up.id){
							if(_.isString(up.id)){
								listenerCb('selectTopViewObject', {id: up.id}, up.editId)					
								curPath = []
							}else{
								listenerCb('selectTopObject', {id: up.id},  up.editId)					
								//curPath = []
							}
						}
						currentResponseId = up.id
						
						if(_.isString(up.id)){
		
							_.assertArray(up.path)
							var newPath = [].concat(up.path)
							pathmerger.editToMatch(curPath, newPath, function(op, edit){
								listenerCb(op, edit, up.editId)					
							})
							curPath = newPath
						}
					}
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
							if(e.edits.length === 0){
								log('0 objects actually sent')
							}
							sentBuffer.shift()
						}else if(e.got === false){
							return;
						}else{
							_.assert(e.id === -1 || alreadySent[e.id])
							log('sending edit: ', e)
							sendEditUpdate(e)
							sentBuffer.shift()
						}
					}
				}
				
				function includeObjectCb(id, editId){
					_.assertInt(id)
					_.assert(id >= 0)
					if(alreadySent[id]){
						log('already sent: ' + id)
						return;
					}else{
						log(syncId + ' including object: ' + id + ' editId: ' + editId)
						//TODO buffer for streaming all the edits for the object and any objects it depends on
						var pointer = {got: false, edits: []}
						sentBuffer.push(pointer)
						_.assertInt(editId)
						_.assertInt(id)
						objectState.streamObjectState(alreadySent, id, -1, editId, function(id, objEditsBuffer){
							
							alreadySent[id] = true
							_.assertBuffer(objEditsBuffer)
							pointer.edits.push({id: id, edits: objEditsBuffer})
							
						}, function(){
							log('---- got')
							pointer.got = true
							advanceSentBuffer()
							
							
						})
						return;
					}				
				}
				function alreadyHasCb(id, editId){
					alreadySent[id] = true
				}
				function listenerCbWrapper(e){
					_.assertLength(arguments, 1);
					//_.assertInt(e.typeCode)
					//log('e: ', e)
					//console.log(new Error().stack)
					if(sentBuffer.length > 0){
						sentBuffer.push(e)
					}else{
						sendEditUpdate(e)
					}
				}
				
				function sendViewObjectCb(id, edits){
					//_.errout('TODO: ' + id + ' ' + JSON.stringify(edits))
					viewObjectCb(id, edits, syncId)
				}

				listenerCbs[syncId] = listenerCbWrapper

				var seq = viewSequencer.make(schema, objectState, broadcaster, alreadyHasCb, includeObjectCb, listenerCbWrapper, sendViewObjectCb, syncId)
				listenerCbWrapper.seq = seq
				
				/*objectSubscribers[syncId] = function(id){
					seq.subscribeToObject(id)
				}*/
				
				return syncId
			},
		
			getSnapshots: function(e, cb){
				_.assertLength(arguments, 2);
				var typeCode = e.typeCode;
				var params = JSON.parse(e.params);
				
				_.assertInt(typeCode);

				if(schema._byCode[typeCode].isView){
					viewState.getSnapshots(typeCode, params, cb);
				}else{
					_.errout('ERROR')
				}
			},
			getAllSnapshots: function(e, cb){
				_.assertLength(arguments, 2);
				var typeCode = e.typeCode;
				var params = JSON.parse(e.params);
				var snapshotIds = e.snapshotVersionIds;
				_.assertArray(snapshotIds);

				if(schema._byCode[typeCode].isView){
					_.assertArray(params);
					try{
						viewState.getAllSnapshotStates(typeCode, params, snapshotIds, function(states){
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
			getSnapshot: function(e, cb){
				_.assertLength(arguments, 2);
				
				var typeCode = e.typeCode;
				var params = JSON.parse(e.params)
				var snapshotId = e.latestVersionId;
				var previousId = e.previousVersionId;
				
				_.assert(params.length === schema._byCode[typeCode].viewSchema.params.length);
			
				if(schema._byCode[typeCode].isView){
					_.assertArray(params);
					viewState.getSnapshotState(typeCode, params, snapshotId, previousId, function(res){
						cb(undefined, res)
					}, function(e){
						cb(e)
					});
				}else{
					_.errout('ERROR')
				}			
			},
			end: function(){
				_.each(listenerCbs, function(value){
					value.seq.end()
				})
			}
		};
		//console.log('cbing')
		cb(handle);
	}
}
