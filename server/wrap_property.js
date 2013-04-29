//"use strict";

var _ = require('underscorem')

var wu = require('./wraputil')

var analytics = require('./analytics')

var editFp = require('./tcp_shared').editFp
var editCodes = editFp.codes
var editNames = editFp.names

function wrapSingleSingleProperty(s, propertyName, propertyType, contextType, context, ws, staticBindings){
	var objSchema = s.schema[contextType.object]
	var p = objSchema.properties[propertyName]
	var propertyCode = p.code
	
	var nameStr = 'property-single(' + context.name+','+propertyName + ')'

	var getProperty = staticBindings.makeGetPropertyAt(objSchema.code, propertyCode)
	
	/*
	var cache = {}
	var lastCacheUpdate = {}
	function getProperty(id, editId, cb){
		updateCache(id, function(){
			var changes = cache[id]
			if(!changes){
				cb(undefined)
			}else{
				var value = changes[changes.length-1].value
				cb(value)
			}
		})
	}
	
	function updateCache(id, cb){
		var lastEditId = lastCacheUpdate[id]
		var latestEditId =  s.objectState.getCurrentEditId()
		if(lastEditId){
			s.objectState.getLastVersion(id, function(eId){
				if(eId > lastEditId){
					s.objectState.getHistoricalPropertyChangesDuring(id, propertyCode, -1, latestEditId, function(propertyChanges){
						if(propertyChanges.length === 0){
							lastCacheUpdate[id] = latestEditId
						}else{
							cache[id] = propertyChanges
							lastCacheUpdate[id] = propertyChanges[propertyChanges.length-1].editId
						}
						cb()
					})
				}else{
					cb()
				}
			})
		}else{
			s.objectState.getHistoricalPropertyChangesDuring(id, propertyCode, -1, latestEditId, function(propertyChanges){
				if(propertyChanges.length === 0){
					lastCacheUpdate[id] = latestEditId
				}else{
					cache[id] = propertyChanges
					lastCacheUpdate[id] = propertyChanges[propertyChanges.length-1].editId
				}
				cb()
			})
		}
	}*/
	
	var wsPc = wu.makeUtilities(p.type)
	
	var a = analytics.make('property-single['+propertyName+']('+context.name+')', [context])
	var handle = {
		name: nameStr,
		analytics: a,
		getStateAt: function(bindings, editId, cb){
			context.getStateAt(bindings, editId, function(id){
				//console.log(JSON.stringify(bindings) + ' ' + context.name + ' got id at: ' + editId + ' ' + id)
				if(id !== undefined){
					getProperty(bindings, id, editId, function(pv){
						a.gotProperty(propertyCode)
						//console.log(id+'('+objSchema.name+').'+propertyName+' is ' + pv + ' at ' + editId)
						cb(pv)
					})
				}else{
					cb(undefined)
				}
			})
		},
		getChangesBetween: function(bindings, startEditId, endEditId, cb){
			context.getStateAt(bindings, startEditId, function(id){
				context.getChangesBetween(bindings, startEditId, endEditId, function(changes){
					//console.log('got ' + startEditId+','+endEditId+': ' + JSON.stringify([id, changes]))
					//console.log(new Error().stack)
					if(changes.length === 1 && id === undefined){
						if(changes[0].type === 'clear'){
							_.errout('already cleared? ' + JSON.stringify([startEditId, endEditId]))
						}else{
							id = changes[0].value
						}
						startEditId = changes[0].editId
						_.assertDefined(id)
						getProperty(bindings, id, startEditId, function(pv){
							a.gotProperty(propertyCode)
							//s.objectState.getPropertyChangesDuring(id, propertyCode, startEditId, endEditId, function(changes){
							staticBindings.getPropertyChangesDuring(id, propertyCode, startEditId, endEditId, function(changes){
								a.gotPropertyChanges(propertyCode)
								if(changes.length > 0){

									cb(changes)
								}else{
									if(pv !== undefined){
										_.assertDefined(pv)

										cb([{type: 'set', value: pv, editId: startEditId}])
									}else{
										cb([])
									}
								}
							})
						})
						return
					}else if(changes.length > 0){
						_.errout(context.name + ' ' + startEditId + ' TODO(' + id + '): ' + JSON.stringify(changes))
					}

					if(id === undefined){
						cb([])
						return
					}

					s.objectState.getPropertyChangesDuring(id, propertyCode, startEditId, endEditId, function(changes){
						
						cb(changes)
					})
				})
			})
		},
		getHistoricalChangesBetween: function(bindings, startEditId, endEditId, cb){
			if(startEditId === -1){
				context.getHistoricalChangesBetween(bindings, startEditId, endEditId, function(changes){
					//console.log('computing property-single historical changes with context: ' + JSON.stringify(changes))
					if(changes.length === 1){
						//_.errout('TODO: ' + JSON.stringify(changes))
						var c = changes[0]
						var id = c.value
						_.assertEqual(c.type, 'set')
						getProperty(bindings, id, c.editId, function(startPv){
							var allChanges = []
							if(startPv !== undefined){
								if(_.isArray(startPv)) _.errout('error, not a single value: ' + JSON.stringify(startPv))
								allChanges.push({type: 'set', value: startPv, editId: c.editId})
							}
							//s.objectState
							staticBindings.getHistoricalPropertyChangesDuring(id, propertyCode, c.editId, endEditId, function(propertyChanges){
								//_.errout('TODO: ' + JSON.stringify([startPv, propertyChanges]))
								allChanges = allChanges.concat(propertyChanges)
								//console.log('here: ' + JSON.stringify([startEditId, endEditId, changes, startPv, propertyChanges, allChanges]))
								cb(allChanges)
							})
						})						
					}else{
					
						context.getStateAt(bindings, startEditId, function(firstId){
							var allEditIds = [firstId]
							var has = {}
							has[firstId] = true
							
							var allResults = []
							
							var cdl = _.latch(changes.length, function(){
								var results = []
								for(var i=0;i<allResults.length;++i){
									results = results.concat(allResults[i])
								}
								cb(results)
							})
							
							changes.forEach(function(c, index){
								var nextEditId = index+1<changes.length?changes[index+1]:endEditId
								if(c.type === 'set'){
									//_.assertDefined(c.old)
									if(c.old !== undefined){
										getProperty(bindings, c.old, c.editId, rest)
									}else{
										rest(undefined)
									}
									
									function rest(oldValue){
										getProperty(bindings, c.value, c.editId, function(newValue){

											staticBindings.getHistoricalPropertyChangesDuring(c.value, propertyCode, c.editId, nextEditId, function(propertyChanges){
												//_.errout('tODO diff: ' + JSON.stringify([oldValue, newValue]))
												var es = wsPc.diffFinder(oldValue, newValue)
												var res = []
												es.forEach(function(e){
													e.editId = c.editId
													res.push(e)
												})
											
												allResults[index] = res.concat(propertyChanges)
												cdl()
											})
										})
									}
								}else{
									_.errout('tODO: ' + JSON.stringify(c))
								}
							})
						})
						
						//console.log('*falling back to slow single.single getHistoricalChangesBetween: ' + JSON.stringify(changes))
						//genericGetHistoricalChangesBetween(bindings, startEditId, endEditId, cb)
					}
				})
				return
			}else{
				context.getHistoricalChangesBetween(bindings, startEditId, endEditId, function(changes){
					if(changes.length === 0){
						//cb([])
						context.getStateAt(bindings, startEditId, function(id){
							//s.objectState.
							staticBindings.getHistoricalPropertyChangesDuring(id, propertyCode, startEditId, endEditId, function(propertyChanges){
								//console.log('for ' + id + ' got changes: ' + JSON.stringify(propertyChanges))
								cb(propertyChanges)
							})
						})
					}else{
						console.log('falling back to slow single.single getHistoricalChangesBetween: ' + JSON.stringify([startEditId, endEditId]))
						genericGetHistoricalChangesBetween(bindings, startEditId, endEditId, cb)
					}
				})
			}
			/*
			context.getStateAt(bindings, startEditId, function(id){
				context.getHistoricalChangesBetween(bindings, startEditId, endEditId, function(changes){
				
					function getInitial(cb){
						if(id){
							getProperty(id, startEditId, cb)
						}else{
							cb(undefined)
						}
					}
					getInitial(function(pv){
						var curEditId = startEditId
						var allChanges = []
						var cdl = _.latch(changes.length+1, function(){
							var resultChanges = []
							allChanges.forEach(function(propertyChanges){
								propertyChanges.forEach(function(nc){
									//_.assertEqual(nc.type, 'set')
									if(nc.type === 'set'){
										var nv = nc.value
										if(pv !== nv){
											resultChanges.push({type: 'set', value: nv, editId: nc.editId})
											pv = nv
										}
									}else if(nc.type === 'clear'){
										if(pv !== undefined){
											resultChanges.push({type: 'clear', editId: nc.editId})
											pv = undefined
										}									
									}else{
										_.errout('TODO: ' + JSON.stringify(nc))
									}
								})
							})
							//console.log('wrapProperty historicalChanges: ' + JSON.stringify([allChanges, resultChanges]))
							cb(resultChanges)
						})
						
						changes.forEach(function(c, index){
							if(id){
								s.objectState.getHistoricalPropertyChangesDuring(id, propertyCode, curEditId, c.editId, function(propertyChanges){
									allChanges[index] = propertyChanges
									cdl()
								})							
							}else{
								allChanges[index] = []
								cdl()
							}
							_.assertEqual(c.type, 'set')
							id = c.value
						})
						
						var startLastEditId = startEditId
						if(changes.length > 0) startLastEditId = changes[changes.length-1].editId
						if(id === undefined){
							allChanges[allChanges.length] = [{type: 'clear', editId: startLastEditId}]
							cdl()
						}else{
							s.objectState.getHistoricalPropertyChangesDuring(id, propertyCode, startLastEditId, endEditId, function(propertyChanges){
								allChanges[allChanges.length] = propertyChanges
								cdl()
							})
						}						
					})
				})
			})*/
		}
	}
	
	var genericGetHistoricalChangesBetween = wu.makeGenericHistoricalChangesBetween(handle, ws, context, getProperty)
	
	return handle
}

