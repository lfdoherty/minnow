
exports.make = function(listeners){

	//var listeners = listenerSet()
	
	var cachedViewIncludes = {}
	var viewCounts = {}
	
	return {
		includeView: function(viewId, handle, editId){
			if(viewCounts[viewId] === undefined){
				//console.log('caching view id: ' + viewId)
				cachedViewIncludes[viewId] = handle
				viewCounts[viewId] = 1
				listeners.emitIncludeView(viewId, handle, editId)
			}else{
				++viewCounts[viewId]
			}
		},
		removeView: function(viewId, handle, editId){
			--viewCounts[viewId]
			if(viewCounts[viewId] === 0){
				delete cachedViewIncludes[viewId]
				delete viewCounts[viewId]
				listeners.emitRemoveView(viewId, handle, editId)
			}
		},
		include: function(listener, editId){
			//listeners.add(listener)
			Object.keys(cachedViewIncludes).forEach(function(key){
				listener.includeView(key, cachedViewIncludes[key], editId)
			})
		}/*,
		detach: function(listener, editId){
			if(editId){
			Object.keys(cachedViewIncludes).forEach(function(key){
				listener.removeView(key, cachedViewIncludes[key], editId)
			})
		}*/
	}
}
