"use strict";

var timers = require('timers')
var setTimeout = timers.setTimeout
var setInterval = timers.setInterval

var _ = require('underscorem')

var xhrHttp = require('./xhr_http')

var postJson = xhrHttp.postJson
var getJson = xhrHttp.getJson

var syncApi = require('./sync_api')

exports.establishSocket = establishSocket

function establishSocket(appName, schema, host, cb){
	if(arguments.length !== 4) throw new Error(arguments.length)
	
	//_.assertInt(syncId)
	//console.log('socket.io loaded, ready to begin socket.io connection');

	var connected = false;

	var syncUrl = host+'/mnw/sync/'+appName;
	getJson(syncUrl, function(json){    

		var syncId = json.syncId


		var editListeners = []
	
		var viewsBeingSetup = {}
		var sendFacade = {
			editBuffer: [],
			sendSetupMessage: function(e, cb){
				var uid = Math.random()+''
				viewsBeingSetup[uid] = cb
				e.uid = uid
				console.log('sent setup message')
				sendFacade.editBuffer.push(e)//{type: 'setup view', snapshotVersion: snapshotVersion, uid: uid})
			},
			persistEdit: function(/*typeCode, id, path, */op, edit){
				_.assertLength(arguments, 2)
				console.log('got arguments: ' + JSON.stringify(arguments))
				//_.assertInt(typeCode)
				//_.assertInt(id)
				//_.assertArray(path)
				_.assertString(op)
				_.assertObject(edit)
				sendFacade.editBuffer.push({data: {/*typeCode: typeCode, id: id, path: path, */op: op, edit: edit}});
			},
			addEditListener: function(listener){
				editListeners.push(listener)
			}
		};

		var api = syncApi.make(schema, sendFacade);
		api.setEditingId(syncId);
		
		//update.establishSocket(schemaName, host, syncId, sendFacade, viewsBeingSetup)
		setupRest(api, syncId, sendFacade, viewsBeingSetup, editListeners)

		sendFacade.addEditListener(function(data){			
			if(data[0] === 'edit'){
				/*var doneRefresh = */api.changeListener(data[1], data[2], data[3]);
				//doneRefresh();
			}else if(data[0] === 'reify'){
				var id = data[1]
				var temporary = data[2]
				api.reifyExternalObject(temporary, id)
			}else{
				console.log('got object: ' + data[1])
				api.objectListener(data[1], data[2]);
			}
		})
	
		var handle = {
			view: function(viewName, params, cb){
				openView(syncId, api, schema, host, appName, viewName, params, sendFacade, cb)
			},
			_openViewWithSnapshots: function(baseTypeCode, lastId, snaps, viewName, params, cb){
				openViewWithSnapshots(baseTypeCode, lastId, snaps, api, viewName, params, sendFacade, cb)
			}
		}
		cb(handle)		
	})
	
		
	function setupRest(api, syncId, sendFacade, viewsBeingSetup, editListeners){


		function editSender(id, path, op, edit){

			sendFacade.editBuffer.push([id, path, op, edit])
			//console.log('sending message: ' + msgStr);
		}

		function sendMessages(){
		    if(sendFacade.editBuffer.length > 0){
				sendMessage(syncId, sendFacade.editBuffer)
				sendFacade.editBuffer = []
		    }else{
		        setTimeout(sendMessages, 500);    
		    }
		}	
		function sendMessage(syncId, msg){
			//TODO
		    //throw new Error('TODO send message: ' + msgStr)
		    console.log('sending messages: ' + msg.length)
		    var sendUrl = '/mnw/xhr/update/' + appName + '/' + syncId
		    postJson(host+sendUrl, msg, function(){
		        console.log('got ok response from post messages')
		    	setTimeout(sendMessages, 500);	
		    })
		}
		setTimeout(sendMessages, 500);	

		sendMessages()

		var wasAlreadyReady = false;

		var pollUrl = '/mnw/xhr/longpoll/' + appName + '/' + syncId
		function pollServer(){
			getJson(host+pollUrl, function(msgs){
				console.log('got messages: ' + JSON.stringify(msgs))
				msgs.forEach(takeMessage)
				pollServer()
			})
		}
		pollServer()

		function takeMessage(data){
			if(data.type === 'ready'){
				viewsBeingSetup[data.uid](data.data)
			}else{
				editListeners.forEach(function(listener){
					listener(data)
				})
			}
		}
	}
}

