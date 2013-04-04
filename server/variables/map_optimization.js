//"use strict";

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

	var nameStr = 'map-optimization('+inputSet.name+')'//,{'+recurse(keyExpr).name+'},{'+recurse(valueExpr).name+'})'

	var a = analytics.make(nameStr, [inputSet])

	var inputGetMayHaveChanged
	if(inputSet.getMayHaveChanged){
		inputGetMayHaveChanged = inputSet.getMayHaveChanged
	}else{
		inputGetMayHaveChanged = inputSet.getStateAt
	}
	
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

		var getProperty = s.objectState.makeGetPropertyAt(objSchema.code, propertyCode)
		
		function getPropertyChangesDuring(id, startEditId, endEditId, cb){
			s.objectState.getPropertyChangesDuring(id, /*objSchema.code, */propertyCode, startEditId, endEditId, cb)
		}
	
		getPropertyValueAt = function(id, editId, cb){
			a.gotProperty(propertyCode)
			getProperty(id, editId, cb)
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

			//optimization, keeping in mind preforked-style issues
			//those being that we need not only the right id, but also the id with whatever
			//overrides to e.g. getPropertyValueAt have been defined by the inputSet expr.
			if(inputSet.getConfiguredIdAt){
			
				for(var i=0;i<keySet.length;++i){
					var id = keySet[i]
					inputSet.getConfiguredIdAt(id, bindings, editId, function(realId){
						getPropertyValueAt(realId, editId, function(pv, id){
							//console.log('got at ' + editId + ' ' + id+'->'+JSON.stringify(pv))
							results[id] = pv
							cdl()
						})
					})
				}
			}else{
				//TODO optimize this case or reduce the number of inputSets that do not have getConfiguredIdAt
				//it should be fairly easy to optimize the no-op when no configuration needs to happen anyway
				inputSet.getStateAt(bindings, editId, function(state){
					var has = {}
					for(var i=0;i<keySet.length;++i){
						has[keySet[i]] = true
						if(has[id]){
							inputSet.getConfiguredIdAt(id, bindings, editId, function(realId){
								getPropertyValueAt(realId, editId, function(pv, id){
									//_.errout('TODO')
									//console.log('got at ' + editId + ' ' + id+'->'+JSON.stringify(pv))
									results[id] = pv
									cdl()
								})
							})
						}
					}
				})
			}
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
				
				inputGetMayHaveChanged(bindings, startEditId, endEditId, function(ids){
					//console.log('may have changed: ' + JSON.stringify(ids))
				
					var cdl = _.latch(newIds.length, function(){

						var cdl = _.latch(ids.length, function(){
							//console.log('**changes: ' + JSON.stringify(changesToMap))
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
										//console.log('changed: ' + JSON.stringify([startPv, endPv, id]))
										if(_.isArray(endPv)){
											var aHas = {}
											var bHas = {}
											startPv.forEach(function(v){aHas[v]=true;})
											endPv.forEach(function(v){bHas[v]=true;})
											var state = {key: id, keyOp: editCodes.selectObjectKey}
											startPv.forEach(function(v){
												if(!bHas[v]) changesToMap.push({type: 'putRemove', value: v, state: state, editId: endEditId})
											})
											endPv.forEach(function(v){
												if(!aHas[v]) changesToMap.push({type: 'putAdd', value: v, state: state, editId: endEditId})
											})
	
										}else{
											_.assertPrimitive(endPv)
											changesToMap.push({
												type: 'put', 
												value: endPv,
												state: {key: id, keyOp: editCodes.selectObjectKey}, 
												editId: endEditId})
										}
									}
									cdl()
								})
							})
						}
					})
					
					for(var i=0;i<newIds.length;++i){
						getPropertyValueAt(newIds[i], endEditId, function(pv, id){
							//if(!_.isPrimitive(pv)) _.errout('not primitive: ' + JSON.stringify(pv))//_.assertPrimitive(pv)
							if(_.isArray(pv)){
								pv.forEach(function(v){
									changesToMap.push({type: 'putAdd', value: v, state: {key: id}, editId: endEditId})
								})
							}else{
								changesToMap.push({
									type: 'put', 
									value: pv,
									state: {key: id}, 
									editId: endEditId})
							}
							cdl()
						})
					}
				})
			})
		},
		getHistoricalChangesBetween: function(bindings, startEditId, endEditId, cb){
			inputSet.getChangesBetween(bindings, startEditId, endEditId, function(changes){
				var newIds = []
				var isNewId = {}
				var newIdEditIds = []
				for(var i=0;i<changes.length;++i){
					var c = changes[i]
					_.assertEqual(c.type, 'add')
					newIds.push(c.value)
					newIdEditIds.push(c.editId)
					isNewId[c.value] = true
				}
				
				var changesToMap = []
				
				//console.log('map inputSet changes: ' + JSON.stringify(changes))
				
				function applyChanges(id, propertyChanges){
					//console.log('applying changes: ' + id + ' ' + JSON.stringify(propertyChanges))
					propertyChanges.forEach(function(pc){
						if(pc.type === 'set'){
							_.assertEqual(pc.type, 'set')
							_.assertInt(pc.editId)
							_.assertPrimitive(pc.value)
							changesToMap.push({
								type: 'put', 
								value: pc.value,
								state: {key: id, keyOp: editCodes.selectObjectKey}, 
								editId: pc.editId})
						}else if(pc.type === 'add'){
							changesToMap.push({
								type: 'putAdd', 
								value: pc.value,
								state: {key: id, keyOp: editCodes.selectObjectKey}, 
								editId: pc.editId})
						}else if(pc.type === 'remove'){
							changesToMap.push({
								type: 'putRemove', 
								value: pc.value,
								state: {key: id, keyOp: editCodes.selectObjectKey}, 
								editId: pc.editId})
						}/*else if(pc.type === 'put'){
							changesToMap.push({
								type: 'putRemove', 
								value: pc.value,
								state: {key: id, keyOp: editCodes.selectObjectKey}, 
								editId: pc.editId})
						}*/else{
							_.errout('tODO: ' + JSON.stringify(pc))
						}
					})
				}
				inputGetMayHaveChanged(bindings, startEditId, endEditId, function(ids){

					var cdl = _.latch(newIds.length, function(){

						var cdl = _.latch(ids.length, function(){
							changesToMap.sort(function(a,b){return a.editId - b.editId;})
							cb(changesToMap)
						})
						
						ids.forEach(function(id){

							if(isNewId[id]){
								cdl()
								return
							}
							getPropertyChangesDuring(id, startEditId, endEditId, function(propertyChanges){
								applyChanges(id, propertyChanges)
								cdl()
							})
							
						})
					})
					
					newIds.forEach(function(id, index){
						//getPropertyValueAt(id, newIdEditIds[index], function(pv){
						//	_.assertPrimitive(pv)
							getPropertyChangesDuring(id, -1, endEditId, function(propertyChanges){
								//if(pv !== undefined) propertyChanges = [{type: 'set', value: pv, editId: newIdEditIds[index]}].concat(propertyChanges)
								applyChanges(id, propertyChanges)
								cdl()
							})
						//})						
					})
				})
			})
		}
	}
	
	if(inputSet.getConfiguredIdAt){
		newHandle.getKeyStateAt = function(bindings, editId, id, cb){
			inputSet.getConfiguredIdAt(id, bindings, editId, function(realId){
				//console.log('getting id: ' + realId + ' ' + id)
				getPropertyValueAt(realId, editId, cb)
			})
		}
	}else{
		newHandle.getKeyStateAt = function(bindings, editId, id, cb){
			_.errout('TODO: ' + inputSet.name)
		}
		//
	}
		
	return newHandle
}
