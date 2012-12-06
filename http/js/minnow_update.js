"use strict";

var timers = require('timers')
var setTimeout = timers.setTimeout
var setInterval = timers.setInterval
var clearTimeout = timers.clearTimeout

var _ = require('underscorem')

var xhrHttp = require('./xhr')

var postJson = xhrHttp.postJson
var getJson = xhrHttp.getJson

var syncApi = require('./sync_api')
var jsonutil = require('./jsonutil')

exports.establishSocket = establishSocket

var shared = require('./update_shared')

var lookup = require('./lookup')
var editCodes = lookup.codes

function establishSocket(appName, schema, host, cb){
	if(arguments.length !== 4) throw new Error(arguments.length)
	
	//_.assertInt(syncId)
	//console.log('socket.io loaded, ready to begin socket.io connection');
	
	var closed = false
	var connected = false

	
	var syncUrl = host+'/mnw/sync/'+appName+'/'+(Math.random()+'').substr(2);
	getJson(syncUrl, function(json){    

		if(closed) return

		var syncId = json.syncId


		var editListeners = []
	
		var makeIdCbListeners = {}
	
		var viewsBeingSetup = {}

		var editBuffer = []
		
		var sendFacade = {
			send: function(e){
				editBuffer.push(e)
			},
			sendSetupMessage: function(e, cb){
				_.assertFunction(cb)
				var uid = Math.random()+''
				viewsBeingSetup[uid] = cb
				e.uid = uid
				console.log(syncId + ' sent setup message ' + JSON.stringify(e))
				sendFacade.send(e)//{type: 'setup view', snapshotVersion: snapshotVersion, uid: uid})
			},
			persistEdit: function(op, edit){
				_.assertString(op)
				_.assertObject(edit)
				sendFacade.send({data: {op: op, edit: edit}});
			},
			make: function(type, json, forget, cb, temporary){

				_.assertLength(arguments, 5)
				
				var st = schema[type];

				var edits = jsonutil.convertJsonToEdits(schema, type, json, api.makeTemporaryId.bind(api))

				sendFacade.persistEdit(editCodes.make, {typeCode: st.code, forget: forget})

				if(cb) {
					makeIdCbListeners[temporary] = cb
					//console.log('setup cb: ' + temporary)
				}

				edits.forEach(function(e){
					sendFacade.persistEdit(e.op, e.edit);
				})
				if(forget){
					sendFacade.forgetLastTemporary()
				}
				return edits
			},
			forgetLastTemporary: function(){
				sendFacade.send({type: 'forgetLastTemporary'});
			},
			addEditListener: function(listener){
				editListeners.push(listener)
			}
		};

		function log(msg){
			console.log(msg)
		}
		log.info = function(msg){
			console.log(msg)
		}
		log.warn = function(msg){
			console.log('WARNING: ' + msg)
		}
		log.err = function(msg){
			console.log('ERROR: ' + msg)
		}
		var api = syncApi.make(schema, sendFacade, log);
		api.setEditingId(syncId);
		
		
		function sendMessages(){
		    if(editBuffer.length > 0){
				sendMessage(syncId, editBuffer)
				editBuffer = []
		    }else{
		    	sendMessageTimeoutHandle = setTimeout(sendMessages, 100);    
		    }
		}	
		function sendMessage(syncId, msg){
		    var sendUrl = '/mnw/xhr/update/' + appName + '/' + syncId
		    postJson(host+sendUrl, msg, function(){
		    	sendMessageTimeoutHandle = setTimeout(sendMessages, 100);	
		    })
		}
		sendMessageTimeoutHandle = setTimeout(sendMessages, 100);	

		sendMessages()

		var pollUrl = '/mnw/xhr/longpoll/' + appName + '/' + syncId
		function pollServer(){
			getJson(host+pollUrl, function(msgs){
				if(closed) return
				console.log('got messages: ' + JSON.stringify(msgs))
				msgs.forEach(takeMessage)
				pollServer()
			}, function(){
				setTimeout(pollServer, 2000)//TODO use backoff?
			})
		}
		pollServer()
		
		function takeMessage(data){
			if(data.type === 'ready'){
			//	console.log('got ready: ' + data.uid)
				if(viewsBeingSetup[data.uid] === undefined){
					_.errout('unknown view uid: ' + data.uid + ', known: ' + JSON.stringify(Object.keys(viewsBeingSetup)))
				}
				viewsBeingSetup[data.uid](data.data)
			}else{
				console.log('message: ' + JSON.stringify(data))
				editListeners.forEach(function(listener){
					listener(data)
				})
			}
		}

		sendFacade.addEditListener(function(data){			
			//console.log('processing: ' + JSON.stringify(data))
			if(data[0] === 'edit'){
				api.changeListener(data[1], data[2], data[3]);
			}else if(data[0] === 'reify'){
				var id = data[1]
				var temporary = data[2]
				api.reifyExternalObject(temporary, id)
				//console.log('reifying temporary: ' + temporary)
				if(makeIdCbListeners[temporary] !== undefined){
					var cb = makeIdCbListeners[temporary]
					delete makeIdCbListeners[temporary]
					cb(id)
				}
			}else{
				api.objectListener(data[1], data[2]);
			}
		})
	
		//var errorListeners = []
	
		var handle = {
			getSessionId: function(){
				return syncId
			},
			view: function(viewName, params, cb){
			
				if(schema[viewName] === undefined) _.errout('unknown view: ' + viewName)
				
				if(arguments.length === 2 && _.isFunction(params)){
					cb = params
					params = []
				}
				var realParams = []
				for(var i=0;i<params.length;++i){
					realParams[i] = params[i]
					if(_.isObject(params[i])) realParams[i] = params[i].id()
				}
				
				var manyParams = schema[viewName].viewSchema.params.length
				if(manyParams !== params.length){
					_.errout('wrong number of params for ' + viewName + ' view (should be ' + manyParams + ', but is ' + params.length)
				}
				//console.log('getting view: ' + viewName + ' ' + JSON.stringify(params))
				shared.openView(syncId, api, schema, host, appName, viewName, realParams, sendFacade, function(err,handle){
					/*if(err){
						errorListeners.forEach(function(listener){
							listener(err)
						})
						return
					}*/
					cb(err, handle)
				})
			},
			_openViewWithSnapshots: function(baseTypeCode, lastId, snaps, viewName, params, cb){
				shared.openViewWithSnapshots(baseTypeCode, lastId, snaps, api, viewName, params, sendFacade, cb)
			},
			close: function(cb){
				closed = true
				if(sendMessageTimeoutHandle !== undefined){
					clearTimeout(sendMessageTimeoutHandle)
				}
				if(cb) cb()
			}/*,
			on: function(event, listener){
				//_.errout('TODO')
				if(event === 'error'){
					errorListeners.push(listener)
				}else{
					_errout('invalid event: ' + event)
				}
			}*/
		}
		cb(handle)		
	})
	
	var sendMessageTimeoutHandle;
		
	
}


