"use strict";

var net = require('net')
var fs = require('fs')

var quicklog = require('quicklog')

var log = quicklog.make('minnow/tcp.server')

var random = require('seedrandom')

var _ = require('underscorem')
var shared = require('./tcp_shared');
var bin = require('./../util/bin')
var server = require('./server');
var fparse = require('fparse')

var pathsplicer = require('./pathsplicer')
var pathmerger = require('./pathmerger')

var serializeViewObject = require('./snapshot_serialization').serializeViewObject

var editFp = require('./tcp_shared').editFp
var editCodes = editFp.codes
var editNames = editFp.names

var totalBytesReceived = 0
var totalBytesSent = 0

var WriteFlushInterval = 10

var ReconnectPeriod = 1000*60//a client may reconnect within 1 minute

function makeServer(appSchema, appMacros, dataDir, port, config, loadedListeners, facades, readyCb){
	_.assertLength(arguments, 8);
	_.assertInt(port);
	_.assertFunction(readyCb);
	
	server.make(appSchema, appMacros, dataDir, config, loadedListeners, facades, function(s){
		
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
	
	/*if(snapshots.length === 1){
		return snapshots[0]
	}*/

	var len = 1
	for(var i=0;i<snapshots.length;++i){
		len += snapshots[i].length
	}
	var buf = new Buffer(len)
	buf[0] = snapshots.length
	var off = 1
	//console.log('copying ' + snapshots.length + ' into bytes ' + buf.length)
	for(var i=0;i<snapshots.length;++i){
		var s = snapshots[i]
		_.assertBuffer(s)
		s.copy(buf,off)
		off += s.length
	}
	/*var str = ''
	for(var i=0;i<snapshots[0].length;++i){
		str += ' ' + snapshots[0][i]
	}*/

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
	
var connectionCount = 0
function createTcpServer(appSchema, port, s, readyCb){
	//console.log('making tcp server')
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

	//var liveConnections = {}//index for reconnection	

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

	function addConnection(c){
		++connectionCount
		if(!connections){
			//console.log('WARNING: adding connection from destroyed server')
			c.destroy()
			return
		}
		connections.push(c)
		console.log('connections: ' + connectionCount)
	}
	function removeConnection(c){
		--connectionCount
		if(!connections){
			//console.log('WARNING: removing connection from destroyed server')//: ' + new Error().stack)
			c.destroy()
			return
		}
		connections.splice(connections.indexOf(c), 1)
		console.log('connections: ' + connectionCount)
		c.destroy()
	}
	
	var cf = makeClientFunc(s, appSchema, addConnection, removeConnection, getTemporaryGenerator, lastTemporaryId)
	var tcpServer = net.createServer(cf);

	//tcpServer.on('close', function(){
	//	console.log('TCP SERVER CLOSED')
	//})
	var serverHandle = {
		close: function(cb){
			//console.log('minnow server manually closed tcp server')
			isClosed = true
			
			var cdl = _.latch(2, function(){
				//console.log('all closed')
				cb()
			})
			tcpServer.on('close', function(){
				//log('tcp server closed')
				cdl()
			})
			//console.log('closing tcp server: ', tcpServer.connections)
			
			//console.log(JSON.stringify(Object.keys(liveConnections)))
			//Object.keys(liveConnections).forEach(function(k){
			//	liveConnections[k].destroy()
			//})
			//liveConnections = undefined
			
			//apparently you cannot close a server until you've destroyed all its connections
			//even if those connections were closed remotely???
			connections.forEach(function(c){
				c.destroy();
				//_.assert(c.isDead)
			})
			connections = undefined
			tcpServer.close()
			s.close(function(){
				//console.log('closed rest')
				cdl()
			})
			
			clearInterval(cf.flushHandle)
		}
	}

	tcpServer.listen(port, function(){
		readyCb(serverHandle);
		readyCb = undefined
	});
}


function makeClientFunc(s, appSchema, addConnection, removeConnection, getTemporaryGenerator, lastTemporaryId){

	var writersByCode = fp.writersByCode

	function serializeVO(obj){
		var tw = fparse.makeSingleBufferWriter()
		serializeViewObject(tw, fp.codes, fp.writersByCode, obj.edits)
		return tw.finish()
	}

	function serializeEdits(diff){

		var tw = fparse.makeSingleBufferWriter()
		tw.putInt(diff.edits.length)
		for(var i=0;i<diff.edits.length;++i){
			var e = diff.edits[i]
			tw.putInt(e.editId)
			tw.putByte(e.op)
			writersByCode[e.op](tw, e.edit)
		}
		//serializeViewObject(tw, fp.codes, fp.writersByCode, obj)
		return tw.finish()

		//_.errout('TODO: ' + JSON.stringify(diff.edits))
	}
	function serializeObjects(diff){
		//_.errout('TODO')
		
		var tw = fparse.makeSingleBufferWriter()
		tw.putInt(diff.addedObjects.length)
		for(var i=0;i<diff.addedObjects.length;++i){
			var obj = diff.addedObjects[i]
			_.assertBuffer(obj.edits)
			tw.putUuid(obj.id)
			tw.putBuffer(obj.edits)
		}
		//serializeViewObject(tw, fp.codes, fp.writersByCode, obj)
		return tw.finish()
	}
	function serializeViewObjects(diff){
		var tw = fparse.makeSingleBufferWriter()
		tw.putInt(diff.addedViewObjects.length)
		for(var i=0;i<diff.addedViewObjects.length;++i){
			var obj = diff.addedViewObjects[i]
			//console.log('serializing view object: ' + JSON.stringify(obj))
			//_.assertBuffer(obj.edits)
			_.assertString(obj.id)
			tw.putString(obj.id)
			tw.putBuffer(serializeVO(obj))
		}
		return tw.finish()
	}

	var writersToFlush = []
	var flushHandle = setInterval(function(){
		//w.flush()
		for(var i=0;i<writersToFlush.length;++i){
			var w = writersToFlush[i]
			w.flush()
		}
	},WriteFlushInterval)
	
	var schemaStr = JSON.stringify(appSchema)

	function clientFunc(c){

		/*if(isClosed){
			_.errout('getting connection despite server being closed')
		}*/
		
		var isDead = false
	
		var connectionId
		
		c.on('error', function(e){
			console.log('tcp server error: ' + e + ' ' + require('util').inspect(e))
		})


		var ws = quicklog.make('minnow/tcp server->client.' + (++logCounter))
	
		log('tcp server got connection')
		
		addConnection(c)
		
		var rrk = fparse.makeRs()

		function setupConnection(syncId){
			_.assertString(syncId)
			_.assertLength(syncId, 8)
			//var syncId = s.makeSyncId()
			
//			var syncIdStr = random.uuidBufferToString(syncId)
		
			var eHandle = {syncId: syncId}
			
			/*var wrappedListenerCb = sendEditUpdate.bind(eHandle)
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
			}*/
			
			console.log('server sending syncId: ' + syncId)
			
			function blockChangesCb(diff){
				//_.errout('tODO')
				var binEdits = serializeEdits(diff)
				var binObjects = serializeObjects(diff)
				var binViewObjects = serializeViewObjects(diff)
				
				_.assertString(diff.destinationSyncId)
				//console.log('block for: ' + diff.destinationSyncId)
				
				w.blockUpdate({
					endEditId: diff.endEditId,
					destinationSyncId: diff.destinationSyncId,
					edits: binEdits,
					objects: binObjects,
					viewObjects: binViewObjects
				})
			}
			
			console.log('beginSync: ' + syncId)

			s.beginSync(syncId, blockChangesCb)//wrappedListenerCb, wrappedObjCb, viewObjectCb)
		
			var setupStr = '{"syncId": "'+random.uuidStringToBase64(syncId)+'", "schema": '+schemaStr+'}'//JSON.stringify({syncId: syncId, schema: appSchema})
			var setupByteLength = Buffer.byteLength(setupStr, 'utf8')
			var setupBuffer = new Buffer(setupByteLength+8)
			bin.writeInt(setupBuffer, 0, setupByteLength)
			setupBuffer.write(setupStr, 8)
		
			c.write(setupBuffer)

			var wHandle = {
				write: function(buf){
					if(this.c.isDead){
						console.log('WARNING: should not be writing to a dead socket')
						return
					}
					this.c.write(buf);
					//console.log('wfs writing to c: ' + buf.length)
					totalBytesSent += buf.length
				},
				end: function(){
					//TODO?
				},
				c: c
			}
			var wfs = fparse.makeWriteStream(shared.serverResponses, wHandle)
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
		
			w.flush = function(){
				if(wfs.shouldWriteFrame()){
					wfs.endFrame()
				}
			}
			w.end = function(){}
				
			writersToFlush.push(w)
			
			function flushHandle(){
				var index = writersToFlush.indexOf(w)
				if(index !== -1){
					writersToFlush.splice(index, 1)
				}
			}
		
			//these are the *incoming* edit's path state
			var pathsFromClientById = {}//TODO these should be indexed by syncId as well as id
		
			/*function sendObject(syncId, ob){
				if(!conn.w){//this means that the server has explicitly shut down this connection permanently (no possibility of reconnect)
					_.errout('bad server shutdown: still receiving object updates')
				}
				_.assertBuffer(ob.edits)
				//ws('sending object: ' + ob.id)
				//console.log('sending object: ' + ob.id + ' ' + syncId)
				ob.destinationSyncId = syncId
				conn.w.updateObject(ob);
			}*/

			var nkw = fparse.makeTemporaryBufferWriter(1024*1024)
			function binEdit(op, edit){
				//console.log('getting writer: ' + e.type)
				fp.writersByCode[op](nkw.w, edit)
				return nkw.get()
			}
		
			/*function sendEditUpdate(op, edit, editId){
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
				//console.log('writing edit', editNames[op], edit, syncId, editId, destinationSyncId)
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
			}*/
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
				//sendEditUpdate: sendEditUpdate,
				//viewObjectCb: viewObjectCb,
				//sendObject: sendObject,
				blockChangesCb: blockChangesCb,
				currentIdFor: {},
				pathFromClientFor: {},
				reifications: {},
				w: w,
				openSyncIds: [syncId]
			}
		}
		var conn
		
		function reifyCb(temporary, id, syncId){
			_.assert(temporary < 0)
			_.assertString(syncId)
			_.assertLength(syncId, 8)
			
			var msg = {id: id, temporary: temporary, destinationSyncId: syncId}
			conn.reifications[temporary] = id
			//console.log('storing reification ' + temporary + ' -> ' + id)
			conn.w.reifyObject(msg);
		}	
		
		var reader = {
			
			beginSync: function(e){
				var syncId = e.syncId//s.makeSyncId()
				_.assertString(syncId)
				conn.openSyncIds.push(syncId)
				console.log('adding open syncId: ' + syncId)
				var ne = {syncId: syncId}
				/*var updater = conn.sendEditUpdate.bind(ne)
				function objectUpdater(ob){
					conn.sendObject(syncId, ob)
				}
				function viewObjectUpdater(id, obj, syncId){
					_.assertInt(syncId)
					conn.viewObjectCb(id, obj, syncId)
				}*/
				
				function blockChangesCb(e){
					conn.blockChangesCb(e)
				}
				
				s.beginSync(syncId, blockChangesCb)//updater, objectUpdater, viewObjectUpdater);
				//_.assert(e.requestId > 0)
				//var msg = {requestId: e.requestId, syncId: syncId}
				//conn.w.newSyncId(msg)
				conn.w.flush();
			},
			beginView: function(e){
				//console.log('beginning view
				var start = Date.now()
				s.beginView(e, function(){
					console.log('beginning view ' + e.viewId + ' took: ' + (Date.now()-start)+'ms')
					conn.sendReady(e)
				})
			},
			endView: function(e){
			},
			endSync: function(e){
				log('tcpserver got client request endSync: ', e)
				//TODO
				var i = conn.openSyncIds.indexOf(e.syncId)
				if(i !== -1){
					conn.openSyncIds.splice(i, 1)
					s.endSync(e.syncId)
				}else{
					console.log('WARNING: ended unknown or already ended syncId: ' + e.syncId)
				}
			},
			syncIdUpTo: function(e){
				s.syncIdUpTo(e.syncId, e.editId)
				//_.errout('TODO: ' + JSON.stringify(e))
			},
			persistEdit: function(e){

				rrk.put(e.edit)

				var op = e.op
				e.edit = fp.readersByCode[op](rrk.s)
				var syncId = e.syncId
				
				
				var pu = conn.pathFromClientFor[syncId]

				//console.log('^^^^ ' + editNames[op] + ' ' + JSON.stringify(e))

				if(op === editCodes.selectTopObject){
					if(conn.currentIdFor[syncId] === e.edit.id){
						console.log('WARNING: redundant selectTopObject edit?')//I'm not sure if this is really the case
					}
					if(e.edit.id < 0){
						var realId = conn.reifications[e.edit.id]
						_.assertInt(realId)
						_.assert(realId > 0)
						conn.currentIdFor[syncId] = realId
						//console.log('set top to: ' + realId + ' <- ' + e.edit.id)
						_.assert(conn.currentIdFor[syncId] > 0)
					}else{
						conn.currentIdFor[syncId] = e.edit.id
					}
					if(pu){
						pu.reset()
						//console.log('reset pu')
					}
					return
				}else if(op === editCodes.selectTopViewObject){
					_.errout('cannot modify view objects directly')
				}
				
				var currentId = conn.currentIdFor[syncId]

				if(pu === undefined){
					pu = conn.pathFromClientFor[syncId] = pathsplicer.make()//[])
				}

				
				var wasPathUpdate = pu.update(e)
				if(wasPathUpdate){
					//_.assert(currentId > 0)
					//s.updatePath(currentId, pu.getPath(), syncId)
					//console.log('was path update')
					return
				}
				
				//var tg = getTemporaryGenerator(syncId)
				
				if(op === editCodes.made || op === editCodes.copied){
				
					currentId = e.edit.id

					if(pu) pu.reset()
					
					var state = pu.getAll()
							
					//console.log('make - persisting with state: ' + JSON.stringify(state))
					var id = s.persistEdit(op, state, e.edit, syncId)//, tg)

					pu.setTop(id)
					pu.setObject(id)
					
					_.assertString(id)

					conn.currentIdFor[syncId] = e.edit.id//this works because make can be executed synchronously
				
					if(!e.edit.forget){
						//conn.reifications[lastTemporaryId[syncId]] = id//if we're forgetting, the object will never be re-selected via selectTopObject
						
						
						var msg = {requestId: e.requestId, id: id, destinationSyncId: syncId}
						//_.assert(lastTemporaryId[syncId] < 0)
						
						//TODO delay this until sync handle updates to the editId of the object creation
						
						//console.log('would do here: ' + JSON.stringify(msg))
						//reifyCb(msg.temporary, msg.id, msg.destinationSyncId)
						s.afterNextSyncHandleUpdate(syncId, function(){
							//console.log('sending objectMade: ' + JSON.stringify(msg))
							conn.w.objectMade(msg);
						})
					}
				}else{
				
					//if(op === editCodes.setToNew){
						//_.errout('TODO')
						
					//}
					
					if(currentId === undefined){
						log.err('current id is not defined, cannot save edit: ', [ op, pu.getAll(), e.edit, syncId])
						//console.log('destroying')
						c.destroy()
					}else{
						//try{
							var state = pu.getAll()
							//state.top = currentId
							//_.assertInt(state.top)
							state.top = currentId
							if(!state.object) state.object = state.top
							//console.log('persisting with state: ' + JSON.stringify(state))
							s.persistEdit(op, state, e.edit, syncId)//, tg, reifyCb)
						/*}catch(e){
							throw e
						}*/
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
			/*forgetLastTemporary: function(e){
				var temporaryId = lastTemporaryId[e.syncId]
				_.assertInt(temporaryId)
				s.forgetTemporary(temporaryId, e.syncId)
			},*/
			getSnapshots: function(e){
				s.getSnapshots(e, function(err, versionList){
					if(err){
						_.errout('TODO: ' + err)
					}
					
					var res = {snapshotVersionIds: serializeSnapshotVersionList(versionList), isHistorical: e.isHistorical}
					res.requestId = e.requestId;
					conn.w.gotSnapshots(res);
					conn.w.flush();
				});
			},
			getFullSnapshot: function(e){
				s.getFullSnapshot(e, function(err, snapBuffer, versionId){
					if(err){
						conn.w.requestError({err: ''+err, requestId: e.requestId, code: err.code||'UNKNOWN'})
						//_.errout('TODO: ' + err)
						return
					}
					
					var res = {versionId: versionId, snapshot: snapBuffer}
					res.requestId = e.requestId;
					conn.w.gotFullSnapshot(res);
					conn.w.flush();
				});
			},
			getAllSnapshots: function(e){
				e.snapshotVersionIds = deserializeSnapshotVersionIds(e.snapshotVersionIds)
				//console.log('params: ' + e.params)
				s.getAllSnapshots(e, function(err, res){
					if(err){
						conn.w.requestError({err: ''+err, requestId: e.requestId, code: err.code||'UNKNOWN'})
						return
					}
					res.requestId = e.requestId;
					res.snapshots = serializeAllSnapshots(res.snapshots)
					res.isHistorical = e.isHistorical
					conn.w.gotAllSnapshots(res);
					conn.w.flush();
				});
			},
			getAllCurrentSnapshots: function(e){
				//e.snapshotVersionIds = deserializeSnapshotVersionIds(e.snapshotVersionIds)
				s.getSnapshots(e, function(err, versionList){
					if(err){
						conn.w.requestError({err: ''+err, requestId: e.requestId, code: err.code||'UNKNOWN'})
						return
					}
					e.snapshotVersionIds = versionList
					s.getAllSnapshots(e, function(err, res){
						if(err){
							conn.w.requestError({err: ''+err, requestId: e.requestId, code: err.code||'UNKNOWN'})
							return
						}
						res.requestId = e.requestId;
						//console.log('serializing all snapshots for ' + JSON.stringify(e))
						res.snapshots = serializeAllSnapshots(res.snapshots)
						res.isHistorical = e.isHistorical
						conn.w.gotAllSnapshots(res);
						conn.w.flush();
					});
				})
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
			//console.log('client closed: ' + new Error().stack)
			if(isDead){
				console.log('already closed: ' + new Error().stack)
				return
			}
			c.isDead = true
			isDead = true
			if(conn){
				clearInterval(conn.flushHandle)
			
				//clearTimeout(conn.randomHandle)
				//clearInterval(conn.ackHandle)
				//conn.randomHandle = undefined
				conn.flushHandle = undefined
				//conn.ackHandle = undefined
			}
			//if(randomHandle){
			//	clearTimeout(randomHandle)
			//}
			Object.keys(reader).forEach(function(rk){
				reader[rk] = undefined
			})

			//connections.splice(connections.indexOf(c), 1)
			removeConnection(c)
		}
		
		c.on('close', cleanupClient)
		c.on('end', function(){
			cleanupClient()
			
			//console.log('server ending the connection stream: ' + JSON.stringify(conn.openSyncIds))
			//console.log(new Error().stack)
			
			//end all sync handles
			permanentlyEndConnection()
			
			if(conn && conn.w){
				conn.w.end(undefined, true)
				conn.w = undefined
			}
			conn = undefined
			deser = undefined
		});

		var deser;
		//c.on('connect', function(){
		deser = fparse.makeReadStream(shared.clientRequests, reader, function(){})
		//})
		
		function permanentlyEndConnection(){
			conn.openSyncIds.forEach(function(syncId){
				s.endSync(syncId)
			})
		}
		
		c.on('data', function(buf){
			//console.log('server got buf: ' + buf.length)
			try{
				deser(buf);
				totalBytesReceived += buf.length
			}catch(e){
				c.destroy()
				throw e
			}
			//if(Math.random() < .1) console.log('(' + buf.length + ') total bytes received: ' + totalBytesReceived)
		})
		
		var theSyncId = random.uid()
		
		function beginConnectionSetup(){
		
			conn = setupConnection(theSyncId)

			conn.deser = deser

			connectionId = 'r'+Math.random()
			conn.w.setup({serverInstanceUid: s.serverInstanceUid(), connectionId: connectionId});
			conn.w.flush()
		}
		
		beginConnectionSetup()
		//console.log('writing setup')
		
		
		//console.log('flushed setup')
	}
	
	clientFunc.flushHandle = flushHandle
	
	return clientFunc
}
exports.make = makeServer;
