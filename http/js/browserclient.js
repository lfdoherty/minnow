"use strict";

//#requires minnow-service:socket.io,sync_api matterhorn-standard:jquery-1.5

var gotSnapshot;
var gotSchema;
var getRoot;

var listenForMinnow;

(function(){

var api;
var root;

var listeners = [];
listenForMinnow = function(listener){
	if(api === undefined){
		listeners.push(listener);
	}else{
		listener(api);
	}
}

var schema;

var snapsRemaining = [].concat(snapshotIds);

for(var i=0;i<snapshotIds.length;++i){
	var id = snapshotIds[i];
	console.log('snap id: ' + id);
}

var snaps = [];
gotSnapshot = function(snap){
	var index;
	for(var i=0;i<snapsRemaining.length;++i){
		if(snapsRemaining[i] === snap.id){
			index = i;
			break;
		}
	}
	if(index === undefined) throw "error, invalid snap id or already received: " + snap.id;
	
	snapsRemaining.splice(i, 1);
	
	snaps.push(snap);
	
	console.log('received snap: ' + snap.id);
	
	tryLoad();
}

gotSchema = function(s){

	schema = s;

	tryLoad();
}

function tryLoad(){
	if(snapsRemaining.length === 0 && schema !== undefined){
		loadMinnowView();
	}
}

function mergeSnapshots(snaps){

	var result = {version: snaps[snaps.length-1].version, objects: {}};
	
	var taken = {};
	for(var i=snaps.length-1;i>=0;--i){
		var m = snaps[i].objects;
		
		var typeCodes = Object.keys(m);
		for(var k=0;k<typeCodes.length;++k){
			var typeCode = typeCodes[k];
			var objs = m[typeCode];
			
			var t = taken[typeCode];
			if(t === undefined) t = taken[typeCode] = {};
			
			var resObjs = result.objects[typeCode];
			if(resObjs === undefined) resObjs = result.objects[typeCode] = {};
			
			var ids = _.keys(objs);
			for(var j=0;j<ids.length;++j){
				var id = ids[j];
				
				if(!t[id]){
					t[id] = true;
					resObjs[id] = objs[id];
				}
			}
		}
	}
	
	return result;
}

var snapshot;

getRoot = function(){
	_.errout('too soon to getRoot - minnow is not finished loading.  Use listenForMinnow(function(root){...}) to get it as soon as it is loaded.');
}

function loadMinnowView(){
	console.log('got all snapshot parts, loading minnow');
	
	var sendFacade = {
		editBuffer: [],
		persistEdit: function(typeCode, id, path, edit){
			sendFacade.editBuffer.push([typeCode, id, path, edit]);
		}
	};
	
	snapshot = mergeSnapshots(snaps);
	
	console.log('version loaded: ' + snapshot.version);
	
	api = makeSyncApi(schema, sendFacade, snapshot, baseTypeCode, baseId);
	api.setEditingId(syncId);

	function readyCb(){	
		root = api.getRoot();
		getRoot = function(){return root;}
		
		$(document).ready(function(){
			_.each(listeners, function(listener){
				listener(root);
			});
		});
	}
	
	var now = Date.now();
	if(snapshot.version === lastId){
		readyCb();
		setTimeout(function(){
			establishSocket(sendFacade, function(){
				console.log('...connected lazily after ' + (Date.now() - now) + 'ms.');
			});
		}, 3000);
	}else{
		establishSocket(sendFacade, readyCb);
	}
}

function establishSocket(sendFacade, readyCb){
	if(typeof(io) !== 'undefined'){
		doEstablishSocket(sendFacade, readyCb);
	}else{
		setTimeout(function(){
			establishSocket(sendFacade);
		}, 10);
	}
}
function doEstablishSocket(sendFacade, readyCb){
	console.log('socket.io loaded, ready to begin socket.io connection');
	
	var socket = io.connect(window.location.protocol + '//' + window.location.hostname + ':8934'); 

	//This is less a means of disconnecting the socket, and more a means of
	//disabling Firefox's "Javascript Caching" which is a horror in this context - memory leaks,
	//errors from cached code receiving socket messages, etc.
	$(window).unload(function(){
		socket.disconnect();
	});
	
	var connected = false;
	
	var localSyncId = syncId;
	
	function editSender(typeCode, id, path, edit){
		
		var msgStr = JSON.stringify([typeCode, id, path, edit, syncId]);
		console.log('sending message: ' + msgStr);
		socket.send(msgStr);
		//console.log('message sent');
	}
	
	socket.on('connect', function(){ 
	 	connected = true;
		socket.send(JSON.stringify([syncId, snapshot.version]));
		console.log('socket.io connected: ' + syncId + ' ' + snapshot.version);
		sendFacade.persistEdit = editSender;
		for(var i=0;i<sendFacade.editBuffer.length;++i){
			sendFacade.persistEdit.apply(undefined, sendFacade.editBuffer[i]);
		}
		sendFacade.editBuffer = undefined;
	});

	socket.on('message', function(data){ 
		//console.log('started message processing...');
		console.log('msg: ' + data);
		//console.log('local syncId: ' + localSyncId);
		//console.log('syncId: ' + syncId);
		
		data = JSON.parse(data);
		if(data.length === 1){
			if(data[0] === 'reset'){
				window.location.reload();
			}else if(data[0] === 'ready'){
				readyCb();
			}else{
				console.log('unknown command: ' + data[0]);
			}
		}else{
			var doneRefresh = api.changeListener(data[0], data[1], data[2], data[3], data[4] || undefined);
			_.assertFunction(doneRefresh);
			doneRefresh();
		}
		//console.log('...ended message processing');
	});

	socket.on('disconnect', function(){
	  connected = false;
	  console.log('socket.io disconnected');
	});
}

})();