function wrapSetSingleProperty(s, propertyName, propertyType, contextType, context, ws, staticBindings){
	var objSchema = s.schema[contextType.members.object]
	var propertyCode = objSchema.properties[propertyName].code
	var a = analytics.make('property-set['+propertyName+']('+context.name+')', [context])

	var getProperty = staticBindings.makeGetPropertyAt(objSchema.code, propertyCode)

	var handle = {
		name: 'property-set',
		analytics: a,
		getStateAt: function(bindings, editId, cb){
			if(editId === -1){
				cb([])
				return
			}
			context.getChangesBetween(bindings, -1, editId, function(state){
				var all = []
				var has = {}
				var cdl = _.latch(state.length, function(){
					cb(all)
				})
				state.forEach(function(e){
					var id = e.value
					getProperty(bindings, id, editId, function(propertyValue){
						a.gotProperty(propertyCode)
						_.assertPrimitive(propertyValue)
						if(propertyValue !== undefined){
							if(!has[propertyValue]){
								has[propertyValue] = true
								all.push(propertyValue)
							}
						}					
						cdl()
					})
				})
			})
		},
		getStateCountsAt: function(bindings, editId, cb){
			context.getChangesBetween(bindings, -1, editId, function(state){
				var counts = {}
				var cdl = _.latch(state.length, function(){
					cb(counts)
				})
				state.forEach(function(e){
					var id = e.value
					getProperty(bindings, id, editId, function(propertyValue){
						a.gotProperty(propertyCode)
						_.assertPrimitive(propertyValue)
						if(propertyValue !== undefined){
							if(!counts[propertyValue]) counts[propertyValue] = 0
							++counts[propertyValue]
						}					
						cdl()
					})
				})
			})
		}
	}
	
	if(propertyType.type === 'object' || propertyType.type === 'primitive' || propertyType.type === 'view'){
		handle.getChangesBetween = makeGenericEditsBetween(handle, ws)
		
		var genericGetHistoricalChangesBetween = wu.makeGenericHistoricalChangesBetween(handle, ws, context, getProperty)
		handle.getHistoricalChangesBetween = genericGetHistoricalChangesBetween
		/*handle.getHistoricalChangesBetween = function(){
			_.errout('TODO')
		}*/
	}else{
		_.errout('TODO')
	}
		
	return handle
}

