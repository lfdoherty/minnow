
var log = require('quicklog').make('minnow/longpoll')

exports.make = function(app, appName, identifier){

	var userTokenBySyncId = {}

	var handle = {
		handleErrors: function(){
			return function(e){
				_.assertDefined(e)
				console.log('longpoll error: ' + e)
			}
		},
		exposeBeginSync: function(cb){
		
			app.get(exports, '/mnw/sync/'+appName+'/:random', identifier, function(req, httpRes){
				
				cb(req.userToken, function(syncId){
					var data = JSON.stringify({syncId: syncId})

					userTokenBySyncId[syncId] = req.userToken

					httpRes.setHeader('Content-Type', 'application/json');
					httpRes.setHeader('Content-Length', data.length);
					//httpRes.setHeader('Cache-Control', 'max-age=0');
					httpRes.end(data)
				})
			})
		},
		receiveUpdates: function(cb){
			app.post(exports,  '/mnw/xhr/update/' + appName + '/:syncId', identifier, function(req, res){
				var msgs = req.body
				var syncId = parseInt(req.params.syncId)
				function replyCb(){
					res.setHeader('Content-Type', 'text/plain');
					res.setHeader('Content-Length', '0');

					res.end()
				}
				function securityFailureCb(){
					res.send(403)
				}
				cb(req.userToken,syncId, msgs, replyCb, securityFailureCb)
			})
		},
		sendAllToClient: sendToClient,
		failToBegin: function(err, syncId){
			sendToClient(syncId, {type: 'error', code: err.code, msg: err+''})
		}
	}
	
	function sendToClient(syncId, msgs){
		if(longPollCaller[syncId]){
			longPollCaller[syncId](msgs)
		}else{
			if(waitingForLongPoll[syncId] === undefined) waitingForLongPoll[syncId] = []
			log('adding to waiting list')
			waitingForLongPoll[syncId] = waitingForLongPoll[syncId].concat(msgs)//.push(msgs)
		}
	}
	var waitingForLongPoll = {}
	var longPollCaller = {}
	//long poll connections to send update server->client for a sync handle
	//TODO if no longpoll connection is made for a syncId for awhile, delete it
	app.get(exports, '/mnw/xhr/longpoll/' + appName + '/:syncId', identifier, function(req, res){
		var syncId = parseInt(req.params.syncId)

		/*var syncHandle = getSyncHandle(syncId)//syncHandles[syncId]
		if(syncHandle === undefined) _.errout('no known sync handle for syncId: ' + syncId)
		if(syncHandle.owningUserId !== req.userToken){
			log('user(' + req.userToken + ') attempted to access sync handle of user(' + syncHandle.owningUser + ') - access denied')
			res.send(403)
			return
		}*/
		if(userTokenBySyncId[syncId] !== req.userToken){
			log('user(' + req.userToken + ') attempted to access sync handle of user(' + userTokenBySyncId[syncId] + ') - access denied')
			console.log('WARNING: user(' + req.userToken + ') attempted to access sync handle of user(' + userTokenBySyncId[syncId] + ') - access denied')
			console.log(req.url)
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
			longPollCaller[syncId] = function(msgs){
				log('sending content to waiting long poll request')
				msgsToSend = msgsToSend.concat(msgs)
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
	
	return handle
}
