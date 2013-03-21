"use strict";

var _ = require('underscorem')
var wraputil = require('./../wraputil')

var analytics = require('./../analytics')

var editFp = require('./../tcp_shared').editFp
var editCodes = editFp.codes
var editNames = editFp.names

exports.make = function(s, rel, recurse, handle, ws){
	var keyExpr = rel.params[1].expr
	var valueExpr = rel.params[2].expr

	if(
		keyExpr.type === 'param' && 
		rel.params[1].implicits[0] === keyExpr.name &&
		valueExpr.type === 'view' && valueExpr.view === 'property' &&
		valueExpr.params[1].type === 'param' &&
		rel.params[2].implicits[0] === valueExpr.params[1].name){
	}else{
		return handle
	}
	
	//_.errout('TODO')
	var objSchema = s.schema[rel.params[0].schemaType.members.object]
	_.assertObject(objSchema)
	var propertyName = valueExpr.params[0].value
	
	var getPropertyValueAt

	var inputSet = recurse(rel.params[0])

	var nameStr = 'map-optimization('+inputSet.name+',{'+recurse(keyExpr).name+'},{'+recurse(valueExpr).name+'})'

	var a = analytics.make(nameStr, [inputSet])


	if(propertyName === 'uuid'){
		getPropertyValueAt = function(id, editId, cb){
			a.gotProperty('uuid')
			var uuid = s.objectState.getUuid(id)
			//console.log('got uuid: ' + id + '->'+uuid)
			cb(uuid, id)
		}
	}else{
		//console.log(objSchema.name + '.' + propertyName)
		var prop = objSchema.properties[propertyName]
		_.assertObject(prop)
		var propertyCode = prop.code

	
	
		var propertyWs = wraputil.makeUtilities(prop.type)
		var defaultState = propertyWs.defaultState
		
		var gpv = s.objectState.getPropertyValueAt
		getPropertyValueAt = function(id, editId, cb){
			a.gotProperty(propertyName)
			//console.log('get property value at')
			gpv(id, propertyCode, editId, cb)
		}
	}	


	var newHandle = {
		name: nameStr,
		analytics: a,
		getStateAt: function(bindings, editId, cb){
			
			inputSet.getStateAt(bindings, editId, function(state){
			
				var result = {}
				var cdl = _.latch(state.length, function(){
					cb(result)
				})
				for(var i=0;i<state.length;++i){
					getPropertyValueAt(state[i], editId, function(pv, id){
						//_.assertInt(id)
						_.assertDefined(id)
						result[id] = pv
						//console.log('here: ' + nameStr)
						//console.log('got at ' + editId + ' ' + id+'->'+JSON.stringify(pv))
						cdl()
					})
				}
			})
		},
		getPartialStateAt: function(bindings, editId, keySet, cb){//gets the map for the given keys
			//_.errout('TODO')
			
			var results = {}
			
			var cdl = _.latch(keySet.length, function(){
				cb(results)
			})

			inputSet.getStateAt(bindings, editId, function(state){//TODO optimize, keeping in mind preforked-style issues
				var has = {}
				for(var i=0;i<keySet.length;++i){
					has[keySet[i]] = true
				}					
				for(var i=0;i<state.length;++i){
					var id = state[i]//keySet[i]
					if(has[id]){
						getPropertyValueAt(id, editId, function(pv, id){
							//_.errout('TODO')
							//console.log('got at ' + editId + ' ' + id+'->'+JSON.stringify(pv))
							results[id] = pv
							cdl()
						})
					}
				}
			})
		},
		getChangesBetween: function(bindings, startEditId, endEditId, cb){
			//_.errout('TODO')
			inputSet.getChangesBetween(bindings, startEditId, endEditId, function(changes){
				var newIds = []
				var isNewId = {}
				for(var i=0;i<changes.length;++i){
					var c = changes[i]
					_.assertEqual(c.type, 'add')
					newIds.push(c.value)
					isNewId[c.value] = true
				}
				
				var changesToMap = []
				inputSet.getMayHaveChanged(bindings, startEditId, endEditId, function(ids){
					//console.log('may have changed: ' + JSON.stringify(ids))
				
					var cdl = _.latch(newIds.length, function(){

						var cdl = _.latch(ids.length, function(){
							cb(changesToMap)
						})
						
						for(var i=0;i<ids.length;++i){
							var id = ids[i]
							if(isNewId[id]){
								cdl()
								continue
							}
							getPropertyValueAt(id, startEditId, function(startPv){
								getPropertyValueAt(id, endEditId, function(endPv, id){
									if(startPv !== endPv){
										console.log('changed: ' + JSON.stringify([startPv, endPv, id]))
										changesToMap.push({
											type: 'put', 
											value: endPv,
											state: {key: id, keyOp: editCodes.selectObjectKey}, 
											editId: endEditId})
									}
									cdl()
								})
							})
						}
					})
					
					for(var i=0;i<newIds.length;++i){
						getPropertyValueAt(newIds[i], endEditId, function(pv, id){
							changesToMap.push({
								type: 'put', 
								value: pv,
								state: {key: id, keyOp: editCodes.selectObjectKey}, 
								editId: endEditId})
							cdl()
						})
					}
				})
			})
		}
	}
	
	return newHandle
}
