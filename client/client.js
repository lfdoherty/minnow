"use strict";
/*
var old = console.log
console.log = function(msg){
	msg += ''
	if(msg.length > 10000){
		throw new Error('too long')
		process.exit(0)
	}
	old(msg)
}
*/

var _ = require('underscorem');

var schema = require('./../shared/schema');

var syncApi = require('./../http/js/sync_api');

var matterhornService = require('./../http/matterhorn_service');

var xhrService = require('./../http/xhr_service')

var tcpserver = require('./../server/tcpserver')
var tcpclient = require('./tcpclient');

var longpoll = require('./../http/longpoll')
var websocket = require('./../http/websocket')

var jsonutil = require('./../http/js/jsonutil')

exports.module = module


var editFp = require('./../server/tcp_shared').editFp
var editCodes = editFp.codes
var editNames = editFp.names

var log = require('quicklog').make('minnow/client')

var historicalKeyCounter = 1

function getView(dbSchema, cc, st, type, params, syncId, api, beginView, historicalKey, cb){
	_.assertInt(syncId)

	_.assertFunction(cb)
	var listeningSyncId = syncId
	
	_.assertArray(params);
	var paramsStr = JSON.stringify(params);
	
	//console.log(require('util').inspect(st));
	_.assertInt(st.code);
	//console.log(new Error().stack)
	
	cc.getSnapshots({typeCode: st.code, params: paramsStr, isHistorical: !!historicalKey}, function(err, res){
		if(err){
			console.log('getView error: ' + err)
			cb(err)
			return
		}
		var snapshotIds = res.snapshotVersionIds;
		//console.log(JSON.stringify(snapshotIds));
		for(var i=0;i<snapshotIds.length;++i){
			_.assertInt(snapshotIds[i]);
		}
		cc.getAllSnapshots({typeCode: st.code, params: paramsStr, snapshotVersionIds: snapshotIds, isHistorical: !!historicalKey}, function(err, snapshotsRes){
		
			if(err){
				console.log('getAllSnapshots error: ' + err)
				cb(err)
				return
			}
		
			var snapshots = snapshotsRes.snapshots;
			if(snapshots === undefined){
				cb();
				return;
			}
		
			//var snapshot = mergeSnapshots(snapshots);
			//console.log('got snapshots: ' + JSON.stringify(snapshots).slice(0,500));

			//TODO: cache/reuse sync apis?
			//TODO: they would need to have different syncIds though...
		
			//var api;
			function readyCb(e){
				//_.assertInt(e.syncId);
				//cb()//.getRoot());
				//log('ready!!!!!!!!!!!!!!!!!!!!!!!1')
				cb()
			}
			
			snapshots.forEach(function(snapshot){
				//log('snapshot: ' + JSON.stringify(snapshot).slice(0,500))
				//process.exit(0)
				api.addSnapshot(snapshot, historicalKey)
			})
		
			//var key = st.isView ? st.code+':'+JSON.stringify(params) : params;
		
			//_.errout('TODO')
		
			
			var req = {
				typeCode: st.code, 
				params: JSON.stringify(params), 
				latestSnapshotVersionId: snapshots[snapshots.length-1].endVersion,//snapshot.latestVersionId,
				syncId: syncId,
				isHistorical: !!historicalKey
			}
			if(historicalKey) req.historicalKey = historicalKey
			//console.log('beginning view')
			beginView(req, readyCb);

		});
	});
}

