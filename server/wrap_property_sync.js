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
	
	var nameStr = 'property-single-sync(' + context.name+','+propertyName + ')'

	//var getProperty = staticBindings.makeGetPropertyAt(objSchema.code, propertyCode)
	var index = staticBindings.makePropertyIndex(objSchema, objSchema.propertiesByCode[propertyCode])
	
	var wsPc = wu.makeUtilities(p.type)
	
	var a = analytics.make('property-single-sync['+propertyName+']('+context.name+')', [context])
	var handle = {
		name: nameStr,
		analytics: a,
		getAt: function(bindings, editId){
			var id = context.getAt(bindings, editId)
			//console.log(JSON.stringify(bindings) + ' ' + context.name + ' got id at: ' + editId + ' ' + id)
			if(id !== undefined){
				var res = index.getValueAt(bindings,id, editId)
				//if(objSchema.name === 'tab') console.log(objSchema.name + '.' + propertyName + ' got id at: ' + editId + ' ' + id + ' , value: ' + res)
				return res
			}else{
				//console.log(editId + ' null id looking for ' + objSchema.name + '.' + propertyName)
				return
			}
		},
		getBetween: function(bindings, startEditId, endEditId){
			var id = context.getAt(bindings, startEditId)
			var changes = context.getBetween(bindings, startEditId, endEditId)
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
				
				//getProperty(bindings, id, startEditId, function(pv){
				var pv = index.getValueAt(bindings,id, startEditId)
				a.gotProperty(propertyCode)
				//s.objectState.getPropertyChangesDuring(id, propertyCode, startEditId, endEditId, function(changes){
				var pvChanges = index.getValueChangesBetween(bindings, id, startEditId, endEditId)
				//staticBindings.getPropertyChangesDuring(id, propertyCode, startEditId, endEditId, function(changes){
				a.gotPropertyChanges(propertyCode)
				if(pvChanges.length > 0){
					//console.log(startEditId + ',' + endEditId+ ': ' + context.name+'.'+propertyName + ' got pv changes(' + id + '): ' + JSON.stringify(pvChanges))

					return pvChanges
				}else{
					if(pv !== undefined){
						_.assertDefined(pv)

						//console.log(startEditId + ',' + endEditId+ ': ' + context.name+'.'+propertyName + ' got pv: ' + JSON.stringify(pv))
						return [{type: 'set', value: pv, editId: startEditId}]
					}else{
						//console.log(startEditId + ',' + endEditId+ ': ' + context.name+'.'+propertyName + ' nothing: ' + id)
						return []
					}
				}
				//})
				return
			}else if(changes.length > 0){
				_.errout(context.name + ' ' + startEditId + ' TODO(' + id + '): ' + JSON.stringify(changes))
			}

			if(id === undefined){
				//console.log(startEditId + ',' + endEditId+ ': ' + context.name+'.'+propertyName + ' no changes, no id')
				return []
			}

			//s.objectState.getPropertyChangesDuring(id, propertyCode, startEditId, endEditId, function(changes){
			var pvChanges = index.getValueChangesBetween(bindings, id, startEditId, endEditId)	

			//console.log(startEditId + ',' + endEditId+ ': ' + context.name+'.'+propertyName + ' got pv changes*(' + id + '): ' + JSON.stringify(pvChanges))
			
			return pvChanges
		},
		getHistoricalBetween: function(bindings, startEditId, endEditId){
			//console.log('here')
			if(startEditId === -1 || startEditId === 0){
				var changes = context.getHistoricalBetween(bindings, startEditId, endEditId)//, function(changes){
					//console.log('computing property-single historical changes with context: ' + JSON.stringify(changes))
				if(changes.length === 1){
					//_.errout('TODO: ' + JSON.stringify(changes))
					var c = changes[0]
					var id = c.value
					_.assertEqual(c.type, 'set')
					//getProperty(bindings, id, c.editId, function(startPv){
					var startPv = index.getValueAt(bindings,id, c.editId)
					var allChanges = []
					if(startPv !== undefined){
						if(_.isArray(startPv)) _.errout('error, not a single value: ' + JSON.stringify(startPv))
						allChanges.push({type: 'set', value: startPv, editId: c.editId})
					}
					//s.objectState
					//staticBindings.getHistoricalPropertyChangesDuring(id, propertyCode, c.editId, endEditId, function(propertyChanges){
					var propertyChanges = index.getValueChangesBetween(bindings, id, c.editId, endEditId)
					//_.errout('TODO: ' + JSON.stringify([startPv, propertyChanges]))
					allChanges = allChanges.concat(propertyChanges)
					//console.log('here: ' + JSON.stringify([startEditId, endEditId, changes, startPv, propertyChanges, allChanges]))
					return allChanges//cb(allChanges)
					//})
					//})						
				}else{
				
					//context.getStateAt(bindings, startEditId, function(firstId){
					var firstId = context.getAt(bindings, startEditId)//, function(firstId){
						var allEditIds = [firstId]
					var has = {}
					has[firstId] = true
					
					var allResults = []
					
					
					
					changes.forEach(function(c, i){
						var nextEditId = i+1<changes.length?changes[i+1]:endEditId
						if(c.type === 'set'){
							//_.assertDefined(c.old)
							if(c.old !== undefined){
								//getProperty(bindings, c.old, c.editId, rest)
								rest(index.getValueAt(bindings,c.old, c.editId))
							}else{
								rest(undefined)
							}
							
							function rest(oldValue){
								//getProperty(bindings, c.value, c.editId, function(newValue){
								var newValue = index.getValueAt(bindings,c.value, c.editId)

								//staticBindings.getHistoricalPropertyChangesDuring(c.value, propertyCode, c.editId, nextEditId, function(propertyChanges){
								var propertyChanges = index.getValueChangesBetween(bindings, c.value, c.editId, nextEditId)
									//_.errout('tODO diff: ' + JSON.stringify([oldValue, newValue]))
								var es = wsPc.diffFinder(oldValue, newValue)
								//var res = []
								es.forEach(function(e){
									e.editId = c.editId
									//res.push(e)
								})
							
								allResults[i] = es.concat(propertyChanges)
								//cdl()
								//})
								//})
							}
						}else if(c.type === 'clear'){
							if(c.old === undefined) _.errout('missing clear in edit from: ' + context.name)
							_.assertDefined(c.old)
							var oldValue = index.getValueAt(bindings,c.old, c.editId)
							var es = wsPc.diffFinder(oldValue, undefined)
							es.forEach(function(e){
								e.editId = c.editId
							})
							allResults[i] = es
						}else{
							_.errout('tODO: ' + JSON.stringify(c))
						}
					})
					
					//var cdl = _.latch(changes.length, function(){
					var results = []
					for(var i=0;i<allResults.length;++i){
						results = results.concat(allResults[i])
					}
					return results//cb(results)
					//})
					//})
					
					//console.log('*falling back to slow single.single getHistoricalChangesBetween: ' + JSON.stringify(changes))
					//genericGetHistoricalChangesBetween(bindings, startEditId, endEditId, cb)
				}
				//})
				return
			}else{
				var changes = context.getHistoricalBetween(bindings, startEditId, endEditId)
				if(changes.length === 0){
					//cb([])
					var id = context.getAt(bindings, startEditId)
						//s.objectState.
						/*staticBindings.getHistoricalPropertyChangesDuring(id, propertyCode, startEditId, endEditId, function(propertyChanges){
							//console.log('for ' + id + ' got changes: ' + JSON.stringify(propertyChanges))
							cb(propertyChanges)
						})
					})*/
					var pvChanges = index.getValueChangesBetween(bindings, id, startEditId, endEditId)	
					return pvChanges
				}else{
					console.log('falling back to slow single.single getHistoricalChangesBetween: ' + JSON.stringify([startEditId, endEditId]))
					return genericGetHistoricalChangesBetween(bindings, startEditId, endEditId)
				}
			}
		}
	}
	
	var genericGetHistoricalChangesBetween = wu.makeGenericHistoricalChangesBetweenSync(handle, ws, context, index)
	
	return handle
}

