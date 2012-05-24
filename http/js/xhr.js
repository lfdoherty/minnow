/*

This is an XHR-based version of the minnow browser client.

It uses long polling for server push.

*/

var XMLHttpRequest = require('xhr').XMLHttpRequest


function getJson(token, url, cb){
    var xhr = new XMLHttpRequest();  
    
    console.log('getJson: ' + url)
    
    xhr.open("GET", url, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Cookie', token)

	xhr.onreadystatechange = function (oEvent) {  
		if (xhr.readyState === 4) {  
			if (xhr.status === 200) {  
				var contentType = xhr.getResponseHeader('Content-Type');
				console.log('contentType: ' + contentType)
				if(contentType !== 'application/json'){
					//assume redirect
				}else{
	                var json = JSON.parse(xhr.responseText)
    	            if(json === undefined) throw new Error('cannot parse getJson response')
					cb(json)
				}
			} else {  
				console.log("Error", xhr.statusText, url);  
			}  
		}  
	};  
	xhr.send(null); 
}

function stringifyParams(params){
    if(params.length === 0) return '-'
	var str = ''
	for(var i=0;i<params.length;++i){
		if(i > 0) str += ';';
		str += querystring.escape(params[i]);
	}
	return str
}

function mergeSnapshots(snaps){

	var result = {version: snaps[snaps.length-1].version, objects: []};
	
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

exports.setup = setup

function setup(token, host, schemaName, viewName, params, cb){
	
    //1. download meta file (stuff that would be included in the initial GET response in the browserclient.js implementation.)
	//meta/'+minnowClient.schemaName+'/:viewName/:params
	
	var paramsStr = stringifyParams(params)
	var metaUrl = host+'/mnw/meta/' + schemaName + '/' + viewName + '/' + paramsStr + '/'
    var schema;
	var syncId
    var remaining
	var snaps = []
	var baseTypeCode
	var lastId
	
	var gj = getJson.bind(undefined, token)
	
	gj(metaUrl, function(json){
	
    	
    	//2. (in parallel)  download schema
    	//3. 				get snapshot parts
    	remaining = 1+json.snapUrls.length;
        
    	gj(metaUrl, function(json){
    
    		syncId = json.syncId
    		baseTypeCode = json.baseTypeCode
    		lastId = json.lastId
    		
    		gj(host+json.schemaUrl, function(schemaJson){
    			--remaining
    			schema = schemaJson
    			tryFinish()
    		})
    
    		json.snapUrls.forEach(function(url, index){
    			getJson(host+url+'-/', function(snapJson){
    				snaps.push(snapJson)
    				--remaining
    				tryFinish()
    			})
    		})
    		
    	})
	})
    
	function tryFinish(){
		if(remaining > 0) return
		
        console.log('finishing')
        
		var snap = mergeSnapshots(snaps)

		var sendFacade = {
			editBuffer: [],
			persistEdit: function(typeCode, id, path, edit){
				sendFacade.editBuffer.push([typeCode, id, path, edit]);
			}
		};
		
		api = makeSyncApi(schema, sendFacade, snapshot, baseTypeCode, baseId);
		api.setEditingId(syncId);

		function readyCb(){	
			root = api.getRoot();
			getRoot = function(){return root;}

			cb(root)
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
	
	//4. use long polling for sending and receiving updates

	function sendMessage(syncId, msgStr){
		//TODO
	}
	
	function establishSocket(sendFacade, readyCb){

		console.log('socket.io loaded, ready to begin socket.io connection');
	
		var connected = false;
	
		var localSyncId = syncId;
	
		function editSender(id, path, op, edit){
		
			sendFacade.editBuffer.push([id, path, op, edit])
			console.log('sending message: ' + msgStr);
		}

		function sendMessages(){
			sendMessage(syncId, JSON.stringify(sendFacade.editBuffer))
			sendFacade.editBuffer = []
		}		
		setInterval(sendMessages, 500);	
		
		sendFacade.editBuffer.push([snapshot.version])
		
		sendMessages()

		var wasAlreadyReady = false;
	
		var pollUrl = 'mnw/xhr/update/' + schemaName + '/' + syncId
		function pollServer(){
			gj(host+pollUrl, function(msgs){
				msgs.forEach(takeMessage)
				pollServer()
			})
		}
		pollServer()
		
		function takeMessage(data){
			if(data === 'ready'){
				wasAlreadyReady = true;
				readyCb()
				return
			}else if(data === 'reset'){
				throw new Error('TODO implement reset')
			}
			
			var doneRefresh = api.changeListener(data[0], data[1], data[2], data[3], data[4], data[5]);
			doneRefresh();
		}
	}
}
