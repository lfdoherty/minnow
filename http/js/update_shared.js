
var _ = require('underscorem')
var seedrandom = require('seedrandom')

var getJson = require('./bxhr').getJson
var getString = require('./bxhr').getString
var b64 = require('./b64')

var lookup = require('./lookup')
var fp = lookup.editFp

var pu = require('./paramutil')

exports.openView = openView
exports.openViewWithSnapshots = openViewWithSnapshots

function openView(syncId, api, schema, host, appName, viewName, params, sendFacade, readyCb){
	console.log('paramsStr: ' + paramsStr + ' ' + JSON.stringify(params))
	_.assertString(syncId)
	_.assertLength(syncId, 8)
	//_.assertArray(params)

	var viewSchema = schema[viewName]
	var typeCode = viewSchema.code
	var viewId = ':'+typeCode+pu.paramsStr(params, viewSchema.viewSchema.params)//JSON.stringify(params)//TODO use real param stringification
	console.log('meta viewId: ' + viewId)
	if(api.hasView(viewId)){
		//api.getView(viewId)
		readyCb(undefined, api.getView(viewId))
		return
	}
	
	if(api.viewsBeingGotten === undefined) api.viewsBeingGotten = {}
	
	if(api.viewsBeingGotten[viewId]){
		console.log('view already being retrieved')
		api.viewsBeingGotten[viewId].push(readyCb)
		return
	}else{
		api.viewsBeingGotten[viewId] = [readyCb]
	}
	
	var paramsStr = stringifyParams(params, schema[viewName].viewSchema.params)
	var metaUrl = host+'/mnw/meta/' + appName + '/' + seedrandom.uuidStringToBase64(syncId) + '/' + viewName + '/' + paramsStr + '/'

	getJson(metaUrl, function(json){

		var syncId = seedrandom.uuidBase64ToString(json.syncId)
        var baseTypeCode = json.baseTypeCode
        var lastId = json.lastId

		openViewWithMeta(syncId, baseTypeCode, lastId, json.snapUrls, host, api, viewName, viewId, sendFacade, readyCb)
	}, function(err){
		readyCb(err)
	})    
}


function openViewWithMeta(syncId, baseTypeCode, lastId, snapUrls, host, api, viewName, viewId, sendFacade, cb){
	_.assertInt(lastId)
	var snaps = []
	var remaining = snapUrls.length
	snapUrls.forEach(function(url, index){
		getString(host+url, function(str){
			//console.log('got snap: ' + JSON.stringify(snapJson) + ' ' + remaining)
			var decoded = b64.decodeBuffer(str)
			//console.log('decoded: ' + decoded.length)// + ' ' + str)
			//var snapJson = JSON.parse(decoded)
			//throw new Error('TODO - read snap buffer')
			
			var snap = lookup.deserializeSnapshot(decoded)
			
			//console.log('snap: ' + JSON.stringify(snap))
			
			snaps[index] = snap//Json
			--remaining
			if(remaining === 0){
				openViewWithSnapshots(baseTypeCode, lastId, snaps, api, viewName, viewId, sendFacade, cb)
			}
		}, function(err, json){
			if(json) cb(json)
			else cb(err)
		})
	})
}
function openViewWithSnapshots(baseTypeCode, lastId, snaps, api, viewName, viewId, sendFacade, cb, historicalKey){
	_.assertInt(lastId)
	
   // var viewId = baseTypeCode+':'+JSON.stringify(params)
    
    for(var i=0;i<snaps.length;++i){
		api.addSnapshot(snaps[i], historicalKey)
	}
	var lastSnapshotVersion = snaps[snaps.length-1].endVersion

	_.assertString(viewId)
	
	//var opened = false
	function readyCb(cb){	
		//if(opened) return
		//opened = true
		
		if(exports.slowGet){//special debug hook - specifies millisecond delay for testing
			setTimeout(function(){
				cb(undefined, api.getView(viewId, historicalKey))
			},exports.slowGet)
		}else{
			var viewObj = api.getView(viewId, historicalKey)
			if(!viewObj) _.errout('could not find view object: ' + viewId)
			cb(undefined, viewObj)
		}
	}
	
	console.log('sending setup message: ' + Date.now() )
	sendFacade.sendSetupMessage({
		type: 'setup', 
		viewName: viewName, 
		viewId: viewId,
		isHistorical: !!historicalKey,
		version: lastSnapshotVersion}, function(){
		
		//readyCb()
		console.log('got setup message: ' + Date.now())
		if(api.viewsBeingGotten === undefined || api.viewsBeingGotten[viewId] === undefined){
			readyCb(cb)
			return
		}
		api.viewsBeingGotten[viewId].forEach(function(cb, index){
			//console.log('calling back for ' + index)
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

function stringifyParams(params, paramTypes){
    if(params.length === 0) return '-'
	var str = ''
	console.log('stringifying params: ' + JSON.stringify(params))
	for(var i=0;i<params.length;++i){
		var p = params[i]
		var t = paramTypes[i]
		console.log(JSON.stringify(t))
		if(i > 0) str += ';';
		if(t.type.primitive === 'uuid'){
			str += seedrandom.uuidStringToBase64(p)
		}else if(t.type.type === 'object'){
			if(p.length === 8){
				str += seedrandom.uuidStringToBase64(p)
			}else{
				_.assertLength(p, 22)
				str += p
			}
		}else{
			str += encodeURIComponent(p);
		}
	}
	return str
}
