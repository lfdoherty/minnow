"use strict";

var _ = require('underscorem');

var schema = require('./../shared/schema');

var syncApi = require('./../http/js/sync_api');

var matterhornService = require('./../http/matterhorn_service');

var xhrService = require('./../http/xhr_service')

var tcpserver = require('./../server/tcpserver')
var tcpclient = require('./tcpclient');

var longpoll = require('./../http/longpoll')

exports.name = 'minnow'
exports.dir = __dirname
exports.module = module

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
		
//var ooo = console.log

function getView(dbSchema, cc, st, type, params, syncId, api, beginView, cb){
	_.assertInt(syncId)

	_.assertFunction(cb)
	var listeningSyncId = syncId
	
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
		
			var snapshots = snapshotsRes.snapshots;
			if(snapshots === undefined){
				cb();
				return;
			}
		
			//var snapshot = mergeSnapshots(snapshots);
			console.log('got snapshots: ' + JSON.stringify(snapshots).slice(0,500));

			//TODO: cache/reuse sync apis?
			//TODO: they would need to have different syncIds though...
		
			//var api;
			function readyCb(e){
				//_.assertInt(e.syncId);
				//cb()//.getRoot());
				console.log('ready!!!!!!!!!!!!!!!!!!!!!!!1')
				cb()
			}
			
			snapshots.forEach(function(snapshot){
				console.log('snapshot: ' + JSON.stringify(snapshot).slice(0,500))
				//process.exit(0)
				api.addSnapshot(snapshot)
			})
		
			//var key = st.isView ? st.code+':'+JSON.stringify(params) : params;
		
			//_.errout('TODO')
		
			
			var req = {
				typeCode: st.code, 
				params: JSON.stringify(params), 
				latestSnapshotVersionId: snapshots[snapshots.length-1].endVersion,//snapshot.latestVersionId,
				syncId: syncId
			}
			beginView(req, /*changeListenerWrapper, */readyCb);

		});
	});
}