function wrapSetSetProperty(s, propertyName, propertyType, contextType, context, ws, staticBindings){
	var objSchema = s.schema[contextType.members.object]
	var propertyCode = objSchema.properties[propertyName].code
	var a = analytics.make('property-set-set['+propertyName+']('+context.name+')', [context])

	var getProperty = s.facade.makeGetPropertyAt(objSchema.code, propertyCode)
	//var getChang = s.objectState.makeGetPropertyAt(objSchema.code, propertyCode)
	function getChanges(id, startEditId, endEditId, cb){
		staticBindings.getPropertyChangesDuring(id, propertyCode, startEditId, endEditId, cb)
	}

	var handle = {
		name: 'property-set-set',
		analytics: a,
		getStateAt: function(bindings, editId, cb){
			if(!_.isFunction(context.getStateAt)) _.errout('missing getStateAt: ' + context.name)
		
			context.getStateAt(bindings, editId, function(state){
				var has = {}
				var result = []
				var cdl = _.latch(state.length, function(){
					cb(result)
				})
				state.forEach(function(id){
					getProperty(bindings, id, editId, function(propertyValue){
						_.assertArray(propertyValue)
						a.gotProperty(propertyCode)
						for(var i=0;i<propertyValue.length;++i){
							var value = propertyValue[i]
							if(has[value]) continue
							has[value] = true
							result.push(value)
						}
						cdl()
					})
				})
			})
		},
		getStateCountsAt: function(bindings, editId, cb){
			context.getChangesBetween(bindings, -1, editId, function(state){
				var counts = {}
				var all = []
				var cdl = _.latch(state.length, function(){
					cb(counts, all)
				})
				state.forEach(function(e){
					var id = e.value
					getProperty(bindings, id, editId, function(propertyValue){
						a.gotProperty(propertyCode)
						_.assertPrimitive(propertyValue)
						if(propertyValue !== undefined){
							if(!counts[propertyValue]) counts[propertyValue] = 0
							else all.push(propertyValue)
							++counts[propertyValue]
						}					
						cdl()
					})
				})
			})
		},
		getHistoricalChangesBetween: function(bindings, startEditId, endEditId, cb){
			if(startEditId === -1){
				context.getHistoricalChangesBetween(bindings, startEditId, endEditId, function(changes){
					if(changes.length === 0){
						cb([])
					}else if(changes.length === 1 && startEditId === -1){
						_.assertEqual(changes[0].type, 'add')
						var singleAdded = changes[0].value
						var singleEditId = changes[0].editId

						getChanges(singleAdded, startEditId, endEditId, function(pcs){
							var startValue = []
							var after = []
							for(var i=0;i<pcs.length;++i){
								var c = pcs[i]
								if(c.editId <= singleEditId){
									if(c.type === 'add'){
										startValue.push(c.value)
									}else if(c.type === 'remove'){
										var index = startValue.indexOf(c.value)
										if(index !== -1){
											startValue.splice(index, 1)
										}
									}else{
										_.errout('TODO: ' + JSON.stringify(c))
									}
								}else if(c.editId <= endEditId){
									after.push(c)
								}
							}
							var all = []
							for(var i=0;i<startValue.length;++i){
								all.push({type: 'add', value: startValue[i], editId: singleEditId})
							}
							all = all.concat(after)
							//console.log('computed ' + JSON.stringify([changes, pcs, all]))
							cb(all)
						})
					}else if(changes[changes.length-1].editId === 0){

						var allChanges = []
						var cdl = _.latch(changes.length, function(){
							allChanges.sort(function(a,b){return a.editId - b.editId;})
							
							var counts = {}
							var result = []
							allChanges.forEach(function(c){
								if(c.type === 'add'){
									if(!counts[c.value]){
										result.push(c)
										counts[c.value] = 0
									}
									++counts[c.value]
								}else if(c.type === 'remove'){
									--counts[c.value]
									if(!counts[c.value]){
										result.push(c)
									}
								}else{
									_.errout('TODO: ' + JSON.stringify(c))
								}
							})
							console.log('completed more optimal set.set getHistoricalChangesBetween: ' + result.length)
							cb(result)
						})						
						
						console.log(JSON.stringify(changes) + ' ' + context.name)
						changes.forEach(function(c){
							_.assertEqual(c.type, 'add')
							getProperty(bindings, c.value, c.editId, function(startPv){
								startPv.forEach(function(v){
									allChanges.push({type: 'add', value: v, editId: 0})
								})
								staticBindings.getHistoricalPropertyChangesDuring(c.value, propertyCode, c.editId, endEditId, function(propertyChanges){
									allChanges = allChanges.concat(propertyChanges)
									cdl()
								})
							})		
						})
									
					}else{
						console.log('*falling back to slow set.set getHistoricalChangesBetween: ' + JSON.stringify(changes))
						genericGetHistoricalChangesBetween(bindings, startEditId, endEditId, cb)
					}
				})
				return
			}
			console.log('falling back to slow set.set getHistoricalChangesBetween')
			genericGetHistoricalChangesBetween(bindings, startEditId, endEditId, cb)
		}
	}

	handle.getChangesBetween = makeGenericEditsBetween(handle, ws)
	
	//handle.getHistoricalChangesBetween = makeSetSetHistoricalChangesBetween(handle, ws, context, getProperty, getChanges)
	var genericGetHistoricalChangesBetween = wu.makeGenericHistoricalChangesBetween(handle, ws, context, getProperty)
	//handle.getHistoricalChangesBetween = genericGetHistoricalChangesBetween
	
	return handle
}

