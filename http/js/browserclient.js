"use strict";

var domready = require('matterhorn-standard/js/domready')

var syncApi = require('./sync_api')
var update = require('./minnow_update_websocket')

var listenForMinnow;

(function(){

var api;

var domWasReady = false
document.addEventListener('DOMContentLoaded', function(){
	domWasReady = true
	tryBegin()
})

var listeners = [];
global.listenForMinnow = function(listener){
	if(api === undefined || !domWasReady){
		listeners.push(listener);
	}else{
		listener(api);
	}
}

function tryBegin(){
	if(!api) return
	if(!domWasReady) return
	listeners.forEach(function(listener){
		listener(api);
	});
}

exports.listen = global.listenForMinnow

var schema;

var snapsRemaining = [].concat(snapshotIds);

for(var i=0;i<snapshotIds.length;++i){
	var id = snapshotIds[i];
	console.log('snap id: ' + id);
}

var snaps = [];
global.gotSnapshot = function(snap){
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

if(window.minnowSnap){
	//snaps.push(minnowSnap)
	minnowSnap.id = lastId
	global.gotSnapshot(minnowSnap)
}

global.gotSchema = function(s){

	schema = s;

	tryLoad();
}

function tryLoad(){
	if(snapsRemaining.length === 0 && schema !== undefined){
		loadMinnowView();
	}
}

function mergeSnapshots(snaps){

	var result = {version: snaps[snaps.length-1].endVersion, objects: []};
	
	var taken = {};
	for(var i=snaps.length-1;i>=0;--i){
		var m = snaps[i].objects;
		
		var objs = m
		
		var t = taken
		
		var resObjs = result.objects
		
		for(var j=0;j<objs.length;++j){
			var obj = objs[j];
			var id = obj.object.meta.id
			
			if(!t[id]){
				t[id] = true;
				resObjs.push(obj)
			}
		}
	}
	
	return result;
}

var snapshot;

global.getRoot = function(){
	_.errout('too soon to getRoot - minnow is not finished loading.  Use listenForMinnow(function(root){...}) to get it as soon as it is loaded.');
}

var fullFunc
var waitingFunc

var host = window.location.protocol + '//' + window.location.host + UrlPrefix+'/ws/'// + ':' + minnowSocketPort
console.log('opening websocket... ' + Date.now())
var hasStarted = false
function start(){
	hasStarted = true
	update.openSocket(applicationName, host, function(fullFuncParam){
			console.log('socket opened: ' + Date.now())
			fullFunc = fullFuncParam
			if(waitingFunc){
				waitingFunc()
				waitingFunc = undefined
			}
		}, function(err){
		}, function(){
			//window.location.reload()
			setTimeout(function(){
				window.document.body.innerHTML = '<h3>Lost Connection to Server</h3>'
			},5000)
		})
}
start()

function loadMinnowView(){
	console.log('got all snapshot parts, loading minnow');
	
	snapshot = mergeSnapshots(snaps);
	
	console.log('version loaded: ' + snapshot.version);

	var viewName = schema._byCode[baseTypeCode].name
	
	function finish(syncHandle){
		console.log('beginning sync handle setup: ' + Date.now())
		syncHandle._openViewWithSnapshots(baseTypeCode, snapshot.version, snaps, viewName, baseId, function(err, root){
			if(err) _.errout('Error: ' + err)

			getRoot = function(){return root;}
		
			console.log('got main view api: ' + Date.now())
			api = root
	
			tryBegin()

		}, window.mainViewHistorical?1:undefined)
	}
	if(fullFunc){
		fullFunc(schema, finish)
	}else{
		waitingFunc = function(){
			fullFunc(schema, finish)
		}
	}
}


})();
