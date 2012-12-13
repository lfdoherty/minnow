"use strict";

var net = require('net')
var fs = require('fs')

var quicklog = require('quicklog')

var log = quicklog.make('minnow/tcp.server')

var _ = require('underscorem')
var shared = require('./tcp_shared');
var bin = require('./../util/bin')
var server = require('./server');
var fparse = require('fparse')

var pathsplicer = require('./pathsplicer')
var pathmerger = require('./pathmerger')

var serializeViewObject = require('./view_sequencer').serializeViewObject

var editFp = require('./tcp_shared').editFp
var editCodes = editFp.codes
var editNames = editFp.names

var totalBytesReceived = 0
var totalBytesSent = 0

var WriteFlushInterval = 10

var RandomFailureDelay = 100000

var ReconnectPeriod = 1000*60//a client may reconnect within 1 minute

function makeServer(appSchema, appMacros, dataDir, port, readyCb){
	_.assertLength(arguments, 5);
	_.assertInt(port);
	_.assertFunction(readyCb);
	
	server.make(appSchema, appMacros, dataDir, function(s){
		createTcpServer(appSchema, port, s, readyCb);
	});
}

function serializeSnapshotVersionList(versionList){
	var buf = new Buffer((versionList.length*4)+1)
	buf[0] = versionList.length
	var off = 1
	for(var i=0;i<versionList.length;++i){
		bin.writeInt(buf,off,versionList[i])
		off+=4
	}
	return buf
}
function serializeAllSnapshots(snapshots){
	_.assertArray(snapshots)

	var len = 1
	for(var i=0;i<snapshots.length;++i){
		len += snapshots[i].length
	}
	var buf = new Buffer(len)
	buf[0] = snapshots.length
	var off = 1
	for(var i=0;i<snapshots.length;++i){
		var s = snapshots[i]
		_.assertBuffer(s)
		s.copy(buf,off)
		off += s.length
	}
	var str = ''
	for(var i=0;i<snapshots[0].length;++i){
		str += ' ' + snapshots[0][i]
	}

	return buf
}

function deserializeSnapshotVersionIds(b){
	var many = b[0]
	var arr = []
	var off = 1
	for(var i=0;i<many;++i){
		arr.push(bin.readInt(b, off))
		off += 4
	}
	return arr
}

var logCounter = 0

var fp = shared.editFp
	
