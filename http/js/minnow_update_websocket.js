"use strict";

var timers = require('timers')
var setTimeout = timers.setTimeout
var setInterval = timers.setInterval
var clearTimeout = timers.clearTimeout

var _ = require('underscorem')

var syncApi = require('./sync_api')
var jsonutil = require('./jsonutil')

exports.establishSocket = establishSocket

var shared = require('./update_shared')

var WebSocket = global.WebSocket

function getCookieToken(){
	var si = document.cookie.indexOf('SID=')
	console.log('token: ' + document.cookie)
	var cookieToken = document.cookie.substring(si+4,document.cookie.indexOf('|',si))
	console.log('*token: ' + cookieToken)
	return cookieToken
}

if(WebSocket === undefined){
	WebSocket = require('ws')
	getCookieToken = function(){
		return 'DUMMYTOKEN'
	}
}


function establishSocket(appName, schema, host, cb){
	if(arguments.length !== 4) throw new Error(arguments.length)
	
	//_.assertInt(syncId)
	//console.log('socket.io loaded, ready to begin socket.io connection');
	
	var closed = false
	var connected = false

	var wsHost = 'ws'+host.substr(4)
	var url = wsHost//+'/websocket'
	//console.log('url: ' + url)
	var ws = new WebSocket(url);
	
	var msgBuf = []
	ws.onopen = function() {

		
		//ws._socket.on('error', function(e){	
		//	console.log('caught error directly: ' + e)
		//});

		ws.send(getCookieToken())
		msgBuf.forEach(function(msg){
			ws.send(msg)
		})
		msgBuf = undefined
	}
	
	
	function send(msg){
		msg = JSON.stringify(msg)
		if(msgBuf) msgBuf.push(msg)
		else ws.send(msg)
	}
	
	var isFirstMessage = true

	var syncId
	
	ws.onerror = function(err) {
		_.errout('error: ' + err)
	}
	
	var api
	
	ws.onmessage = function(msg) {
		msg = msg.data
		//console.log('message: ' + msg)
		var msgs = JSON.parse(msg)
		
		
		if(isFirstMessage){
			isFirstMessage = false
			syncId = msgs[0].syncId
			
			//console.log('here')

			api = syncApi.make(schema, sendFacade, log);
			api.setEditingId(syncId);
			
			msgs.slice(1).forEach(function(msg){
				processMessage(msg)
			})

			cb(handle)
		}else{		
			msgs.forEach(function(msg){
				processMessage(msg)
			})
		}
	}
	function processMessage(msg){
		//console.log('isFirstMessage: ' + isFirstMessage)
		/*if(isFirstMessage){
			isFirstMessage = false
			syncId = msg.syncId
			
			//console.log('here')

			api = syncApi.make(schema, sendFacade, log);
			api.setEditingId(syncId);

			cb(handle)
			//console.log('setup')
		}else */if(msg.type === 'ready'){
			if(viewsBeingSetup[msg.uid] === undefined){
				_.errout('unknown view uid: ' + msg.uid + ', known: ' + JSON.stringify(Object.keys(viewsBeingSetup)))
			}
			viewsBeingSetup[msg.uid](msg.data)
		}else{
			editListeners.forEach(function(listener,index){
				//console.log('sending to listener: ' + index)
				listener(msg)
			})
		}
	}


	var editListeners = []

	var makeIdCbListeners = {}

	var viewsBeingSetup = {}
	var sendFacade = {
		editBuffer: [],
		sendSetupMessage: function(e, cb){
			_.assertFunction(cb)
			var uid = Math.random()+''
			viewsBeingSetup[uid] = cb
			e.uid = uid
			//console.log(syncId + ' sent setup message for uid: ' + uid)
			//sendFacade.editBuffer.push(e)//{type: 'setup view', snapshotVersion: snapshotVersion, uid: uid})
			send(e)
		},
		persistEdit: function(op, edit){
			_.assertString(op)
			_.assertObject(edit)
			send({data: {op: op, edit: edit}});
		},
		make: function(type, json, forget, cb, temporary){

			_.assertLength(arguments, 5)
			
			var st = schema[type];

			var edits = jsonutil.convertJsonToEdits(schema, type, json, api.makeTemporaryId.bind(api))

			sendFacade.persistEdit('make', {typeCode: st.code, forget: forget})

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
			//_.errout('TODO')
			send({type: 'forgetLastTemporary'})
		},
		addEditListener: function(listener){
			_.assert(editListeners.indexOf(listener) === -1)
			
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
		console.log(msg)
	}
	log.err = function(msg){
		console.log(msg)
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
	
	var errorListeners = []

	var handle = {
		getSessionId: function(){
			return syncId
		},
		view: function(viewName, params, cb){
			if(arguments.length === 2 && _.isFunction(params)){
				cb = params
				params = []
			}
			var realParams = []
			for(var i=0;i<params.length;++i){
				realParams[i] = params[i]
				if(_.isObject(params[i])) realParams[i] = params[i].id()
			}
			shared.openView(syncId, api, schema, host, appName, viewName, realParams, sendFacade, function(err, handle){
				if(err){
					errorListeners.forEach(function(listener){
						listener(err)
					})
					return
				}
				cb(handle)
			})
		},
		_openViewWithSnapshots: function(baseTypeCode, lastId, snaps, viewName, params, cb){
			shared.openViewWithSnapshots(baseTypeCode, lastId, snaps, api, viewName, params, sendFacade, cb)
		},
		close: function(cb){
			closed = true
			cb()
		},
		on: function(event, listener){
			//_.errout('TODO')
			if(event === 'error'){
				errorListeners.push(listener)
			}else{
				_errout('invalid event: ' + event)
			}
		}
	}
		
}