function translateParamObjects(s, params){
	var viewSchema = s.viewSchema
	//console.log(JSON.stringify(viewSchema))
	if(viewSchema.params.length === 0) return []

	var manyParams = viewSchema.params.length
	if(manyParams !== params.length){
		_.errout('wrong number of params for ' + viewSchema.name + ' view (should be ' + manyParams + ', but is ' + params.length + ')')
	}	
	
	var res = []
	viewSchema.params.forEach(function(p, i){
		if(p.type.type === 'object'){
			var id = params[i]
			if(!_.isInt(id)){
				//res.push(id)	
				if(id !== undefined && id.id !== undefined && _.isFunction(id.id)){
					id = id.id()
				}else{
					throw new Error('invalid param value(' + i + '): ' + id)
				}
			}
			//TODO check objectHandle type against param type
			_.assertInt(id)
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
	var errorListeners = []
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

	wrapper.persistEdit = function(op, edit){//, temporaryId){
		//.assertLength(arguments, 2)
		_.assertInt(op)
		_.assertObject(edit)
		
		var requestId = cc.getDefaultSyncHandle().persistEdit(op, edit, listeningSyncId);

		if(op === editCodes.make){// && !edit.forget){
			_.errout('TODO')
			//_.assertInt(temporaryId)
			//_.assert(temporaryId < -1)
			//makeCbsWaiting[requestId] = {temporary: temporaryId}
		}
	}
	
	wrapper.make = function(type, json, forget, cb, temporary){
		//_.assertLength(arguments, 4)
		_.assert(arguments.length >= 4)
		_.assertString(type)
		/*if(_.isFunction(json)){
			cb = json
			json = {}
		}*/
		return doMake(type, json, forget, cb, temporary)
	}
	
	wrapper.makeFork = function(obj, cb, temporary){
		_.assertLength(arguments, 3)
		return doFork(obj, cb)
	}

	wrapper.forgetLastTemporary = function(){
		//_.errout('TODO');
		cc.getDefaultSyncHandle().forgetLastTemporary(listeningSyncId)
	}
	
	var rrr = Math.random()
	//console.log('made client ' + rrr)
	
	function changeListenerWrapper(e){
		_.assertLength(arguments, 1);
		var op = e.op
		var edit = e.edit
		var editId = e.editId;
		_.assertInt(op);
		api.changeListener(op, edit, editId);
	}
	function objectListenerWrapper(id, edits){
		//console.log(JSON.stringify(e))
		//console.log('client got object: ' + id)
		api.objectListener(id, edits);
	}
	
	var makeCbsWaiting = {}
	function defaultMakeListener(id, requestId, temporary){
		_.assertInt(id)
		_.assertInt(requestId)

		api.reifyExternalObject(temporary, id)
		
		//console.log('getting cb: ' + id + ' ' + requestId)
		var cb = makeCbsWaiting[requestId]
		if(cb){
			if(cb.cb){
				//var objHandle = api.getTopObject(id)
				_.assert(id > 0)
				cb.cb(id)
			}else{
				//console.log('no actual cb')
			}
			delete makeCbsWaiting[requestId]
		}else{
			//console.log('WARNING: no cb')
		}
	}
	
	function defaultReifyListener(temporary, id){
		api.reifyObject(temporary, id)
	}
	
	function makeTemporary(){
		return api.makeTemporaryId()
	}
	
	function doMake(type, json, forget, cb, temp){
		//_.errout('TODO')
		var st = dbSchema[type];
		//var temp = makeTemporary()
		var edits = jsonutil.convertJsonToEdits(dbSchema, type, json, makeTemporary, temp)
		
		var dsh = cc.getDefaultSyncHandle()
		var requestId = dsh.persistEdit(editCodes.make, {typeCode: st.code, forget: forget, following: edits.length}, listeningSyncId)
		if(cb){
			_.assertInt(requestId)
			_.assertFunction(cb)
			//console.log('setting cb: ' + requestId)
			
			makeCbsWaiting[requestId] = {temporary: temp, cb: cb}
		}
		for(var i=0;i<edits.length;++i){
			var e = edits[i]
			_.assertInt(e.op)
			dsh.persistEdit(e.op, e.edit, listeningSyncId);
		}
		if(forget){
			dsh.forgetLastTemporary(listeningSyncId)
		}
		return edits
	}	

	function doFork(obj, cb){

		var dsh = cc.getDefaultSyncHandle()
		var requestId = dsh.persistEdit(editCodes.makeFork, {sourceId: obj._internalId()}, listeningSyncId)
		if(cb){
			_.assertInt(requestId)
			_.assertFunction(cb)
			makeCbsWaiting[requestId] = {cb: cb}
		}
		
		return []
	}	

	var dbSchema
	
	tcpclient.make(host, port, changeListenerWrapper, objectListenerWrapper, defaultMakeListener, defaultReifyListener, function(serverHandle, syncId){
		_.assertInt(syncId)
		
		listeningSyncId = syncId
		dbSchema = serverHandle.schema;
	
		//if(console.log !== ooo) ooo('*got inmem')
		//console.log('making tcp client')
		
		cc = serverHandle

		api = syncApi.make(dbSchema, wrapper, log);
		api.setEditingId(syncId);
	
		_.assertFunction(api.changeListener);
		
		var serviceIsSetup = false;
		var xhrServiceIsSetup = false
		
		var uid = Math.random()
		
		_.extend(wrapper, cc);
		
		var viewGetter = _.memoizeAsync(function(type, params, historicalKey, st, syncId, sc, cb){
			_.assertFunction(cb)
			//console.log(uid + ' getting view ' + type + JSON.stringify(params))
			//_.assert(errorListeners.length > 0)
			getView(dbSchema, cc, st, type, params, syncId, api, sc.beginView, historicalKey, function(err){
				if(err){
					if(cb.length === 1){
						throw err
					}
					//console.log('getView error in client: ' + err)
					//console.log('view "' + type + '" load failed with error: ' + err)
					cb(err)
					return
				}
				var viewId = st.code+':'+JSON.stringify(params)
				//log('calling back with view: ' + viewId + '+++++++++++++++++++++')
				api.onEdit(changeListener)
				/*
				if(cb.length === 1){
					cb(api.getView(viewId, historicalKey))
				}else{*/
				if(historicalKey){
					cb(undefined, api.getView(viewId, historicalKey))
				}else{
					cb(undefined, api.getView(viewId, historicalKey))
				}
				//}
			})
		},function(type, params, historicalKey){
			//console.log(require('util').inspect(params))
			var key = type + JSON.stringify(params) + ':'+historicalKey
			//console.log(uid + ' view key (' + key + ')')
			return key
		})
		
		var syncHandles = {}
		
		syncHandles[syncId] = cc.getDefaultSyncHandle()

		var handle = {
			//begins the creation process for an externally-accessible object of the given type
			schema: dbSchema,
			//schemaName: dbName,
			internalClient: cc,
			beginSync: function(listenerCb, objectCb, makeCb, reifyCb, cb){
				_.assertLength(arguments, 5)
				_.assertFunction(listenerCb)
				_.assertFunction(objectCb)
				_.assertFunction(makeCb)
				_.assertFunction(reifyCb)
				//_.assertFunction(versionTimestamps)
				_.assertFunction(cb)
				function makeCbWrapper(id, requestId, temporary){
					_.assert(temporary < 0)
					makeCb(temporary, id)
				}
				cc.beginSync(listenerCb, objectCb, makeCbWrapper, reifyCb, function(syncId, syncHandle){
					_.assertLength(arguments, 2)
					_.assertInt(syncId)
					_.assertObject(syncHandle)
					
					syncHandles[syncId] = syncHandle

					cb(syncId, syncHandle)
				})
			},
			serverInstanceUid: cc.serverInstanceUid,
			setupService: function(name, local, secureLocal, identifier, authenticateByToken, viewSecuritySettings, syncHandleCreationListener){
				//_.assertLength(arguments, 5)
				_.assert(arguments.length >= 6)
				_.assert(arguments.length <= 7)
				_.assertFunction(identifier)
				_.assert(_.isObject(viewSecuritySettings) || _.isFunction(viewSecuritySettings))
				_.assertNot(serviceIsSetup);
				serviceIsSetup = true;
				var lp = longpoll.load(local, name, dbSchema, identifier, viewSecuritySettings, handle, syncHandleCreationListener)

				var ws = websocket.load(local, dbSchema, authenticateByToken, viewSecuritySettings, handle, syncHandleCreationListener)
				
				xhrService.make(name, dbSchema, local, handle, identifier, viewSecuritySettings, lp);
				return matterhornService.make(name, dbSchema, local, secureLocal, handle, identifier, viewSecuritySettings, lp);
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

				_.assertFunction(cb)

				params = translateParamObjects(st, params)
				
				var syncHandle = syncHandles[syncId]
				_.assertObject(syncHandle)
				_.assertArray(params)
				viewGetter(type, params, 0, st, syncId, syncHandle, cb)
			},
			historicalView: function(type, params, cb){
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
				var historicalKey = historicalKeyCounter++
				viewGetter(type, params, historicalKey, st, syncId, syncHandle, cb)
			},
			make: function(type, json, cb){
				_.assertString(type)
				if(_.isFunction(json)){
					cb = json
					json = {}
				}
				var forget = !cb
				if(cb === true){
					forget = true
				}
				
				json = json || {}
				_.assertObject(json)
				//doMake(type, json, forget, cb)
				var res = api.createNewExternalObject(type, json, forget, cb)
				if(!forget){
					_.assertDefined(res)
				}
				//console.log('here '+new Error().stack + ' ' + JSON.stringify(res))
				return res
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
			},
			on: function(what, listener){
				if(what === 'edit'){
					editListeners.push(listener)
				}else if(what === 'error'){
					errorListeners.push(listener)
				}else{
					_.errout('not a valid event type: ' + what)
				}
			}
		};
		//if(console.log !== ooo) ooo('#calling back')
		clientCb(handle, dbSchema);
	});
}


function makeServer(dbSchema, globalMacros, dataDir, port, cb){
	tcpserver.make(dbSchema, globalMacros, dataDir, port, cb)
}


var sync = require('./../server/variables/sync/index')

exports.makeServer = function(config, cb){
	_.assertLength(arguments, 2)
	_.assert(_.isString(config.schemaDir) || _.isArray(config.schemaDir))
	//console.log('here: ' + config.schemaDir)
	//_.assertString(config.dataDir)
	_.assertInt(config.port)
	if(config.synchronousPlugins !== undefined) _.assertObject(config.synchronousPlugins)
	
	var syncPlugins = {}
	_.extend(syncPlugins, config.synchronousPlugins||{}, sync.plugins)
	
	schema.load(config.schemaDir, syncPlugins, config.disableOptimizations, function(dbSchema, globalMacros){
		makeServer(dbSchema, globalMacros, config.dataDir||'.', config.port, cb||function(){})
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

