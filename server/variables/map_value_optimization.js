"use strict";

var _ = require('underscorem')
var u = require('./optimization_util')
var schema = require('./../../shared/schema')
var analytics = require('./../analytics')
var wu = require('./../wraputil')

/*

This is an optimization for mapValue(multimap_optimization, param)
*/

exports.make = function(s, rel, recurse, handle, ws){
	
	var multimap = recurse(rel.params[0])
	var param = recurse(rel.params[1])
	_.assertDefined(multimap)
	_.assertDefined(param)
	var a = analytics.make('map-value-optimization', [multimap, param])
	
	if(!multimap.getValueChangesBetween){
		_.errout('missing multimap.getValueChangesBetween: ' + multimap.name)
	}
	//console.log(JSON.stringify(rel.params[0], null, 2))
	_.assertEqual(rel.params[0].schemaType.value.type, 'set')
	var vws = wu.makeUtilities(rel.params[0].schemaType.value)
	
	var handle = {
		name: 'map-value-optimization',
		analytics: a,
		getStateAt: function(bindings, editId, cb){
			param.getStateAt(bindings, editId, function(paramValue){
				multimap.getValueStateAt(paramValue, bindings, editId, function(values){
				//	console.log('values: ' + JSON.stringify([paramValue, values]))
					cb(values)
				})
			})
		},
		/*getStateSync: function(bindingValues){
			console.log(JSON.stringify(rel, null, 2))
			_.errout('TODO: ' + JSON.stringify(bindingValues))
		},*/
		getChangesBetween: function(bindings, startEditId, endEditId, cb){
			param.getHistoricalChangesBetween(bindings, startEditId, endEditId, function(changes){
				if(changes.length > 0){
					//console.log('dddd')
					param.getStateAt(bindings, startEditId, function(paramValue){
						var paramStates = [paramValue]
						var betweenChanges = []
						var cdl = _.latch(changes.length*2+1, function(){
							var result = []
							paramStates.slice(1).forEach(function(ps, index){
								var beforeState = paramStates[index]
								var switchChanges = vws.diffFinder(beforeState, ps)
								switchChanges.forEach(function(c){
									c.editId = startEditId+index
								})
								result = result.concat(betweenChanges[index])
								result = result.concat(switchChanges)
							})
							result = result.concat(betweenChanges[betweenChanges.length-1])
							//console.log('-dddd')
							cb(result)
						})
						multimap.getValueChangesBetween(paramValue, bindings, startEditId, changes[0].editId, function(beforeChanges){
							betweenChanges[0] = beforeChanges
							cdl()
						})
						
						changes.forEach(function(c, index){
							//_.assertEqual(c.type, 'set')
							if(c.type === 'set'){
								var pv = c.value
								multimap.getValueStateAt(pv, bindings, c.editId, function(state){
									paramStates[index+1] = state
									cdl()
								})
								var nextEditId = index+1<changes.length?changes[index+1].editId:endEditId
								multimap.getValueChangesBetween(pv, bindings, c.editId, nextEditId, function(changes){
									betweenChanges[index+1] = changes
									cdl()
								})
							}else if(c.type === 'clear'){
								paramStates[index+1] = undefined
								betweenChanges[index+1] = []
								cdl()
								cdl()
							}else{
								_.errout('TODO: ' + JSON.stringify(c))
							}
						})
					})
				}else{
					//console.log('+d')
					param.getStateAt(bindings, startEditId, function(paramValue){
						multimap.getValueChangesBetween(paramValue, bindings, startEditId, endEditId, function(changes){
							//console.log('-d')
							cb(changes)
						})
					})
				}
			})
		},
		
	}
	handle.getHistoricalChangesBetween = handle.getChangesBetween
	return handle
}


exports.makeSync = function(s, rel, recurseSync, handle, ws){
	
	var multimap = recurseSync(rel.params[0])
	var param = recurseSync(rel.params[1])

	if(!param.getAt) _.errout('missing getAt: ' + param.name)
	
	_.assertDefined(multimap)
	_.assertDefined(param)
	var a = analytics.make('map-value-optimization', [multimap, param])
	
	_.errout('here')
	
	if(!multimap.getValueAt) _.errout('missing getValueAt: ' + multimap.name)
	//console.log(JSON.stringify(rel.params[0], null, 2))
	_.assertEqual(rel.params[0].schemaType.value.type, 'set')
	var vws = wu.makeUtilities(rel.params[0].schemaType.value)
	
	var paramIsBoolean = rel.params[1].schemaType.primitive === 'boolean'
	
	var handle = {
		name: 'map-value-optimization-sync',
		analytics: a,
		getAt: function(bindings, editId){
			var paramValue = param.getAt(bindings, editId)
			//if(paramValue == null){
				//console.log('why null: ' + param.name)
			//}
			var values = multimap.getValueAt(paramValue, bindings, editId)
			//if(values.length === 0){
				console.log(editId +' got at: ' + JSON.stringify([paramValue, values, rel.params[1]]))
			//	console.log(param.name)
			//}
			return values
		},
		getBetween: function(bindings, startEditId, endEditId){
			var choiceChanges = param.getHistoricalBetween(bindings, startEditId, endEditId)
			if(choiceChanges.length > 0){
				//console.log('dddd')
				var paramValue = param.getAt(bindings, startEditId)
				//console.log('paramValue: ' + JSON.stringify(paramValue) + ' ' + param.name)
				var paramStates = [paramValue]
				var betweenChanges = []
				
				var beforeChanges = multimap.getValueBetween(paramValue, bindings, startEditId, choiceChanges[0].editId)
				betweenChanges[0] = beforeChanges
				
				choiceChanges.forEach(function(c, index){
					//_.assertEqual(c.type, 'set')
					if(c.type === 'set'){
						var pv = c.value

						paramStates[index+1] = multimap.getValueAt(pv, bindings, c.editId)

						var nextEditId = index+1<choiceChanges.length?choiceChanges[index+1].editId:endEditId
						var mapChanges = multimap.getValueBetween(pv, bindings, c.editId, nextEditId)
						betweenChanges[index+1] = mapChanges
					}else if(c.type === 'clear'){
						paramStates[index+1] = undefined
						betweenChanges[index+1] = []
					}else{
						_.errout('TODO: ' + JSON.stringify(c))
					}
				})
				
				var result = []
				paramStates.slice(1).forEach(function(ps, index){
					var beforeState = paramStates[index]
					var switchChanges = vws.diffFinder(beforeState, ps)
					switchChanges.forEach(function(c){
						if(c.type === 'remove' && c.value === "undefined") _.errout('invalid changes: ' + JSON.stringify([switchChanges, beforeState, ps,paramStates]))
						c.editId = startEditId+index
					})
					result = result.concat(betweenChanges[index])
					result = result.concat(switchChanges)
				})
				result = result.concat(betweenChanges[betweenChanges.length-1])
				
				//console.log('changes to mapValue: ' + JSON.stringify(result) + ' from '  +JSON.stringify(choiceChanges))
				return result
			}else{
				//console.log('+d')
				//console.log('no changes to mapValue')
				var paramValue = param.getAt(bindings, startEditId)
				var changes = multimap.getValueBetween(paramValue, bindings, startEditId, endEditId)
				return changes
			}
		},
		
	}
	handle.getHistoricalBetween = handle.getBetween
	return handle
}

