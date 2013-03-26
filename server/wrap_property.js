//"use strict";

var _ = require('underscorem')

var wu = require('./wraputil')

var analytics = require('./analytics')

var editFp = require('./tcp_shared').editFp
var editCodes = editFp.codes
var editNames = editFp.names

function wrapSingleSingleProperty(s, propertyName, propertyType, contextType, context, ws){
	var objSchema = s.schema[contextType.object]
	var propertyCode = objSchema.properties[propertyName].code
	
	var nameStr = 'property-single(' + context.name+','+propertyName + ')'

	var getProperty = s.objectState.makeGetPropertyAt(objSchema.code, propertyCode)
	
	var a = analytics.make('property-single['+propertyName+']('+context.name+')', [context])
	var handle = {
		name: nameStr,
		analytics: a,
		getStateAt: function(bindings, editId, cb){
			context.getStateAt(bindings, editId, function(id){
				if(id !== undefined){
					getProperty(id, editId, function(pv){
						a.gotProperty(propertyName)
						///console.log(id+'('+objSchema.name+').'+propertyName+' is ' + pv + ' at ' + editId)
						cb(pv)
					})
				}else{
					cb(undefined)
				}
			})
		},
		getChangesBetween: function(bindings, startEditId, endEditId, cb){
			context.getStateAt(bindings, startEditId, function(id){
				context.getChangesBetween(bindings, startEditId+1, endEditId, function(changes){
					if(changes.length === 1 && id === undefined){
						if(changes[0].type === 'clear'){
							_.errout('already cleared? ' + JSON.stringify([startEditId, endEditId]))
						}else{
							id = changes[0].value
						}
						startEditId = changes[0].editId
						_.assertDefined(id)
						getProperty(id, startEditId, function(pv){
							a.gotProperty(propertyName)
							s.objectState.getPropertyChangesDuring(id, propertyCode, startEditId, endEditId, function(changes){
								a.gotPropertyChanges(propertyName)
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
									_.assertEqual(nc.type, 'set')
									var nv = nc.value
									if(pv !== nv){
										resultChanges.push({type: 'set', value: nv, editId: nc.editId})
										pv = nv
									}
								})
							})
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
						s.objectState.getHistoricalPropertyChangesDuring(id, propertyCode, startLastEditId, endEditId, function(propertyChanges){
							allChanges[changes.length] = propertyChanges
							cdl()
						})
						
					})
				})
			})
		}
	}
	
	return handle
}

