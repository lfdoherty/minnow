"use strict";

/*
TODO implement transparent reconnect?
*/

var net = require('net');
var fs = require('fs')

var log = require('quicklog').make('minnow/tcp.client')


var _ = require('underscorem')
var fparse = require('fparse')
var shared = require('./../server/tcp_shared');
var bin = require('./../util/bin')
var bufw = require('./../util/bufw')
var fp = shared.editFp


var editCodes = fp.codes
var editNames = fp.names

var RandomFailureDelay = 100000

function deserializeSnapshotVersionIds(buf){
	var versions = []
	var many = buf[0]
	var off = 1
	for(var i=0;i<many;++i){
		var v = bin.readInt(buf,off)
		versions.push(v)
		off+=4
	}
	return versions
}
function deserializeAllSnapshots(readers, readersByCode, names, snapshots){
	_.assertBuffer(snapshots)
	var r = fparse.makeSingleReader(snapshots)
	var manySnaps = r.readByte()//readInt()
	var snaps = []
	//log('many snaps: ' + manySnaps)
	for(var i=0;i<manySnaps;++i){
		var objects = deserializeSnapshotInternal(readers, readersByCode, names, r)
		snaps.push(objects)
	}
	return snaps
}

function deserializeSnapshotInternal(readers, readersByCode, names, rs){
	var startEditId = rs.readInt()
	var endEditId = rs.readInt()
	
	//console.log(startEditId + ' -> ' + endEditId)
	
	var manyObjects = rs.readInt()
	var objects = {}
	//console.log('many objects: ' + manyObjects)
	//console.log(new Error().stack)
	for(var i=0;i<manyObjects;++i){
		var edits = []
		var e = readers.selectTopObject(rs)
		var id = e.id
		objects[id] = edits

		var many = rs.readInt()
		//console.log('many edits: ' + many)
		for(var j=0;j<many;++j){
			var code = rs.readByte()
			var editId = rs.readInt()
			//var name = names[code]
			//console.log('getting name(' + code + '): ' + name + ' ' + editId)
			//_.assertString(name)
			var e = readersByCode[code](rs)
			//console.log('got e: ' + JSON.stringify(e))
			edits.push({op: code, edit: e, editId: editId})
		}
	}
	var manyViewObjects = rs.readInt()
	//console.log('many view objects: ' + manyViewObjects)
	for(var i=0;i<manyViewObjects;++i){
		var edits = []
		var e = readers.selectTopViewObject(rs)
		var id = e.id
		objects[id] = edits
		var many = rs.readInt()
		//console.log('many: ' + many)
		for(var j=0;j<many;++j){
			var code = rs.readByte()
			var editId = rs.readInt()
			//console.log(JSON.stringify(names))
			//if(name === undefined) _.errout(editId + ' cannot find name for code: ' + code)
			var e = readersByCode[code](rs)
			edits.push({op: code, edit: e, editId: editId})
		}
	}
	return {startVersion: startEditId, endVersion: endEditId, objects: objects}
}
function deserializeSnapshot(readers, readersByCode, names, snap){
	var rs = fparse.makeSingleReader(snap)
	return deserializeSnapshotInternal(readers, readersByCode, names, rs)
}
function make(host, port, defaultChangeListener, defaultObjectListener, defaultMakeListener, defaultReifyListener, readyCb){
	_.assertLength(arguments, 7);
	_.assertString(host)
	_.assertInt(port);
	_.assertFunction(defaultChangeListener)
	_.assertFunction(defaultObjectListener)
	_.assertFunction(defaultMakeListener)
	_.assertFunction(defaultReifyListener)
	_.assertFunction(readyCb);
	
	//console.log('making tcp client')
	//console.log(new Error().stack)
	
	var syncListenersByRequestId = {}
	var syncListenersBySyncId = {}
	
	var closed = {}
	
	var callbacks = {};
	var requestIdCounter = 1;
	function applyRequestId(e, cb){
		_.assertFunction(cb);
		var reqId = makeRequestId();
		e.requestId = reqId
		callbacks[reqId] = cb;
	}
	function makeRequestId(){
		var reqId = requestIdCounter;
		++requestIdCounter;
		return reqId
	}
	function getRequestCallback(e){
		var cb = callbacks[e.requestId];
		delete callbacks[e.requestId]
		if(cb === undefined) console.log('unknown request id: ' + e.requestId)
		return cb;
	}
	
	var syncReadyCallbacks = {};
	
	var serverInstanceUid;
	
	var updateReader = fparse.makeReusableSingleReader()
	
	var connectionId
	
	var manyReconnectRequests = 0
	var manyReconnectConfirmations = 0
	
	var wasClosedManually = false
	
	var reconnectExpired = false
	
	var lastAck = 0
	
	function ackFunction(frameCount){
		//console.log('client got ack: ' + frameCount)
		if(frameCount > lastAck){
			backingWriter.discardReplayableFrames(frameCount - lastAck)
			lastAck = frameCount
			//console.log('increased client ack: ' + lastAck + ', sent: ' + backingWriter.getFrameCount())
		}
	}
	
	var reader = {
		/*increaseAck: function(e){
			if(e.frameCount > lastAck){
				backingWriter.discardReplayableFrames(e.frameCount - lastAck)
				lastAck = e.frameCount
				//console.log('increased client ack: ' + lastAck + ', sent: ' + backingWriter.getFrameCount())
			}
		},*/	
		reconnectExpired: function(e){
			//console.log('reconnect expired')
			//_.errout('TODO')
			reconnectExpired = true
			
		},
		confirmReconnect: function(e){
			//_.errout('TODO?')
			
			if(!(clientDestroyed || clientEnded || clientClosed)){
				_.errout('got reconnect without it being asked for? ' + manyReconnectRequests + ' ' + manyReconnectConfirmations)
			}
			
			++manyReconnectConfirmations
			
			console.log('client got confirmReconnect')
			_.assertInt(e.manyClientMessagesReceived)
			if(lastAck < e.manyClientMessagesReceived){
				console.log('actually server has more client frames: ' + (e.manyClientMessagesReceived - lastAck))
				backingWriter.discardReplayableFrames(e.manyClientMessagesReceived - lastAck)
				lastAck = e.manyClientMessagesReceived
			}else{
				_.assertEqual(lastAck, e.manyClientMessagesReceived)
			}

			clientDestroyed = false
			clientEnded = false
			clientClosed = false

			console.log('replaying: ' + (backingWriter.getFrameCount() - lastAck) + ' (' + backingWriter.getFrameCount() + ' ' + lastAck + ')')

			_.assert(backingWriter.getFrameCount() >= lastAck)
			
			backingWriter.replay()

			startFlusher()
		},
		setup: function(e){
			connectionId = e.connectionId
			serverInstanceUid = e.serverInstanceUid;
			_.assertString(serverInstanceUid);
			//console.log('tcp client got setup')
			readyCb(handle, syncId)
		},
		newSyncId: function(e){
			_.assertInt(e.requestId)
			//console.log('set newSyncId listener =============================')
			//console.log('got new syncId: ' + JSON.stringify(e))
			var cb = getRequestCallback(e);
			syncListenersBySyncId[e.syncId] = syncListenersByRequestId[e.requestId]
			//makeCbListenersBySyncId[e.syncId] = makeCbListenersByRequestId[e.requestId]
			_.assertFunction(syncListenersBySyncId[e.syncId].edit)
			_.assertFunction(syncListenersBySyncId[e.syncId].object)
			_.assertFunction(syncListenersBySyncId[e.syncId].make)
			//_.assertFunction(syncListenersBySyncId[e.syncId].versionTimestamps)
			delete syncListenersByRequestId[e.requestId]
			cb(e.syncId);
		},
		update: function(e){
			if(closed[e.destinationSyncId]){
				return
			}
			
			_.assertInt(e.destinationSyncId)
			var cb = syncListenersBySyncId[e.destinationSyncId]
			_.assertFunction(cb.edit);
			_.assertFunction(cb.object);
			
			updateReader.put(e.edit)
			e.edit = fp.readersByCode[e.op](updateReader.s)
			
			_.assertInt(e.editId)
			//console.log('tcpclient got response update: ' + e.op + ' ' + JSON.stringify(e.edit) + ' ' + e.editId + ' '  + e.destinationSyncId)
			cb.edit(e);
		},
		updateObject: function(e){
			if(closed[e.destinationSyncId]){
				return
			}
			
			_.assertInt(e.destinationSyncId)
			var cb = syncListenersBySyncId[e.destinationSyncId]
			_.assertObject(cb)
			var r = fparse.makeSingleReader(e.edits)
			var many = r.readInt()
			var edits = []
			//console.log('many: ' + many)
			for(var i=0;i<many;++i){
				var op = r.readByte()
				var editId = r.readInt()
				var edit = fp.readersByCode[op](r)
				edits.push({op: op, edit: edit, editId: editId})
			}
			//log([e.id, edits])
			cb.object(e.id, edits)
		},
		updateViewObject: function(e){
			if(closed[e.destinationSyncId]){
				return
			}
			
			_.assertInt(e.destinationSyncId)
			//console.log('destination: ' + e.destinationSyncId)
			var cb = syncListenersBySyncId[e.destinationSyncId]
			_.assertObject(cb)
			var r = fparse.makeSingleReader(e.edits)
			var many = r.readInt()
			var edits = []
			//console.log('many: ' + many)
			for(var i=0;i<many;++i){
				var op = r.readByte()
				var editId = r.readInt()
				var edit = fp.readersByCode[op](r)
				edits.push({op: op, edit: edit, editId: editId})
			}
			//log([e.id, edits])
			cb.object(e.id, edits)
		},
		ready: function(e){
			if(closed[e.syncId]){
				return
			}
			//console.log('tcpclient got response ready(' + e.syncId + ')')//: ' + JSON.stringify(e))
			var cb = syncReadyCallbacks[e.requestId];
			delete syncReadyCallbacks[e.requestId]
			_.assertFunction(cb);
			cb(undefined, e);
		},
		gotSnapshots: function(e){
			var cb = getRequestCallback(e);
			//console.log('tcpclient got response gotSnapshots')//: ' + JSON.stringify(e))
			cb(e);
		},
		gotAllSnapshots: function(e){
			var cb = getRequestCallback(e);
			//console.log('tcpclient got response gotAllSnapshots')//: ' + JSON.stringify(e))
			cb(undefined, e);
		},
		gotSnapshot: function(e){
			var cb = getRequestCallback(e);
			//console.log('tcpclient got response gotSnapshot')//: ' + JSON.stringify(e))
			cb(undefined, e);
		},
		objectMade: function(e){
			//console.log('GOT BACK OBJECT MADE EVENT: ' + e.destinationSyncId + ' ' + JSON.stringify(Object.keys(syncListenersBySyncId)))
			var makeCb = syncListenersBySyncId[e.destinationSyncId].make
			makeCb(e.id, e.requestId, e.temporary)
		},
		reifyObject: function(e){
			var reifyCb = syncListenersBySyncId[e.destinationSyncId].reify
			reifyCb(e.temporary, e.id)
		},
		requestError: function(e){
			log.err('ERROR: ' + e.err)
			console.log('ERROR: ' + e.err + ' ' + e.code)
			var cb = callbacks[e.requestId]
			var err = {code: e.code}
			err.toString = function(){
				return e.code + ' - ' + e.err;
			}
			//err.code = e.code
			cb(err)
		}
	};
	
	var deser;
	var client = net.connect(port, host, function(){
		log('tcp client waiting for setup message');
	});
	
	var defaultSyncHandle;
	
	var w
	
	var firstBuf = true
	var schemaBufLength;
	var firstBufs = []
	var needed;
	var syncId
	function mergeBuffers(bufs){
		var total = 0
		for(var i=0;i<bufs.length;++i){
			var b = bufs[i]
			total += b.length;
		}
		var nb = new Buffer(total)
		var off = 0
		for(var i=0;i<bufs.length;++i){
			var b = bufs[i]
			b.copy(nb, off)
			off += b.length;
		}
		return nb;
	}

	deser = function(buf){//this handles the initial setup
		if(firstBuf){
			needed = schemaBufLength = bin.readInt(buf, 0)
			buf = buf.slice(8)
			firstBuf = false;
		}
		//console.log('got buf ' + buf.length + ' ' + needed)
		if(needed <= buf.length){
			firstBufs.push(buf.slice(0, needed))
			var schemaStr = mergeBuffers(firstBufs).toString('utf8')
			var all = JSON.parse(schemaStr)
			syncId = all.syncId
			setupBasedOnSchema(all.schema)
			
			if(buf.length > needed){
				deser(buf.slice(needed))
			}
		}else{
			needed -= buf.length
			firstBufs.push(buf)
		}
	}
	
	var clientDestroyed = false
	var clientEnded = false
	var clientClosed = false
	
	var draining = false
	var backingWriter = fparse.makeReplayableWriteStream(shared.clientRequests, {
		write: function(buf){
			if(clientDestroyed || clientEnded || clientClosed){
				console.log('WARNING: client already destroyed, discarding bytes to write: ' + buf.length)
				//we just ignore for reconnect because we can go backingWriter.replay() at some point in the future
				//once the reconnection client is available
				return
			}
			var d = client.write(buf);
			//console.log('wrote ' + d + ' ' + buf.length)
			if(!d && !draining){
				draining = true
				client.once('drain', function(){
					//console.log('drained*')
					draining = false
				})
			}
		},
		end: function(){
		}
	});
	
	w = backingWriter.fs
	//backingWriter.beginFrame()
	w.flush = function(cb){
		if(backingWriter.shouldWriteFrame()){
			backingWriter.endFrame()
		}
		if(cb){
			if(draining){
				console.log('draining: ' + draining)
				client.once('drain',function(){
					console.log('drained')
					cb()
				})
			}else{
				cb()
			}
		}
	}	
	
	var increaseAckHandle
	
	function setupBasedOnSchema(schema){
		//log('setting up')
		
		handle.schema = schema
		
		deser = fparse.makeReadStream(shared.serverResponses, reader, ackFunction)

		var last = 0
		increaseAckHandle = setInterval(function(){
			var v = deser.getFrameCount()
			if(v > last){
				w.flush()
				//w.increaseAck({frameCount: v})
				backingWriter.writeAck(v)
				w.flush()
				//console.log('client increased ack: ' + v + ' <- ' + last + ' (sent: ' + backingWriter.getFrameCount()+')')
				last = v
			}else{
				_.assertEqual(v, last)
			}
		},100)
			
		defaultSyncHandle = makeSyncHandle(syncId, defaultMakeListener)
		syncListenersBySyncId[syncId] = {
			edit: defaultChangeListener, 
			object: defaultObjectListener, 
			make: defaultMakeListener,
			reify: defaultReifyListener}

		startFlusher()
		
	}
	
	function startFlusher(){
		flushIntervalHandle = setInterval(doFlush, 10)
	}

	//console.log('sent original connection')
	w.originalConnection({})
	w.flush()
	
	function dataListener(data) {
		if(clientDestroyed) return
		
		try{
			//console.log('client got data: ' + data.length)
			deser(data);
		}catch(e){
			console.log('WARNING: deserialization error: ' + e + '\n' + e.stack)
			client.removeListener('data', dataListener)
			client.destroy()
			clientDestroyed = true
			clearInterval(flushIntervalHandle)
			//clearInterval(randomHandle)
			clearInterval(increaseAckHandle)
			//throw e
		}
	}
	/*
	var randomHandle
	
	var randomFailureDelay = 500//Math.floor(Math.random()*1000*RandomFailureDelay)+1000
		randomHandle = setTimeout(function(){
			console.log('client randomly destroyed tcp connection: ' + connectionId)
			client.destroy()
		},randomFailureDelay)
*/

	function attachClient(){	
		client.on('data', dataListener);

		client.on('error', function(e) {
			console.log('tcp client error: ' + e.stack)
		})

		client.on('close', function() {
			clientClosed = true
			clearInterval(flushIntervalHandle)
			//clearTimeout(randomHandle)
			clearInterval(increaseAckHandle)
			console.log('got close event')
			if(!clientEnded && !wasClosedManually){
				tryReconnect()
			}
		})
		client.on('end', function() {
			console.log('client disconnected');
			clearInterval(flushIntervalHandle)
			//clearTimeout(randomHandle)
			clearInterval(increaseAckHandle)
			clientEnded = true
		});
	}
	attachClient()
	
	function tryReconnect(){
		if(reconnectExpired){
			return//TODO?
		}
		console.log('trying to reconnect')
		client = net.connect(port, host, function(){
			console.log('reconnected tcp client waiting for... something: ' + backingWriter.getFrameCount());

			var temporaryBw = fparse.makeReplayableWriteStream(shared.clientRequests, {
				write: function(buf){
					console.log('buf for reconnect sent: ' + buf.length)
					client.write(buf);
				},
				end: function(){
				}
			});

			var tw = temporaryBw.fs
			//temporaryBw.beginFrame()
			
			console.log('about to request reconnect')
	
			++manyReconnectRequests
			
			tw.reconnect({
				  connectionId: connectionId
				, manyServerMessagesReceived: deser.getFrameCount()
			})
			temporaryBw.endFrame()
			
			console.log('wrote and flushed reconnect request')
			
			attachClient()
		});
		
		client.on('error', function(){
			console.log('reconnect failed')
			console.log('TODO: retry, wait, etc')
			handle.close()
		})
	}
	
	
	
	var flushIntervalHandle
	function doFlush(){
		w.flush()
	}
	
	var nkw = fparse.makeTemporaryBufferWriter(1024*1024)
	function serializeEdit(op, edit){
		_.assertInt(op)
		fp.writers[op](nkw.w, edit)
		return nkw.get()
	}
	
	function makeSyncHandle(syncId, makeCb){
		_.assertFunction(makeCb)
		
		var handle = {
			beginView: function(e, cb){
				_.assertLength(arguments, 2)
				_.assertFunction(cb)

				_.assertArray(JSON.parse(e.params))

				e.requestId = makeRequestId();
				syncReadyCallbacks[e.requestId] = cb;
				//console.log('tcpclient e.params: ', e.params + ' ' + syncId)

				w.beginView(e);
			},
			endView: function(e){
				w.endView(e);
			},
			persistEdit: function(op, edit, sourceSyncId){
				_.assertInt(op)
				
				var es = editNames[op]
				
				//console.log('persisting edit')
				
				if(es === undefined) _.errout('unknown edit op: ' + op)
				var editTypeCode = op//es.code
				
				var requestId
				if(op === editCodes.make && !edit.forget){
					requestId = makeRequestId()
				}
				
				backingWriter.forceBeginFrame()
				
				var bw = backingWriter.writer
				bw.putByte(3)
				bw.putInt(requestId)
				bw.putByte(editTypeCode)
				try{
					bw.startLength()
					fp.writersByCode[op](bw, edit)
					bw.endLength()
				}catch(e){
					console.log(e)
					console.log('invalid edit received and not sent to server: ' + JSON.stringify(e));
					delete callbacks[e.requestId];
					throw e
				}
				bw.putInt(syncId)
				
				//if(bw.position > 4*1024) w.flush()
				
				return requestId
			},
			forgetLastTemporary: function(sourceSyncId){
				_.assertInt(sourceSyncId)
				w.forgetLastTemporary({syncId: sourceSyncId})
			},
			close: function(){
				//_.errout('TODO close sync handle')
				delete syncListenersBySyncId[syncId]
				closed[syncId] = true
				w.endSync({syncId: syncId})
			}
		}
		return handle;
	}

	function wrapper(cb, makeCb, syncId, syncHandle){
		cb(syncId, makeSyncHandle(syncId, makeCb))
	}
	
	var handle = {
		getDefaultSyncHandle: function(){
			return defaultSyncHandle;
		},
		serverInstanceUid: function(){
			return serverInstanceUid;
		},
		//even though we provide a default sync handle, we include the ability to create them
		//for the purposes of proxying.
		beginSync: function(listenerCb, objectCb, makeCb, reifyCb, cb){
			_.assertLength(arguments, 5)
			_.assertFunction(listenerCb)
			_.assertFunction(objectCb)
			_.assertFunction(makeCb)
			_.assertFunction(reifyCb)
			_.assertFunction(cb);
			var e = {};
			applyRequestId(e, wrapper.bind(undefined, cb, makeCb));

			log('BEGAN SYNC CLIENT')

			w.beginSync(e);
			syncListenersByRequestId[e.requestId] = {edit: listenerCb, object: objectCb, make: makeCb, reify: reifyCb}
			
			
		},
		
		getSnapshots: function(e, cb){
			_.assertFunction(cb)
			applyRequestId(e, function(res){
				res.snapshotVersionIds = deserializeSnapshotVersionIds(res.snapshotVersionIds)
				cb(undefined, res)
			});
			w.getSnapshots(e);
			//log('tcpclient: getSnapshots: ' + JSON.stringify(e))
		},
		
		getAllSnapshots: function(e, cb){
			_.assertFunction(cb)
			//_.assertBuffer(e.snapshotVersionIds)
			var svb = new Buffer(1+(e.snapshotVersionIds.length*4))
			svb[0] = e.snapshotVersionIds.length
			var off = 1
			for(var i=0;i<e.snapshotVersionIds.length;++i){
				bin.writeInt(svb, off, e.snapshotVersionIds[i])
				off += 4
			}
			e.snapshotVersionIds = svb
			applyRequestId(e, function(err, res){
				if(err){
					cb(err)
					return
				}
				//console.log('getAllSnapshots: ' + e.isHistorical)

				res.snapshots = deserializeAllSnapshots(fp.readers, fp.readersByCode, fp.names, res.snapshots)
				//log('deserialized: ' + JSON.stringify(res).slice(0,500))
				cb(undefined, res)
			});
			w.getAllSnapshots(e);
		},
		getSnapshot: function(e, cb){
			_.assertFunction(cb)
			//console.log('get snapshot: ' + e.isHistorical + ' ' + new Error().stack)
			applyRequestId(e, function(err, res){
				if(err){
					cb(err)
					return
				}
				res.snap = deserializeSnapshot(fp.readers, fp.readersByCode, fp.names, res.snap)
				cb(undefined, res)
			});
			w.getSnapshot(e);
			//log('tcpclient: getSnapshots')
		},
		close: function(cb){
			console.log('closing client---')
			wasClosedManually = true
			clearInterval(flushIntervalHandle)
			clearInterval(increaseAckHandle)
			if(clientEnded){
				if(cb) cb()
				return
			}
			console.log('calling client end')
			var alreadyCbed = false
			client.on('error', function(){
				if(alreadyCbed) return
				alreadyCbed = true
				cb()
			})
			console.log('ending client: ' + w.flush)
			w.flush(function(){
				client.on('close', function(){
					if(alreadyCbed) return
					console.log('tcp client closed')
					alreadyCbed = true
					w = undefined
					
					if(cb) cb()
				})
				console.log('really ended client')
				client.end()
			})
			
		}
	}

}


exports.make = make;
