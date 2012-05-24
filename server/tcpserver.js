"use strict";

var net = require('net')

var _ = require('underscorem')
var baleen = require('baleen')
var shared = require('./tcp_shared');
var bin = require('./../util/bin')
var server = require('./server');

function makeServer(appSchema, dataDir, port, readyCb){
	_.assertLength(arguments, 4);
	//_.assertString(appName);
	_.assertInt(port);
	_.assertFunction(readyCb);
	
	var exes = shared.makeExes(appSchema);
	
	server.make(appSchema, dataDir, function(s){
		createTcpServer(appSchema, port, exes, s, readyCb);
	});
}

function createTcpServer(appSchema, port, exes, s, readyCb){
	console.log('making tcp server')
	var tcpServer = net.createServer(function(c){

		console.log('tcp server made')
		var syncId = s.makeNewSyncId()
		
		var setupStr = JSON.stringify({syncId: syncId, schema: appSchema})
		var setupByteLength = Buffer.byteLength(setupStr, 'utf8')
		var setupBuffer = new Buffer(setupByteLength+8)
		bin.writeInt(setupBuffer, 0, setupByteLength)
		setupBuffer.write(setupStr, 8)
		
		c.write(setupBuffer)

		var w = exes.responses.binary.stream.makeWriter({
			write: function(buf){
				c.write(buf);
			},
			end: function(){
				//TODO?
			}
		});
		
	//	console.log('writer: ' + JSON.stringify(Object.keys(w)));
		
		function makeRequestWrapper(requestName, responseName){
			//console.log('making wrapper: ' + requestName + ' ' + responseName)
			var wf = w[responseName];
			_.assertFunction(wf);
			var sf = s[requestName];
			_.assertFunction(sf);
			return function(e){
				console.log('tcpserver got client request ' + requestName + ': ' + JSON.stringify(e))
				sf(e, function(res){
					res.requestId = e.requestId;
					console.log('tcpserver writing client response ' + responseName + ': ' + JSON.stringify(res));
					wf(res);
					w.flush();
				})
			}
		}
		
		var reader = {
			makeSyncId: function(e){
				var syncId = s.makeNewSyncId();
				w.newSyncId({requestId: e.requestId, syncId: syncId});
				w.flush();
			},
			beginSync: function(e){
				//console.log('tcpserver got client request beginSync: ' + JSON.stringify(e))
				//var syncId = s.makeNewSyncId();
				//w.open({requestId: e.requestId, syncId: syncId});
				s.beginSync(e, function(typeCode, id, path, op, edit, syncId, editId){
					_.assertLength(arguments, 7);
					_.assertString(op);
					//_.assertInt(id);
					var update = {id: id, path: JSON.stringify(path), edit: {type: op, object: edit}, syncId: syncId, editId: editId, requestId: e.requestId};
					//console.log('tcpserver sending update: ' + JSON.stringify(update))
					w.update(update);
					w.flush()
				}, function(updatePacket){
					_.assertArray(updatePacket)
					w.ready({requestId: e.requestId, updatePacket: JSON.stringify(updatePacket)})
					w.flush();
				});
			},
			endSync: function(e){
				console.log('tcpserver got client request endSync: ' + JSON.stringify(e))
			},
			persistEdit: function(e){
				var op = e.edit.type;
				console.log('tcpserver got client request persistEdit: ' + JSON.stringify(e).slice(0,300))
				s.persistEdit(e.id, JSON.parse(e.path), op, e.edit.object, e.syncId, function(result){
					if(op === 'make'){
						_.assertInt(result.id);
						w.objectMade({requestId: e.requestId, id: result.id});
						w.flush();
					}
				});
			},
			getSnapshots: makeRequestWrapper('getSnapshots', 'gotSnapshots'),
			getAllSnapshots: function(e, cb){
				
				s.getAllSnapshots(e, function(res){
					res.requestId = e.requestId;
					w.gotAllSnapshots(res);
					w.flush();
				});
			},
			getSnapshot: function(e, cb){
				s.getSnapshot(e, function(res){
					//res.requestId = e.requestId;
					w.gotSnapshot({snap: res, requestId: e.requestId});
					w.flush();
				});
			}
		}

		c.on('end', function() {
		//console.log('server disconnected');
		});

		var deser;
		c.on('connect', function(){
			deser = exes.client.binary.stream.makeReader(reader);
		})
		c.on('data', function(buf){
			deser(buf);
		})
		
		w.setup({serverInstanceUid: s.serverInstanceUid(), schema: JSON.stringify(appSchema)});
		w.flush()
		//c.write('hello\r\n');
		//c.pipe(c);
		

	});

	var serverHandle = {
		close: function(cb){
			var cdl = _.latch(2, function(){
				console.log('all closed')
				cb()
			})
			tcpServer.on('close', function(){
				console.log('tcp server closed')
				cdl()
			})
			tcpServer.close()
			s.close(cdl)
		}
	}

	tcpServer.listen(port, function(){
		readyCb(serverHandle);
	});
}
exports.make = makeServer;
