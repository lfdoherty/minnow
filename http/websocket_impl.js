
var _ = require('underscorem')

var log = require('quicklog').make('minnow/websocket')

var WebSocketServer = require('ws').Server

function stub(){}

exports.make = function(authenticateByToken, local, urlPrefix, listeners){//secureLocal){
	_.assertFunction(authenticateByToken)

	var receiver

	var senders = {}
	
	var handle = {
		handleErrors: function(){
			return function(e){
				_.assertDefined(e)
				console.log('websocket error: ' + e)
			}
		},
		exposeBeginSync: function(cb, endCb){

			wss = new WebSocketServer({server: local.getSecureServer(), path: urlPrefix+'/ws/'})
			
			wss.on('error', function(err){
				console.log('ERROR: ' + err)
			})
			
			wss.on('connection', function(ws){

				var syncId
				
				ws.on('error', function(err){
					console.log(err)
					close()
				})
				ws._socket.on('error', function(e){	
					console.log('caught error directly: ' + e)
				});
				
				//console.log('got websocket connection, waiting for token')
				var closed = false

				var waitingForToken = true
				var userToken
				var authBuffer = []

				ws.on('message', function(data,flags){
					if(userToken === undefined){
						var setupMsg = JSON.parse(data)
						console.log('got setup msg: ' + JSON.stringify(setupMsg))
						authenticateByToken(setupMsg.token, function(err, t){
							if(err){
								console.log('websocket client provided incorrect authentication info, closing socket: ' + err)
								ws.close()
								return
							}
							userToken = t
							

							cb(userToken, function(theSyncId){

								if(closed) return
								
								syncId = theSyncId

								senders[syncId] = send

								if(listeners.websocketFromUrl) listeners.websocketFromUrl(syncId, setupMsg.url)

								try{
									ws.send(JSON.stringify([{syncId: syncId}]))
									authBuffer.forEach(send)
								}catch(e){
									console.log('send error: ' + e)
									console.log('shutting down websocket connection')
									try{
										ws.close()
									}catch(e){
									}
								}
							})
						})
					}else{
						if(data === 'heartbeat') return
						var msg = JSON.parse(data)
						//console.log('data: ' + data)
						receive(msg)
					}
				})

				function securityFailureCb(){
					ws.send(JSON.stringify([{type: 'security error', msg: 'tried to access non-accessible view'}]))
				}
				function deadSyncIdCb(){
					ws.send(JSON.stringify([{type: 'error', msg: 'sync id is dead or non-existent'}]))
				}
				function receive(msg){
					if(userToken === undefined){
						authBuffer.push(msg)
					}else{
						receiver(userToken, syncId, [msg], stub, securityFailureCb, deadSyncIdCb)
					}
				}	

				function send(msgs){
					if(closed){
						console.log('WARNING: tried to send to closed websocket: ' + syncId)
						console.log(new Error().stack)
						return
					}
					try{
						ws.send(JSON.stringify(msgs))
					}catch(e){
						log.warn(e)
					}
				}
				
				function close(){
					console.log('closed: ' + syncId)
					delete senders[syncId]
					closed = true
					endCb(userToken, syncId)
				}

				
				
				ws.on('close', close)
			})
		},
		receiveUpdates: function(cb){
			receiver = cb
			return
		},
		sendAllToClient: function(syncId, msgs){
			//console.log('sending to: ' + syncId + ' ' + (senders[syncId] == undefined))
			if(senders[syncId] == undefined){
				console.log('WARNING: tried to send to closed websocket sync handle')
				console.log(new Error().stack)
				return
			}
			senders[syncId](msgs)
		},
		failToBegin: function(err, syncId){
			handle.sendToClient(syncId, {type: 'error', code: err.code, msg: err+''})
		}
	}
	
	return handle
}
