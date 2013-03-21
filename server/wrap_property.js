"use strict";

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
	
	var a = analytics.make('property-single['+propertyName+']('+context.name+')', [context])
	var handle = {
		name: nameStr,
		analytics: a,
		getStateAt: function(bindings, editId, cb){
			context.getStateAt(bindings, editId, function(id){
				if(id !== undefined){
					s.objectState.getPropertyValueAt(id,propertyCode, editId, function(pv){
						a.gotProperty(propertyName)
						//console.log(id+'.'+propertyCode+' is ' + pv + ' at ' + editId)
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
						s.objectState.getPropertyValueAt(id, propertyCode, startEditId, function(pv){
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
		getHistoricalChangesBetween: function(){
			_.errout('TODO')
		}
	}
	
	return handle
}

function wrapSetSingleProperty(s, propertyName, propertyType, contextType, context, ws){
	var objSchema = s.schema[contextType.members.object]
	var propertyCode = objSchema.properties[propertyName].code
	var a = analytics.make('property-set['+propertyName+']('+context.name+')', [context])
	var handle = {
		name: 'property-set',
		analytics: a,
		getStateAt: function(bindings, editId, cb){
		
			context.getChangesBetween(bindings, -1, editId, function(state){
				var all = []
				var cdl = _.latch(state.length, function(){
					all.sort(function(a,b){return a.editId - b.editId;})
					var has = {}
					var result = []
					all.forEach(function(value){
						if(has[value]) return
						has[value] = true
						_.assertDefined(value)
						result.push(value)
					})
					cb(result)
				})
				state.forEach(function(e){
					//_.assertEqual(e.op, editCodes.addExisting)
					var id = e.value//e.edit.id
					//console.log('getting property value: ' + id + '.' + propertyCode)
					s.objectState.getPropertyValueAt(id, propertyCode, editId, function(propertyValue){
						a.gotProperty(propertyName)
						_.assertPrimitive(propertyValue)
						if(propertyValue !== undefined){
							all.push(propertyValue)
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
	var handle = {
		name: 'property-set-set',
		analytics: a,
		getStateAt: function(bindings, editId, cb){
			if(!_.isFunction(context.getStateAt)) _.errout('missing getStateAt: ' + context.name)
		
			context.getStateAt(bindings, editId, function(state){
				var all = []
				var has = {}
				var result = []
				var cdl = _.latch(state.length, function(){
					//all.sort(function(a,b){return a.editId - b.editId;})
					//all.forEach(function(value){
					//	_.assertDefined(value)
					//	result.push(value)
					//})
					//console.log('result: ' + JSON.stringify(result))
					cb(result)
				})
				state.forEach(function(id){
					s.objectState.getPropertyValueAt(id, propertyCode, editId, function(propertyValue){
						_.assertArray(propertyValue)
						a.gotProperty(propertyName)
					//	console.log('got: ' + id + ' ' + JSON.stringify(propertyValue) + ' ' + propertyName)
						for(var i=0;i<propertyValue.length;++i){
							var value = propertyValue[i]
							if(has[value]) continue
							has[value] = true
							result.push(value)
						}
						//all = all.concat(propertyValue)
						cdl()
					})
				})
			})
		}
	}

	handle.getChangesBetween = makeGenericEditsBetween(handle, ws)
	
	handle.getHistoricalChangesBetween = function(){
		_.errout('TODO')
	}
	
	return handle
}


function wrapSingleSetProperty(s, propertyName, propertyType, contextType, context, ws){
	var objSchema = s.schema[contextType.object]
	var propertyCode = objSchema.properties[propertyName].code
	var nameStr = 'property-single-set['+propertyName+']('+context.name+')'
	var a = analytics.make(nameStr, [context])
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

				s.objectState.getPropertyValueAt(id, propertyCode, editId, function(propertyValue){
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

	handle.getHistoricalChangesBetween = function(bindings, startEditId, endEditId, cb){
	}
	
	return handle
}

function wrapSingleMapProperty(s, propertyName, propertyType, contextType, context, ws){
	var objSchema = s.schema[contextType.object]
	var propertyCode = objSchema.properties[propertyName].code
	var nameStr = 'property-single-map['+propertyName+']('+context.name+')'
	var a = analytics.make(nameStr, [context])
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

				s.objectState.getPropertyValueAt(id, propertyCode, editId, function(propertyValue){
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
					s.objectState.getPropertyValueAt(id, propertyCode, editId, function(propertyValue){
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
	
	handle.getHistoricalChangesBetween = function(bindings, startEditId, endEditId, cb){
		_.errout('TODO')
	}

	return handle
}

function stubGetInclusionsDuring(bindings, lastEditId, endEditId, cb){
	cb([])
}

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
}


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
