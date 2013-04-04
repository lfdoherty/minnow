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
	
	//console.log(JSON.stringify(rel.params[0], null, 2))
	_.assertEqual(rel.params[0].schemaType.value.type, 'set')
	var vws = wu.makeUtilities(rel.params[0].schemaType.value)
	
	var handle = {
		name: 'map-value-optimization',
		analytics: a,
		getStateAt: function(bindings, editId, cb){
			param.getStateAt(bindings, editId, function(paramValue){
				multimap.getValueStateAt(paramValue, bindings, editId, function(values){
					//console.log('values: ' + JSON.stringify(values))
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
					/*if(changes.length === 1 && changes[0].editId === 0){
					
						param.getStateAt(bindings, 0, function(paramValue){
							console.log('paramValue: ' + JSON.stringify(paramValue) + ' ' + JSON.stringify(changes))
							multimap.getValueChangesBetween(paramValue, bindings, startEditId, endEditId, function(changes){
								cb(changes)
							})
						})
					}else if(changes.length === 1){
						param.getStateAt(bindings, startEditId, function(paramValue){
							var c = changes[0]
							_.assertEqual(c.type, 'set')
							//var changedTo = changes[0].value
							
							multimap.getValueChangesBetween(paramValue, bindings, startEditId, c.editId, function(beforeChanges){
								multimap.getValueStateAt(paramValue, bindings, c.editId, function(aState){
									multimap.getValueStateAt(c.value, bindings, c.editId, function(bState){
										var switchChanges = vws.diffFinder(aState, bState)
										multimap.getValueChangesBetween(c.value, bindings, c.editId, endEditId, function(afterChanges){
											var all = beforeChanges.concat(switchChanges).concat(afterChanges)
											console.log('computed: ' + JSON.stringify(all))
											cb(all)
										})
									})
								})
							})
						})
					}else{*/
						param.getStateAt(bindings, startEditId, function(paramValue){
							var paramStates = [paramValue]
							var betweenChanges = []
							var cdl = _.latch(changes.length*2+1, function(){
								var result = []
								paramStates.slice(1).forEach(function(ps, index){
									var beforeState = paramStates[index]
									var switchChanges = vws.diffFinder(beforeState, ps)
									result = result.concat(betweenChanges[index])
									result = result.concat(switchChanges)
								})
								result = result.concat(betweenChanges[betweenChanges.length-1])
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
					//}
				}else{
					param.getStateAt(bindings, startEditId, function(paramValue){
						multimap.getValueChangesBetween(paramValue, bindings, startEditId, endEditId, function(changes){
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