function makeSetSetHistoricalChangesBetween(handle, ws, context, getProperty, getChanges){

	return function(bindings, startEditId, endEditId, cb){
		//_.errout('TODO')
		context.getStateAt(bindings, startEditId, function(inputState){
			_.assertArray(inputState)
			handle.getStateCountsAt(bindings, startEditId, function(counts, state){
				_.assertArray(state)
				context.getHistoricalChangesBetween(bindings, startEditId, endEditId, function(changes){
					var lastEditId = startEditId
					
					var ars = []//all the adds and removes
					var rem = 1
					function tryFinish(){
						--rem
						if(rem === 0){
							//_.errout('TODO')
							Object.keys(idRemoveAdds).forEach(function(key){
								var changes = idChanges[key]
								var lastEditId = endEditId
								idRemoveAdds[key].reverse().forEach(function(rac){
									if(rac.type === 'remove'){
										for(var i=changes.length-1;i>=0;--i){
											var c = changes[i]
											if(c.editId >= lastEditId) continue
											if(c.editId < rac.editId) break
											changes.splice(i, 1)
										}
									}//if it's a add, just mark the lastEditId value appropriately
									lastEditId = rac.editId
								})
								ars = ars.concat(changes)
							})
							
							var results = []
							ars.sort(function(a,b){return a.editId - b.editId;})
							ars.forEach(function(c){
								if(c.type === 'add'){
									if(!counts[c.value]){
										counts[c.value] = 1
										results.push({type: 'add', value: c.value, editId: c.editId})
									}else{
										++counts[c.value]
									}
								}else{
									--counts[c.value]
									if(counts[c.value] === 0){
										results.push({type: 'remove', value: c.value, editId: c.editId})
									}
								}
							})
							cb(results)
						}
					}
					var idChanges = {}
					var idRemoveAdds = {}
					rem += state.length
					state.forEach(function(id){
						getChanges(id, startEditId, endEditId, function(changes){
							idChanges[id] = changes
							tryFinish()
						})
					})
					changes.forEach(function(c){
						if(c.type === 'add'){

							if(idRemoveAdds[c.value]) idRemoveAdds[c.value].push({type: 'add', editId: c.editId})
							
							inputState.push(c.value)
							++rem
							getProperty(bindings, c.value, c.editId, function(pv){
								pv.forEach(function(v){
									ars.push({type: 'add', value: v, editId: c.editId})
								})
								if(!idChanges[c.value]){
									getChanges(c.value, c.editId, endEditId, function(changes){
										idChanges[c.value] = changes
										tryFinish()
									})
								}else{
									tryFinish()
								}
							})
						}else if(c.type === 'remove'){
							
							++rem

							if(!idRemoveAdds[c.value]) idRemoveAdds[c.value] = [{type: 'remove', editId: c.editId}]
							else idRemoveAdds[c.value].push({type: 'remove', editId: c.editId})
							
							getProperty(bindings, c.value, c.editId, function(pv){
								pv.forEach(function(v){
									ars.push({type: 'remove', value: v, editId: c.editId})
								})
								tryFinish()
							})
						}else{
							_.errout('tODO: ' + JSON.stringify(c))
						}

						lastEditId = c.editId
					})
					tryFinish()
				})
			})
		})
	}
}



