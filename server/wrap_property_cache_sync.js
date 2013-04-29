//"use strict";

var _ = require('underscorem')

var wu = require('./wraputil')

var analytics = require('./analytics')

function wrapSingleValue(s, type, rel, exprHandle, macroExprHandle, allHandle, ws, staticBindings){
	_.assertLength(arguments, 8)
	
	var letName = rel.params[1].implicits[0]
	
	var cache = {}
	var lastCacheUpdate = {}
	function getProperty(id, editId){
		updateCache(id)
		var changes = cache[id]
		//console.log('cache updated')
		if(!changes){
			//console.log(editId + ' ' + id + ' -> []& -> undefined')
			return undefined
		}else{
			var value
			for(var i=changes.length-1;i>=0;--i){
				var c = changes[i]
				//_.assertEqual(c.type, 'set')
				if(c.editId <= editId){
					if(c.type === 'set'){
						value = c.value
					}else if(c.type === 'clear'){
						value = undefined
					}else{
						_.errout('TODO: ' + JSON.stringify(c))
					}
					break
				}
			}
			//console.log(editId + ' ' + id + ' -> ' + JSON.stringify(changes) + ' -> ' + JSON.stringify(value))
			return value
		}
	}
	
	function updateCacheValue(id, latestEditId){
		_.assertDefined(id)//_.assertInt(id)
		var specificBindings = {}
		specificBindings[letName] = id
		
		//console.log('ipdating cache: ' + macroExprHandle.getHistoricalChangesBetween)
		//console.log('name: ' + macroExprHandle.name)
		var changes = macroExprHandle.getHistoricalBetween(specificBindings, -1, latestEditId)
		if(changes.length === 0){
			//console.log('no changes computed')
			lastCacheUpdate[id] = latestEditId
		}else{
			cache[id] = changes
			//console.log('updated: ' + JSON.stringify(changes))
			//console.log(new Error().stack)
			//console.log('macroExprHandle: ' + macroExprHandle.name)
			lastCacheUpdate[id] = latestEditId//changes[changes.length-1].editId
		}
	}
	function updateCache(id){
		var lastEditId = lastCacheUpdate[id]
		var latestEditId =  s.objectState.getCurrentEditId()
		if(lastEditId){
			//console.log('getLastVersion: ' + staticBindings.getLastVersion)
			var eid = staticBindings.getLastVersion(id)
			_.assertInt(eId)
			if(eId >= lastEditId){
				//console.log('cache needs updating: ' + id + ' ' + lastEditId)
				updateCacheValue(id, latestEditId)
			}
		}else{
			//console.log('cache needs updating: ' + id + ' ' + lastEditId)
			updateCacheValue(id, latestEditId)
		}
	}
	
	var nameStr = 'property-dependent-cache('+allHandle.name+')'
	var a = analytics.make(nameStr, [exprHandle, macroExprHandle, allHandle])
	var handle = {
		name: nameStr,
		analytics: a,
		getAt: function(bindings, editId){
			//console.log('bindings: ' + JSON.stringify(bindings))
			if(bindings.__mutatorKey){
				//console.log('here^^^')
				return allHandle.getAt(bindings, editId)
			}
			
				//console.log('here**')
				//console.log(new Error().stack)
			var id = exprHandle.getAt(bindings, editId)
				//console.log('here***')
				//_.errout('TODO')
			if(id !== undefined){
				var pv = getProperty(id, editId)
					//console.log('here&&&: ' + pv)// + ' ' + cb)
				return pv
			}else{
				//console.log('here&&&*')
				return undefined
			}
		}/*,
		getChangesBetween: function(bindings, startEditId, endEditId, cb){
			context.
		},
		getHistoricalChangesBetween: function(bindings, startEditId, endEditId, cb){
			
		}*/
	}
	handle.getChangesBetween = allHandle.getChangesBetween
	handle.getHistoricalChangesBetween = allHandle.getHistoricalChangesBetween
	
	handle.getPropertyValueAt = allHandle.getPropertyValueAt
	
	return handle
}

