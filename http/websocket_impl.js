
var _ = require('underscorem')

var log = require('quicklog').make('minnow/websocket')

var WebSocketServer = require('ws').Server

function stub(){}

exports.make = function(authenticateByToken, local){
	_.assertFunction(authenticateByToken)

	var receiver

	var senders = {}
	
	var handle = {
		exposeBeginSync: function(cb, endCb){

			wss = new WebSocketServer({server: local.getServer()/*, path: '/websocket'*/})
			
			wss.on('error', function(err){
				console.log('ERROR: ' + err)
			})
			
			wss.on('connection', function(ws){

				var syncId
				
				
				ws.on('error', function(err){
					console.log(err)
					//ws.close()
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
						//console.log('got token: ' + data)
						authenticateByToken(data, function(err, t){
							if(err){
								log.warn('websocket client provided incorrect authentication info, closing socket: ' + err)
								ws.close()
								return
							}
							userToken = t

							cb(userToken, function(theSyncId){

								if(closed) return
								
								syncId = theSyncId

								senders[syncId] = send
								
								//console.log('syncId: ' + syncId)
			
								ws.send(JSON.stringify([{syncId: syncId}]))
								authBuffer.forEach(send)
							})
						})
					}else{
						var msg = JSON.parse(data)
						//console.log('data: ' + data)
						receive(msg)
					}
				})

				function securityFailureCb(){
					ws.send(JSON.stringify([{type: 'security error', msg: 'tried to access non-accessible view'}]))
				}
				function receive(msg){
					if(userToken === undefined){
						authBuffer.push(msg)
					}else{
						receiver(userToken, syncId, [msg], stub, securityFailureCb)
					}
				}	

				function send(msgs){
					if(closed){
						console.log('WARNING: tried to send to closed websocket: ' + syncId)
						console.log(new Error().stack)
						return
					}
					try{
						//ws.send({type: 'transaction', size: msgs.length})
						//for(var i=0;i<msgs.length;++i){
						//	ws.send(JSON.stringify(msg))
						//}
						ws.send(JSON.stringify(msgs))
					}catch(e){
						log.warn(e)
					}
				}
				
				function close(){
					console.log('closed: ' + syncId)
					delete senders[syncId]
					closed = true
					endCb(syncId)
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