function wrapSingleSetProperty(s, propertyName, propertyType, contextType, context, ws, staticBindings){
	var objSchema = s.schema[contextType.object]
	var propertyCode = objSchema.properties[propertyName].code
	var nameStr = 'property-single-set['+propertyName+']('+context.name+')'
	var a = analytics.make(nameStr, [context])

	var getProperty = staticBindings.makeGetPropertyAt(objSchema.code, propertyCode)

	var handle = {
		name: nameStr,
		analytics: a,
		getStateAt: function(bindings, editId, cb){
			if(!_.isFunction(context.getStateAt)) _.errout('missing getStateAt: ' + context.name)
		
			context.getStateAt(bindings, editId, function(id){
				if(_.isArray(id)) _.errout('not a single: ' + JSON.stringify(id) + ' ' + nameStr)
				if(id === undefined){
					cb([])
					return
				}
				if(id == undefined){
					_.errout('invalid null value instead of undefined')
				}

				getProperty(bindings, id, editId, function(propertyValue){

					a.gotProperty(propertyCode)
					//console.log(editId + ' got* property value ' + id + '.' + propertyCode+': ' + JSON.stringify(propertyValue))
					
					_.assertArray(propertyValue)
					cb(propertyValue)
				})
			})
		}
	}

	handle.getChangesBetween = function(bindings, startEditId, endEditId, cb){
		context.getStateAt(bindings, startEditId, function(id){
			context.getStateAt(bindings, endEditId, function(endId){
				if(id !== endId){
					if(id === undefined){
						//s.objectState.
						staticBindings.getPropertyChangesDuring(endId, propertyCode, -1, endEditId, function(changes){
							a.gotPropertyChanges(propertyCode)
							cb(changes)
						})
					}else{
						_.errout('TODO ' + id + ' ' + endId)
					}
				}else{
					if(id === undefined){
						cb([])
					}else{
						//s.objectState.
						staticBindings.getPropertyChangesDuring(endId, propertyCode, startEditId, endEditId, function(changes){
							a.gotPropertyChanges(propertyCode)
							cb(changes)
						})
					}
				}
			})
		})
	}

	handle.getHistoricalChangesBetween = function(bindings, startEditId, endEditId, cb){
		if(startEditId === -1){
			context.getHistoricalChangesBetween(bindings, startEditId, endEditId, function(changes){
				if(changes.length === 0){
					cb([])
				}else if(changes.length === 1){
					//console.log('^^')
					var c = changes[0]
					var id = c.value
					_.assertEqual(c.type, 'set')
					getProperty(bindings, id, c.editId, function(startPv){
						var allChanges = []
						_.assertArray(startPv)
						
						startPv.forEach(function(v){
							allChanges.push({type: 'add', value: v, editId: c.editId})
						})

						staticBindings.getHistoricalPropertyChangesDuring(id, propertyCode, c.editId, endEditId, function(propertyChanges){
							//_.errout('TODO: ' + JSON.stringify([startPv, propertyChanges]))
							allChanges = allChanges.concat(propertyChanges)
							//console.log(JSON.stringify([startEditId, endEditId, changes, startPv, propertyChanges]))
							//console.log('^^-')
							cb(allChanges)
						})
					})		
				}else if(startEditId === -1){
				//	console.log('^^%')
					
					var allChanges = {}
					var allStates = {}
					var alreadyGetting = {}
					
					var cdl = _.latch(changes.length, function(){
						var resultChanges = []
						changes.forEach(function(c, index){
						
							var nextEditId = index+1 < changes.length? changes[index+1].editId : endEditId
							
							var currentState = []
							if(c.type === 'set'){
								var stateAtAdd = allStates[c.value+':'+c.editId]
								var propertyChanges = allChanges[c.value]
								var es = ws.diffFinder(currentState, stateAtAdd)
								es.forEach(function(e){
									e.editId = c.editId
									resultChanges.push(e)
								})
								currentState = stateAtAdd
								for(var i=0;i<propertyChanges.length;++i){
									var pc = propertyChanges[i]
									if(pc.editId < c.editId) continue
									if(pc.editId > nextEditId) break
									resultChanges.push(pc)
									if(pc.type == 'add'){
										currentState.push(pc.value)
									}else if(pc.type === 'remove'){
										var index = currentState.indexOf(pc.value)
										currentState.splice(index, 1)
									}else{
										_.errout('TODO: ' + JSON.stringify(pc))
									}
								}
							}else if(c.type === 'clear'){
								var es = ws.diffFinder(currentState, [])
								currentState = []
								es.forEach(function(e){
									e.editId = c.editId
									resultChanges.push(e)
								})
							}else{
								_.errout('TODO: ' + JSON.stringify(c))
							}
						})
						cb(resultChanges)
					})
					
					changes.forEach(function(c, index){
						//var nextEditId = index+1 < changes.length? changes[index+1].editId : endEditId
						if(c.type === 'set'){
							if(alreadyGetting[c.value]){
								cdl()
								return
							}
							alreadyGetting[c.value] = true
							getProperty(bindings, c.value, c.editId, function(pv){
								allStates[c.value+':'+c.editId] = pv
								staticBindings.getHistoricalPropertyChangesDuring(c.value, propertyCode, c.editId, endEditId, function(propertyChanges){
									allChanges[c.value] = propertyChanges
									cdl()
								})
							})
						}else if(c.type === 'clear'){
							cdl()
						}else{
							_.errout('TODO: ' + JSON.stringify(c))
						}
					})
				}else{
					console.log('*falling back to slow single.set getHistoricalChangesBetween: ' + JSON.stringify(changes))
					genericGetHistoricalChangesBetween(bindings, startEditId, endEditId, cb)
				}
			})
			return
		}
		console.log('falling back to slow single.set getHistoricalChangesBetween')
		genericGetHistoricalChangesBetween(bindings, startEditId, endEditId, cb)
	}
	/*handle.getHistoricalChangesBetween = function(bindings, startEditId, endEditId, cb){
		_.errout('TODO')
	}*/
	/*handle.getHistoricalChangesBetween = function(bindings, startEditId, endEditId, cb){
		context.getStateAt(bindings, startEditId, function(id){
			context.getHistoricalChangesBetween(bindings, startEditId, endEditId, function(inputChanges){
				var allChanges = []
				
				var rem = 1
				function tryFinish(){
					--rem
					if(rem === 0){
						//_.errout('TODO')
						allChanges.sort(function(a,b){return a.editId - b.editId;})
						cb(allChanges)
					}
				}
				
				var lastEditId = startEditId
				rem += inputChanges.length*2
				inputChanges.forEach(function(c, index){
					if(c.type === 'set'){
						if(id !== undefined){
							_.assert(id !== c.value)
							getProperty(id, c.editId, function(pv){
								getProperty(c.value, c.editId, function(npv){
									if(pv.length === 0 && npv.length === 0){
										tryFinish()
									}else{
										_.errout('TODO diff: ' + JSON.stringify([pv, npv]))
										tryFinish()
									}
								})
							})
						}else{
							getProperty(c.value, c.editId, function(npv){
								//_.errout('TODO diff: ' + JSON.stringify([npv]))
								npv.forEach(function(v){
									allChanges.push({type: 'add', value: v, editId: c.editId})
								})
								tryFinish()
							})
						}
						if(id !== undefined){
							s.objectState.getPropertyChangesDuring(id, propertyCode, lastEditId, inputChanges.length>index+1?inputChanges[index+1].editId:endEditId, function(changes){
								allChanges = allChanges.concat(changes)
								tryFinish()
							})
						}else{
							tryFinish()
						}
						id = c.value
						lastEditId = c.editId
					}else if(c.type === 'clear'){
						getProperty(id, c.editId, function(pv){
							pv.forEach(function(v){
								allChanges.push({type: 'remove', value: v, editId: c.editId})
							})
							tryFinish()
						})						
					}else{
						_.errout('TODO: ' + JSON.stringify(c))
					}
				})
				
				if(lastEditId !== endEditId){
					if(id !== undefined){
						s.objectState.getPropertyChangesDuring(id, propertyCode, startEditId, inputChanges.length>0?inputChanges[0].editId:endEditId, function(changes){
							allChanges = allChanges.concat(changes)
							tryFinish()
						})
					}else{
						tryFinish()
					}
				}else{
					tryFinish()
				}
			
			})
		})
	
	}*/
	//makeGenericHistoricalChangesBetween(handle, ws, context, getProperty)

	var genericGetHistoricalChangesBetween = wu.makeGenericHistoricalChangesBetween(handle, ws, context, getProperty)
	//handle.getHistoricalChangesBetween = 
	
	return handle
}

