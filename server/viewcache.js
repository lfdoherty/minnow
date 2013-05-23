
var CleanupDelay = 30*1000

exports.make = function(objectState){

	var cache = {}
	var cacheLists = []
	var curList = {editId: -10, list: [], time: 0}
	var cacheListEditId
	var dirtyCount = 0
	var cacheCount = 0
	
	function cleanup(){
		while(cacheLists.length > 0){
			var next = cacheLists[0]
			if(Date.now() - next.time < CleanupDelay){
				break
			}
			cacheLists.shift()
			for(var i=0;i<next.list.length;++i){
				var key = next.list[i]
				console.log('cleaned up: ' + key)
				cache[key] = undefined
				++dirtyCount
			}
		}
		if(dirtyCount > cacheCount){
			refreshCacheObject()
		}
	}
	function refreshCacheObject(){
		var keys = Object.keys(cache)
		var newCache = {}
		cacheCount = 0
		dirtyCount = 0
		for(var i=0;i<keys.length;++i){
			var key = keys[i]
			var value = cache[key]
			if(value){
				newCache[key] = value
				++cacheCount
			}
		}
		cache = newCache
	}
	
	setInterval(cleanup, 1000)
	
	function get(viewId, editId){
		var key = viewId+'_'+editId
		//console.log(JSON.stringify([key, cache]))
		return cache[key]
	}
	
	function put(viewId, state){
	
		var curEditId = objectState.getCurrentEditId()-1
		var key = viewId+'_'+curEditId
		
		if(cacheListEditId !== curEditId){
			cacheLists.push(curList)
			curList = {editId: curEditId, list: [], time: Date.now()}
			cacheListEditId = curEditId
		}
		curList.list.push(key)
		cache[key] = state
		++cacheCount
	}
	
	var handle = {
		get: get,
		put: put
	}

	return handle	
}