function wrapSetSingleProperty(s, propertyName, propertyType, contextType, context, ws){
	var objSchema = s.schema[contextType.members.object]
	var propertyCode = objSchema.properties[propertyName].code
	var a = analytics.make('property-set['+propertyName+']('+context.name+')', [context])

	var getProperty = s.objectState.makeGetPropertyAt(objSchema.code, propertyCode)

	var handle = {
		name: 'property-set',
		analytics: a,
		getStateAt: function(bindings, editId, cb){
		
			context.getChangesBetween(bindings, -1, editId, function(state){
				var all = []
				var has = {}
				var cdl = _.latch(state.length, function(){
					cb(all)
				})
				state.forEach(function(e){
					var id = e.value
					getProperty(id, editId, function(propertyValue){
						a.gotProperty(propertyName)
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
					getProperty(id, editId, function(propertyValue){
						a.gotProperty(propertyName)
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
		
		handle.getHistoricalChangesBetween = function(){
			_.errout('TODO')
		}
	}else{
		_.errout('TODO')
	}
		
	return handle
}

function wrapSetSetProperty(s, propertyName, propertyType, contextType, context, ws){
	var objSchema = s.schema[contextType.members.object]
	var propertyCode = objSchema.properties[propertyName].code
	var a = analytics.make('property-set-set['+propertyName+']('+context.name+')', [context])

	var getProperty = s.objectState.makeGetPropertyAt(objSchema.code, propertyCode)
	//var getChang = s.objectState.makeGetPropertyAt(objSchema.code, propertyCode)
	function getChanges(id, startEditId, endEditId, cb){
		s.objectState.getPropertyChangesDuring(id, propertyCode, startEditId, endEditId, cb)
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
					getProperty(id, editId, function(propertyValue){
						_.assertArray(propertyValue)
						a.gotProperty(propertyName)
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
					getProperty(id, editId, function(propertyValue){
						a.gotProperty(propertyName)
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
		}
	}

	handle.getChangesBetween = makeGenericEditsBetween(handle, ws)
	
	handle.getHistoricalChangesBetween = makeSetSetHistoricalChangesBetween(handle, ws, context, getProperty, getChanges)
	
	return handle
}

function makeSetSetHistoricalChangesBetween(handle, ws, context, getProperty, getChanges){

	return function(bindings, startEditId, endEditId, cb){
		//_.errout('TODO')
		context.getStateAt(bindings, startEditId, function(inputState){
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
							getProperty(c.value, c.editId, function(pv){
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
							
							getProperty(c.value, c.editId, function(pv){
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

function makeGenericHistoricalChangesBetween(handle, ws, context, getProperty){
	return function(bindings, startEditId, endEditId, cb){
	
		var cdl = _.latch(endEditId+1-startEditId, function(){
			var changes = []
			wu.range(startEditId, endEditId+1, function(editId, index){
				var es = ws.diffFinder(states[index], states[index+1])
				es.forEach(function(e){
					//_.assert(editId > 0)
					//if(editId < 0) _.errout(editId + ' nothing can happen before editId 1: ' + JSON.stringify([snaps[index], snaps[index+1]]))
					e.editId = editId+1
					changes.push(e)
				})
			})
			cb(changes)
		})
		
		var states = []
		console.log('getting all states: ' + startEditId + ' ' + endEditId)
		wu.range(startEditId, endEditId+1, function(editId, index){
			handle.getStateAt(bindings, editId, function(state){
				states[index] = state
				cdl()
			})
		})
	}
}


function wrapSingleSetProperty(s, propertyName, propertyType, contextType, context, ws){
	var objSchema = s.schema[contextType.object]
	var propertyCode = objSchema.properties[propertyName].code
	var nameStr = 'property-single-set['+propertyName+']('+context.name+')'
	var a = analytics.make(nameStr, [context])

	var getProperty = s.objectState.makeGetPropertyAt(objSchema.code, propertyCode)

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
				if(id == undefined){
					_.errout('invalid null value instead of undefined')
				}

				getProperty(id, editId, function(propertyValue){
				//s.objectState.getPropertyValueAt(id, propertyCode, editId, function(propertyValue){
					a.gotProperty(propertyName)
					//console.log(editId + ' got* property value ' + id + '.' + propertyCode+': ' + propertyValue)
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
						s.objectState.getPropertyChangesDuring(endId, propertyCode, -1, endEditId, function(changes){
							a.gotPropertyChanges(propertyName)
							cb(changes)
						})
					}else{
						_.errout('TODO ' + id + ' ' + endId)
					}
				}else{
					if(id === undefined){
						cb([])
					}else{
						s.objectState.getPropertyChangesDuring(endId, propertyCode, startEditId, endEditId, function(changes){
							a.gotPropertyChanges(propertyName)
							cb(changes)
						})
					}
				}
			})
		})
	}

	/*handle.getHistoricalChangesBetween = function(bindings, startEditId, endEditId, cb){
		_.errout('TODO')
	}*/
	handle.getHistoricalChangesBetween = function(bindings, startEditId, endEditId, cb){
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
			
				/*if(id !== endId){
					if(id === undefined){
						s.objectState.getPropertyChangesDuring(endId, propertyCode, -1, endEditId, function(changes){
							a.gotPropertyChanges(propertyName)
							cb(changes)
						})
					}else{
						_.errout('TODO ' + id + ' ' + endId)
					}
				}else{
					if(id === undefined){
						cb([])
					}else{
						s.objectState.getPropertyChangesDuring(endId, propertyCode, startEditId, endEditId, function(changes){
							a.gotPropertyChanges(propertyName)
							cb(changes)
						})
					}
				}*/
			})
		})
	
	}//makeGenericHistoricalChangesBetween(handle, ws, context, getProperty)
	
	return handle
}

function wrapSingleMapProperty(s, propertyName, propertyType, contextType, context, ws){
	var objSchema = s.schema[contextType.object]
	var propertyCode = objSchema.properties[propertyName].code
	var nameStr = 'property-single-map['+propertyName+']('+context.name+')'
	var a = analytics.make(nameStr, [context])

	var getProperty = s.objectState.makeGetPropertyAt(objSchema.code, propertyCode)

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
				getProperty(id, editId, function(propertyValue){
					//console.log(editId + ' got property value ' + id + '.' + propertyCode+': ' + propertyValue)
					a.gotProperty(propertyName)
					_.assertObject(propertyValue)
					cb(propertyValue)
				})
			})
		}
	}

	handle.getChangesBetween = function(bindings, startEditId, endEditId, cb){
		_.errout('TODO')
	}

	handle.getHistoricalChangesBetween = function(bindings, startEditId, endEditId, cb){
		_.errout('TODO')
	}
	
	return handle
}


function wrapSetMapProperty(s, propertyName, propertyType, contextType, context, ws){
	var objSchema = s.schema[contextType.members.object]
	var propertyCode = objSchema.properties[propertyName].code
	var a = analytics.make('property-set-map['+propertyName+']('+context.name+')', [context])
	
	var getProperty = s.objectState.makeGetPropertyAt(objSchema.code, propertyCode)
	
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
					getProperty(id, editId, function(propertyValue){
						a.gotProperty(propertyName)
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
	
	/*handle.getHistoricalChangesBetween = function(bindings, startEditId, endEditId, cb){
		_.errout('TODO')
	}*/
	handle.getHistoricalChangesBetween = makeGenericHistoricalChangesBetween(handle, ws, context, getProperty)

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


	
function wrapProperty(s, propertyName, propertyType, contextType, resultType, context, ws){

	if(propertyType.type === 'primitive' || propertyType.type === 'object'){
		if(contextType.type === 'object'){
			return wrapSingleSingleProperty(s, propertyName, propertyType, contextType, context, ws)
		}else if(contextType.type === 'set'){
			return wrapSetSingleProperty(s, propertyName, propertyType, contextType, context, ws)
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

	}
	_.errout('serve property: ' + JSON.stringify({propertyType: propertyType, contextType: contextType}))
}

exports.wrapProperty = wrapProperty