function wrapSetSingleProperty(s, propertyName, propertyType, contextType, context, ws, staticBindings){
	var objSchema = s.schema[contextType.members.object]
	var propertyCode = objSchema.properties[propertyName].code
	var a = analytics.make('property-set-sync['+propertyName+']('+context.name+')', [context])

	//var getProperty = staticBindings.makeGetPropertyAt(objSchema.code, propertyCode)
	var index = staticBindings.makePropertyIndex(objSchema, objSchema.propertiesByCode[propertyCode])

	var handle = {
		name: 'property-set-sync',
		analytics: a,
		getAt: function(bindings, editId){
			if(editId === -1){
				return []
			}
			var state = context.getBetween(bindings, -1, editId)//, function(state){
			var all = []
			var has = {}
			//var cdl = _.latch(state.length, function(){
			//	cb(all)
			//})
			state.forEach(function(e){
				var id = e.value
				//getProperty(bindings, id, editId, function(propertyValue){
				var propertyValue = index.getValueAt(bindings,id, editId)
				a.gotProperty(propertyCode)
				_.assertPrimitive(propertyValue)
				if(propertyValue !== undefined){
					if(!has[propertyValue]){
						has[propertyValue] = true
						all.push(propertyValue)
					}
				}					
				//cdl()
				//})
			})
			return all
			//})
		},
		getStateCountsAt: function(bindings, editId){
			_.errout('TODO')
			/*context.getChangesBetween(bindings, -1, editId, function(state){
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
			})*/
		}
	}
	
	if(propertyType.type === 'object' || propertyType.type === 'primitive' || propertyType.type === 'view'){
		handle.getBetween = makeGenericEditsBetween(handle, ws)
		
		var genericGetHistoricalChangesBetween = wu.makeGenericHistoricalChangesBetweenSync(handle, ws, context, index)
		handle.getHistoricalBetween = genericGetHistoricalChangesBetween
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
	var a = analytics.make('property-set-set-sync['+propertyName+']('+context.name+')', [context])

	//var getProperty = s.facade.makeGetPropertyAt(objSchema.code, propertyCode)
	var index = staticBindings.makePropertyIndex(objSchema, objSchema.propertiesByCode[propertyCode])
	
	//var getChang = s.objectState.makeGetPropertyAt(objSchema.code, propertyCode)
	//function getChanges(id, startEditId, endEditId, cb){
	//	staticBindings.getPropertyChangesDuring(id, propertyCode, startEditId, endEditId, cb)
	//}

	var handle = {
		name: 'property-set-set-sync',
		analytics: a,
		getAt: function(bindings, editId){
			if(!_.isFunction(context.getAt)) _.errout('missing getAt: ' + context.name)
		
			var state = context.getAt(bindings, editId)//, function(state){
			var has = {}
			var result = []
			//var cdl = _.latch(state.length, function(){
			//	cb(result)
			//})
			state.forEach(function(id){
				//getProperty(bindings, id, editId, function(propertyValue){
				var propertyValue = index.getValueAt(bindings,id, editId)
				_.assertArray(propertyValue)
				a.gotProperty(propertyCode)
				for(var i=0;i<propertyValue.length;++i){
					var value = propertyValue[i]
					if(has[value]) continue
					has[value] = true
					result.push(value)
				}
				//cdl()
				//})
			})
			return result
			//})
		},
		getStateCountsAt: function(bindings, editId){
			_.errout('TODO')
			/*context.getChangesBetween(bindings, -1, editId, function(state){
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
			})*/
		},
		getHistoricalBetween: function(bindings, startEditId, endEditId){
			if(startEditId === -1){
				var changes = context.getHistoricalBetween(bindings, startEditId, endEditId)//, function(changes){
				if(changes.length === 0){
					return []
				}else if(changes.length === 1 && startEditId === -1){
					_.assertEqual(changes[0].type, 'add')
					var singleAdded = changes[0].value
					var singleEditId = changes[0].editId

					//getChanges(singleAdded, startEditId, endEditId, function(pcs){
					var pcs = index.getValueChangesBetween(bindings, singleAdded, startEditId, endEditId)
					var startValue = []
					var after = []
					for(var i=0;i<pcs.length;++i){
						var c = pcs[i]
						if(c.editId <= singleEditId){
							if(c.type === 'add'){
								startValue.push(c.value)
							}else if(c.type === 'remove'){
								var valueIndex = startValue.indexOf(c.value)
								if(valueIndex !== -1){
									startValue.splice(valueIndex, 1)
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
					//cb(all)
					return all
					//})
				}else if(changes[changes.length-1].editId === 0){

					var allChanges = []
										
					
					console.log(JSON.stringify(changes) + ' ' + context.name)
					changes.forEach(function(c){
						_.assertEqual(c.type, 'add')
						//getProperty(bindings, c.value, c.editId, function(startPv){
						var startPv = index.getValueAt(bindings,c.value, c.editId)
						startPv.forEach(function(v){
							allChanges.push({type: 'add', value: v, editId: 0})
						})
						//staticBindings.getHistoricalPropertyChangesDuring(c.value, propertyCode, c.editId, endEditId, function(propertyChanges){
						var propertyChanges = index.getValueChangesBetween(c.value, c.editId, endEditId)
						allChanges = allChanges.concat(propertyChanges)
						//	cdl()
						//})
						//})		
					})
						
					//var cdl = _.latch(changes.length, function(){
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
					//cb(result)
					return result
					//})			
				}else{
					console.log('*falling back to slow set.set getHistoricalChangesBetween: ' + JSON.stringify(changes))
					return genericGetHistoricalChangesBetween(bindings, startEditId, endEditId)
				}
			}
			console.log('falling back to slow set.set getHistoricalChangesBetween')
			return genericGetHistoricalChangesBetween(bindings, startEditId, endEditId)
		}
	}

	handle.getBetween = makeGenericEditsBetween(handle, ws)
	
	//handle.getHistoricalChangesBetween = makeSetSetHistoricalChangesBetween(handle, ws, context, getProperty, getChanges)
	var genericGetHistoricalBetween = wu.makeGenericHistoricalChangesBetweenSync(handle, ws, context, index)
	//handle.getHistoricalChangesBetween = genericGetHistoricalChangesBetween
	
	return handle
}
/*
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

*/

function wrapSingleSetProperty(s, propertyName, propertyType, contextType, context, ws, staticBindings){
	var objSchema = s.schema[contextType.object]
	var propertyCode = objSchema.properties[propertyName].code
	var nameStr = 'property-single-set-sync['+propertyName+']('+context.name+')'
	var a = analytics.make(nameStr, [context])

	//var getProperty = staticBindings.makeGetPropertyAt(objSchema.code, propertyCode)
	var index = staticBindings.makePropertyIndex(objSchema, objSchema.propertiesByCode[propertyCode])

	var handle = {
		name: nameStr,
		analytics: a,
		getAt: function(bindings, editId){
			if(!_.isFunction(context.getAt)) _.errout('missing getAt: ' + context.name)
		
			var id = context.getAt(bindings, editId)//, function(id){
			if(_.isArray(id)) _.errout('not a single: ' + JSON.stringify(id) + ' ' + nameStr)
			if(id === undefined){
				return []
			}
			if(id == undefined){
				_.errout('invalid null value instead of undefined')
			}

			//getProperty(bindings, id, editId, function(propertyValue){
			var propertyValue = index.getValueAt(bindings,id, editId)

			a.gotProperty(propertyCode)
			//console.log(editId + ' got* property value ' + id + '.' + propertyName+': ' + JSON.stringify(propertyValue))
			
			_.assertArray(propertyValue)
			return propertyValue//cb(propertyValue)
			//})
			//})
		}
	}

	handle.getBetween = function(bindings, startEditId, endEditId){
		var id = context.getAt(bindings, startEditId)
		var endId = context.getAt(bindings, endEditId)
		if(id !== endId){
			if(id === undefined){
				//s.objectState.
				//staticBindings.getPropertyChangesDuring(endId, propertyCode, -1, endEditId, function(changes){
				var changes = index.getValueChangesBetween(bindings, endId, -1, endEditId)
				a.gotPropertyChanges(propertyCode)
				return changes//cb(changes)
				//})
			}else{
				_.errout('TODO ' + id + ' ' + endId)
			}
		}else{
			if(id === undefined){
				return []
			}else{
				//s.objectState.
				/*staticBindings.getPropertyChangesDuring(endId, propertyCode, startEditId, endEditId, function(changes){
					a.gotPropertyChanges(propertyCode)
					cb(changes)
				})*/
				var changes = index.getValueChangesBetween(bindings, endId, startEditId, endEditId)
				return changes
			}
		}
		//})
		//})
	}

	handle.getHistoricalBetween = function(bindings, startEditId, endEditId){
		if(startEditId === -1){
			var changes = context.getHistoricalBetween(bindings, startEditId, endEditId)//, function(changes){
			if(changes.length === 0){
				return []
			}else if(changes.length === 1){
				//console.log('^^')
				var c = changes[0]
				var id = c.value
				_.assertEqual(c.type, 'set')
				//getProperty(bindings, id, c.editId, function(startPv){
				var startPv = index.getValueAt(bindings,id, c.editId)
				var allChanges = []
				_.assertArray(startPv)
				
				startPv.forEach(function(v){
					allChanges.push({type: 'add', value: v, editId: c.editId})
				})

				//staticBindings.getHistoricalPropertyChangesDuring(id, propertyCode, c.editId, endEditId, function(propertyChanges){
				var propertyChanges = index.getValueChangesBetween(bindings, id, c.editId, endEditId)
					//_.errout('TODO: ' + JSON.stringify([startPv, propertyChanges]))
				allChanges = allChanges.concat(propertyChanges)
				//console.log(JSON.stringify([startEditId, endEditId, changes, startPv, propertyChanges]))
				//console.log('^^-')
				return allChanges//cb(allChanges)
				//})
				//})		
			}else if(startEditId === -1){
			//	console.log('^^%')
				
				var allChanges = {}
				var allStates = {}
				var alreadyGetting = {}
				
				
				
				changes.forEach(function(c, i){
					//var nextEditId = index+1 < changes.length? changes[index+1].editId : endEditId
					if(c.type === 'set'){
						if(alreadyGetting[c.value]){
							return
						}
						alreadyGetting[c.value] = true
						//getProperty(bindings, c.value, c.editId, function(pv){
						var pv = index.getValueAt(bindings,c.value, c.editId)
						allStates[c.value+':'+c.editId] = pv
						//staticBindings.getHistoricalPropertyChangesDuring(c.value, propertyCode, c.editId, endEditId, function(propertyChanges){
						var propertyChanges = index.getValueChangesBetween(bindings, c.value, c.editId, endEditId)
						allChanges[c.value] = propertyChanges
							//cdl()
						//})
						//})
					}else if(c.type === 'clear'){
						//cdl()
					}else{
						_.errout('TODO: ' + JSON.stringify(c))
					}
				})
				
				//var cdl = _.latch(changes.length, function(){
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
				//cb(resultChanges)
				return resultChanges
				//})
			}else{
				console.log('*falling back to slow single.set getHistoricalChangesBetween: ' + JSON.stringify(changes))
				return genericGetHistoricalChangesBetween(bindings, startEditId, endEditId)
			}
			//})
			//return
		}
		console.log('falling back to slow single.set getHistoricalChangesBetween')
		return genericGetHistoricalChangesBetween(bindings, startEditId, endEditId)
	}
	
	var genericGetHistoricalChangesBetween = wu.makeGenericHistoricalChangesBetweenSync(handle, ws, context, index)
	
	return handle
}

function wrapSingleMapProperty(s, propertyName, propertyType, contextType, context, ws, staticBindings){
	var objSchema = s.schema[contextType.object]
	var propertyCode = objSchema.properties[propertyName].code
	var nameStr = 'property-single-map-sync['+propertyName+']('+context.name+')'
	var a = analytics.make(nameStr, [context])

	//var getProperty = staticBindings.makeGetPropertyAt(objSchema.code, propertyCode)//s.objectState.makeGetPropertyAt(objSchema.code, propertyCode)
	var index = staticBindings.makePropertyIndex(objSchema, objSchema.propertiesByCode[propertyCode])

	var handle = {
		name: nameStr,
		analytics: a,
		getAt: function(bindings, editId){
			if(!_.isFunction(context.getAt)) _.errout('missing getAt: ' + context.name)
		
			var id = context.getAt(bindings, editId)//, function(id){
			if(id === undefined){
				//cb([])
				//return
				return []
			}

			//s.objectState.getPropertyValueAt(id, propertyCode, editId, function(propertyValue){
			//getProperty(bindings, id, editId, function(propertyValue){
			var propertyValue = index.getValueAt(bindings,id, editId)
				//console.log(editId + ' got property value ' + id + '.' + propertyCode+': ' + propertyValue)
			a.gotProperty(propertyCode)
			_.assertObject(propertyValue)
			//cb(propertyValue)
			return propertyValue
			//})
			//})
		}
	}

	handle.getChangesBetween = makeGenericEditsBetween(handle, ws)
	handle.getHistoricalChangesBetween = wu.makeGenericHistoricalChangesBetweenSync(handle, ws, context, index)

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
	var a = analytics.make('property-set-map-sync['+propertyName+']('+context.name+')', [context])
	
	//var getProperty = staticBindings.makeGetPropertyAt(objSchema.code, propertyCode)
	var index = staticBindings.makePropertyIndex(objSchema, objSchema.propertiesByCode[propertyCode])
	
	var handle = {
		name: 'property-set-map-sync',
		analytics: a,
		getAt: function(bindings, editId){
			if(!_.isFunction(context.getAt)) _.errout('missing getAt: ' + context.name)
		
			var state = context.getAt(bindings, editId)//, function(state){
			if(state === undefined){
				//cb({})
				//return
				return {}
			}
			
			var result = {}

			state.forEach(function(id){
				//s.objectState.getPropertyValueAt(id, propertyCode, editId, function(propertyValue){
				//getProperty(bindings, id, editId, function(propertyValue){
				var propertyValue = index.getValueAt(bindings,id, editId)
				a.gotProperty(propertyCode)
				//console.log(editId + ' got property value ' + id + '.' + propertyCode+': ' + propertyValue)
				_.assertObject(propertyValue)
				
				Object.keys(propertyValue).forEach(function(key){
					result[key] = propertyValue[key]
				})
				//cdl()
				//})
			})
			return result
			//var cdl = _.latch(state.length, function(){
			//	cb(result)
			//})
			//})
		}
	}

	handle.getChangesBetween = makeGenericEditsBetween(handle, ws)
	handle.getHistoricalChangesBetween = wu.makeGenericHistoricalChangesBetweenSync(handle, ws, context, index)

	return handle
}

function makeGenericEditsBetween(handle, ws){
	function genericChangesBetween(bindings, startEditId, endEditId){
		
		var startState = handle.getAt(bindings, startEditId)
		var state = handle.getAt(bindings, endEditId)
		var es = ws.diffFinder(startState, state)
		var changes = []
		es.forEach(function(e){
			e.editId = endEditId
			changes.push(e)
		})
		return changes
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

exports.wrapPropertySync = wrapProperty
