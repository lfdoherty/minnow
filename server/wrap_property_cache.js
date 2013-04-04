//"use strict";

var _ = require('underscorem')

var wu = require('./wraputil')

var analytics = require('./analytics')

function wrapSingleValue(s, type, rel, exprHandle, macroExprHandle, allHandle, ws){
	_.assertLength(arguments, 7)
	
	var letName = rel.params[1].implicits[0]
	
	var cache = {}
	var lastCacheUpdate = {}
	function getProperty(id, editId, cb){
		updateCache(id, function(){
			var changes = cache[id]
			if(!changes){
				//console.log(editId + ' ' + id + ' -> []& -> undefined')
				cb(undefined)
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
				cb(value)
			}
		})
	}
	
	function updateCacheValue(id, latestEditId, cb){
		_.assertDefined(id)//_.assertInt(id)
		var specificBindings = {}
		specificBindings[letName] = id
		
		macroExprHandle.getHistoricalChangesBetween(specificBindings, -1, latestEditId, function(changes){
			if(changes.length === 0){
				//console.log('no changes computed')
				lastCacheUpdate[id] = latestEditId
			}else{
				cache[id] = changes
				//console.log('updated: ' + JSON.stringify(changes))
				//console.log('macroExprHandle: ' + macroExprHandle.name)
				lastCacheUpdate[id] = latestEditId//changes[changes.length-1].editId
			}
			cb()
		})
	}
	function updateCache(id, cb){
		var lastEditId = lastCacheUpdate[id]
		var latestEditId =  s.objectState.getCurrentEditId()
		if(lastEditId){
			s.objectState.getLastVersion(id, function(eId){
				if(eId >= lastEditId){
					//console.log('cache needs updating: ' + id + ' ' + lastEditId)
					updateCacheValue(id, latestEditId, cb)
				}else{
					//console.log('cache ok: ' + id + ' ' + eId + ' <= ' + lastEditId)
					cb()
				}
			})
		}else{
			//console.log('cache needs updating: ' + id + ' ' + lastEditId)
			updateCacheValue(id, latestEditId, cb)
		}
	}
	
	var nameStr = 'property-dependent-cache('+allHandle.name+')'
	var a = analytics.make(nameStr, [exprHandle, macroExprHandle, allHandle])
	var handle = {
		name: nameStr,
		analytics: a,
		getStateAt: function(bindings, editId, cb){
			//console.log('bindings: ' + JSON.stringify(bindings))
			exprHandle.getStateAt(bindings, editId, function(id){
				if(id !== undefined){
					getProperty(id, editId, function(pv){
						/*allHandle.getStateAt(bindings, editId, function(rightPv){
							if(JSON.stringify(pv) !== JSON.stringify(rightPv)){
								console.log(JSON.stringify(rel, null, 2))
								_.errout('error: ' + JSON.stringify([pv, rightPv]))
							}*/
							//console.log('got: ' + pv)
							cb(pv)
						//})
					})
				}else{
					//console.log('got none')
					cb(undefined)
				}
			})
		}/*,
		getChangesBetween: function(bindings, startEditId, endEditId, cb){
			context.
		},
		getHistoricalChangesBetween: function(bindings, startEditId, endEditId, cb){
			
		}*/
	}
	handle.getChangesBetween = allHandle.getChangesBetween
	handle.getHistoricalChangesBetween = allHandle.getHistoricalChangesBetween
	
	return handle
}

