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

var random = require('seedrandom')

var _ = require('underscorem');

var schema = require('./../shared/schema');

var syncApi = require('./../http/js/sync_api');

var matterhornService = require('./../http/matterhorn_service');

var xhrService = require('./../http/xhr_service')

var tcpserver = require('./../server/tcpserver')
var tcpclient = require('./tcpclient');

var longpoll = require('./../http/longpoll')
var websocket = require('./../http/websocket')

var pu = require('./../http/js/paramutil')

var jsonutil = require('./../http/js/jsonutil')

exports.module = module


//var newViewSequencer = require('./../server/new_view_sequencer')

var editFp = require('./../server/tcp_shared').editFp
var editCodes = editFp.codes
var editNames = editFp.names

var log = require('quicklog').make('minnow/client')

var historicalKeyCounter = 1

function getView(dbSchema, cc, st, type, params, syncId, api, beginView, /*historicalKey,*/ cb){
	//_.assertString(syncId)
	_.assertString(syncId)
	_.assertLength(syncId, 8)

	_.assertFunction(cb)
	var listeningSyncId = syncId
	
	_.assertArray(params);
	var paramsStr = pu.paramsStr(params, st.viewSchema.params)//JSON.stringify(params);
	
	//console.log('paramsStr: ' + paramsStr)
	
	//console.log(require('util').inspect(st));
	_.assertInt(st.code);
	//console.log(new Error().stack)
	
	cc.getSnapshots({typeCode: st.code, params: paramsStr/*, isHistorical: !!historicalKey*/}, function(err, res){
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
		cc.getAllSnapshots({typeCode: st.code, params: paramsStr, snapshotVersionIds: snapshotIds/*, isHistorical: !!historicalKey*/}, function(err, snapshotsRes){
		
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
				api.addSnapshot(snapshot)//, historicalKey)
			})
		
			//var key = st.isView ? st.code+':'+JSON.stringify(params) : params;
		
			//_.errout('TODO')
		
			//var viewId = ':'st.code+paramsStr
			var viewId = pu.viewIdStr(st.code,params,st)
			var req = {
				typeCode: st.code, 
				//params: JSON.stringify(params), 
				viewId: viewId,
				latestSnapshotVersionId: snapshots[snapshots.length-1].endVersion,//snapshot.latestVersionId,
				syncId: syncId/*,
				isHistorical: !!historicalKey*/
			}
			//if(historicalKey) req.historicalKey = historicalKey
			//console.log('beginning view')
			beginView(req, readyCb);

		});
	});
}

