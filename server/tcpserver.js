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

var totalBytesReceived = 0
var totalBytesSent = 0

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

var pathControlEdits = [
	'reset', 
	'selectProperty', 'reselectProperty', 
	'selectObject', 'reselectObject', 
	'selectIntKey', 'selectStringKey', 'selectLongKey', 'selectBooleanKey',
	'reselectIntKey', 'reselectStringKey', 'reselectLongKey', 'reselectBooleanKey',
	'ascend', 'ascend1', 'ascend2', 'ascend3', 'ascend4', 'ascend5']

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
	

	var tcpServer = net.createServer(function(c){
	
		c.on('error', function(e){
			console.log('ERROR: ' + e)
			
		})

		var ws = quicklog.make('minnow/tcp server->client.' + (++logCounter))
	
		log('tcp server got connection')
		
		connections.push(c)

		var syncId = s.makeSyncId()
		
		var eHandle = {syncId: syncId}
		var wrappedListenerCb = sendEditUpdate.bind(eHandle)
		function wrappedObjCb(ob){
			//console.log('sending: ' + JSON.stringify(ob).substr(0,100))
			sendObject(syncId, ob)
		}
		
		function viewObjectCb(id, obj, syncId){//TODO find a more optimal way (binary serialization, etc.)
			_.assertInt(syncId)
			///var update = {
			//	id: id,
			//	data: JSON.stringify(obj)
			//}

			//w.resetViewObject(update);
			var tw = fparse.makeSingleBufferWriter()
			serializeViewObject(tw, fp.codes, fp.writers, obj)
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

		var wfs = fparse.makeWriteStream(shared.serverResponses, {
			write: function(buf){
				c.write(buf);
				totalBytesSent += buf.length
				//if(Math.random() < .1) console.log('(' + buf.length + ') total bytes sent: ' + totalBytesSent);
			},
			end: function(){
				//TODO?
			}
		})
		
		var w = wfs.fs
		
		wfs.beginFrame()
		w.flush = function(){
			wfs.endFrame()
			wfs.beginFrame()
		}
		w.end = function(){}
				
		var flushHandle = setInterval(function(){
			w.flush()
		},10)

		
		//var viewHandles = []
		//var syncHandles = []
		
		//these are the *incoming* edit's path state
		var pathsFromClientById = {}//TODO these should be indexed by syncId as well as id
		
		function sendObject(syncId, ob){
			_.assertBuffer(ob.edits)
			ws('sending object: ' + ob.id)
			//log('sending object: ' + ob.id)
			ob.destinationSyncId = syncId
			w.updateObject(ob);
		}
		//var nw = fparse.makeReusableBufferWriter(1024*1024)
		var nkw = fparse.makeTemporaryBufferWriter(1024*1024)
		function binEdit(op, edit){
			//console.log('getting writer: ' + e.type)
			fp.writers[op](nkw.w, edit)
			//return nw.finish()
			return nkw.get()
		}
		
		//var curPath = []
		function sendEditUpdate(op, edit, editId){
			_.assertLength(arguments, 3)
			
			var destinationSyncId = this.syncId
			
			log.info('sending update', [op, edit, editId, destinationSyncId])

			if(w === undefined){
				throw new Error('got update after already disconnected')
			}
			
			sendUpdate(op, edit, editId, destinationSyncId)
			
		}
		function sendUpdate(op, edit, editId, destinationSyncId){
			_.assertLength(arguments, 4)
			_.assert(destinationSyncId > 0)
			log('writing edit', op, edit, syncId, editId, destinationSyncId)
			var binaryEdit = binEdit(op, edit)
			if(syncId === undefined) syncId = -1
			_.assertInt(editId)
			var update = {
				op: op,
				edit: binaryEdit,
				//syncId: syncId, 
				editId: editId,
				destinationSyncId: destinationSyncId};

			w.update(update);
		}
		function sendReady(e){
			//_.assertArray(updatePacket)
			log('sending ready')
			var msg = {requestId: e.requestId}//)//, updatePacket: JSON.stringify(updatePacket)}
			w.ready(msg)
			w.flush();
		}
		
		var rrk = fparse.makeRs()
		
		var opsByCode = {}
		Object.keys(shared.editSchema._byCode).forEach(function(key){
			opsByCode[key] = shared.editSchema._byCode[key].name
		})
		
		var pathFromClientFor = {}
		var currentIdFor = {}
		
		var reader = {
			beginSync: function(e){
				var syncId = s.makeSyncId()
				var ne = {syncId: syncId}
				var updater = sendEditUpdate.bind(ne)
				function objectUpdater(ob){
					sendObject(syncId, ob)
				}
				function viewObjectUpdater(id, obj, syncId){
					_.assertInt(syncId)
					//sendObject(syncId, ob)
					viewObjectCb(id, obj, syncId)
				}
				s.beginSync(syncId, updater, objectUpdater, viewObjectUpdater);
				_.assert(e.requestId > 0)
				var msg = {requestId: e.requestId, syncId: syncId}
				//serverResponses.writers.newSyncId(w, msg)
				w.newSyncId(msg)
				w.flush();
			},
			beginView: function(e){
				s.beginView(e, sendReady.bind(undefined, e));
				//_.assertObject(viewHandle)
				//viewHandles.push(viewHandle)
			},
			endView: function(e){
			},
			endSync: function(e){
				log('tcpserver got client request endSync: ', e)
				//TODO
				s.endSync(e.syncId)
			},
			persistEdit: function(e){
				//var r = fparse.makeSingleReader(e.edit)
				//var r = rrk
				rrk.put(e.edit)
				var r = rrk.s

				var op = opsByCode[e.op]
				e.op = op
				e.edit = fp.readers[op](r)

				//console.log('op: ' + e.op)
				//console.log(JSON.stringify(e))
				
				var syncId = e.syncId
				
				//var op = e.op
				//ws.write('(' + currentId + ') tcpserver got client(' + syncId + ') request persistEdit: ' + JSON.stringify(e).slice(0,300)+'\n')
				ws.info('(', currentId, ') tcpserver got client(', syncId, ') request persistEdit:', e)
				//console.log('(', currentId, ') tcpserver got client(', syncId, ') request persistEdit:', e)
				if(op === 'selectTopObject'){
					if(currentIdFor[syncId] === e.edit.id){
						console.log('WARNING: redundant selectTopObject edit?')//I'm not sure if this is really the case
					}
					//if(currentIdFor[syncId] !== e.edit.id){
					currentIdFor[syncId] = e.edit.id
					//_.assertInt(currentId)
					delete pathFromClientFor[syncId]
					//}
					return
				}else if(op === 'selectTopViewObject'){
					/*//if(currentIdFor[syncId] !== e.edit.id){
					if(currentIdFor[syncId] === e.edit.id){
						console.log('WARNING: redundant selectTopViewObject edit')
					}
					delete pathFromClientFor[syncId]
					currentIdFor[syncId] = e.edit.id
						//_.assertInt(currentId)
					//}
					return*/
					_.errout('cannot modify view objects directly')
				}
				
				var currentId = currentIdFor[syncId]

				//console.log(currentId + ' ' + JSON.stringify(e))
				
				//log.info('current id (tcpserver-client): ', currentId)
				/*
				var pathKey = syncId+':'+currentId
				var pu = pathsFromClientById[pathKey]
				if(pu === undefined){
					pu = pathsFromClientById[pathKey] = pathsplicer.make([])
				}*/
				var pu = pathFromClientFor[syncId]
				if(pu === undefined){
					pu = pathFromClientFor[syncId] = pathsplicer.make([])
				}
				var wasPathUpdate = pu.update(e)
				
				if(wasPathUpdate){
					//log.info('processed path update: ', e)
					//log.info('path now: ', pu.getPath())
					//console.log(syncId+' path(' + currentId+') now: ', pu.getPath())
					return
				}
				
				if(op === 'make') currentId = -1
				//_.assertInt(currentId)

				var tg = getTemporaryGenerator(syncId)//temporaryGeneratorsBySyncId[syncId]
				//_.assertFunction(tg)
				if(op === 'make'){

					pathFromClientFor[syncId] = undefined
				
					//TODO remove this cb
					var id = s.persistEdit(currentId, op, pu.getPath(), e.edit, syncId, tg)

					currentIdFor[syncId] = id//this works because make can be executed synchronously
					
					//console.log('last temporary id(' + syncId + '): ' + tg)
				
					if(!e.edit.forget){
						//_.assertInt(id);
						var msg = {requestId: e.requestId, id: id, temporary: lastTemporaryId[syncId], destinationSyncId: syncId}
						w.objectMade(msg);
					}
				}else{
					if(currentId === undefined){
						log.err('current id is not defined, cannot save edit: ', [ op, pu.getPath(), e.edit, syncId])
						c.destroy()
					}else{
						s.persistEdit(currentId, op, pu.getPath(), e.edit, syncId, tg)
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
				s.getSnapshots(e, function(versionList){

					
					var res = {snapshotVersionIds: serializeSnapshotVersionList(versionList)}
					res.requestId = e.requestId;
					w.gotSnapshots(res);
					//serverResponses.writers.gotSnapshots(w, res)
					w.flush();
				});
			},//makeRequestWrapper('getSnapshots', 'gotSnapshots'),
			getAllSnapshots: function(e){
				e.snapshotVersionIds = deserializeSnapshotVersionIds(e.snapshotVersionIds)
				s.getAllSnapshots(e, function(err, res){
					if(err){
						w.requestError({err: ''+err, requestId: e.requestId, code: err.code})
						return
					}
					res.requestId = e.requestId;
					res.snapshots = serializeAllSnapshots(res.snapshots)
					w.gotAllSnapshots(res);
					w.flush();
				});
			},
			getSnapshot: function(e){
				//console.log('getting snapshot: ' + JSON.stringify(e))
				s.getSnapshot(e, function(err, res){
					if(err){
						w.requestError({err: ''+err, requestId: e.requestId, code: err.code})
						return
					}
					//res.snap = serializeSnapshot(res.snap)
					var msg = {snap: res, requestId: e.requestId}
					w.gotSnapshot(msg);
					w.flush();
				});
			}
		}
		
		function cleanupClient(){
			log('client closed')
			if(c.isDead){
				return
			}
			c.isDead = true
			clearInterval(flushHandle)
			//viewHandles.forEach(function(sh){
			//	sh.end()
			//})
			//activeSyncIds.forEach(function(syncId){
			//	sh.endSync(syncId)
			//})
			s.end()
			
			w.end(undefined, true)
			w = undefined
			connections.splice(connections.indexOf(c), 1)
		}
		
		c.on('close', cleanupClient)
		c.on('end', cleanupClient);

		var deser;
		c.on('connect', function(){
			deser = fparse.makeReadStream(shared.clientRequests, reader)
		})
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
		w.setup({serverInstanceUid: s.serverInstanceUid(), schema: JSON.stringify(appSchema)});
		w.flush()
		//console.log('flushed setup')
	});

	tcpServer.on('close', function(){
		log('TCP SERVER CLOSED')
	})
	var serverHandle = {
		close: function(cb){
			var cdl = _.latch(2, function(){
				log('all closed')
				cb()
			})
			tcpServer.on('close', function(){
				log('tcp server closed')
				cdl()
			})
			log('closing tcp server: ', tcpServer.connections)
			
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
