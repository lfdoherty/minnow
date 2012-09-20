
var _ = require('underscorem')

var getJson = require('./xhr_http').getJson

exports.openView = openView
exports.openViewWithSnapshots = openViewWithSnapshots

function openView(syncId, api, schema, host, appName, viewName, params, sendFacade, readyCb){
	//console.log('paramsStr: ' + paramsStr + ' ' + JSON.stringify(params))
	//_.assertArray(params)

	var typeCode = schema[viewName].code
	var viewId = typeCode+':'+JSON.stringify(params)
	if(api.hasView(viewId)){
		//api.getView(viewId)
		readyCb(api.getView(viewId))
		return
	}
	
	if(api.viewsBeingGotten === undefined) api.viewsBeingGotten = {}
	
	if(api.viewsBeingGotten[viewId]){
		api.viewsBeingGotten[viewId].push(readyCb)
		return
	}else{
		api.viewsBeingGotten[viewId] = [readyCb]
	}
	
	var paramsStr = stringifyParams(params)
	var metaUrl = host+'/mnw/meta/' + appName + '/' + syncId + '/' + viewName + '/' + paramsStr + '/'

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
			//console.log('got snap: ' + JSON.stringify(snapJson) + ' ' + remaining)
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
	
    var viewId = baseTypeCode+':'+JSON.stringify(params)
    
    for(var i=0;i<snaps.length;++i){
		api.addSnapshot(snaps[i])
	}
	var lastSnapshotVersion = snaps[snaps.length-1].endVersion

	var opened = false
	function readyCb(cb){	
		if(opened) return
		opened = true
		
		if(exports.slowGet){//special debug hook - specifies millisecond delay for testing
			setTimeout(function(){
				cb(api.getView(viewId))
			},exports.slowGet)
		}else{
			cb(api.getView(viewId))
		}
	}
	
	sendFacade.sendSetupMessage({type: 'setup', viewName: viewName, params: JSON.stringify(params), version: lastSnapshotVersion}, function(){
		
		//readyCb()
		if(api.viewsBeingGotten === undefined || api.viewsBeingGotten[viewId] === undefined){
			readyCb(cb)
			return
		}
		api.viewsBeingGotten[viewId].forEach(function(cb){
			readyCb(cb)
		})
	})
	/*if(lastSnapshotVersion >= lastId){
		readyCb();
	}else{
		//console.log(JSON.stringify(snapshot))
		//console.log('waiting for update from ' + lastSnapshotVersion + ' to ' + lastId)
	}*/
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