function wrapSet(s, type, rel, exprHandle, macroExprHandle, allHandle, ws, staticBindings){
	_.assertLength(arguments, 8)

	if(!rel.sync) _.errout('error')
	
	var letName = rel.params[1].implicits[0]
	
	var cache = {}
	var lastCacheUpdate = {}
	function getProperty(id, editId){
		updateCache(id)
		return getPropertyValue(id, editId)
	}
	
	function getPropertyValue(id, editId){
		var changes = cache[id]
		if(!changes){
			//console.log(editId + ' ' + id + ' -> []& -> undefined')
			return []
		}else{
			var value = []
			for(var i=0;i<changes.length;++i){
				var c = changes[i]
				//_.assertEqual(c.type, 'set')
				if(c.editId > editId){
					break
				}
				if(c.type === 'add'){
					value.push(c.value)
				}else if(c.type === 'remove'){
					var index = value.indexOf(c.value)
					_.assert(index !== -1)
					value.splice(index, 1)
				}else{
					_.errout('TODO: ' + JSON.stringify(c))
				}
			}
			//console.log(editId + ' ' + id + ' -> ' + JSON.stringify(changes) + ' -> ' + JSON.stringify(value))
			return value
		}
	}
		
	function updateCacheValue(id, latestEditId){
		_.assertDefined(id)//_.assertInt(id)
		var specificBindings = {}
		specificBindings[letName] = id
		//console.log('macroExprHandle: ' + macroExprHandle.name)
		var changes = macroExprHandle.getHistoricalBetween(specificBindings, -1, latestEditId)
		if(changes.length !== 0){
			cache[id] = changes
		}
		lastCacheUpdate[id] = latestEditId
	}
	function updateCache(id){
		//_.assertObject(id)
		var lastEditId = lastCacheUpdate[id]
		var latestEditId =  s.objectState.getCurrentEditId()
		if(lastEditId){
			var eId = staticBindings.getLastVersion(id)
			_.assertInt(eId)
			if(eId >= lastEditId){
				//console.log('last change for ' + id + ' at ' +  + eId + ' last update: ' + lastEditId)
				updateCacheValue(id, latestEditId)
			}
		}else{
			updateCacheValue(id, latestEditId)
		}
	}
	
	var nameStr = 'property-dependent-cache('+allHandle.name+')'
	var a = analytics.make(nameStr, [exprHandle, macroExprHandle, allHandle])
	var handle = {
		name: nameStr,
		analytics: a,
		getAt: function(bindings, editId){
			//console.log('bindings: ' + JSON.stringify(bindings))
			if(bindings.__mutatorKey){
				return allHandle.getAt(bindings, editId)
			}
			
			var id = exprHandle.getAt(bindings, editId)
			//_.assert(_.isInt(id) || _.isInt(id.top))
			if(_.isArray(id)){
				var result = []
				var has = {}
				id.forEach(function(id){
					var pv = getProperty(id, editId)
					pv.forEach(function(v){
						if(has[v]) return
						has[v] = true
						result.push(v)
					})
				})
				
				return result
			}else if(id){
				var pv = getProperty(id, editId)
				return pv
			}else{
				return []
			}
		},
		getHistoricalBetween: function(bindings, startEditId, endEditId){
			if(bindings.__mutatorKey) _.errout('TODO')
			
			if(startEditId === -1){
				//console.log('running property-cached single.set getHistoricalChangesBetween')
				var changes = exprHandle.getHistoricalBetween(bindings, startEditId, endEditId)
				if(changes.length === 1){
					_.assertEqual(changes[0].type, 'set')
					var id = changes[0].value
					_.assert(_.isInt(id) || _.isInt(id.top))
					updateCache(id)
					var changes = cache[id]
					if(changes === undefined) changes = []
					_.assertArray(changes)
					return changes
				}else{
					console.log('*running slow single.set getHistoricalChangesBetween')
					return allHandle.getHistoricalBetween(bindings, startEditId, endEditId)
				}
			}else{
				var changes = exprHandle.getHistoricalChangesBetween(bindings, startEditId, endEditId)
				if(changes.length === 0){
					//_.errout('TODO')
					var id = exprHandle.getAt(bindings, startEditId)
					if(id){
						_.assert(_.isInt(id) || _.isInt(id.top))
						updateCache(id)
						var changes = cache[id]
						if(changes === undefined) changes = []
						_.assertArray(changes)
						return changes
					}else{
						return []
					}
				}else{
					console.log('#running slow single.set getHistoricalChangesBetween')
					return allHandle.getHistoricalChangesBetween(bindings, startEditId, endEditId)
				}
			}
		}
	}
	handle.getBetween = handle.getHistoricalBetween
	//handle.getHistoricalChangesBetween = allHandle.getHistoricalChangesBetween
	
	return handle
}	
function wrapProperty(s, resultType, rel, exprHandle, macroExprHandle, allHandle, ws, staticBindings){
	_.assertLength(arguments, 8)
	
	//return allHandle
	
	if(resultType.type === 'primitive' || resultType.type === 'object'){
		return wrapSingleValue(s, resultType, rel, exprHandle, macroExprHandle, allHandle, ws, staticBindings)
	}else if(resultType.type === 'set'){
		return wrapSet(s, resultType, rel, exprHandle, macroExprHandle, allHandle, ws, staticBindings)
	}else if(resultType.type === 'map'){
	}
	return allHandle//just fall through for now
	
	/*if(propertyType.type === 'primitive' || propertyType.type === 'object'){
		if(contextType.type === 'object'){
			return wrapSingleSingleProperty(s, contextType, context, ws)
		}else if(contextType.type === 'set'){
			return wrapSetSingleProperty(s, contextType, context, ws)
		}else{
		}
	}else if(propertyType.type === 'set' || propertyType.type === 'list'){
		if(contextType.type === 'object'){
			return wrapSingleSetProperty(s, propertyName, propertyType, contextType, context, ws)			
		}else if(contextType.type === 'set'){
			return wrapSetSetProperty(s, propertyName, propertyType, contextType, context, ws)			
		}else{
			_.errout('TODO: ' + JSON.stringify(contextType))
		}
	}else if(propertyType.type === 'map'){
		if(contextType.type === 'object'){
			return wrapSingleMapProperty(s, propertyName, propertyType, contextType, context, ws)			
		}else if(contextType.type === 'set'){
			return wrapSetMapProperty(s, propertyName, propertyType, contextType, context, ws)			
		}else{
		}
	}else{

	}*/
	//_.errout('serve property: ' + JSON.stringify({resultType: resultType}))
}

exports.wrap = wrapProperty