function wrapSingleMapProperty(s, propertyName, propertyType, contextType, context, ws, staticBindings){
	var objSchema = s.schema[contextType.object]
	var propertyCode = objSchema.properties[propertyName].code
	var nameStr = 'property-single-map['+propertyName+']('+context.name+')'
	var a = analytics.make(nameStr, [context])

	var getProperty = staticBindings.makeGetPropertyAt(objSchema.code, propertyCode)//s.objectState.makeGetPropertyAt(objSchema.code, propertyCode)

	var handle = {
		name: nameStr,
		analytics: a,
		getStateAt: function(bindings, editId, cb){
			if(!_.isFunction(context.getStateAt)) _.errout('missing getStateAt: ' + context.name)
		
			context.getStateAt(bindings, editId, function(id){
				if(id === undefined){
					cb([])
					return
				}

				//s.objectState.getPropertyValueAt(id, propertyCode, editId, function(propertyValue){
				getProperty(bindings, id, editId, function(propertyValue){
					//console.log(editId + ' got property value ' + id + '.' + propertyCode+': ' + propertyValue)
					a.gotProperty(propertyCode)
					_.assertObject(propertyValue)
					cb(propertyValue)
				})
			})
		}
	}

	handle.getChangesBetween = makeGenericEditsBetween(handle, ws)
	handle.getHistoricalChangesBetween = wu.makeGenericHistoricalChangesBetween(handle, ws, context, getProperty)

	/*handle.getChangesBetween = function(bindings, startEditId, endEditId, cb){
		_.errout('TODO')
	}

	handle.getHistoricalChangesBetween = function(bindings, startEditId, endEditId, cb){
		_.errout('TODO')
	}*/
	
	return handle
}


