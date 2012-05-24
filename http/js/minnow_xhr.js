/*

This is an XHR-based version of the minnow browser client.

It uses long polling for server push.

*/

var syncApi = require('sync_api')

var XMLHttpRequest = require('xhr').XMLHttpRequest

var timers = require('timers')
var setTimeout = timers.setTimeout
var setInterval = timers.setInterval

function getJson(token, url, cb){
    var xhr = new XMLHttpRequest();  
    
    console.log('getJson: ' + url)
    
    xhr.open("GET", url, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Cookie', 'SID=' + token)
	xhr.onreadystatechange = function (oEvent) {  
		if (xhr.readyState === 4) {  
			if (xhr.status === 200) {  
               // console.log('parsing response text: ' + xhr.responseText)
                var json = JSON.parse(xhr.responseText)
                if(json === undefined) throw new Error('cannot parse getJson response')
				cb(json)
			} else {  
				console.log("Error", xhr.statusText, url);  
			}  
		}  
	};  
	xhr.send(null); 
}
function postJson(token, url, content, cb){
    var xhr = new XMLHttpRequest();  
    
    console.log('postJson: ' + url)
    
    xhr.open("POST", url, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Cookie', 'SID=' + token)
    xhr.onreadystatechange = function (oEvent) {  
		if (xhr.readyState === 4) {  
			if (xhr.status === 200) {  
                //console.log('parsing response text: ' + xhr.responseText)
                //var json = JSON.parse(xhr.responseText)
               // if(json === undefined) throw new Error('cannot parse getJson response')
				cb()
			} else {  
				console.log("Error", xhr.statusText, url);  
			}  
		}  
	};  
	xhr.send(JSON.stringify(content)); 
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

function mergeSnapshots(snaps){

	var result = {version: snaps[snaps.length-1].version || -1, objects: []};
	
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


function setup(token, host, schemaName){
    

    var handle = {
        view: function(viewName, params, cb){
            openView(token, host, schemaName, viewName, params, cb)
        }
    }
    return handle
}

//TODO merge all update and longpoll calls to minimize per-view overhead

function openView(token, host, schemaName, viewName, params, cb){

	var paramsStr = stringifyParams(params)
	var metaUrl = host+'/mnw/meta/' + schemaName + '/' + viewName + '/' + paramsStr + '/'
    var schema;
	var syncId
    var remaining
	var snaps = []
    var baseTypeCode
    var lastId
    //var userId
    
    var gj = getJson.bind(undefined, token)

    //1. download meta file (stuff that would be included in the initial GET response in the browserclient.js implementation.)
    //meta/'+minnowClient.schemaName+'/:viewName/:params

	gj(metaUrl, function(json){
	
    	
    	//2. (in parallel)  download schema
    	//3. 				get snapshot parts
    	remaining = 1+json.snapUrls.length;
        
    	gj(metaUrl, function(json){
    
    		syncId = json.syncId
            baseTypeCode = json.baseTypeCode
            lastId = json.lastId
            //userId = json.userId
    		
    		gj(host+json.schemaUrl, function(schemaJson){
    			--remaining
    			schema = schemaJson
    			tryFinish()
    		})
    
    		json.snapUrls.forEach(function(url, index){
    			gj(host+url, function(snapJson){
    				snaps.push(snapJson)
    				--remaining
    				tryFinish()
    			})
    		})
    		
    	})
	})
    
    var snapshot
	function tryFinish(){
		if(remaining > 0) return
		
        console.log('finishing')
        
		snapshot = mergeSnapshots(snaps)
        //console.log('snapshot: ' + JSON.stringify(snapshot))

		var sendFacade = {
			editBuffer: [],
			persistEdit: function(typeCode, id, path, edit){
				sendFacade.editBuffer.push([typeCode, id, path, edit]);
			}
		};
		
        var viewId = baseTypeCode+':'+JSON.stringify(params)
        
		api = syncApi.make(schema, sendFacade, snapshot, baseTypeCode, viewId);
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

    
	
	function establishSocket(sendFacade, readyCb){

		//console.log('socket.io loaded, ready to begin socket.io connection');
	
		var connected = false;
	
		var localSyncId = syncId;
	
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
            var sendUrl = '/mnw/xhr/update/' + schemaName + '/' + syncId
            postJson(token, host+sendUrl, msg, function(){
                console.log('got ok response from post messages')
            	setTimeout(sendMessages, 500);	
            })
    	}
		setTimeout(sendMessages, 500);	
		
		sendFacade.editBuffer.push([snapshot.version])
		
		sendMessages()

		var wasAlreadyReady = false;
	
		var pollUrl = '/mnw/xhr/longpoll/' + schemaName + '/' + syncId
		function pollServer(){
			gj(host+pollUrl, function(msgs){
				msgs.forEach(takeMessage)
				pollServer()
			})
		}
		pollServer()
		
		function takeMessage(data){
            //data = JSON.parse(data)
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