function translateParamObjects(s, params){
	var viewSchema = s.viewSchema
	//console.log(JSON.stringify(viewSchema))
	if(viewSchema.params.length === 0) return []
	
	var res = []
	viewSchema.params.forEach(function(p, i){
		if(p.type.type === 'object'){
			var id = params[i]
			if(!_.isInt(id)){
				//res.push(id)				
				id = id.id()
			}
			//TODO check objectHandle type against param type
			_.assert(id >= 0)
			res.push(id)
		}else{
			res.push(params[i])
		}
	})
	return res
}
function makeClient(host, port, clientCb){
	//if(console.log !== ooo) ooo('@got schema')
	//console.log('got here')

	var editListeners = []
	function changeListener(){
		var args = Array.prototype.slice.apply(arguments)
		var sp = editListeners

		function applyFunc(listener){listener.apply(undefined, args);}
		
		editListeners.forEach(applyFunc)
	}

	var listeningSyncId;
	
	var wrapper = {};

	var api;
	var cc;
	//TODO should the client maintain the current typeCode,id,path
	//via edits, rather than passing them with the persistEdit call
	wrapper.persistEdit = function(op, edit){
		_.assertLength(arguments, 2)
		
	//	console.log('client persisting: ' + op + ' ' + JSON.stringify(edit))
	//	console.log(new Error().stack)
		
		cc.getDefaultSyncHandle().persistEdit(op, edit, listeningSyncId, function(response){
			if(op === 'make'){
				//this is a special case since we are the originating party
				//edit.obj.object.meta.id = response.id;
				//console.log('calling change listener specially: ' + JSON.stringify([id, path, op, edit, syncId, edit.obj.object.meta.editId]));
				//_.assert(id >= 0)
				_.assert(response.id >= 0)
				
				//_.errout('TODO update temporaries, make callback')
				console.log('response: ' + JSON.stringify(response))
				api.reifyExternalObject(edit.temporary, response.id)
				//api.changeListener(id, path, op, edit, syncId, edit.obj.object.meta.editId);
			}else{
				_.errout('why?')
			}
		});
		//console.log('op: ' + op);
	}
	
	var rrr = Math.random()
	//console.log('made client ' + rrr)
	
	function changeListenerWrapper(e){
		//_.assertInt(typeCode);
		_.assertLength(arguments, 1);
		console.log(listeningSyncId + ' tcpserver sent change: ' + JSON.stringify(e).slice(0,300))
		//console.log(new Error().stack)
		//console.log(e.op)
		//var id = e.id
		//var path = JSON.parse(e.path)
		var op = e.op//edit.type;
		var edit = e.edit//.object;
		//var syncId = e.syncId;
		var editId = e.editId;
		_.assertString(op);
		//_.assert(_.isString(id) || _.isInt(id));
		//console.log('(' + rrr + ') ' + listeningSyncId + ' got edit ' + op + ' from syncId ' + syncId + ', editId: ' + editId)
		api.changeListener(op, edit, editId);
		//console.log('... ' + listeningSyncId + ' done.')
	}
	function objectListenerWrapper(id, edits){
		//console.log(JSON.stringify(e))
		api.objectListener(id, edits);
	}
	tcpclient.make(host, port, changeListenerWrapper, objectListenerWrapper, function(serverHandle, syncId){
		_.assertInt(syncId)
		
		listeningSyncId = syncId
		var dbSchema = serverHandle.schema;
	
		//if(console.log !== ooo) ooo('*got inmem')
		//console.log('making tcp client')
		
		cc = serverHandle//clientConnection.make(serverHandle);

		api = syncApi.make(dbSchema, wrapper/*, snapshot, st.code, key*/);
		api.setEditingId(syncId);
	
		_.assertFunction(api.changeListener);
		
		var serviceIsSetup = false;
		var xhrServiceIsSetup = false
		
		var uid = Math.random()
		
		//9999999999999999999999999999
		
		_.extend(wrapper, cc);

		
		
		
		//9999999999999999999999999999
		
		var viewGetter = _.memoizeAsync(function(type, params, st, syncId, sc, cb){
			_.assertFunction(cb)
			console.log(uid + ' getting view ' + type + JSON.stringify(params))
			getView(dbSchema, cc, st, type, params, syncId, api, sc.beginView, function(){
				var viewId = st.code+':'+JSON.stringify(params)
				console.log('calling back with view: ' + viewId + '+++++++++++++++++++++')
				api.onEdit(changeListener)
				cb(api.getView(viewId))
			})
		},function(type, params){
			var key = type + JSON.stringify(params)
			//console.log(uid + ' view key (' + key + ')')
			return key
		})
		
		var syncHandles = {}
		
		syncHandles[syncId] = cc.getDefaultSyncHandle()

		/*var longPollersByAppName = {}
		function setupLongPollerIfNeeded(appName){
			var lp = longPollersByAppName[appName]
			if(lp === undefined){
				longPollersByAppName[appName] = longpoll.load(exports, appName, dbSchema, authenticator, minnowClient)
			}
		}*/
		
		var handle = {
			//begins the creation process for an externally-accessible object of the given type
			schema: dbSchema,
			//schemaName: dbName,
			internalClient: cc,
			beginSync: function(listenerCb, objectCb, cb){
				_.assertLength(arguments, 3)
				_.assertFunction(listenerCb)
				_.assertFunction(objectCb)
				_.assertFunction(cb)
				cc.beginSync(listenerCb, objectCb, function(syncId, syncHandle){
					_.assertLength(arguments, 2)
					_.assertInt(syncId)
					_.assertObject(syncHandle)
					
					syncHandles[syncId] = syncHandle
					cb(syncId, syncHandle)
				})
			},
			serverInstanceUid: cc.serverInstanceUid,
			setupService: function(name, local, authenticator){
				_.assertLength(arguments, 3)
				_.assertFunction(authenticator)
				_.assertNot(serviceIsSetup);
				serviceIsSetup = true;
				//console.log('minnow-matterhorn service is running')
				var lp = longpoll.load(name, dbSchema, authenticator, handle)
				xhrService.make(name, dbSchema, local, handle, authenticator, lp);
				return matterhornService.make(name, dbSchema, local, handle, authenticator, lp);
			},
			/*setupXhrService: function(name, local, authenticator){
				_.assertNot(xhrServiceIsSetup);
				xhrServiceIsSetup = true;
				//console.log('minnow-xhr service is running')
				return xhrService.make(name, dbSchema, local, handle, authenticator);
			},*/
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

				_.assertFunction(cb)

				params = translateParamObjects(st, params)
				
				var syncHandle = syncHandles[syncId]
				_.assertObject(syncHandle)
				_.assertArray(params)
				viewGetter(type, params, st, syncId, syncHandle, cb)
			},
			
			getDefaultSyncId: function(){
				return syncId
			},
			onEdit: function(listener){
				//console.log('listening for edits on syncId ' + syncId)
				editListeners.push(listener)
			},
			close: function(cb){
				serverHandle.close(cb);
			}
		};
		//if(console.log !== ooo) ooo('#calling back')
		clientCb(handle, dbSchema);
	});
}


function makeServer(dbSchema, globalMacros, dataDir, port, synchronousPlugins, cb){
	tcpserver.make(dbSchema, globalMacros, dataDir, port, synchronousPlugins, cb)
}


exports.makeServer = function(config, cb){
	_.assertLength(arguments, 2)
	_.assert(_.isString(config.schemaDir) || _.isArray(config.schemaDir))
	//_.assertString(config.dataDir)
	_.assertInt(config.port)
	if(config.synchronousPlugins !== undefined) _.assertObject(config.synchronousPlugins)
	//if(arguments.length < 3) throw new Error('makeServer(schemaDir, dataDir, port[, cb]) only got ' + arguments.length + ' arguments.')
	//if(arguments.length > 4) throw new Error('makeServer(schemaDir, dataDir, port[, cb]) got ' + arguments.length + ' arguments.')
	schema.load(config.schemaDir, config.synchronousPlugins, function(dbSchema, globalMacros){
		makeServer(dbSchema, globalMacros, config.dataDir||'.', config.port, config.synchronousPlugins||{}, cb||function(){})
	})
}
exports.makeClient = function(port, host, cb){
	//_.assertLength(arguments, 2)
	if(arguments.length === 2){
		cb = host
		host = undefined
	}
	_.assertInt(port)
	_.assertFunction(cb)
	makeClient(host||'localhost', port, cb)
}

