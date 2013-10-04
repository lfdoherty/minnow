
var _ = require('underscorem')

var log = require('quicklog').make('minnow/websocket')

var WebSocketServer = require('ws').Server

var b64 = require('./js/b64')
var arraystring = require('./js/arraystring')

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
			console.log('wss listening: ' + urlPrefix + '/ws/')
			
			wss.on('error', function(err){
				console.log('ERROR: ' + err)
			})
			
			wss.on('connection', function(ws){

				var syncId
				
				ws.on('error', function(err){
					console.log('ws got err: ')
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
					//var old = data
					data = b64.decode(data)//arraystring.bufferToString(data)
					/*for(var i=0;i<data.length;++i){
						var v = data[i]
						console.log(i + ': ' + v)
					}
					console.log('data: (' + data + ') ' + data.length)*/
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
								_.assertString(theSyncId)
								_.assertLength(theSyncId, 8)

								senders[syncId] = send

								if(listeners.websocketFromUrl) listeners.websocketFromUrl(syncId, setupMsg.url)

								try{
									var encoded = b64.encode(JSON.stringify([{syncId: syncId}]))
									//console.log('encoded: ' + encoded + '|')
									ws.send(encoded)
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
						if(data === '"heartbeat"') return
						//console.log('msg data: (' + data + ')')
						var msg = JSON.parse(data)
						//console.log('data: ' + data)
						receive(msg)
					}
				})

				function securityFailureCb(viewName){
					ws.send(b64.encode(JSON.stringify([{type: 'security error', msg: 'tried to access non-accessible view: ' + viewName}])))
				}
				function deadSyncIdCb(){
					ws.send(b64.encode(JSON.stringify([{type: 'error', msg: 'sync id is dead or non-existent'}])))
				}
				function receive(msg){
					if(userToken === undefined){
						authBuffer.push(msg)
					}else{
						receiver(userToken, syncId, [msg], stub, securityFailureCb, deadSyncIdCb)
					}
				}	

				function send(msgs){
					//console.log('sending: ' + JSON.stringify(msgs))
					if(closed){
						console.log('WARNING: tried to send to closed websocket: ' + syncId)
						console.log(new Error().stack)
						return
					}
					try{
						ws.send(b64.encode(JSON.stringify(msgs)))
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
