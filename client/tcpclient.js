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
function deserializeAllSnapshots(readers, names, snapshots){
	_.assertBuffer(snapshots)
	var r = fparse.makeSingleReader(snapshots)
	var manySnaps = r.readByte()//readInt()
	var snaps = []
	//log('many snaps: ' + manySnaps)
	for(var i=0;i<manySnaps;++i){
		var objects = deserializeSnapshotInternal(readers, names, r)
		snaps.push(objects)
	}
	return snaps
}

function deserializeSnapshotInternal(readers, names, rs){
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
		//var segmentLength = rs.readInt()//we just ignore this
		//console.log('segment length: ' + )
		var many = rs.readInt()
		//console.log('many edits: ' + many)
		for(var j=0;j<many;++j){
			var code = rs.readByte()
			var editId = rs.readInt()
			var name = names[code]
			//console.log('getting name(' + code + '): ' + name + ' ' + editId)
			//_.assertString(name)
			var e = readers[name](rs)
			//console.log('got e: ' + JSON.stringify(e))
			edits.push({op: name, edit: e, editId: editId})
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
			var name = names[code]
			//console.log(JSON.stringify(names))
			if(name === undefined) _.errout(editId + ' cannot find name for code: ' + code)
			var e = readers[name](rs)
			edits.push({op: name, edit: e, editId: editId})
		}
	}
	return {startVersion: startEditId, endVersion: endEditId, objects: objects}
}
function deserializeSnapshot(readers, names, snap){
	var rs = fparse.makeSingleReader(snap)
	return deserializeSnapshotInternal(readers, names, rs)
}
function make(host, port, defaultChangeListener, defaultObjectListener, defaultMakeListener, readyCb){
	_.assertLength(arguments, 6);
	_.assertString(host)
	_.assertInt(port);
	_.assertFunction(defaultChangeListener)
	_.assertFunction(defaultObjectListener)
	_.assertFunction(defaultMakeListener)
	_.assertFunction(readyCb);
	
	//console.log('making tcp client')
	//console.log(new Error().stack)
	
	var syncListenersByRequestId = {}
	var syncListenersBySyncId = {}
	
	var closed = {}
	
	//var makeCbListenersByRequestId = {}
	//var makeCbListenersBySyncId = {}
	
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
		//e.requestId = reqId;
		return reqId
	}
	function getRequestCallback(e){
		var cb = callbacks[e.requestId];
		delete callbacks[e.requestId]
		return cb;
	}
	
	var syncReadyCallbacks = {};
	
	var serverInstanceUid;
	
	var reader = {
		setup: function(e){
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
			//delete makeCbListenersByRequestId[e.requestId]
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
			var r = fparse.makeSingleReader(e.edit)
			e.edit = fp.readers[e.op](r)
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
				var op = fp.names[r.readByte()]
				var editId = r.readInt()
				var edit = fp.readers[op](r)
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
				var op = fp.names[r.readByte()]
				var editId = r.readInt()
				var edit = fp.readers[op](r)
				edits.push({op: op, edit: edit, editId: editId})
			}
			//log([e.id, edits])
			cb.object(e.id, edits)
		},
		ready: function(e){
			if(closed[e.syncId]){
				return
			}
			//console.log('tcpclient got response ready(' + e.syncId + '): ' + JSON.stringify(e))
			var cb = syncReadyCallbacks[e.requestId];
			_.assertFunction(cb);
			cb(e);
		},
		gotSnapshots: function(e){
			var cb = getRequestCallback(e);
			//console.log('tcpclient got response gotSnapshots: ' + JSON.stringify(e))
			cb(e);
		},
		gotAllSnapshots: function(e){
			var cb = getRequestCallback(e);
			//console.log('tcpclient got response gotAllSnapshots: ' + JSON.stringify(e))
			cb(undefined, e);
		},
		gotSnapshot: function(e){
			var cb = getRequestCallback(e);
			cb(e);
		},
		objectMade: function(e){
			//console.log('GOT BACK OBJECT MADE EVENT: ' + e.destinationSyncId + ' ' + JSON.stringify(Object.keys(syncListenersBySyncId)))
			var makeCb = syncListenersBySyncId[e.destinationSyncId].make
			makeCb(e.id, e.requestId, e.temporary)
			//defaultMakeListener(e.id, e.requestId)//TODO shouldn't this depend on which syncId we're informing?
		},
		/*gotVersionTimestamps: function(e){
			var timestamps = []
			for(var i=0;i<e.timestamps.length;i+=8){
				timestamps.push(bin.readLong(e.timestamps, i))
			}
			//console.log('got version timestamps: ' + JSON.stringify(e.destinationSyncId) + ' ' + JSON.stringify(timestamps))
			var vtListener = syncListenersBySyncId[e.destinationSyncId].versionTimestamps
			vtListener(e.requestId, timestamps)
		},*/
		requestError: function(e){
			log.err('ERROR: ' + e.err)
			console.log('ERROR: ' + e.err)
			var cb = callbacks[e.requestId]
			cb(e.err)
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
	//var fp
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
	
	var backingWriter
	function setupBasedOnSchema(schema){
		log('setting up')
		
		handle.schema = schema
		//fp = fparse.makeFromSchema(shared.editSchema)

		backingWriter = fparse.makeWriteStream(shared.clientRequests, {
			write: function(buf){
				if(clientDestroyed || clientEnded || clientClosed){
					console.log('WARNING: client already destroyed, discarding bytes to write: ' + buf.length)
					return
				}
				client.write(buf);
			},
			end: function(){
			}
		});
		
		w = backingWriter.fs
		
		backingWriter.beginFrame()
		w.flush = function(){
			backingWriter.endFrame()
			backingWriter.beginFrame()
		}
		
		deser = fparse.makeReadStream(shared.serverResponses, reader)
		
		defaultSyncHandle = makeSyncHandle(syncId, defaultMakeListener)
		syncListenersBySyncId[syncId] = {edit: defaultChangeListener, object: defaultObjectListener, make: defaultMakeListener}
		//makeCbListenersBySyncId[syncId] = defaultMakeListener
		
		flushIntervalHandle = setInterval(doFlush, 20)
	}
	
	function dataListener(data) {
		try{
			deser(data);
		}catch(e){
			console.log('WARNING: deserialization error: ' + e.stack)
			client.removeListener('data', dataListener)
			client.destroy()
			clientDestroyed = true
			clearInterval(flushIntervalHandle)
			throw e
		}
	}
	client.on('data', dataListener);

	client.on('error', function(e) {
		console.log('tcp client error: ' + e)
	})
	
	client.on('close', function() {
		clientClosed = true
		clearInterval(flushIntervalHandle)
	})
	client.on('end', function() {
		log('client disconnected');
		//doFlush()
		clearInterval(flushIntervalHandle)
		clientEnded = true
	});
	
	var flushIntervalHandle
	function doFlush(){
		w.flush()
	}
	
	var nkw = fparse.makeTemporaryBufferWriter(1024*1024)
	function serializeEdit(op, edit){
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
				log('tcpclient e.params: ', e.params)

				w.beginView(e);
			},
			endView: function(e){
				w.endView(e);
			},
			persistEdit: function(op, edit, sourceSyncId){
				_.assertString(op)
				
				var es = shared.editSchema[op]
				if(es === undefined) _.errout('unknown edit op: ' + op)
				var editTypeCode = es.code
				
				var requestId
				if(op === 'make' && !edit.forget){
					requestId = makeRequestId()
				}
				
				var bw = backingWriter.writer
				bw.putByte(3)
				bw.putInt(requestId)
				bw.putByte(editTypeCode)
				try{
					bw.startLength()
					fp.writers[op](bw, edit)
					bw.endLength()
				}catch(e){
					console.log(e)
					console.log('invalid edit received and not sent to server: ' + JSON.stringify(e));
					delete callbacks[e.requestId];
					throw e
				}
				bw.putInt(syncId)
				
				/*
				var e = {
					op: editTypeCode,
					edit: serializeEdit(op, edit),
					syncId: sourceSyncId,
					requestId: requestId
				}

				try{
					w.persistEdit(e);
				}catch(e){
					console.log(e)
					console.log('invalid edit received and not sent to server: ' + JSON.stringify(e));
					delete callbacks[e.requestId];
				}*/
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
		beginSync: function(listenerCb, objectCb, makeCb, cb){
			_.assertLength(arguments, 4)
			_.assertFunction(listenerCb)
			_.assertFunction(objectCb)
			_.assertFunction(makeCb)
			_.assertFunction(cb);
			var e = {};
			applyRequestId(e, wrapper.bind(undefined, cb, makeCb));

			log('BEGAN SYNC CLIENT')

			w.beginSync(e);
			syncListenersByRequestId[e.requestId] = {edit: listenerCb, object: objectCb, make: makeCb}
			
			
		},
		
		getSnapshots: function(e, cb){
			_.assertFunction(cb)
			applyRequestId(e, function(res){
				//console.log('res: ' + JSON.stringify(res))
				res.snapshotVersionIds = deserializeSnapshotVersionIds(res.snapshotVersionIds)
				cb(res)
			});
			w.getSnapshots(e);
			log('tcpclient: getSnapshots: ' + JSON.stringify(e))
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
				/*log('got request reply: ' + res.requestId)
				var str = ''
				for(var i=0;i<res.snapshots.length;++i){
					str += res.snapshots[i]+' '
				}
				console.log(res)
				console.log(str)*/
				res.snapshots = deserializeAllSnapshots(fp.readers, fp.names, res.snapshots)
				//log('deserialized: ' + JSON.stringify(res).slice(0,500))
				cb(undefined, res)
			});
			w.getAllSnapshots(e);
			//log('tcpclient: getSnapshots')
			//w.flush()
		},
		getSnapshot: function(e, cb){
			_.assertFunction(cb)
			applyRequestId(e, function(res){
				res.snap = deserializeSnapshot(fp.readers, fp.names, res.snap)
				cb(res)
			});
			w.getSnapshot(e);
			//log('tcpclient: getSnapshots')
		},
		close: function(cb){
			w.flush()
			clearInterval(flushIntervalHandle)
			client.on('end', function(){
				log('tcp client closed')
				cb()
			})
			client.end()
		}
	}

}


exports.make = make;
