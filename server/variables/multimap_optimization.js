
var _ = require('underscorem')
var analytics = require('./../analytics')
var wu = require('./../wraputil')

function removeInner(arr){

	return arr
	/*
	var res = []
	for(var i=0;i<arr.length;++i){
		var id = arr[i]
		if(typeof(id) === 'number'){
			res.push(id)
		}
	}
	return res*/
}
function removeInnerEdits(edits){

	return edits
	/*

	if(edits.length === 0) return edits
	
	var res = []
	for(var i=0;i<edits.length;++i){
		var e = edits[i]
		_.assert(e.type === 'add' || e.type === 'remove')
		var id = e.value
		if(typeof(id) === 'number'){
			res.push(e)
		}
	}
	return res*/
}

function makeWithIndex(s, rel, recurseSync, handle, ws, staticBindings, allHandle, objSchema, propertyCode, keysAreBoolean){
	
	var a = analytics.make('multimap-optimization-with-index', [])
	
	var p = propertyCode===-2?propertyCode:objSchema.propertiesByCode[propertyCode]
	var index = staticBindings.makeReversePropertyIndex(objSchema, p)
	_.assertFunction(index.getValueChangesBetween)
	_.assertDefined(index.getValueAt)
	
	var inputSet = recurseSync(rel.params[0])

	var forwardIndex = staticBindings.makePropertyIndex(objSchema, p)
	
	var handle = {
		name: 'multimap-optimization',
		analytics: a,
		getValueStateAt: function(key, bindings, editId, cb){
			cb(removeInner(index.getValueAt(bindings, key, editId)))
		},
		getValueAt: function(key, bindings, editId){
			return removeInner(index.getValueAt(bindings, key, editId))
		},
		getValueBetween: function(key, bindings, startEditId, endEditId){
			//console.log('getting value changes between for: ' + key)
			return removeInnerEdits(index.getValueChangesBetween(bindings, key, startEditId, endEditId))
		},
		getValueChangesBetween: function(key, bindings, startEditId, endEditId, cb){
			cb(removeInnerEdits(index.getValueChangesBetween(bindings, key, startEditId, endEditId)))
		},
		getAt: function(bindings, editId){
			_.assertLength(arguments, 2)
			
			var ids = inputSet.getAt(bindings, editId)
			var m = {}
			for(var i=0;i<ids.length;++i){
				var id = ids[i]
				var v = forwardIndex.getValueAt(bindings, id, editId)
				var arr = m[v]
				if(!arr){
					arr = m[v] = []
				}
				arr.push(id)
			}
			//console.log('m: ' + JSON.stringify(m))
			return m
		},
		getStateAt: function(bindings, editId, cb){
			_.errout('TODO')
			//TODO keep in mind domain issue
		},
		getHistoricalChangesBetween: function(bindings, startEditId, endEditId, cb){
			_.errout('TODO')
			//TODO keep in mind domain issue
		}
	}
	handle.getChangesBetween = handle.getHistoricalChangesBetween

	return handle
}

exports.make = make
exports.makeSync = function(s, rel, recurse, handle, ws, staticBindings, allHandle){
	return make(s, rel, recurse, handle, ws, staticBindings, allHandle, true)
}

