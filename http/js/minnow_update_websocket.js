"use strict";

var timers = require('timers')
var setTimeout = timers.setTimeout
var setInterval = timers.setInterval
var clearTimeout = timers.clearTimeout

var _ = require('underscorem')

var syncApi = require('./sync_api')
var jsonutil = require('./jsonutil')
var b64 = require('./b64')
var arraystring = require('./arraystring')

exports.openSocket = openSocket

var shared = require('./update_shared')
var random = require('seedrandom')

var WebSocket = global.WebSocket

var lookup = require('./lookup')
var editCodes = lookup.codes

function processCookieToMap(cookie){
	var parts = cookie.split(';')
	var partMap = {}
	parts.forEach(function(p){
		var key = p.substr(0, p.indexOf('='))
		key = key.trim()
		var value = p.substr(p.indexOf('=')+1)
		partMap[key] = value
	})
	if(partMap.LOGGEDOUT){
		loggedOut()
		return
	}
	return partMap
}
function getCookieToken(){
	var map = processCookieToMap(document.cookie)
	//console.log('token: ' + document.cookie)
	//console.log('*token: ' + map.SID)
	return map.SID.substr(0, map.SID.indexOf('|'))
}

if(WebSocket === undefined){
	WebSocket = require('ws')
	//getCookieToken = function(){
	//	return 'DUMMYTOKEN'
	//}
}

function openSocket(appName, host, cb, errCb, closeCb){
	
	if(arguments.length !== 5) throw new Error(arguments.length)
	
	var closed = false
	var connected = false

	var wsHost = 'ws'+host.substr(4)
	var url = wsHost
	//console.log('url: ' + url)
	var ws = new WebSocket(url);
	//ws.binaryType = "arraybuffer";
	
	console.log('here')
	
	ws.onopen = function() {

		console.log('websocket connection opened: ' + Date.now())
		send({token: getCookieToken(), url: document.location.href})
		cb(establishSocketFully)
	}
	
	function heartbeat(){
		send('heartbeat')
	}
	
	var heartbeatHandle = setInterval(function(){
		heartbeat()
	}, 30000);
	
	function send(msg){
		msg = b64.encode(JSON.stringify(msg))
		//if(msgBuf) msgBuf.push(msg)
		///else 
		ws.send(msg)
	}
	
	var isFirstMessage = true

	var syncId
	
	ws.onerror = function(err) {
		console.log('error: ' + err)
		errCb(err)
	}
	
	ws.onclose = function(){
		console.log('websocket closed')
		closeCb()
	}
	
	var api
	
	var msgsBuffer = []
	ws.onmessage = function(msg) {
		msgsBuffer.push(JSON.parse(b64.decode(msg.data)))
	}
	
	var schema
	var fullCb
	
	function processMsgs(msgs){
		if(isFirstMessage){
			isFirstMessage = false
			syncId = msgs[0].syncId
		
			//console.log('here')

			api = syncApi.make(schema, sendFacade, log);
			api.setEditingId(syncId);
		
			processMsgs(msgs.slice(1))

			fullCb(handle)
		}else{		
			msgs.forEach(function(msg){
				processMessage(msg)
			})
		}
	}
	
	function processMessage(msg){
		if(msg.type === 'ready'){
			if(viewsBeingSetup[msg.uid] === undefined){
				_.errout('unknown view uid: ' + msg.uid + ', known: ' + JSON.stringify(Object.keys(viewsBeingSetup)))
			}
			viewsBeingSetup[msg.uid]()//msg.data)
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
			//console.log(syncId + ' sent setup message for uid: ' + uid + ' ' + JSON.stringify(e))
			send(e)
		},
		persistEdit: function(op, edit){
			_.assertInt(op)
			_.assertObject(edit)
			//console.log('sending edit: ' + JSON.stringify({op: op, edit: edit}))
			//if(op === 21){
			//	console.log('id length: ' + edit.id.length)
			//}
			send({data: {op: op, edit: edit}});
		},
		make: function(type, json, forget, cb, id){

			_.assertLength(arguments, 5)
			
			var st = schema[type];
			
			//var id = random.uid()

			var edits = jsonutil.convertJsonToEdits(schema, type, json, id)//api.makeTemporaryId.bind(api), temporary)

			sendFacade.persistEdit(editCodes.made, {id: id, typeCode: st.code, forget: forget, following: edits.length})

			if(cb) {
				makeIdCbListeners[id] = cb
				//console.log('setup cb: ' + temporary)
			}

			edits.forEach(function(e){
				sendFacade.persistEdit(e.op, e.edit);
			})
			/*if(forget){
				sendFacade.forgetLastTemporary()
			}*/
			return edits
		},
		copy: function(obj, json, forget, cb, id){

			
			_.assertLength(arguments, 5)
			_.assertString(obj.id())
			
			//var id = random.uid()
			
			var edits = jsonutil.convertJsonToEdits(schema, obj.type(), json, id)//api.makeTemporaryId.bind(api))

			sendFacade.persistEdit(editCodes.copied, {id: id, sourceId: obj._internalId(), typeCode: obj.getObjectTypeCode(), forget: forget, 
				following: 
					edits.length+
					(obj.edits?obj.edits.length:0)+
					(obj.localEdits?obj.localEdits.length:0)})

			if(cb) {
				makeIdCbListeners[id] = cb
				//console.log('setup cb: ' + temporary)
			}

			edits.forEach(function(e){
				sendFacade.persistEdit(e.op, e.edit);
			})
			/*if(forget){
				sendFacade.forgetLastTemporary()
			}*/
			return edits
		},
		/*forgetLastTemporary: function(){
			//_.errout('TODO')
			send({type: 'forgetLastTemporary'})
		},*/
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
			/*var temporary = data[2]
			api.reifyExternalObject(temporary, id)*/
			//console.log('reifying temporary: ' + temporary)
			if(makeIdCbListeners[id] !== undefined){
				var cb = makeIdCbListeners[id]
				delete makeIdCbListeners[id]
				cb(id)
			}
			//console.log('WARNING: got reify')
		}else if(data[0] === 'block'){
			api.blockUpdate(data[1])
		}else if(data.type){
			throw JSON.stringify(data)
		}else{
			//console.log('type: ' + data[0])
			api.objectListener(data[1], data[2]);
		}
	})

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
			var manyParams = schema[viewName].viewSchema.params.length
			if(manyParams !== params.length){
				_.errout('wrong number of params for ' + viewName + ' view (should be ' + manyParams + ', but is ' + params.length)
			}
			shared.openView(syncId, api, schema, host, appName, viewName, realParams, sendFacade, function(err, handle){
				cb(err, handle)
			})
		},
		_openViewWithSnapshots: function(baseTypeCode, lastId, snaps, viewName, params, cb, historicalKey){
			shared.openViewWithSnapshots(baseTypeCode, lastId, snaps, api, viewName, params, sendFacade, cb, historicalKey)
		},
		close: function(cb){
			closed = true
			cb()
		}
	}
	
	function establishSocketFully(schemaParam, fullCbParam){
		schema = schemaParam
		fullCb = fullCbParam
		
		ws.onmessage = function(msg) {
			//msg = msg.data
			//console.log('message: ' + msg)
			var decodedMsg = b64.decode(msg.data)
			var msgs = JSON.parse(decodedMsg)
			processMsgs(msgs)
		}
	
		msgsBuffer.forEach(processMsgs)
		msgsBuffer = undefined
	}
}


