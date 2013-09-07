
var _ = require('underscorem')
var log = require('quicklog').make('minnow/longpoll')

var seedrandom = require('seedrandom')

exports.make = function(app, appName, prefix, identifier){
	_.assertLength(arguments, 4)

	var userTokenBySyncId = {}

	var endingCb
	
	var handle = {
		handleErrors: function(){
			return function(e){
				_.assertDefined(e)
				console.log('longpoll error: ' + e)
			}
		},
		exposeBeginSync: function(cb, endCb){
			endingCb = endCb
			
			app.get('/mnw/sync/'+appName+'/:random', identifier, function(req, httpRes){
				
				cb(req.userToken, function(syncId){
					var data = JSON.stringify({syncId: syncId.toString()})

					userTokenBySyncId[syncId] = req.userToken
					
					console.log('registered sync id user ' + syncId + ' -> ' + req.userToken)

					httpRes.setHeader('Content-Type', 'application/json');
					httpRes.setHeader('Content-Length', data.length);
					httpRes.setHeader('Cache-Control', 'no-cache, no-store');
					//httpRes.setHeader('Cache-Control', 'max-age=0');
					httpRes.end(data)
				})
			})
		},
		receiveUpdates: function(cb){
			app.post('/mnw/xhr/update/' + appName + '/:syncId', identifier, function(req, res){
				var msgs = req.body
				var syncId = seedrandom.uuidStringToBuffer(req.params.syncId)
				//_.assertBuffer(syncId)
				function replyCb(){
					res.setHeader('Content-Type', 'text/plain');
					res.setHeader('Content-Length', '0');
					res.setHeader('Cache-Control', 'no-cache, no-store');

					res.end()
				}
				function securityFailureCb(){
					res.send(403)
				}
				function deadSyncHandleCb(){
					res.send(400)
				}
				cb(req.userToken,syncId, msgs, replyCb, securityFailureCb, deadSyncHandleCb)
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
	var lastStartedWaiting = {}
	var waitingForLongPoll = {}
	var longPollCaller = {}
	var isOpen = {}
	
	setInterval(function(){
		var now = Date.now()
		var toRemove = []

		Object.keys(lastStartedWaiting).forEach(function(k){
			var last = lastStartedWaiting[k]
			if(isOpen[k]) return
			if(now - last > 30*1000){
				console.log('long poll sync handle was not used for too long, destroying sync handle: ' + k)
				toRemove.push(k)
			}
		})
		toRemove.forEach(function(k){

			var userToken = userTokenBySyncId[k]
			
			delete lastStartedWaiting[k]
			delete waitingForLongPoll[k]
			delete longPollCaller[k]
			delete userTokenBySyncId[k]
			
			endingCb(userToken, parseInt(k))
			
		})
	},5000)
	
	//long poll connections to send update server->client for a sync handle
	//TODO if no longpoll connection is made for a syncId for awhile, delete it
	app.get('/mnw/xhr/longpoll/' + appName + '/:syncId', identifier, function(req, res){
		var syncId = req.params.syncId

		if(userTokenBySyncId[syncId] !== req.userToken){
			//log('user(' + req.userToken + ') attempted to access sync handle of user(' + userTokenBySyncId[syncId] + ') - access denied')
			console.log('WARNING: user(' + req.userToken + ') attempted to access sync handle of user(' + userTokenBySyncId[syncId] + ') - access denied (syncId: ' + syncId + ')')
			console.log(req.url)
			res.send(403)
			return
		}

		lastStartedWaiting[syncId] = Date.now()
		isOpen[syncId] = true
		console.log('open: ' + syncId)
				
		function sendContent(content){
			var data = new Buffer(content)
		    res.setHeader('Content-Type', 'application/json');
		    res.setHeader('Content-Length', data.length);
		    res.header('Cache-Control', 'no-cache, no-store')
			res.send(data)
			isOpen[syncId] = false
			lastStartedWaiting[syncId] = Date.now()
			console.log('closed: ' + syncId)
		}
		
		var stillOpen = true
		
		
		req.on('close', function(err){
			//console.log('req close: ' + err)
			isOpen[syncId] = false
			console.log('*closed: ' + syncId)
			lastStartedWaiting[syncId] = Date.now()
			stillOpen = false
		})
		
		
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
						if(!stillOpen){
							console.log('cannot send messages, req closed in meantime')
							return
						}
						sendPending = false
						waitingForLongPoll[syncId] = []
						sendContent(JSON.stringify(msgsToSend))
						longPollCaller[syncId] = undefined;
					},50)
				}else{
					console.log('WARNING: send pending')
				}
			}
		}
	})
	
	return handle
}