function wrapSetMapProperty(s, propertyName, propertyType, contextType, context, ws, staticBindings){
	var objSchema = s.schema[contextType.members.object]
	var propertyCode = objSchema.properties[propertyName].code
	var a = analytics.make('property-set-map['+propertyName+']('+context.name+')', [context])
	
	var getProperty = staticBindings.makeGetPropertyAt(objSchema.code, propertyCode)
	
	var handle = {
		name: 'property-set-map',
		analytics: a,
		getStateAt: function(bindings, editId, cb){
			if(!_.isFunction(context.getStateAt)) _.errout('missing getStateAt: ' + context.name)
		
			context.getStateAt(bindings, editId, function(state){
				if(state === undefined){
					cb({})
					return
				}
				var result = {}
				var cdl = _.latch(state.length, function(){
					cb(result)
				})
				state.forEach(function(id){
					//s.objectState.getPropertyValueAt(id, propertyCode, editId, function(propertyValue){
					getProperty(bindings, id, editId, function(propertyValue){
						a.gotProperty(propertyCode)
						//console.log(editId + ' got property value ' + id + '.' + propertyCode+': ' + propertyValue)
						_.assertObject(propertyValue)
						
						Object.keys(propertyValue).forEach(function(key){
							result[key] = propertyValue[key]
						})
						cdl()
					})
				})
			})
		}
	}

	handle.getChangesBetween = makeGenericEditsBetween(handle, ws)
	handle.getHistoricalChangesBetween = wu.makeGenericHistoricalChangesBetween(handle, ws, context, getProperty)

	return handle
}

