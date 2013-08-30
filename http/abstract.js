"use strict";

var _ = require('underscorem')

exports.module = module

var log = require('quicklog').make('minnow/longpoll')

var newViewSequencer = require('./../server/new_view_sequencer')

var random = require('seedrandom')

exports.load = function(schema, viewSecuritySettings, minnowClient, listeners, impl){
	_.assertFunction(minnowClient.make)
	
//	if(syncHandleCreationListener !== undefined) _.assertFunction(syncHandleCreationListener)
	
	var syncHandles = {}

	var intervalHandle = setInterval(function(){
		Object.keys(syncHandles).forEach(function(key){
			var sh = syncHandles[key]
			if(!sh.msgs){
				console.log('wtf: ' + key + ' ' + sh)
			}
			if(sh.msgs.length > 0){
				impl.sendAllToClient(sh.id, sh.msgs)
				sh.msgs = []
			}
		})
	},50)
	
	var ee = impl.handleErrors()
	minnowClient.on('error', ee)
	
	impl.exposeBeginSync(function(userToken, replyCb){
		_.assertLength(arguments, 2)
		
		var theSyncId = random.uid()
		var sh
		
		/*function listenerCb(e){
			syncListener(sh, e)
		}
		function objectCb(id, edits){
			_.assertLength(arguments, 2)

			objectListener(sh, id, edits)
		}*/
		function blockCb(e){
			blockListener(sh, e)
		}
		
		function reifyCb(temporary, id){
			_.assert(temporary < 0)
			_.assert(id > 0)
			sh.msgs.push(['reify', id, temporary])
		}

		minnowClient.beginSync(theSyncId, blockCb,/*listenerCb, objectCb,*/ reifyCb, reifyCb, function(syncHandle){
			//theSyncId = syncId
			_.assertObject(syncHandle)

			sh = syncHandles[theSyncId] = syncHandle
			sh.id = theSyncId
			sh.msgs = []
			//log('got sync handle: ' + syncId)
			//console.log('got sync handle: ' + syncId)
			if(listeners.newSync) listeners.newSync(userToken, theSyncId)
			
			replyCb(theSyncId)

		})
	}, function(userToken, syncId){//called when the sync handle is ended
		if(syncHandles[syncId]){
			syncHandles[syncId].close()
			if(listeners.closeSync) listeners.closeSync(userToken, syncId)
			delete syncHandles[syncId]
		}else{
			log.warn('cannot find sync id to close: ' + syncId)
		}
	})
	
	if(listeners.heartbeat){
		setInterval(function(){
			Object.keys(syncHandles).forEach(function(key){
				var syncId = key//parseInt(key)
				listeners.heartbeat(syncId)
			})
		},5000)
	}
	
	function blockListener(sh, e){
		_.assertLength(arguments, 2);
		var msg = ['block', e];
		sh.msgs.push(msg)
	}

	/*function objectListener(sh, id, edits){
		_.assertLength(arguments, 3);
		
		_.assertArray(edits)
		var msg = ['object', id, edits];

		sh.msgs.push(msg)
	}
	function syncListener(sh, e){
		_.assertLength(arguments, 2);
		
		_.assertInt(e.op)

		var msg = ['edit', e.op, e.edit, e.editId];

		sh.msgs.push(msg)
	}*/

	impl.receiveUpdates(function(userToken, syncId, msgs, replyCb, securityFailureCb, deadSyncHandleCb){
	
		_.assertFunction(deadSyncHandleCb)
		
		var failed = false
		
		function doViewSetup(msg){
			var start = Date.now()
			var snapshotId = parseInt(msg.snapshotVersion);
			
			//console.log('msg.viewId: ' + msg.viewId + ' ' + JSON.stringify(msg))
			_.assertString(msg.viewId)
			
			//log(JSON.stringify(Object.keys(schema)))
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
				securityFailureCb(msg.viewName)
				failed = true
				return
			}
			
			//console.log('msg.params: ' + msg.params)

			securitySetting(function(passed){
				if(!passed){
					log('security policy denied access to view: ' + viewName);
					console.log('WARNING: security policy denied access to view: ' + viewName);
					securityFailureCb(msg.viewName)
					failed = true
					return
				}
				
				var beginTime = Date.now()
			
				var viewReq = {
					syncId: syncId,
					typeCode: viewCode,
					//params: msg.params,
					viewId: msg.viewId,
					latestSnapshotVersionId: msg.version,
					isHistorical: msg.isHistorical
				}
				var sh = syncHandles[syncId]
				sh.beginView(viewReq, function(err){
					if(err){
						impl.failToBegin(syncId, err)
						return
					}
					//log(syncId + ' BEGAN VIEW(' + viewCode + ')' + msg.params + ': ' + msg.uid + ' ' + msg.version)
					
					console.log('view setup for sync handle ' + syncId + ' took ' + (Date.now()-start) + 'ms - ' + (beginTime-start)+ 'ms was in security')

					sh.msgs.push({type: 'ready', uid: msg.uid})
				})
			}, newViewSequencer.parseViewId(msg.viewId).rest, userToken)
		}

		var syncHandle = syncHandles[syncId]
		if(syncHandle === undefined){
			console.log('WARNING: no known sync handle for syncId: ' + syncId + ' ' + JSON.stringify(Object.keys(syncHandles)))
			console.log(new Error().stack)
			deadSyncHandleCb()
			return
		}

		msgs.forEach(function(msg){
			if(failed) return
			//log('msg: ' + JSON.stringify(msg).slice(0, 300))
			if(msg.type === 'setup'){
				doViewSetup(msg)
			}else if(msg.type === 'forgetLastTemporary'){
				syncHandle.forgetLastTemporary(syncId)
			}else{
				msg = msg.data

				syncHandle.persistEdit(msg.op, msg.edit, syncId)
			}
		})

		if(!failed){
			replyCb()
		}

	})
}