function make(s, rel, recurse, handle, ws, staticBindings, allHandle, mustBeSync){
	_.assertObject(staticBindings)

	var propertyName = rel.params[1].expr.params[0].value
	var objectName = rel.params[0].schemaType.members.object
	var objSchema = s.schema[objectName]
	var propertyCode
	if(propertyName === 'uuid'){
		propertyCode = -2
	}else{
		var p = objSchema.properties[propertyName]
		if(p === undefined) _.errout('no property found: ' + objSchema.name+'.'+propertyName + ', got: ' + JSON.stringify(Object.keys(objSchema.properties)))
		propertyCode = p.code
	}

	var keyValueSchemaType = rel.params[2].schemaType
	if(keyValueSchemaType.type !== 'set') keyValueSchemaType = {type: 'set', members: keyValueSchemaType}
	var kws = wu.makeUtilities(keyValueSchemaType)
	var keysAreBoolean = rel.params[1].expr.schemaType.primitive === 'boolean'

	//console.log(JSON.stringify(rel, null, 2))
	//if(/*rel.params[0].view === 'typeset' && propertyCode !== -2*/){
	return makeWithIndex(s, rel, recurse, handle, ws, staticBindings, allHandle, objSchema, propertyCode, keysAreBoolean)
	//}
	/*
	if(mustBeSync) _.errout('cannot make sync, but must: ' + propertyCode)
	
	var inputSet = recurse(rel.params[0])
	

	var a = analytics.make('multimap-optimization', [inputSet,allHandle])

	var getProperty = staticBindings.makeGetPropertyAt(objSchema.code, propertyCode)
	function getPropertyAt(id, editId, cb){
		a.gotProperty(propertyCode)
		getProperty({}, id, editId, cb)
	}
	
	if(!inputSet.getMayHaveChangedAndInAtStart) _.errout('missing getMayHaveChangedAndInAtStart: ' + inputSet.name)
	
	
	//console.log('keysAreBoolean: ' + keysAreBoolean)
	//console.log(JSON.stringify(rel, null, 2))
	
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
					if(keysAreBoolean){
						key = !!key
					}
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
				//console.log(keysAreBoolean + ' updated cache to: ' + JSON.stringify(permanentCache))
				cb()
			})
		}else{
			cb()
		}
	}
	
	function computeHistoricalChangesBetween(startEditId, endEditId, cb){
		//console.log('computing historical changes between: ' + startEditId + ', ' + endEditId)
		//inputSet.getStateAt({}, startEditId, function(inputState){
		inputSet.getMayHaveChangedAndInAtStart({}, startEditId, endEditId, function(inputMayHaveChanged){
			inputSet.getHistoricalChangesBetween({}, startEditId, endEditId, function(inputChanges){

				var result = []
				
				var cdl = _.latch(inputMayHaveChanged.length+inputChanges.length, function(){
					result.sort(function(a,b){return a.editId - b.editId;})
					cb(result)
				})
				
				function propertyChangeProcessor(pcs, id){
					a.gotPropertyChanges(propertyCode)
					for(var i=0;i<pcs.length;++i){
						var c = pcs[i]
						if(c.type === 'set'){
							if(keysAreBoolean && !c.old) c.old = false
						}
						processChange(id, c)
					}
					cdl()
				}
				for(var i=0;i<inputMayHaveChanged.length;++i){
					a.gotPropertyChanges(propertyCode)
					staticBindings.getPropertyChangesDuring(inputMayHaveChanged[i], propertyCode, startEditId, endEditId, propertyChangeProcessor)
				}
				function processChange(id, c){
					//console.log('processing change: ' + JSON.stringify(c))
					if(c.type === 'set'){
						_.assert(Object.keys(c).indexOf('old') !== -1)
						//if(keysAreBoolean && !c.old) c.old = false
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
							a.gotProperty(propertyCode)
							staticBindings.getPropertyChangesDuring(c.value, propertyCode, c.editId, endEditId, function(pcs){
								a.gotPropertyChanges(propertyCode)
								//console.log('changes: ' + JSON.stringify(pcs))
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
						getPropertyAt(c.value, c.editId, function(ps){
							a.gotProperty(propertyCode)
							//1. add the removal change based on the state at removal
							//console.log('adding removal')
							processChange(c.value, {type: 'set', value: undefined, old: ps, editId: c.editId})
							//2. remove any after changes
							for(var i=0;i<result.length;++i){
								var r = result[i]
								if(r.value === c.value && r.editId >= c.editId){
									result.splice(i, 1)
								}
							}
							cdl()
						})
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
			if(bindings.__mutatorKey){
				if(!allHandle.getValueStateAt) _.errout('missing getValueStateAt: ' + allHandle.name)
				allHandle.getValueStateAt(key, bindings, editId, cb)
				return
			}
			
			if(keysAreBoolean){
				key = !!key
			}
			
			function computeValue(){
				var changes =permanentCache[key]||[]
				var state = []
				//console.log('changes: ' + JSON.stringify(changes))
				for(var i=0;i<changes.length;++i){
					var c = changes[i]
					if(c.editId > editId) break
					if(c.type === 'add'){
						state.push(c.value)
					}else if(c.type === 'remove'){//TODO pre-mask?
						//console.log(JSON.stringify([c, state]))
						var index = state.indexOf(c.value)
						_.assert(index !== -1)
						state.splice(index, 1)
					}else{
						_.errout('TODO: ' + JSON.stringify(c))
					}
				}
				//console.log('computed value: ' + state.length)
				cb(state)
			}
			
			updateCacheTo(editId, computeValue)
		},
		getValueChangesBetween: function(key, bindings, startEditId, endEditId, cb){
			if(bindings.__mutatorKey){
				console.log('multimap optimization falling back')
				allHandle.getValueStateAt(key, bindings, startEditId, endEditId, cb)
				return
			}
			
			if(keysAreBoolean){
				key = !!key
			}
			
			updateCacheTo(endEditId, function(){
				var changes = permanentCache[key]||[]
				var realChanges = []
				for(var i=0;i<changes.length;++i){
					var c = changes[i]
					if(c.editId > endEditId) break
					if(c.editId > startEditId){
						realChanges.push(c)
					}
				}
				//console.log('value changes: ' + JSON.stringify([key, startEditId, endEditId, realChanges, changes]))
				cb(realChanges)
			})
		},
		getStateAt: function(bindings, editId, cb){
			
			if(bindings.__mutatorKey){
				console.log('*multimap optimization falling back')
				allHandle.getStateAt(bindings, editId, cb)
				return
			}
			
			updateCacheTo(editId, function(){
				var state = {}
				//console.log('colllecting state')
				for(var i=0;i<cacheKeys.length;++i){
					var key = cacheKeys[i]
					var changes = permanentCache[key]||[]
					var valueState = []
					for(var j=0;j<changes.length;++j){
						var c = changes[j]
						if(c.editId > editId) break;
						if(c.type === 'add'){
							valueState.push(c.value)
						}else if(c.type === 'remove'){//TODO pre-mask?
							var index = state.indexOf(c.value)
							_.assert(index !== -1)
							valueState.splice(index, 1)
						}else{
							_.errout('TODO: ' + JSON.stringify(c))
						}
					}
					state[key] = valueState
				}
				//console.log('colllected state: ' + JSON.stringify(state))
				cb(state)
			})
		},
		getHistoricalChangesBetween: function(bindings, startEditId, endEditId, cb){
			//_.errout('why is this being called?')
			if(bindings.__mutatorKey){
				console.log('**multimap optimization falling back')
				allHandle.getHistoricalChangesBetween(bindings, startEditId, endEditId, cb)
				return
			}
			
			updateCacheTo(endEditId, function(){
				var allChanges = []
				cacheKeys.forEach(function(key){
					var changes = permanentCache[key]
					
					for(var i=0;i<changes.length;++i){
						var c = changes[i]
						if(c.editId < startEditId) continue
						if(c.editId > endEditId) break
						
						if(c.type === 'add'){
							allChanges.push({type: 'putAdd', state:{key: key}, value: c.value, editId: c.editId})
						}else if(c.type === 'remove'){
							allChanges.push({type: 'putRemove', state:{key: key}, value: c.value, editId: c.editId})
						}else{
							_.errout('TODO: ' + JSON.stringify(c))
						}
					}
				})
				allChanges.sort(function(a,b){return a.editId - b.editId})
				//console.log('computed changes: ' + JSON.stringify(allChanges))
				cb(allChanges)
			})
		}
	}
	handle.getChangesBetween = handle.getHistoricalChangesBetween
	return handle*/
}
