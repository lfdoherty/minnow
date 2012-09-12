"use strict";

var _ = require('underscorem')

exports.name = 'minnow-service-core';
exports.dir = __dirname;
exports.module = module
//exports.requirements = ['matterhorn-standard'];

var fs = require('fs')

var log = require('quicklog').make('minnow/longpoll')

exports.load = function(app, appName, schema, identifier, viewSecuritySettings, minnowClient, syncHandleCreationListener){
	_.assertFunction(identifier)
	_.assertString(appName)
	_.assertFunction(syncHandleCreationListener)
	
	var clientInfoBySyncId = {};
	
	log('setting up long poll -------------')
	var syncHandles = {}
	
	var gvtHandles = {}
	
	//TODO dedup for multiple?
	app.get(exports, '/mnw/sync/'+appName+'/:random', identifier, function(req, httpRes){
		var theSyncId;
		//var state = {{
		function listenerCb(e){
			syncListener(theSyncId, e)
		}
		function objectCb(id, edits){
			_.assertLength(arguments, 2)
			//_.errout('TODO: ' + JSON.stringify(e))
			objectListener(theSyncId, id, edits)
		}
		function makeCb(id, temporary){
			//_.errout('TODO')
			//console.log('makeCb in longpoll: ' + temporary + ' -> ' + id)
			sendToClient(theSyncId, ['reify', id, temporary])
		}
		function versionTimestamps(requestId, timestamps){
			_.assertInt(requestId)
			_.assertArray(timestamps)
			gvtHandles[requestId](timestamps)
			//sendToClient(theSyncId, ['versionTimestamps', {uid: uid, timestamps: timestamps}])			
		}
		
		minnowClient.beginSync(listenerCb, objectCb, makeCb, versionTimestamps, function(syncId, syncHandle){
			theSyncId = syncId
			syncHandle.owningUserId = req.user.id
			syncHandles[syncId] = syncHandle
			log('got sync handle: ' + syncId)
			syncHandleCreationListener(req, syncId)
			var data = JSON.stringify({syncId: syncId})
			httpRes.setHeader('Content-Type', 'application/json');
			httpRes.setHeader('Content-Length', data.length);
			//httpRes.setHeader('Cache-Control', 'max-age=0');
			httpRes.end(data)
		})
	})

	function objectListener(connectionSyncId, id, edits){
		_.assertLength(arguments, 3);
		
		log('$got object e: ' + JSON.stringify([id, edits]).slice(0, 300));
		
		//_.assertString(e.op)
		
		log('sending message for sync ' + connectionSyncId)// + ', editId: ' + e.editId);
		_.assertInt(id)
		_.assertArray(edits)
		var msg = ['object', id, edits];

		sendToClient(connectionSyncId, msg)
	}
	function syncListener(connectionSyncId, e){
		_.assertLength(arguments, 2);
		
		log('$got e: ' + JSON.stringify(e).slice(0, 300));
		
		_.assertString(e.op)
		
		log('sending message for sync ' + connectionSyncId + ': ' + JSON.stringify(e));

		var msg = ['edit', e.op, e.edit, e.editId];

		sendToClient(connectionSyncId, msg)
	}

	//used to get updates for a sync handle
	app.post(exports,  '/mnw/xhr/update/' + appName + '/:syncId', identifier, function(req, res){

		var msgs = req.body
		var syncId = parseInt(req.params.syncId)
		
		function doViewSetup(msg){
			var snapshotId = parseInt(msg.snapshotVersion);
			
			log(JSON.stringify(Object.keys(schema)))
			var viewCode = schema[msg.viewName].code
			_.assertInt(viewCode)

			var viewName = schema._byCode[viewCode].name
			var securitySetting = viewSecuritySettings[viewName]
			
			if(securitySetting === undefined){
				log('security policy denied access to view (view is not accessible via HTTP): ' + viewName);
				console.log('WARNING: security policy denied access to view (view is not accessible via HTTP): ' + viewName);
				return
			}
			//var params = serviceModule.parseParams(msg.params, viewSchema)
			securitySetting(function(passed){
				if(!passed){
					log('security policy denied access to view: ' + viewName);
					console.log('WARNING: security policy denied access to view: ' + viewName);
					return
				}
			
				var viewReq = {
					syncId: syncId,
					typeCode: viewCode,
					params: msg.params,//JSON.stringify(msg.params),
					latestSnapshotVersionId: msg.version//snapshotIds[snapshotIds.length-1]
				}
				syncHandles[syncId].beginView(viewReq, function(e){
					log(syncId + ' BEGAN VIEW(' + viewCode + ')' + msg.params + ': ' + msg.uid)
					sendToClient(syncId, {type: 'ready', uid: msg.uid, data: JSON.parse(e.updatePacket)})
				})
			}, JSON.parse(msg.params), req)
		}

		var syncHandle = syncHandles[syncId]
		if(syncHandle === undefined) _.errout('no known sync handle for syncId: ' + syncId)
		if(syncHandle.owningUserId !== req.user.id){
			log('user(' + req.user.id + ') attempted to access sync handle of user(' + syncHandle.owningUser + ') - access denied')
			console.log('WARNING: user(' + req.user.id + ') attempted to access sync handle of user(' + syncHandle.owningUser + ') - access denied')
			res.send(403)
			return
		}

		msgs.forEach(function(msg){

			log('msg: ' + JSON.stringify(msg).slice(0, 300))
			if(msg.type === 'setup'){
				doViewSetup(msg)
			}else if(msg.type === 'versionTimestamps'){
				//_.errout('TODO')
				_.assertArray(msg.versions)
				console.log('versions: ' + JSON.stringify(msg.versions))
				var requestId = syncHandle.getVersionTimestamps(msg.versions)
				gvtHandles[requestId] = function(timestamps){
					delete gvtHandles[requestId]
					sendToClient(syncId, {type: 'versionTimestamps', uid: msg.uid, timestamps: timestamps})
				}
			}else{
				msg = msg.data

				log(syncId + ' longpoll persisting ' + msg.op + ' ' + JSON.stringify(msg.edit))
				syncHandle.persistEdit(msg.op, msg.edit, syncId)
			}
		})

	    res.setHeader('Content-Type', 'text/plain');
	    res.setHeader('Content-Length', '0');

		res.end()
	})

	function sendToClient(syncId, msg){
		if(longPollCaller[syncId]){
			longPollCaller[syncId](msg)
		}else{
			if(waitingForLongPoll[syncId] === undefined) waitingForLongPoll[syncId] = []
			log('adding to waiting list')
			waitingForLongPoll[syncId].push(msg)
		}
	}
	var waitingForLongPoll = {}
	var longPollCaller = {}
	//long poll connections to send update server->client for a sync handle
	//TODO if no longpoll connection is made for a syncId for awhile, delete it
	app.get(exports, '/mnw/xhr/longpoll/' + appName + '/:syncId', identifier, function(req, res){
		var syncId = parseInt(req.params.syncId)

		var syncHandle = syncHandles[syncId]
		if(syncHandle === undefined) _.errout('no known sync handle for syncId: ' + syncId)
		if(syncHandle.owningUserId !== req.user.id){
			log('user(' + req.user.id + ') attempted to access sync handle of user(' + syncHandle.owningUser + ') - access denied')
			res.send(403)
			return
		}
				
		function sendContent(content){
			var data = new Buffer(content)
		    res.setHeader('Content-Type', 'application/json');
		    res.setHeader('Content-Length', data.length);
			res.send(data)
		}
		
		var sendPending = false
		if(waitingForLongPoll[syncId] === undefined) waitingForLongPoll[syncId] = []
		var msgsToSend = waitingForLongPoll[syncId]
		if(msgsToSend.length > 0){
			log('got long poll request, sending')//TODO wait a bit?
			sendContent(JSON.stringify(msgsToSend))
			waitingForLongPoll[syncId] = []
		}else{
			log('got long poll request, waiting for msgs...')
			longPollCaller[syncId] = function(msg){
				log('sending content to waiting long poll request')
				msgsToSend.push(msg)
				if(!sendPending){
					sendPending = true
					setTimeout(function(){
						log('...finally sending response with some messages: ' + msgsToSend.length)
						sendPending = false
						waitingForLongPoll[syncId] = []
						sendContent(JSON.stringify(msgsToSend))
						longPollCaller[syncId] = undefined;
					},50)
				}
			}
		}
	})
	
	return clientInfoBySyncId
}