function wrapSet(s, type, rel, exprHandle, macroExprHandle, allHandle, ws){
	_.assertLength(arguments, 7)
	
	var letName = rel.params[1].implicits[0]
	
	var cache = {}
	var lastCacheUpdate = {}
	function getProperty(id, editId, cb){
		updateCache(id, function(){
			cb(getPropertyValue(id, editId))
		})
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
		
	function updateCacheValue(id, latestEditId, cb){
		_.assertDefined(id)//_.assertInt(id)
		var specificBindings = {}
		specificBindings[letName] = id
		//console.log('macroExprHandle: ' + macroExprHandle.name)
		macroExprHandle.getHistoricalChangesBetween(specificBindings, -1, latestEditId, function(changes){
			if(changes.length !== 0){
				cache[id] = changes
			}
			lastCacheUpdate[id] = latestEditId
			cb()
		})
	}
	function updateCache(id, cb){
		//_.assertObject(id)
		var lastEditId = lastCacheUpdate[id]
		var latestEditId =  s.objectState.getCurrentEditId()
		if(lastEditId){
			s.objectState.getLastVersion(id, function(eId){
				if(eId >= lastEditId){
					//console.log('last change for ' + id + ' at ' +  + eId + ' last update: ' + lastEditId)
					updateCacheValue(id, latestEditId, cb)
				}else{
					//console.log('not updating cache: ' + lastEditId + ' ' + eId + ' ' + id)
					cb()
				}
			})
		}else{
			updateCacheValue(id, latestEditId, cb)
		}
	}
	
	var nameStr = 'property-dependent-cache('+allHandle.name+')'
	var a = analytics.make(nameStr, [exprHandle, macroExprHandle, allHandle])
	var handle = {
		name: nameStr,
		analytics: a,
		getStateAt: function(bindings, editId, cb){
			//console.log('bindings: ' + JSON.stringify(bindings))
			exprHandle.getStateAt(bindings, editId, function(id){
				//_.assert(_.isInt(id) || _.isInt(id.top))
				if(_.isArray(id)){
					var result = []
					var has = {}
					var cdl = _.latch(id.length, function(){
						cb(result)
					})
					id.forEach(function(id){
						getProperty(id, editId, function(pv){
							pv.forEach(function(v){
								if(has[v]) return
								has[v] = true
								result.push(v)
							})
							cdl()
						})
					})
				}else if(id){
					getProperty(id, editId, function(pv){
						/*allHandle.getStateAt(bindings, editId, function(rightPv){
							if(JSON.stringify(pv) !== JSON.stringify(rightPv)){
								console.log(JSON.stringify(rel, null, 2))
								_.errout('error: ' + JSON.stringify([pv, rightPv]))
							}*/
							cb(pv)
						//})
					})
				}else{
					cb([])
				}
			})
		},
		/*getChangesBetween: function(bindings, startEditId, endEditId, cb){
			context.
		},*/
		getHistoricalChangesBetween: function(bindings, startEditId, endEditId, cb){
			if(startEditId === -1){
				console.log('running property-cached single.set getHistoricalChangesBetween')
				exprHandle.getHistoricalChangesBetween(bindings, startEditId, endEditId, function(changes){
					if(changes.length === 1){
						_.assertEqual(changes[0].type, 'set')
						var id = changes[0].value
						_.assert(_.isInt(id) || _.isInt(id.top))
						updateCache(id, function(){
							var changes = cache[id]
							if(changes === undefined) changes = []
							_.assertArray(changes)
							cb(changes)
						})
					}else{
						console.log('*running slow single.set getHistoricalChangesBetween')
						allHandle.getHistoricalChangesBetween(bindings, startEditId, endEditId, cb)
					}
				})
			}else{
				exprHandle.getHistoricalChangesBetween(bindings, startEditId, endEditId, function(changes){
					if(changes.length === 0){
						//_.errout('TODO')
						exprHandle.getStateAt(bindings, startEditId, function(id){
							if(id){
								_.assert(_.isInt(id) || _.isInt(id.top))
								updateCache(id, function(){
									var changes = cache[id]
									if(changes === undefined) changes = []
									_.assertArray(changes)
									cb(changes)
								})
							}else{
								cb([])
							}
						})
					}else{
						console.log('#running slow single.set getHistoricalChangesBetween')
						allHandle.getHistoricalChangesBetween(bindings, startEditId, endEditId, cb)
					}
				})
			}
		}
	}
	handle.getChangesBetween = handle.getHistoricalChangesBetween
	//handle.getHistoricalChangesBetween = allHandle.getHistoricalChangesBetween
	
	return handle
}	
function wrapProperty(s, resultType, rel, exprHandle, macroExprHandle, allHandle, ws){
	//return allHandle
	if(resultType.type === 'primitive' || resultType.type === 'object'){
		return wrapSingleValue(s, resultType, rel, exprHandle, macroExprHandle, allHandle, ws)
	}else if(resultType.type === 'set'){
		return wrapSet(s, resultType, rel, exprHandle, macroExprHandle, allHandle, ws)
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
