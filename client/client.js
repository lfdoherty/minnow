"use strict";

var _ = require('underscorem');

var schema = require('./../shared/schema');

var syncApi = require('./../http/js/sync_api');

var matterhornService = require('./../http/matterhorn_service');

var xhrService = require('./../http/xhr_service')

var tcpserver = require('./../server/tcpserver')
var tcpclient = require('./tcpclient');

//copied from browserclient.js
function mergeSnapshots(snaps){

	var result = {latestVersionId: snaps[snaps.length-1].latestVersionId, objects: []};
	
	var taken = {};
	for(var i=snaps.length-1;i>=0;--i){
		var m = snaps[i].objects;
		
		for(var j=0;j<m.length;++j){	
			var obj = m[j]
			var id = obj.object.meta.id
			if(!taken[id]){
				taken[id] = true;
				result.objects.push(obj);
			}
		}
	}
	
	return result;
}
		
var ooo = console.log

function getView(dbSchema, cc, st, type, params, syncId, cb){
	_.assertInt(syncId)

	_.assertFunction(cb)
	
	_.assertArray(params);
	var paramsStr = JSON.stringify(params);
	
	//console.log(require('util').inspect(st));
	_.assertInt(st.code);
	
	cc.getSnapshots({typeCode: st.code, params: paramsStr}, function(res){
		var snapshotIds = res.snapshotVersionIds;
		//console.log(JSON.stringify(snapshotIds));
		for(var i=0;i<snapshotIds.length;++i){
			_.assertInt(snapshotIds[i]);
		}
		cc.getAllSnapshots({typeCode: st.code, params: paramsStr, snapshotVersionIds: snapshotIds}, function(snapshotsRes){
		
			//cc.makeSyncId(function(syncId){
				var snapshots = snapshotsRes.snapshots;
				if(snapshots === undefined){
					cb();
					return;
				}
			
				var snapshot = mergeSnapshots(snapshots);
				//console.log('got snapshot: ' + JSON.stringify(snapshot));

				//TODO: cache/reuse sync apis?
				//TODO: they would need to have different syncIds though...
			
				var api;
				function readyCb(e){
					//_.assertInt(e.syncId);
					cb(api.getRoot());
				}
			
				var key = st.isView ? st.code+':'+JSON.stringify(params) : params;
			
				var wrapper = {};
				_.extend(wrapper, cc);
				//TODO should the client maintain the current typeCode,id,path
				//via edits, rather than passing them with the persistEdit call
				wrapper.persistEdit = function(id, path, op, edit, syncId){
					
					cc.persistEdit({id: id, path: JSON.stringify(path), edit: {type: op, object: edit}, syncId: syncId}, function(response){
						if(op === 'make'){
							//this is a special case since we are the originating party
							//TODO require all creation to be via "add to view set" semantics?
							edit.obj.object.meta.id = response.id;
							console.log('calling change listener specially: ' + JSON.stringify([id, path, op, edit, syncId, edit.obj.object.meta.editId]));
							//_.assert(id >= 0)
							_.assert(response.id >= 0)
							api.changeListener(id, path, op, edit, syncId, edit.obj.object.meta.editId);
						}
					});
					//console.log('op: ' + op);
				}
			
				api = syncApi.make(dbSchema, wrapper, snapshot, st.code, key);
				api.setEditingId(syncId);
				
				_.assertFunction(api.changeListener);
				function changeListenerWrapper(e){
					//_.assertInt(typeCode);
					_.assertLength(arguments, 1);
					var id = e.id
					var path = JSON.parse(e.path)
					var op = e.edit.type;
					var edit = e.edit.object;
					var syncId = e.syncId;
					var editId = e.editId;
					_.assertString(op);
					_.assert(_.isString(id) || _.isInt(id));
					console.log('tcpserver sending change: ' + JSON.stringify(e))
					api.changeListener(id, path, op, edit, syncId, editId);
				}
				var req = {typeCode: st.code, params: JSON.stringify(params), latestSnapshotVersionId: snapshot.latestVersionId}
				cc.beginSync(req, changeListenerWrapper, readyCb);
			//})

		});
	});
}

function makeClient(port, clientCb){
	if(console.log !== ooo) ooo('@got schema')

	tcpclient.make(port, function(serverHandle, syncId){
		_.assertInt(syncId)
		
		var dbSchema = serverHandle.schema;
	
		if(console.log !== ooo) ooo('*got inmem')
		
		var cc = serverHandle//clientConnection.make(serverHandle);
		
		var serviceIsSetup = false;
		var xhrServiceIsSetup = false
		
		var uid = Math.random()
		
		var viewGetter = _.memoizeAsync(function(type, params, st, syncId, cb){
			console.log(uid + ' getting view ' + type + JSON.stringify(params))
			getView(dbSchema, cc, st, type, params, syncId, cb)
		},function(type, params){
			var key = type + JSON.stringify(params)
			console.log(uid + ' view key (' + key + ')')
			return key
		})
		var handle = {
			//begins the creation process for an externally-accessible object of the given type
			schema: dbSchema,
			//schemaName: dbName,
			internalClient: cc,
			makeSyncId: function(cb){
				cc.makeSyncId(cb)
			},
			serverInstanceUid: cc.serverInstanceUid,
			setupService: function(local, port){
				_.assertNot(serviceIsSetup);
				serviceIsSetup = true;
				console.log('minnow-matterhorn service is running')
				return matterhornService.make(local, port, handle);
			},
			setupXhrService: function(name, local, authenticator){
				_.assertNot(xhrServiceIsSetup);
				xhrServiceIsSetup = true;
				console.log('minnow-xhr service is running')
				return xhrService.make(name, dbSchema, local, handle, authenticator);
			},
			view: function(type, params, cb){
				var st = dbSchema[type];
				if(st === undefined){_.errout('unknown view: ' + type);}
	
	
	
				_.assertNot(st.superTypes.abstract);
				if(arguments.length === 2 && st.isView && st.viewSchema.params.length === 0){
					cb = params;
					params = [];

				}else{
					_.assertLength(arguments, 3)
				}
				viewGetter(type, params, st, syncId, cb)
			},
			getDefaultSyncId: function(){
				return syncId
			},
			close: function(cb){
				serverHandle.close(cb);
			}
		};
		if(console.log !== ooo) ooo('#calling back')
		clientCb(handle);
	});
}


function makeServer(dbSchema, dataDir, port, cb){
	tcpserver.make(dbSchema, dataDir, port, cb)
}


exports.makeServer = function(schemaDir, dataDir, port, cb){
	//_.assertLength(arguments, 4)
	if(arguments.length !== 4) throw new Error('makeServer(schemaDir, dataDir, port, cb) only got ' + arguments.length + ' arguments.')
	schema.load(schemaDir, function(dbSchema){
		makeServer(dbSchema, dataDir, port, cb)
	})
}
exports.makeClient = function(port, cb){
	_.assertLength(arguments, 2)
	makeClient(port, cb)
}