function openView(syncId, api, schema, host, appName, viewName, params, sendFacade, readyCb){

	var paramsStr = stringifyParams(params)
	var metaUrl = host+'/mnw/meta/' + appName + '/' + syncId + '/' + viewName + '/' + paramsStr + '/'

    //1. download meta file (stuff that would be included in the initial GET response in the browserclient.js implementation.)
	console.log('metaUrl: ' + metaUrl)
	console.log('host: ' + host)
	
	getJson(metaUrl, function(json){
	

		var syncId = json.syncId
        var baseTypeCode = json.baseTypeCode
        var lastId = json.lastId

		openViewWithMeta(syncId, baseTypeCode, lastId, json.snapUrls, host, api, viewName, params, sendFacade, readyCb)
	})    
}

function openViewWithMeta(syncId, baseTypeCode, lastId, snapUrls, host, api, viewName, params, sendFacade, cb){
	_.assertInt(lastId)
	var snaps = []
	var remaining = snapUrls.length
	snapUrls.forEach(function(url, index){
		getJson(host+url, function(snapJson){
			console.log('got snap: ' + JSON.stringify(snapJson) + ' ' + remaining)
			snaps[index] = snapJson
			--remaining
			if(remaining === 0){
				openViewWithSnapshots(baseTypeCode, lastId, snaps, api, viewName, params, sendFacade, cb)
			}
		})
	})
}
function openViewWithSnapshots(baseTypeCode, lastId, snaps, api, viewName, params, sendFacade, cb){
	_.assertInt(lastId)
	
	//var snapshot = mergeSnapshots(snaps)
	
    var viewId = baseTypeCode+':'+JSON.stringify(params)
    
    console.log('adding snapshots: ' + JSON.stringify(snaps))
    for(var i=0;i<snaps.length;++i){
		api.addSnapshot(snaps[i])
	}
	var lastSnapshotVersion = snaps[snaps.length-1].endVersion

	function readyCb(){	
		console.log('calling back')
		cb(api.getView(viewId))
	}
	


	console.log('sent setup message: ' + viewName)
	sendFacade.sendSetupMessage({type: 'setup', viewName: viewName, params: JSON.stringify(params), version: lastSnapshotVersion}, function(updatePacket){
		console.log('update packet: ' + updatePacket)
		//updatePacket = JSON.parse(updatePacket)
		console.log('got packet of ' + updatePacket.length)
		updatePacket.forEach(function(data){				
			api.changeListener(data[0], data[1], data[2], data[3], data[4], data[5])
		})
		readyCb()
	})
	if(lastSnapshotVersion >= lastId){
		//waitingForReady = false
		readyCb();
		readyCb = function(){}
	}else{
		console.log(JSON.stringify(snapshot))
		console.log('waiting for update from ' + lastSnapshotVersion + ' to ' + lastId)
	}
	//}
}

function stringifyParams(params){
    if(params.length === 0) return '-'
	var str = ''
	for(var i=0;i<params.length;++i){
		if(i > 0) str += ';';
		str += encodeURIComponent(params[i]);
	}
	return str
}
/*
function mergeSnapshots(snaps){

	console.log('TOP SNAP ID: ' + snaps[snaps.length-1].latestVersionId)
	var result = {version: snaps[snaps.length-1].latestVersionId || -1, objects: []};
	
	var taken = {};
	for(var i=snaps.length-1;i>=0;--i){
		var m = snaps[i].objects;
		
		var objs = m
		
		var t = taken
		
		var resObjs = result.objects
		
		//for(var j=0;j<objs.length;++j){
			var obj = objs[j];
			var id = obj.object.meta.id
			
			if(t[id] === undefined || t[id] < obj.object.meta.editId){
				t[id] = obj.object.meta.editId;
				resObjs.push(obj)
			}
		//}
	}
	
	return result;
}*/