function getSnap(dbSchema, cc, st, type, params, changeListener, syncId, wrapper, cb){

	_.assertFunction(cb)
	
	_.assertArray(params);
	//var paramsStr = JSON.stringify(params);

	//var viewId = ':'+st.code+paramsStr
	var viewId = pu.viewIdStr(st.code,params,st)
	var paramsStr = pu.paramsStr(params,st.viewSchema.params)
	
	//console.log(require('util').inspect(st));
	_.assertInt(st.code);
	//console.log(new Error().stack)
	
	cc.getAllCurrentSnapshots({typeCode: st.code, params: paramsStr, isHistorical: false}, function(err, snapshotsRes){
	
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
		
		//TODO impl and use makeSnap
		var api = syncApi.make(dbSchema, wrapper, log);
		api.setEditingId(syncId)
		
		api.onEdit(changeListener)
		
		snapshots.forEach(function(snapshot){
			api.addSnapshot(snapshot)
		})
		
		cb(undefined, api.getView(viewId))
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
	
	//console.log('translating param objects: ' + JSON.stringify(params))
	
	var res = []
	viewSchema.params.forEach(function(p, i){
		if(p.type.type === 'object'){
			var id = params[i]
			if(id.id){//!_.isInt(id)){
				//res.push(id)	
				if(id !== undefined && id.id !== undefined && _.isFunction(id.id)){
					id = id._internalId()
				}else{
					throw new Error('invalid param value(' + i + '): ' + id)
				}
			}
			//TODO check objectHandle type against param type
			_.assertString(id)
			if(id.length === 22){
				id = random.uuidBase64ToString(id)
			}
			_.assertLength(id, 8)
			//_.assert(id >= 0)
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

		if(op === editCodes.make || op === editCodes.copy){// && !edit.forget){
			_.errout('TODO')
		}
	}
	
	wrapper.make = function(type, json, forget, cb, id){
		_.assert(arguments.length >= 4)
		_.assertString(type)
		_.assertString(id)
		_.assertLength(id, 8)
		return doMake(cc.getDefaultSyncHandle(), type, json, forget, cb, id)
	}
	
	wrapper.copy = function(obj, json, forget, cb, id){
		_.assert(arguments.length >= 4)
		_.assertString(obj.id())
		_.assertString(id)
		return doCopy(cc.getDefaultSyncHandle(), obj, json, forget, cb, id)
	}

	wrapper.forgetLastTemporary = function(){
		//_.errout('TODO');
		cc.getDefaultSyncHandle().forgetLastTemporary(listeningSyncId)
	}
	
	var rrr = Math.random()
	
	
	function defaultBlockListener(e){
		/*var ne = {
			endEditId: e.endEditId,
			edits: e.edits,
			viewObjects: e.viewObjects,
			objects: e.objects
		}
		throw new Error(JSON.stringify(e))*/
		api.blockUpdate(e)
	}
	
	var makeCbsWaiting = {}
	function defaultMakeListener(id, requestId){//, temporary){
		_.assertString(id)
		_.assertInt(requestId)

		//api.reifyExternalObject(temporary, id)
		
		//console.log('getting cb: ' + id + ' ' + requestId)
		var cb = makeCbsWaiting[requestId]
		if(cb){
			if(cb.cb){
				//var objHandle = api.getTopObject(id)
				//_.assert(id > 0)
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
	
	function doMake(dsh, type, json, forget, cb, id){
		//_.errout('TODO')
		var st = dbSchema[type];
		//var temp = makeTemporary()
		var edits = jsonutil.convertJsonToEdits(dbSchema, type, json, id)
		
		var requestId = dsh.persistEdit(editCodes.made, {id: id, typeCode: st.code, forget: forget, following: edits.length}, listeningSyncId)
		if(cb){
			_.assertInt(requestId)
			_.assertFunction(cb)
			//console.log('setting cb: ' + requestId)
			
			makeCbsWaiting[requestId] = {id: id, cb: cb}
		}
		for(var i=0;i<edits.length;++i){
			var e = edits[i]
			if(!_.isInt(e.op)) _.errout('invalid edit: ' + JSON.stringify(e))
			//_.assertInt(e.op)
			dsh.persistEdit(e.op, e.edit, listeningSyncId);
		}
		//if(forget){
			//console.log('doing make, forgetting')
			//dsh.forgetLastTemporary(listeningSyncId)
		//}
		return edits
	}	
	
	function doCopy(dsh, obj, json, forget, cb, id){
		//_.errout('TODO')
		_.assertString(obj.id())
		///var st = dbSchema[type];
		//var temp = makeTemporary()
		_.assertObject(json)
		
		var edits = jsonutil.convertJsonToEdits(dbSchema, obj.type(), json, id)//, makeTemporary, temp)
		
		//var dsh = cc.getDefaultSyncHandle()
		var typeCode = obj.getObjectTypeCode()
		var following = edits.length+obj.edits.length+(obj.localEdits?obj.localEdits.length:0)
		//console.log('doCopy following: ' + following + ' ' + edits.length + ' ' + obj.edits.length + ' ' + (obj.localEdits?obj.localEdits.length:0) + ' ' + 1)
		var requestId = dsh.persistEdit(editCodes.copied, {id: id, sourceId: obj._internalId(), typeCode: typeCode, forget: forget, following: following}, listeningSyncId)
		if(cb){
			_.assertInt(requestId)
			_.assertFunction(cb)
			//console.log('setting cb: ' + requestId)
			
			makeCbsWaiting[requestId] = {id: id, cb: cb}
		}
		for(var i=0;i<edits.length;++i){
			var e = edits[i]
			if(!_.isInt(e.op)) _.errout('invalid edit: ' + JSON.stringify(e))
			//_.assertInt(e.op)
			dsh.persistEdit(e.op, e.edit, listeningSyncId);
		}
		//if(forget){
			//console.log('doing make, forgetting')
		//	dsh.forgetLastTemporary(listeningSyncId)
		//}
		return edits
	}	

	var dbSchema
	
	tcpclient.make(host, port, defaultBlockListener, defaultMakeListener, defaultReifyListener, function(serverHandle, syncId){
		//_.assertInt(syncId)
		
		console.log('client got syncId: ' + syncId)
		
		//var syncId = random.uid()
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
		
		function snapGetter(snapSyncId, type, params, st, cb){
		
			var snapHandle = {
				persistEdit: function(op, edit){//editCodes.copy, {sourceId: obj.id(), typeCode: typeCode, forget: forget, following: following}, listeningSyncId)
					//TODO
					//_.errout('tODO')
					return cc.persistEditGeneric(op, edit, snapSyncId)
				}
			}
			var snapWrapper = {
			}
			snapWrapper.make = function(type, json, forget, cb, temporary){
				_.assert(arguments.length >= 4)
				_.assertString(type)
				if(cb) throw new Error('cannot cb after creation from a snap')
				return doMake(snapHandle, type, json, forget, cb, temporary)
			}

			snapWrapper.copy = function(obj, json, forget, cb, temporary){
				_.assert(arguments.length >= 4)
				//_.assertInt(obj.id())
				_.assertString(obj.id())
				//console.log('obj: ' + obj.constructor.name)
				_.assertLength(obj.id(), 22)
				if(cb) throw new Error('cannot cb after creation from a snap')
				return doCopy(snapHandle, obj, json, forget, cb, temporary)
			}
			
			snapWrapper.persistEdit = function(op, edit){
				return snapHandle.persistEdit(op, edit)
			}

			snapWrapper.forgetLastTemporary = function(){
				//_.errout('TODO');
				snapHandle.forgetLastTemporary(listeningSyncId)
			}
			getSnap(dbSchema, cc, st, type, params, changeListener, snapSyncId, snapWrapper, cb)
			//cb(undefined, api.getView(viewId, historicalKey))
		}
		
		var viewGetter = _.memoizeAsync(function(type, params, historicalKey, st, syncId, sc, cb){
			_.assertFunction(cb)
			console.log(syncId + ' getting view ' + type + JSON.stringify(params))
			//_.assert(errorListeners.length > 0)
			getView(dbSchema, cc, st, type, params, syncId, api, sc.beginView, /*historicalKey,*/ function(err){
				if(err){
					if(cb.length === 1){
						throw err
					}
					//console.log('getView error in client: ' + err)
					//console.log('view "' + type + '" load failed with error: ' + err)
					cb(err)
					return
				}
				var viewId = pu.viewIdStr(st.code,params,st)//':'+st.code+newViewSequencer.paramsStr(params)//JSON.stringify(params)
				//console.log('calling back with view: ' + viewId + '+++++++++++++++++++++')
				api.onEdit(changeListener)
				/*
				if(cb.length === 1){
					cb(api.getView(viewId, historicalKey))
				}else{*/
				/*if(historicalKey){
					cb(undefined, api.getView(viewId, historicalKey))
				}else{*/
				try{
					var view = api.getView(viewId)
				}catch(e){
					console.log('ERROR during api.getView')
					console.log(e.stack)
					return
				}
				
				try{
					cb(undefined, view)//, historicalKey))
				}catch(e){
					console.log('ERROR during client callback')
					console.log(e.stack)
				}
				//}
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
			beginSync: function(syncId, blockCb, makeCb, reifyCb, cb){
				_.assertLength(arguments, 5)
				//_.assertFunction(listenerCb)
				//_.assertFunction(objectCb)
				_.assertFunction(blockCb)
				_.assertFunction(makeCb)
				_.assertFunction(reifyCb)
				_.assertString(syncId)
				console.log('client got beginSync syncId: ' + syncId)
				//_.assertFunction(versionTimestamps)
				_.assertFunction(cb)
				function makeCbWrapper(id, requestId){
					_.assertLength(arguments, 2)
					//_.assert(temporary < 0)
					makeCb(id)
				}
				cc.beginSync(syncId, blockCb, makeCbWrapper, reifyCb, function(syncHandle){
					_.assertLength(arguments, 1)
					_.assertObject(syncHandle)
					
					syncHandles[syncId] = syncHandle

					cb(syncHandle)
				})
			},
			serverInstanceUid: cc.serverInstanceUid,
			setupService: function(name, urlPrefix, local, secureLocal, identifier, authenticateByToken, viewSecuritySettings, listeners){
				//_.assertLength(arguments, 5)
				_.assert(arguments.length >= 8)
				_.assert(arguments.length <= 9)
				_.assertFunction(identifier)
				_.assert(_.isObject(viewSecuritySettings) || _.isFunction(viewSecuritySettings))
				_.assertNot(serviceIsSetup);
				serviceIsSetup = true;
				var lp = longpoll.load(local, name, urlPrefix, dbSchema, identifier, viewSecuritySettings, handle, listeners)

				var ws = websocket.load(local, urlPrefix, dbSchema, authenticateByToken, viewSecuritySettings, handle, listeners)
				
				xhrService.make(name, urlPrefix, dbSchema, local, secureLocal, handle, identifier, viewSecuritySettings);
				return matterhornService.make(urlPrefix, name, dbSchema, local, secureLocal, handle, identifier, viewSecuritySettings, lp);
			},
			snap: function(type, params, cb){
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
				
				//var syncHandle = syncHandles[syncId]
				//_.assertObject(syncHandle)
				
				var snapSyncId = random.uid()//-100//TODO
				
				_.assertArray(params)
				snapGetter(snapSyncId, type, params, st, cb)
			},
			view: function(type, params, cb){
	
				var st = dbSchema[type];
				if(st === undefined){_.errout('unknown view: ' + type);}

				//console.log('getting view ' + type + ' ' + JSON.stringify(params))

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
			
			copy: function(id, json, cb){
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
				var res = api.copyExternalObject(id, json, forget, cb)
				if(!forget){
					_.assertDefined(res)
				}
				//console.log('here '+new Error().stack + ' ' + JSON.stringify(res))
				return res
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


function makeServer(dbSchema, globalMacros, dataDir, port, config, loadedListeners, facades, cb){
	tcpserver.make(dbSchema, globalMacros, dataDir, port, config, loadedListeners, facades, cb)
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

	var indexPlugins = config.indexPlugins || []
	
	var loadedListeners = []
	var facades = []
	schema.load(config.schemaDir, syncPlugins, indexPlugins, config.disableOptimizations, loadedListeners, facades, function(dbSchema, globalMacros){
		makeServer(dbSchema, globalMacros, config.dataDir||'.', config.port, config, loadedListeners, facades, cb||function(){})
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

