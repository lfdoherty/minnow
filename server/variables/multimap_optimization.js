
var _ = require('underscorem')
var analytics = require('./../analytics')
var wu = require('./../wraputil')

exports.make = function(s, rel, recurse, handle, ws){

	//console.log(JSON.stringify(rel, null, 2))
	
	var inputSet = recurse(rel.params[0])
	
	var propertyName = rel.params[1].expr.params[0].value
	var objectName = rel.params[0].schemaType.members.object
	var objSchema = s.schema[objectName]
	var propertyCode = objSchema.properties[propertyName].code

	var a = analytics.make('multimap-optimization', [inputSet])

	var getProperty = s.objectState.makeGetPropertyAt(objSchema.code, propertyCode)
	function getPropertyAt(id, editId, cb){
		a.gotProperty(propertyName)
		getProperty(id, editId, cb)
	}
	
	
	var keyValueSchemaType = rel.params[2].schemaType
	if(keyValueSchemaType.type !== 'set') keyValueSchemaType = {type: 'set', members: keyValueSchemaType}
	var kws = wu.makeUtilities(keyValueSchemaType)
	
	var permanentCache = {}
	var cacheKeys = []
	var cacheLastEditId = -1
	function updateCacheTo(editId, cb){
		if(editId > cacheLastEditId){
			computeHistoricalChangesBetween(cacheLastEditId, editId, function(changes){
				cacheLastEditId = editId
				for(var i=0;i<changes.length;++i){
					var c = changes[i]
					var key = c.key
					if(!permanentCache[key]){
						permanentCache[key] = []
						cacheKeys.push(key)						
					}
					if(c.type === 'putAdd'){
						permanentCache[key].push({type: 'add', value: c.value, editId: c.editId})
					}else if(c.type === 'putRemove'){
						permanentCache[key].push({type: 'remove', value: c.value, editId: c.editId})
					}else{
						_.errout('TODO: ' + JSON.stringify(c))
					}
				}
				cb()
			})
		}else{
			cb()
		}
	}
	
	function computeHistoricalChangesBetween(startEditId, endEditId, cb){
		//console.log('computing historical changes between: ' + startEditId + ', ' + endEditId)
		inputSet.getStateAt({}, startEditId, function(inputState){
			inputSet.getHistoricalChangesBetween({}, startEditId, endEditId, function(inputChanges){

				var result = []
				
				var cdl = _.latch(inputState.length+inputChanges.length, function(){
					result.sort(function(a,b){return a.editId - b.editId;})
					cb(result)
				})
				
				inputState.forEach(function(id){
					s.objectState.getPropertyChangesDuring(id, propertyCode, startEditId, endEditId, function(pcs){
						for(var i=0;i<pcs.length;++i){
							var c = pcs[i]
							processChange(id, c)
						}
						cdl()
					})
				})
				function processChange(id, c){
					if(c.type === 'set'){
						_.assert(Object.keys(c).indexOf('old') !== -1)
						if(c.old === undefined){
							result.push({type: 'putAdd', value: id, key: c.value, editId: c.editId})
						}else{
							result.push({type: 'putRemove', value: id, key: c.old, editId: c.editId})
							result.push({type: 'putAdd', value: id, key: c.value, editId: c.editId})
						}
					}else if(c.type === 'clear'){
						_.assertDefined(c.old)
						result.push({type: 'putRemove', value: id, key: c.old, editId: c.editId})
					}else{
						_.errout('TODO: ' + JSON.stringify(c))
					}
				}
				inputChanges.forEach(function(c){
					if(c.type === 'add'){
						getPropertyAt(c.value, c.editId, function(ps){
							s.objectState.getPropertyChangesDuring(c.value, propertyCode, c.editId, endEditId, function(pcs){
								if(pcs.length === 0 || pcs[0].editId !== c.editId){
									processChange(c.value, {type: 'set', value: ps, old: undefined, editId: c.editId})
								}else{
									pcs[0].old = undefined
								}
								for(var i=0;i<pcs.length;++i){
									processChange(c.value, pcs[i])
								}
								cdl()
							})
						})
					}else if(c.type === 'remove'){
						_.errout('TODO: ' + JSON.stringify(c))
					}else{
						_.errout('TODO: ' + JSON.stringify(c))
					}
				})
			})
		})
	}
	
	var handle = {
		name: 'multimap-optimization',
		analytics: a,
		getValueStateAt: function(key, bindings, editId, cb){
			updateCacheTo(editId, function(){
				var changes = permanentCache[key]||[]
				var state = []
				changes.forEach(function(c){
					if(c.type === 'add'){
						state.push(c.value)
					}else if(c.type === 'remove'){//TODO pre-mask?
						var i = state.indexOf(c.value)
						_.assert(i !== -1)
						state.splice(i, 1)
					}else{
						_.errout('TODO: ' + JSON.stringify(c))
					}
				})
				cb(state)
			})
		},
		getValueChangesBetween: function(key, bindings, startEditId, endEditId, cb){
			updateCacheTo(endEditId, function(){
				var changes = permanentCache[key]||[]
				var realChanges = []
				for(var i=0;i<changes.length;++i){
					var c = changes[i]
					if(c.editId > endEditId) break
					if(c.editId >= startEditId){
						realChanges.push(c)
					}
				}
				//console.log('value changes: ' + JSON.stringify([key, startEditId, endEditId, realChanges, changes]))
				cb(realChanges)
			})
		},
		getStateAt: function(bindings, editId, cb){
			_.errout('TODO?')
		},
		getHistoricalChangesBetween: function(bindings, startEditId, endEditId, cb){
			_.errout('why is this being called?')
			updateCacheTo(endEditId, function(){
				var allChanges = []
				cacheKeys.forEach(function(key){
					var changes = permanentCache[key]
					changes.forEach(function(c){
						if(c.type === 'add'){
							allChanges.push({type: 'putAdd', state:{key: key}, value: c.value, editId: c.editId})
						}else if(c.type === 'remove'){
							allChanges.push({type: 'putRemove', state:{key: key}, value: c.value, editId: c.editId})
						}else{
							_.errout('TODO: ' + JSON.stringify(c))
						}
					})
				})
				allChanges.sort(function(a,b){return a.editId - b.editId})
				console.log('computed changes: ' + JSON.stringify(allChanges))
				cb(allChanges)
			})
		}
	}
	handle.getChangesBetween = handle.getHistoricalChangesBetween
	return handle
}
