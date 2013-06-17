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
			//console.log('got e: ' +code+' ' + editId + ' ' +  JSON.stringify(e))
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

var flushFunctions = []
var flushIntervalHandle = setInterval(function(){
	for(var i=0;i<flushFunctions.length;++i){
		var f = flushFunctions[i]
		f()
	}
}, 10)

function clearFlushFunction(f){
	var index = flushFunctions.indexOf(f)
	if(index !== -1){
		flushFunctions.splice(index, 1)
	}
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
	
	var wasClosedManually = false
	
	var reader = {

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
			
			w.syncIdUpTo({editId: e.editId, syncId: e.destinationSyncId})
			
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
			//console.log('got view object update: ' + JSON.stringify(e))
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
		gotFullSnapshot: function(e){
			var cb = getRequestCallback(e);
			//console.log('tcpclient got response gotSnapshot')//: ' + JSON.stringify(e))
			cb(undefined, e);
		},
		objectMade: function(e){
			//console.log('GOT BACK OBJECT MADE EVENT: ' + e.destinationSyncId + ' ' + JSON.stringify(Object.keys(syncListenersBySyncId)))
			var syncListener = syncListenersBySyncId[e.destinationSyncId]
			if(syncListener){
				var makeCb = syncListener.make
				makeCb(e.id, e.requestId, e.temporary)
			}else{
				console.log('WARNING: sync listener not found for ' + e.destinationSyncId)
			}
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
	var backingWriter = fparse.makeWriteStream(shared.clientRequests, {
		write: function(buf){
			if(clientDestroyed || clientEnded || clientClosed){
				console.log('WARNING: client already destroyed, discarding bytes to write: ' + buf.length)
				//we just ignore for reconnect because we can go backingWriter.replay() at some point in the future
				//once the reconnection client is available
				return
			}
			var d = client.write(buf);
			
			/*if(!d){
				_.errout('TODO oh no!')
			}*/
			
			//console.log('wrote ' + d + ' ' + buf.length)
			//console.log(new Error().stack)
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
			//console.log('ending frame')
			backingWriter.endFrame()
		}else{
			//console.log('not should yet: ' + (backingWriter.writer.b.length) + ' ' + backingWriter.writer.position)//JSON.stringify(backingWriter))
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
		
		deser = fparse.makeReadStream(shared.serverResponses, reader)
			
		defaultSyncHandle = makeSyncHandle(syncId, defaultMakeListener)
		syncListenersBySyncId[syncId] = {
			edit: defaultChangeListener, 
			object: defaultObjectListener, 
			make: defaultMakeListener,
			reify: defaultReifyListener}

		startFlusher()
		
	}
	
	function startFlusher(){
		flushFunctions.push(doFlush)
	}

	//console.log('sent original connection')
	//w.originalConnection({})
	//w.flush()
	
	function dataListener(data) {
		if(clientDestroyed) return
		
		try{
			//console.log('client got data: ' + data.length)
			deser(data);
		}catch(e){
			console.log(e.stack)
			console.log('WARNING: deserialization error: ' + (''+e) + '\n' + e.stack)
			client.removeListener('data', dataListener)
			client.destroy()
			clientDestroyed = true
			//clearInterval(flushIntervalHandle)
			clearFlushFunction(doFlush)
		}
	}

	function attachClient(){	
		client.on('data', dataListener);

		client.on('error', function(e) {
			console.log('tcp client error: ' + e.stack)
		})

		client.on('close', function() {
			clientClosed = true
			//clearInterval(flushIntervalHandle)
			clearFlushFunction(doFlush)
		})
		client.on('end', function() {
			console.log('client disconnected');
			//clearInterval(flushIntervalHandle)
			clearFlushFunction(doFlush)
			clientEnded = true
		});
	}
	attachClient()
	
	//var flushIntervalHandle
	function doFlush(){
		//console.log('flushing')
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

				//_.assertArray(JSON.parse(e.params))
				_.assertString(e.viewId)

				e.requestId = makeRequestId();
				syncReadyCallbacks[e.requestId] = cb;
				//console.log('tcpclient e.viewId: ', e.viewId + ' ' + syncId + ' ' + new Error().stack)

				w.beginView(e);
			},
			endView: function(e){
				w.endView(e);
			},
			persistEdit: function(op, edit, sourceSyncId){
				_.assertInt(op)
				
				var es = editNames[op]
				
				//console.log('persisting edit: ' + editNames[op])
				
				if(es === undefined) _.errout('unknown edit op: ' + op)
				var editTypeCode = op//es.code
				
				var requestId
				if((op === editCodes.make || op === editCodes.copy) && !edit.forget){
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
			//console.log(e.params + ' ' + new Error().stack)
			applyRequestId(e, function(res){
				res.snapshotVersionIds = deserializeSnapshotVersionIds(res.snapshotVersionIds)
				cb(undefined, res)
			});
			w.getSnapshots(e);
			//log('tcpclient: getSnapshots: ' + JSON.stringify(e))
		},
		getFullSnapshot: function(e, cb){
			_.assertFunction(cb)
			//console.log(e.params + ' ' + new Error().stack)
			applyRequestId(e, function(err, res){
				if(err){
					cb(err)
				}else{
					//res.snapshotVersionIds = deserializeSnapshotVersionIds(res.snapshotVersionIds)
					res.snapshot = deserializeSnapshot(fp.readers, fp.readersByCode, fp.names, res.snapshot)
					cb(undefined, res)
				}
			});
			w.getFullSnapshot(e);
			//log('tcpclient: getSnapshots: ' + JSON.stringify(e))
		},
		getAllCurrentSnapshots: function(e, cb){
			_.assertFunction(cb)
			applyRequestId(e, function(err, res){
				if(err){
					cb(err)
					return
				}
				res.snapshots = deserializeAllSnapshots(fp.readers, fp.readersByCode, fp.names, res.snapshots)
				cb(undefined, res)
			});
			w.getAllCurrentSnapshots(e);
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
			//console.log('get snapshot: ' + e.params)// + ' ' + new Error().stack)
			/*if(e.typeCode === 164 && JSON.parse(e.params)[3] === 54){
				_.errout('should be inner')
			}*/
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
			//clearInterval(flushIntervalHandle)
			clearFlushFunction(doFlush)

			//clearInterval(increaseAckHandle)
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
