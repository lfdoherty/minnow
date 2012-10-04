"use strict";

var _ = require('underscorem')

exports.module = module

var log = require('quicklog').make('minnow/longpoll')

exports.load = function(schema, viewSecuritySettings, minnowClient, syncHandleCreationListener, impl){
	_.assertFunction(minnowClient.make)
	
	if(syncHandleCreationListener !== undefined) _.assertFunction(syncHandleCreationListener)
	
	var syncHandles = {}
	
	//var msgBuffer = []
	
	var intervalHandle = setInterval(function(){
		Object.keys(syncHandles).forEach(function(key){
			var sh = syncHandles[key]
			if(sh.msgs.length > 0){
				impl.sendAllToClient(sh.id, sh.msgs)
				sh.msgs = []
			}
		})
		/*for(var i=0;i<msgBuffer.length;++i){
			var m = msgBuffer[i]
			impl.sendToClient(m[0],m[1])
		}
		msgBuffer = []*/
	},50)
	
	var ee = impl.handleErrors()
	minnowClient.on('error', ee)
	
	impl.exposeBeginSync(function(userToken, replyCb){
		_.assertLength(arguments, 2)
		
		var theSyncId;
		var sh
		
		function listenerCb(e){
			syncListener(sh, e)
		}
		function objectCb(id, edits){
			_.assertLength(arguments, 2)

			objectListener(sh, id, edits)
		}
		function reifyCb(temporary, id){
			_.assert(temporary < 0)
			_.assert(id > 0)
			//impl.sendToClient(theSyncId, ['reify', id, temporary])
			//msgBuffer.push([theSyncId, ['reify', id, temporary]])
			sh.msgs.push(['reify', id, temporary])
		}

		minnowClient.beginSync(listenerCb, objectCb, reifyCb, reifyCb, function(syncId, syncHandle){
			theSyncId = syncId

			sh = syncHandles[syncId] = syncHandle
			sh.id = syncId
			sh.msgs = []
			log('got sync handle: ' + syncId)
			console.log('got sync handle: ' + syncId)
			if(syncHandleCreationListener) syncHandleCreationListener(userToken, syncId)
			
			replyCb(syncId)

		})
	}, function(syncId){//called when the sync handle is ended
		if(syncHandles[syncId]){
			syncHandles[syncId].close()
		}else{
			log.warn('cannot find sync id to close: ' + syncId)
		}
	})

	function objectListener(sh, id, edits){
		_.assertLength(arguments, 3);
		
		log('$got object e: ' + JSON.stringify([id, edits]).slice(0, 300));
		
		log('sending message for sync ' + sh.id)
		//_.assertInt(id)
		_.assertArray(edits)
		var msg = ['object', id, edits];

		//impl.sendToClient(connectionSyncId, msg)
		//msgBuffer.push([connectionSyncId, msg])
		sh.msgs.push(msg)
	}
	function syncListener(sh, e){
		_.assertLength(arguments, 2);
		
		log('$got e: ' + JSON.stringify(e).slice(0, 300));
		
		_.assertString(e.op)
		
		log('sending message for sync ' + sh.id + ': ' + JSON.stringify(e));

		var msg = ['edit', e.op, e.edit, e.editId];

		//impl.sendToClient(connectionSyncId, msg)
		//msgBuffer.push([connectionSyncId, msg])
		sh.msgs.push(msg)
	}

	impl.receiveUpdates(function(userToken, syncId, msgs, replyCb, securityFailureCb){
		
		var failed = false
		
		function doViewSetup(msg){
			var snapshotId = parseInt(msg.snapshotVersion);
			
			log(JSON.stringify(Object.keys(schema)))
			var viewCode = schema[msg.viewName].code
			_.assertInt(viewCode)

			var viewName = schema._byCode[viewCode].name
			var securitySetting
			if(_.isFunction(viewSecuritySettings)){
				securitySetting = viewSecuritySettings.bind(undefined,viewName)
			}else{
				securitySetting = viewSecuritySettings[viewName]
			}
			if(securitySetting === undefined){
				log('security policy denied access to view (view is not accessible via HTTP): ' + viewName);
				console.log('WARNING: security policy denied access to view (view is not accessible via HTTP - longpoll): ' + viewName);
				securityFailureCb()
				failed = true
				return
			}

			securitySetting(function(passed){
				if(!passed){
					log('security policy denied access to view: ' + viewName);
					console.log('WARNING: security policy denied access to view: ' + viewName);
					securityFailureCb()
					failed = true
					return
				}
			
				var viewReq = {
					syncId: syncId,
					typeCode: viewCode,
					params: msg.params,
					latestSnapshotVersionId: msg.version
				}
				var sh = syncHandles[syncId]
				sh.beginView(viewReq, function(err){
					if(err){
						impl.failToBegin(syncId, err)
						return
					}
					log(syncId + ' BEGAN VIEW(' + viewCode + ')' + msg.params + ': ' + msg.uid + ' ' + msg.version)
					//console.log(JSON.stringify(e))
					//impl.sendToClient(syncId, {type: 'ready', uid: msg.uid})
					//msgBuffer.push([syncId, {type: 'ready', uid: msg.uid}])
					sh.msgs.push({type: 'ready', uid: msg.uid})
				})
			}, JSON.parse(msg.params), userToken)
		}

		var syncHandle = syncHandles[syncId]
		if(syncHandle === undefined) _.errout('no known sync handle for syncId: ' + syncId)

		msgs.forEach(function(msg){
			if(failed) return
			log('msg: ' + JSON.stringify(msg).slice(0, 300))
			if(msg.type === 'setup'){
				doViewSetup(msg)
			}else if(msg.type === 'forgetLastTemporary'){
				syncHandle.forgetLastTemporary(syncId)
			}else{
				msg = msg.data

				log(syncId + ' longpoll persisting ' + msg.op + ' ' + JSON.stringify(msg.edit))
				syncHandle.persistEdit(msg.op, msg.edit, syncId)
			}
		})

		if(!failed){
			replyCb()
		}

	})
}