function stubGetInclusionsDuring(bindings, lastEditId, endEditId, cb){
	cb([])
}
/*
function computeChanges(startEditId, endEditId, states, diffFinder){
	var changes = []
	wu.range(startEditId, endEditId, function(editId, index){
		//console.log('finding diff: '+ JSON.stringify([states[index], states[index+1]]))
		var es = diffFinder(states[index], states[index+1])
		es.forEach(function(e){
			//_.assert(editId > 0)
			//if(editId < 0) _.errout(editId + ' nothing can happen before editId 1: ' + JSON.stringify([snaps[index], snaps[index+1]]))
			e.editId = editId+1
			changes.push(e)
		})
	})
	return changes
}*/


function makeGenericEditsBetween(handle, ws){
	function genericChangesBetween(bindings, startEditId, endEditId, cb){
		
		handle.getStateAt(bindings, startEditId, function(startState){
			handle.getStateAt(bindings, endEditId, function(state){
				var es = ws.diffFinder(startState, state)
				var changes = []
				es.forEach(function(e){
					e.editId = endEditId
					changes.push(e)
				})
				cb(changes)
			})
		})
		/*var states = []
		var cdl = _.latch(endEditId+1-startEditId, function(){
		
			var changes = computeChanges(startEditId, endEditId, states, ws.diffFinder)

			cb(changes)
		})
		wu.range(startEditId, endEditId+1, function(editId, index){
			handle.getStateAt(bindings, editId, function(state){
			
				states[index] = state
				cdl()
			})
		})*/
	}
	return genericChangesBetween
}


	
function wrapProperty(s, propertyName, propertyType, contextType, resultType, context, ws, staticBindings){

	if(propertyType.type === 'primitive' || propertyType.type === 'object'){
		if(contextType.type === 'object'){
			return wrapSingleSingleProperty(s, propertyName, propertyType, contextType, context, ws, staticBindings)
		}else if(contextType.type === 'set'){
			return wrapSetSingleProperty(s, propertyName, propertyType, contextType, context, ws, staticBindings)
		}else{
		}
	}else if(propertyType.type === 'set' || propertyType.type === 'list'){
		if(contextType.type === 'object'){
			//console.log(JSON.stringify(contextType))
			//_.errout('here')
			return wrapSingleSetProperty(s, propertyName, propertyType, contextType, context, ws, staticBindings)			
		}else if(contextType.type === 'set'){
			return wrapSetSetProperty(s, propertyName, propertyType, contextType, context, ws, staticBindings)			
		}else{
			_.errout('TODO: ' + JSON.stringify(contextType))
		}
	}else if(propertyType.type === 'map'){
		if(contextType.type === 'object'){
			return wrapSingleMapProperty(s, propertyName, propertyType, contextType, context, ws, staticBindings)			
		}else if(contextType.type === 'set'){
			return wrapSetMapProperty(s, propertyName, propertyType, contextType, context, ws, staticBindings)			
		}else{
		}
	}else{

	}
	_.errout('serve property: ' + JSON.stringify({propertyType: propertyType, contextType: contextType}))
}

exports.wrapProperty = wrapProperty