function createTcpServer(appSchema, port, s, readyCb){
	log('making tcp server')
	var connections = []
	
	
	var temporaryGeneratorsBySyncId = {}
	var lastTemporaryId = {}
	function getTemporaryGenerator(syncId){
		if(temporaryGeneratorsBySyncId[syncId]){
			return temporaryGeneratorsBySyncId[syncId]
		}
		return makeTemporaryGenerator(syncId)
	}
	
	function makeTemporaryGenerator(syncId){
		var nextTemporary = -2
		function temporaryGenerator(){
			var nt = nextTemporary
			--nextTemporary
			lastTemporaryId[syncId] = nt
			//console.log('generated temporary for ' + syncId + ': ' + nt)
			return nt
		}
		return temporaryGeneratorsBySyncId[syncId] = temporaryGenerator
	}

	var liveConnections = {}//index for reconnection	

	var isClosed = false
	
	/* TODO implement reconnect timeout
	var dyingConnections = []

	var reconnectTimeoutHandle = setTimeout(function(){
		var dead = []
		var now = Date.now()
		dyingConnections.forEach(function(c){
			if(now - c.connectionLostTime > ReconnectPeriod){
			}
		})
	},1000)*/

	var tcpServer = net.createServer(function(c){

		if(isClosed){
			_.errout('getting connection despite server being closed')
		}
		
		var isDead = false
	
		var connectionId
		
		c.on('error', function(e){
			console.log('tcp server error: ' + e + ' ' + require('util').inspect(e))
			if((''+e) === 'Error: This socket is closed.'){
				_.assert(isDead)
			}
			//_.assert(isDead)
		})
		
		var randomFailureDelay = Math.floor(Math.random()*1000*RandomFailureDelay)+1000
		var randomHandle = setTimeout(function(){
			console.log('server randomly destroyed tcp connection: ' + connectionId)
			c.destroy()
		},randomFailureDelay)

		var ws = quicklog.make('minnow/tcp server->client.' + (++logCounter))
	
		log('tcp server got connection')
		
		connections.push(c)
		
		//var w
		var rrk = fparse.makeRs()

		function setupConnection(){
			var syncId = s.makeSyncId()
		
			var eHandle = {syncId: syncId}
			var wrappedListenerCb = sendEditUpdate.bind(eHandle)
			function wrappedObjCb(ob){
				//console.log('sending: ' + JSON.stringify(ob).substr(0,100))
				sendObject(syncId, ob)
			}
		
			function viewObjectCb(id, obj, syncId){//TODO find a more optimal way (binary serialization, etc.)
				_.assertInt(syncId)

				var tw = fparse.makeSingleBufferWriter()
				serializeViewObject(tw, fp.codes, fp.writersByCode, obj)
				var edits = tw.finish()
			
				var ob = {
					id: id,
					edits: edits,
					destinationSyncId: syncId,
				}
				w.updateViewObject(ob);
			}

			s.beginSync(syncId, wrappedListenerCb, wrappedObjCb, viewObjectCb)
		
			var setupStr = JSON.stringify({syncId: syncId, schema: appSchema})
			var setupByteLength = Buffer.byteLength(setupStr, 'utf8')
			var setupBuffer = new Buffer(setupByteLength+8)
			bin.writeInt(setupBuffer, 0, setupByteLength)
			setupBuffer.write(setupStr, 8)
		
			c.write(setupBuffer)

			var wHandle = {
				write: function(buf){
					if(this.c.isDead) _.errout('should not be writing to a dead socket')
					this.c.write(buf);
					//console.log('wfs writing to c: ' + buf.length)
					totalBytesSent += buf.length
				},
				end: function(){
					//TODO?
				},
				c: c
			}
			var wfs = fparse.makeReplayableWriteStream(shared.serverResponses, wHandle)
			wfs.wHandle = wHandle
		
			/*
			var wfs = fparse.makeWriteStream(shared.serverResponses, {
				write: function(buf){
					c.write(buf);
					totalBytesSent += buf.length
					//if(Math.random() < .1) console.log('(' + buf.length + ') total bytes sent: ' + totalBytesSent);
				},
				end: function(){
					//TODO?
				}
			})*/
		
			var w = wfs.fs
		
			wfs.beginFrame()
			w.flush = function(){
				//if(wfs.hasWritten()){
					wfs.endFrame()
					wfs.beginFrame()
				//}
			}
			w.end = function(){}
				
			var flushHandle = setInterval(function(){
				w.flush()
			},WriteFlushInterval)
		
			//these are the *incoming* edit's path state
			var pathsFromClientById = {}//TODO these should be indexed by syncId as well as id
		
			function sendObject(syncId, ob){
				_.assertBuffer(ob.edits)
				ws('sending object: ' + ob.id)
				//console.log('sending object: ' + ob.id)
				ob.destinationSyncId = syncId
				conn.w.updateObject(ob);
			}

			var nkw = fparse.makeTemporaryBufferWriter(1024*1024)
			function binEdit(op, edit){
				//console.log('getting writer: ' + e.type)
				fp.writersByCode[op](nkw.w, edit)
				return nkw.get()
			}
		
			function sendEditUpdate(op, edit, editId){
				_.assertLength(arguments, 3)
			
				var destinationSyncId = this.syncId
			
				if(w === undefined){
					throw new Error('got update after already disconnected')
				}
			
				sendUpdate(op, edit, editId, destinationSyncId)
			
			}
			function sendUpdate(op, edit, editId, destinationSyncId){
				_.assertLength(arguments, 4)
				_.assert(destinationSyncId > 0)
				//console.log('writing edit', op, edit, syncId, editId, destinationSyncId)
				//console.log(new Error().stack)
			
				var binaryEdit = binEdit(op, edit)
				if(syncId === undefined) syncId = -1
				_.assertInt(editId)
				var update = {
					op: op,
					edit: binaryEdit,
					editId: editId,
					destinationSyncId: destinationSyncId
				};

				w.update(update);
			}
			function sendReady(e){
				//_.assertArray(updatePacket)
				//log('sending ready')
				var msg = {requestId: e.requestId}
				w.ready(msg)
				w.flush();
			}
		
		
			var opsByCode = {}
			Object.keys(shared.editSchema._byCode).forEach(function(key){
				opsByCode[key] = shared.editSchema._byCode[key].name
			})
		
			//var pathFromClientFor = {}
			//var currentIdFor = {}
		
			//var reifications = {}
			
			return {
				wfs: wfs,
				flushHandle: flushHandle,
				sendReady: sendReady,
				sendEditUpdate: sendEditUpdate,
				viewObjectCb: viewObjectCb,
				sendObject: sendObject,
				currentIdFor: {},
				pathFromClientFor: {},
				reifications: {},
				lastAck: 0,
				lastOutgoingAck: 0,
				outgoingAckHistory: 0,
				w: w
			}
		}
		var conn
				
		//var lastAck = 0
		var reader = {
			increaseAck: function(e){
				//console.log(e.frameCount + ' -> ' + conn.lastAck)
				if(e.frameCount > conn.lastAck){
					conn.wfs.discardReplayableFrames(e.frameCount - conn.lastAck)
					conn.lastAck = e.frameCount
				}
			},
			reconnect: function(e){
				if(isDead) throw new Error('tried to reconnect via dead client?')
				
				connectionId = e.connectionId
				
				console.log('server got reconnect request: ' + e.connectionId)
				conn = liveConnections[e.connectionId]
				if(conn){
					conn.wfs.wHandle.c = c//adjust writer to send to the new socket
					conn.w = conn.wfs.fs
					
					
					//TODO replay server->client messages
					if(e.manyServerMessagesReceived > conn.lastAck){
						console.log('discarding frames: ' + (e.manyServerMessagesReceived - conn.lastAck) + ' (' + conn.lastAck + ')')
						conn.wfs.discardReplayableFrames(e.manyServerMessagesReceived - conn.lastAck)
						conn.lastAck = e.manyServerMessagesReceived
					}
					conn.wfs.replay()
					

					//inform client how many messages the server has received from them so far					
					console.log('server confirming reconnect: ' + (conn.deser.getFrameCount() + conn.outgoingAckHistory)+' '+conn.deser.getFrameCount()+' '+ conn.outgoingAckHistory)
					conn.w.confirmReconnect({
						manyClientMessagesReceived: conn.deser.getFrameCount() + conn.outgoingAckHistory
					})
					conn.w.flush()

					conn.lastOutgoingAck = conn.deser.getFrameCount() + conn.outgoingAckHistory

					conn.deser = deser

					//conn.lastOutgoingAck += conn.deser.getFrameCount()
					
					//setIntervalf()
					conn.flushHandle = setInterval(function(){
						conn.w.flush()
					},10)

					if(conn.randomHandle !== undefined){
						clearTimeout(conn.randomHandle)
					}
			
					var randomFailureDelay = Math.floor(Math.random()*1000*RandomFailureDelay)+1000
					conn.randomHandle = setTimeout(function(){
						console.log('*server randomly destroyed tcp connection')
						c.destroy()
					},randomFailureDelay)
					
					conn.outgoingAckHistory = conn.lastOutgoingAck - 1//the -1 is to adjust for the reconnect which the new deser will be counting, but the client won't
					
					startAck(deser, c)

				}else{
					//_.errout('TODO')
					//conn = setupConnection()
					var wHandle = {
						write: function(buf){
							this.c.write(buf);
						},
						end: function(){
							//TODO?
						},
						c: c
					}
					var wfs = fparse.makeReplayableWriteStream(shared.serverResponses, wHandle)
					wfs.beginFrame()
					wfs.fs.reconnectExpired()
					wfs.endFrame()
					//wfs.end()
					setTimeout(function(){
						c.end()
						console.log('server: reconnect expired')
					},100)
				}
			},
			originalConnection: function(){
			
				console.log('got original connection')

				conn = setupConnection()

				conn.deser = deser
				
				conn.randomHandle = randomHandle

				connectionId = 'r'+Math.random()
				conn.w.setup({serverInstanceUid: s.serverInstanceUid(), connectionId: connectionId});
				conn.w.flush()
		
				liveConnections[connectionId] = conn

				startAck(deser, c)

			},
			beginSync: function(e){
				var syncId = s.makeSyncId()
				var ne = {syncId: syncId}
				var updater = conn.sendEditUpdate.bind(ne)
				function objectUpdater(ob){
					conn.sendObject(syncId, ob)
				}
				function viewObjectUpdater(id, obj, syncId){
					_.assertInt(syncId)
					conn.viewObjectCb(id, obj, syncId)
				}
				s.beginSync(syncId, updater, objectUpdater, viewObjectUpdater);
				_.assert(e.requestId > 0)
				var msg = {requestId: e.requestId, syncId: syncId}
				conn.w.newSyncId(msg)
				conn.w.flush();
			},
			beginView: function(e){
				s.beginView(e, conn.sendReady.bind(undefined, e));
			},
			endView: function(e){
			},
			endSync: function(e){
				log('tcpserver got client request endSync: ', e)
				//TODO
				s.endSync(e.syncId)
			},
			persistEdit: function(e){

				rrk.put(e.edit)
				var r = rrk.s

				var op = e.op
				e.edit = fp.readersByCode[op](r)
				
				var syncId = e.syncId
				
				//log('(', currentId, ') tcpserver got client(', syncId, ') request persistEdit:', e)
				//console.log('(', currentId, ') tcpserver got client(', syncId, ') request persistEdit ' + editNames[e.op] + ':', e)
				//console.log('*path: ' + JSON.stringify(pathFromClientFor[syncId]))
				if(op === editCodes.selectTopObject){
					if(conn.currentIdFor[syncId] === e.edit.id){
						console.log('WARNING: redundant selectTopObject edit?')//I'm not sure if this is really the case
					}
					//_.assert(e.edit.id > 0)
					if(e.edit.id < 0){
						var realId = conn.reifications[e.edit.id]
						_.assertInt(realId)
						_.assert(realId > 0)
						conn.currentIdFor[syncId] = realId
						//console.log('reifying: ' + e.edit.id + ' ' + JSON.stringify(reifications))
						_.assert(conn.currentIdFor[syncId] > 0)
					}else{
						conn.currentIdFor[syncId] = e.edit.id
					}
					if(conn.pathFromClientFor[syncId]) conn.pathFromClientFor[syncId].reset()
					return
				}else if(op === editCodes.selectTopViewObject){
					_.errout('cannot modify view objects directly')
				}
				
				var currentId = conn.currentIdFor[syncId]

				var pu = conn.pathFromClientFor[syncId]
				if(pu === undefined){
					pu = conn.pathFromClientFor[syncId] = pathsplicer.make([])
				}
				var wasPathUpdate = pu.update(e)
				
				if(wasPathUpdate){
					//log.info('processed path update: ', e)
					//log.info('path now: ', pu.getPath())
					//console.log(syncId+' path(' + currentId+') now: ', pu.getPath())
					_.assert(currentId > 0)

					s.updatePath(currentId, pu.getPath(), syncId)
					
					return
				}
				
				if(op === editCodes.make) currentId = -1
				//_.assertInt(currentId)

				var tg = getTemporaryGenerator(syncId)
				//_.assertFunction(tg)
				
				function reifyCb(temporary, id){
					_.assert(temporary < 0)
					var msg = {id: id, temporary: temporary, destinationSyncId: syncId}
					conn.reifications[temporary] = id
					//console.log('storing reification ' + temporary + ' -> ' + id)
					conn.w.reifyObject(msg);
				}
				if(op === editCodes.make){

					if(conn.pathFromClientFor[syncId]) conn.pathFromClientFor[syncId].reset()
					
					var id = s.persistEdit(currentId, op, pu.getPath(), e.edit, syncId, tg)
					
					//console.log('made: ' + id, ' now current id for: ' + syncId + ' ' + lastTemporaryId[syncId])
					
					

					conn.currentIdFor[syncId] = id//this works because make can be executed synchronously
					
					//console.log('last temporary id(' + syncId + '): ' + tg)
				
					if(!e.edit.forget){
						//_.assertInt(id);
						conn.reifications[lastTemporaryId[syncId]] = id//if we're forgetting, the object will never be re-selected via selectTopObject
						var msg = {requestId: e.requestId, id: id, temporary: lastTemporaryId[syncId], destinationSyncId: syncId}
						_.assert(lastTemporaryId[syncId] < 0)
						conn.w.objectMade(msg);
					}
				}else{
					if(currentId === undefined){
						log.err('current id is not defined, cannot save edit: ', [ op, pu.getPath(), e.edit, syncId])
						c.destroy()
					}else{
						try{
							s.persistEdit(currentId, op, pu.getPath(), e.edit, syncId, tg, reifyCb)
						}catch(e){
							//if there's an error during persistence, do not permit reconnection (the edit stream is likely invalid)
							//TODO handle async as well
							delete liveConnections[connectionId]
							throw e
						}
					}
				}
			},
			getVersionTimestamps: function(e){
				var versions = []
				for(var f=0;f<e.versions.length;f+=4){
					versions.push(bin.readInt(e.versions, f))
				}
				s.getVersionTimestamps(versions, function(timestamps){
					//_.errout('TODO')
					//console.log('writing timestamps: ' + JSON.stringify(timestamps))
					var tb = new Buffer(timestamps.length*8)
					for(var i=0;i<timestamps.length;++i){
						var t = timestamps[i]
						bin.writeLong(tb, i*8, t)
					}
					w.gotVersionTimestamps({requestId: e.requestId, timestamps: tb, destinationSyncId: e.syncId})
				})
			},
			forgetLastTemporary: function(e){
				var temporaryId = lastTemporaryId[e.syncId]
				_.assertInt(temporaryId)
				s.forgetTemporary(temporaryId, e.syncId)
			},
			getSnapshots: function(e){
				s.getSnapshots(e, function(err, versionList){
					if(err){
						_.errout('TODO: ' + err)
					}
					
					var res = {snapshotVersionIds: serializeSnapshotVersionList(versionList)}
					res.requestId = e.requestId;
					conn.w.gotSnapshots(res);
					conn.w.flush();
				});
			},
			getAllSnapshots: function(e){
				e.snapshotVersionIds = deserializeSnapshotVersionIds(e.snapshotVersionIds)
				s.getAllSnapshots(e, function(err, res){
					if(err){
						conn.w.requestError({err: ''+err, requestId: e.requestId, code: err.code||'UNKNOWN'})
						return
					}
					res.requestId = e.requestId;
					res.snapshots = serializeAllSnapshots(res.snapshots)
					conn.w.gotAllSnapshots(res);
					conn.w.flush();
				});
			},
			getSnapshot: function(e){
				//console.log('getting snapshot: ' + JSON.stringify(e))
				s.getSnapshot(e, function(err, res){
					if(err){
						if(conn.w){
							conn.w.requestError({err: ''+err, requestId: e.requestId, code: err.code})
						}
						return
					}
					var msg = {snap: res, requestId: e.requestId}
					conn.w.gotSnapshot(msg);
					conn.w.flush();
				});
			}
		}
		
		function cleanupClient(){
			console.log('client closed')
			if(isDead){
				console.log('already closed')
				return
			}
			c.isDead = true
			isDead = true
			if(conn){
				clearInterval(conn.flushHandle)
			
				clearInterval(conn.randomHandle)
				clearInterval(conn.ackHandle)
				conn.randomHandle = undefined
			}

			connections.splice(connections.indexOf(c), 1)
			deser = undefined
		}
		
		c.on('close', cleanupClient)
		c.on('end', function(){
			cleanupClient()
			
			console.log('server ending the connection stream')
			//console.log(new Error().stack)
			
			if(conn){
				conn.w.end(undefined, true)
				conn.w = undefined
			}
		});

		var deser;
		c.on('connect', function(){
			deser = fparse.makeReadStream(shared.clientRequests, reader)			
		})
		
		function startAck(deser, c){
			//last = last || 0
			conn.ackHandle = setInterval(function(){
				if(!conn) return
				
				if(isDead) _.errout('should have cancelled ack handle')
				
				var v = deser.getFrameCount() + conn.outgoingAckHistory
				if(v > conn.lastOutgoingAck){
					conn.w.increaseAck({frameCount: v})
					//console.log('server increased ack: ' + v + ' -> ' + conn.lastOutgoingAck + ' (' + deser.getFrameCount() + ' ' +conn.outgoingAckHistory+')')
					conn.lastOutgoingAck = v
				}else{
					_.assertEqual(v, conn.lastOutgoingAck)
					//console.log('same: ' + v + ' ' + conn.lastOutgoingAck)
				}
			},100)
		}
		c.on('data', function(buf){
			try{
				deser(buf);
				totalBytesReceived += buf.length
			}catch(e){
				c.destroy()
				throw e
			}
			//if(Math.random() < .1) console.log('(' + buf.length + ') total bytes received: ' + totalBytesReceived)
		})
		
		//console.log('writing setup')
		
		
		//console.log('flushed setup')
	});

	tcpServer.on('close', function(){
		console.log('TCP SERVER CLOSED')
	})
	var serverHandle = {
		close: function(cb){
			console.log('minnow server manually closed tcp server')
			isClosed = true
			
			var cdl = _.latch(2, function(){
				log('all closed')
				cb()
			})
			tcpServer.on('close', function(){
				log('tcp server closed')
				cdl()
			})
			console.log('closing tcp server: ', tcpServer.connections)
			
			//apparently you cannot close a server until you've destroyed all its connections
			//even if those connections were closed remotely???
			connections.forEach(function(c){
				c.end();
				//_.assert(c.isDead)
			})
			tcpServer.close()
			s.close(function(){
				log('closed rest')
				cdl()
			})
		}
	}

	tcpServer.listen(port, function(){
		readyCb(serverHandle);
	});
}
exports.make = makeServer;
