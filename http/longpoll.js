
var _ = require('underscorem')

exports.name = 'minnow-service-core';
exports.dir = __dirname;
exports.module = module
//exports.requirements = ['matterhorn-standard'];

exports.load = function(appName, schema, authenticator, minnowClient){
	var clientInfoBySyncId = {};
	
	console.log('setting up long poll -------------')
	var syncHandles = {}
	
	_.assertString(appName)
	
	//TODO dedup for multiple?
	app.get(exports, '/mnw/sync/'+appName, authenticator, function(req, httpRes){
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
		minnowClient.beginSync(listenerCb, objectCb, function(syncId, syncHandle){
			theSyncId = syncId
			syncHandles[syncId] = syncHandle
			console.log('got sync handle: ' + syncId)
			var data = JSON.stringify({syncId: syncId})
			httpRes.setHeader('Content-Type', 'application/json');
			httpRes.setHeader('Content-Length', data.length);
			httpRes.end(data)
		})
	})

	function objectListener(connectionSyncId, id, edits){
		_.assertLength(arguments, 3);
		
		console.log('got e: ' + JSON.stringify([id, edits]).slice(0, 300));
		
		//_.assertString(e.op)
		
		console.log('sending socket.io message for sync ' + connectionSyncId)// + ', editId: ' + e.editId);
		_.assertInt(id)
		_.assertArray(edits)
		var msg = ['object', id, edits];

		sendToClient(connectionSyncId, msg)
	}
	function syncListener(connectionSyncId, e){
		_.assertLength(arguments, 2);
		
		console.log('got e: ' + JSON.stringify(e).slice(0, 300));
		
		_.assertString(e.op)
		
		console.log('sending socket.io message for sync ' + connectionSyncId + ', editId: ' + e.editId);

		var msg = ['edit', e.op, e.edit, e.editId];

		sendToClient(connectionSyncId, msg)
	}

	//used to get updates for a sync handle
	app.post(exports,  '/mnw/xhr/update/' + appName + '/:syncId', authenticator, function(req, res){

		var msgs = req.body
		var syncId = parseInt(req.params.syncId)
		
		
		function doViewSetup(msg){
			var snapshotId = parseInt(msg.snapshotVersion);
			
			console.log(JSON.stringify(Object.keys(schema)))
			var viewCode = schema[msg.viewName].code
			_.assertInt(viewCode)
			
			var viewReq = {
				syncId: syncId,
				typeCode: viewCode,
				params: msg.params,//JSON.stringify(msg.params),
				latestSnapshotVersionId: msg.version//snapshotIds[snapshotIds.length-1]
			}
			syncHandles[syncId].beginView(viewReq, function(e){
				console.log('BEGAN VIEW')
				sendToClient(syncId, {type: 'ready', uid: msg.uid, data: JSON.parse(e.updatePacket)})
			})
		}

		var syncHandle = syncHandles[syncId]
		if(syncHandle === undefined) _.errout('no known sync handle for syncId: ' + syncId)
		//for(var i=0;i<msgs.length;++i){
		msgs.forEach(function(msg){
			//var msg = msgs[i]
			console.log('msg: ' + JSON.stringify(msg).slice(0, 300))
			if(msg.type === 'setup'){
				doViewSetup(msg)
			}else{
				msg = msg.data

				/*var persistRequest = {
					typeCode: msg.typeCode,
					id: msg.id,
					path: JSON.stringify(msg.path),
					edit: msg.edit,
					op: msg.op,
					syncId: syncId
				}*/
				console.log(syncId + ' longpoll persisting ' + msg.op + ' ' + JSON.stringify(msg.edit))
				syncHandle.persistEdit(msg.op, msg.edit, syncId, function(response){
					//TODO?
					if(msg.op === 'make'){
						//_.errout('TODO: ' + msg.op + ' ' + JSON.stringify(response))
						//var msg = ['edit', e.op, e.edit, e.editId];

						sendToClient(syncId, ['reify', response.id, response.temporary])
						
					}
				});
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
			waitingForLongPoll[syncId].push(msg)
		}
	}
	var waitingForLongPoll = {}
	var longPollCaller = {}
	//long poll connections to send update server->client for a sync handle
	//TODO if no longpoll connection is made for a syncId for awhile, delete it
	app.get(exports, '/mnw/xhr/longpoll/' + appName + '/:syncId', authenticator, function(req, res){
		var syncId = parseInt(req.params.syncId)
		
		function sendContent(content){
			var data = new Buffer(content)
		    res.setHeader('Content-Type', 'application/json');
		    res.setHeader('Content-Length', data.length);
			res.send(data)
		}
		
		var msgsToSend = waitingForLongPoll[syncId] || []
		if(msgsToSend.length > 0){
		   sendContent(JSON.stringify(msgsToSend))
			waitingForLongPoll[syncId] = []
		}else{
			longPollCaller[syncId] = function(msg){
				sendContent(JSON.stringify([msg]))
				longPollCaller[syncId] = undefined;
			}
		}
	})
	
	return clientInfoBySyncId
}
