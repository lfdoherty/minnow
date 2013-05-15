
var _ = require('underscorem')

exports.make = function(schema, propertyIndex){
	_.assertLength(arguments, 2)

	var basic = {}
	var reverse = {}
	
	var handle = {
		makePropertyIndex: function(objSchema, property){
			if(property === -2){
				var key = objSchema.code+':-2'
				var existing = reverse[key]
				if(existing) return existing
				return basic[key] = makeUuidIndex(objSchema, propertyIndex)				
			}else{
				var key = objSchema.code+':'+property.code
				var existing = basic[key]
				if(existing) return existing
				return basic[key] = makePropertyIndex(objSchema, property, propertyIndex)
			}
		},
		makeReversePropertyIndex: function(objSchema, property){
			if(property === -2){
				var key = objSchema.code+':-2'
				var existing = reverse[key]
				if(existing) return existing
				return reverse[key] = makeUuidReverseIndex(objSchema, propertyIndex)				
			}else{
				var key = objSchema.code+':'+property.code
				var existing = reverse[key]
				if(existing) return existing
				return reverse[key] = makeReversePropertyIndex(objSchema, property, propertyIndex)
			}
		}
	}
	return handle
}

function makeUuidIndex(objSchema, propertyIndex){
	var permanentCache = {}
	var editIds = {}
	propertyIndex.attachIndex(objSchema.code, -2, function(id, c){
		//console.log('got uuid change')
		_.assertEqual(c.type, 'set')
		permanentCache[id] = value
		editIds[id] = c.editId
	})
	
	var handle = {
		getValueAt: function(bindings, id, editId){
			_.assertLength(arguments, 3)
			
			var creationEditId = editIds[id]
			if(creationEditId <= editId){
				
				var value = permanentCache[id]
				return [value]
			}else{
				return []
			}
		},
		getValueChangesBetween: function(bindings, id, startEditId, endEditId){
			_.assertLength(arguments, 4)
			
			var editId = editIds[id]
			if(editId >= startEditId && editId <= endEditId){
				var value = permanentCache[id]
				return [{type: 'set', value: value, editId: editId}]
			}else{
				return []
			}
		}
	}
	
	return handle
}

function makeUuidReverseIndex(objSchema, propertyIndex){
	var permanentCache = {}
	var editIds = {}
	propertyIndex.attachIndex(objSchema.code, -2, function(id, c){
		//console.log('*got uuid change')
		_.assertEqual(c.type, 'set')
		permanentCache[c.value] = id
		editIds[c.value] = c.editId
	})
	
	var handle = {
		getValueAt: function(bindings, key, editId){
			_.assertLength(arguments, 3)
			
			var creationEditId = editIds[key]
			if(creationEditId <= editId){
				
				var id = permanentCache[key]
				return [id]
			}else{
				return []
			}
		},
		getValueChangesBetween: function(bindings, key, startEditId, endEditId){
			_.assertLength(arguments, 4)
			
			var editId = editIds[key]
			if(editId >= startEditId && editId <= endEditId){
				var id = permanentCache[key]
				return [{type: 'set', value: id, editId: editId}]
			}else{
				return []
			}
		}
	}
	
	return handle
}

function indexOfRawId(arr, id){
	for(var i=0;i<arr.length;++i){
		var v = arr[i]
		if(v.inner === id){
			return i
		}else{
			if(v === id){
				return i
			}
		}
	}
	return -1
}

function makePropertyIndex(objSchema, property, propertyIndex){
	_.assertLength(arguments, 3)
	
	var permanentCache = {}
	var ids = []
	var propertyCode = property.code
	
	var allChanges
	var savingChanges = false
	
	var isSetProperty = property.type.type === 'list' || property.type.type === 'set'
	
	propertyIndex.attachIndex(objSchema.code, propertyCode, function(id, c){
		//if(property.name === 'url' && objSchema.name === 'webpage') console.log('*index update: ' + id + ' ' + JSON.stringify(c) + ' ' + objSchema.name + '.'+property.name)
		//if(property.name === 'form' && property.code === 111 && c.value === true) _.errout('invalid combination: ' + JSON.stringify(c) + ' ' + id)
		
		if(c.type === 'set' && isSetProperty){
			_.errout('invalid change for set property: ' + JSON.stringify(c) + ' ' + JSON.stringify(property))
		}
		
		var results = permanentCache[id]
		if(!results){
			results = permanentCache[id] = []
			ids.push(id)
		}
		results.push(c)

		//lastEditIdCache[id] = c.editId		
		//currentValueCache[id] = computeValueAt(id, c.editId+1)
		
		/*
		if(savingChanges){
			if(c.type === 'set'){
				allChanges.push({type: 'put', value: c.value, key: id, editId: c.editId})
			}else if(c.type === 'clear'){
				allChanges.push({type: 'removeKey', key: id, editId: c.editId})
			}else{
				_.errout('TODO: ' + JSON.stringify(c))
			}
		}*/
	})
	
	//var nameStr = 'map-optimization-with-index['+objSchema.name+'.'+property.name+']'
	//var a = analytics.make(nameStr, [])
	
	/*function getSingleValueAtForSingle(bindings, id, editId){
		if(editId
	}*/
	
	var currentValueCache = {}
	var lastEditIdCache = {}
	
	function getValueAtForSingle(bindings, id, editId){
		_.assertLength(arguments, 3)
		if(editId === -1) return
		
		/*if(editId >= lastEditIdCache[id]){
			return currentValueCache[id]
		}*/
		return computeValueAt(id, editId)
	}
	function computeValueAt(id, editId){
		var changes = permanentCache[id]
		//console.log('indexed single property: ' + id + ' ' + JSON.stringify(changes) + ' ' + editId + ' ' + objSchema.name + '.'+property.name)
		//console.log(JSON.stringify(permanentCache))
		if(!changes){
			//console.log('no changes')
			return undefined;
		}
		var lastChange
		for(var i=changes.length-1;i>=0;--i){
			var c = changes[i]
			if(c.editId <= editId){
				lastChange = c
				break
			}
		}

		//_.assertDefined(lastChange)
		if(!lastChange){
			//console.log('no last change')
			if(property.type.primitive === 'boolean') return false
			return undefined//hasn't been initialized yet
		}

		if(lastChange.type === 'set'){
			//if(!lastChange.value) console.log('returning last ' + lastChange.value + ' ' + objSchema.name + '.'+property.name)
			return lastChange.value
		}else if(lastChange.type === 'clear'){
			//omit the value
			return undefined
		}else if(lastChange.type === 'insert'){
			var value = ''
			for(var i=0;i<changes.length;++i){
				var c = changes[i]
				if(c.editId > editId) break
				if(c.type === 'clear'){
					value = ''
				}else if(c.type === 'set'){
					value = c.value
				}else if(c.type === 'insert'){
					_.assertInt(c.index)
					value = value.substr(0, c.index) + c.value + value.substr(c.index)
				}else{
					_.errout('tODO: ' + JSON.stringify(lastChange))
				}
			}
			return value
		}else{
			_.errout('tODO: ' + JSON.stringify(lastChange))
		}
	}
	
	function getValueChangesBetween(bindings, id, startEditId, endEditId){
		_.assertLength(arguments, 4)
		
		var changes = permanentCache[id]
		if(!changes){
			//console.log('nothing in index for: ' + id +' for ' + objSchema.name + '.'+property.name)
			return [];
		}
		var realChanges = []
		for(var i=0;i<changes.length;++i){
			var c = changes[i]
			if(c.editId < startEditId) continue
			if(c.editId > endEditId) break
			realChanges.push(c)
		}
		//console.log('$$: ' + id + '.' + property.name + ' ' + JSON.stringify(realChanges) + ' ' + startEditId + ', ' + endEditId)
		return realChanges
	}
	
	function getStateAt(editId){
		var result = {}
		ids.forEach(function(id){
			result[id] = handle.getValueAt(id, editId)
		})
		return result
	}
	
	function getPartialStateAt(bindings, ids, editId){
		_.assertLength(arguments, 3)
		var result = {}
		ids.forEach(function(id){
			result[id] = handle.getValueAt(bindings, id, editId)
		})
		return result
	}
	
	function getValueAtForSet(bindings, id, editId){
		_.assertLength(arguments, 3)

		var changes = permanentCache[id]
		if(!changes) return []
		var set = []
		for(var i=0;i<changes.length;++i){
			var c = changes[i]
			if(c.editId > editId) break
			if(c.type === 'add'){
				set.push(c.value)
			}else if(c.type === 'remove'){
				var index = indexOfRawId(set, c.value)//set.indexOf(c.value)
				if(index !== -1){
					set.splice(index, 1)
				}else{
					console.log('failed to remove: ' + c.value + ' ' + JSON.stringify(set) + ' ' + JSON.stringify(changes))
				}
			}else{
				_.errout('tODO: ' + JSON.stringify(c))
			}
		}
		//console.log('got indexed set property: ' + id + '.' + property.name + ' ' + JSON.stringify(set))
		return set
	}
	function getValueAtForMap(bindings, id, editId){
		_.assertLength(arguments, 3)

		var changes = permanentCache[id]
		if(!changes) return {}
		var res = {}
		for(var i=0;i<changes.length;++i){
			var c = changes[i]
			if(c.editId > editId) break
			if(c.type === 'put'){
				res[c.key] = c.value
			}else if(c.type === 'removeKey'){
				delete res[c.key]
			}else{
				_.errout('tODO: ' + JSON.stringify(c))
			}
		}
		return res
	}
	function getChangesBetweenForSingle(startEditId, endEditId){
		//_.assertLength(arguments, 3)
		//if(!savingChanges){
		var all = []
		for(var j=0;j<ids.length;++j){
			var id = ids[j]
			var changes = permanentCache[id]
			for(var i=0;i<changes.length;++i){
				var c = changes[i]
				if(c.editId < startEditId) continue
				if(c.editId > endEditId) break
				if(c.type === 'set'){
					all.push({type: 'put', value: c.value, key: id, editId: c.editId})
				}else if(c.type === 'clear'){
					all.push({type: 'removeKey', key: id, editId: c.editId})
				}else{
					_.errout('TODO: ' + JSON.stringify(c))
				}
			}
		}
		all.sort(function(a,b){return a.editId - b.editId;})
		//console.log('computed changes ')
		return all
		/*	allChanges = all
			savingChanges = true
		}
		
		var res = []
		for(var i=0;i<allChanges.length;++i){
			var c = allChanges[i]
			if(c.editId < startEditId) continue
			if(c.editId > endEditId) break
			res.push(c)
		}
		return res*/
	}

	function getChangesBetweenForSet(startEditId, endEditId){
		//_.assertLength(arguments, 3)
		
		var all = []
		for(var j=0;j<ids.length;++j){
			var id = ids[j]
			var changes = permanentCache[id]
			for(var i=0;i<changes.length;++i){
				var c = changes[i]
				if(c.editId < startEditId) continue
				if(c.editId > endEditId) break
				if(c.type === 'add'){
					all.push({type: 'putAdd', value: c.value, key: id, editId: c.editId})
				}else if(c.type === 'remove'){
					all.push({type: 'putRemove', value: c.value, key: id, editId: c.editId})
				}else{
					_.errout('TODO: ' + JSON.stringify(c))
				}
			}
		}
		all.sort(function(a,b){return a.editId - b.editId;})
		return all
	}
	function getChangesBetweenForMap(startEditId, endEditId){
		_.errout('TODO?')
	}	
	var handle = {}
	
	handle.getStateAt = getStateAt	
	handle.getPartialStateAt = getPartialStateAt

	handle.getValueChangesBetween = getValueChangesBetween
	
	if(property.type.type === 'object' || property.type.type === 'primitive'){
		handle.getValueAt = getValueAtForSingle
		handle.getChangesBetween = getChangesBetweenForSingle
	}else if(isSetProperty){
		handle.getValueAt = getValueAtForSet
		handle.getChangesBetween = getChangesBetweenForSet
	}else if(property.type.type === 'map'){
		handle.getValueAt = getValueAtForMap
		handle.getChangesBetween = getChangesBetweenForMap
	}else{
		_.errout('TODO: ' + JSON.stringify(property.type))
	}
	
	//newHandle.getHistoricalChangesBetween = handle.getChangesBetween
	return handle
}

function makeReversePropertyIndex(objSchema, property, propertyIndex){

	if(property.type.type === 'set' || property.type.type === 'map' || property.type.type === 'list'){
		_.errout('TODO')
	}
	
	var keysAreBoolean = property.type.primitive === 'boolean'
	
	var permanentCache = {}

	//in order to know the old value when a value is reset, we need to store the current value
	//TODO optimize this somehow, given that it will likely be rare for values to be reset?
	var currentValue = {}//TODO externalize via makePropertyIndex?
	
	var propertyCode = property.code
	
	propertyIndex.attachIndex(objSchema.code, propertyCode, function(id, c){
		_.assertDefined(id)
		//console.log(' got c: ' + JSON.stringify(c))
		if(c.type === 'set'){

			var value = c.value
			_.assertDefined(value)
			if(keysAreBoolean) value = !!value

			var newSet = permanentCache[value]
			if(!newSet) newSet = permanentCache[value] = []
			newSet.push({type: 'add', value: id, editId: c.editId})
		
			var old = currentValue[id]

			if(old !== undefined){
				var oldSet = permanentCache[old]
				oldSet.push({type: 'remove', value: id, editId: c.editId})
			}else if(keysAreBoolean){
				var oldSet = permanentCache['false']
				oldSet.push({type: 'remove', value: id, editId: c.editId})
			}
			currentValue[id] = c.value
		}else if(c.type === 'insert'){
			var value = c.value
			_.assertDefined(value)
			
			var old = currentValue[id]
			var newValue = old.substr(0, c.index)+c.value+old.substr(c.index)

			var newSet = permanentCache[newValue]
			if(!newSet) newSet = permanentCache[newValue] = []
			newSet.push({type: 'add', value: id, editId: c.editId})

			var oldSet = permanentCache[old]
			oldSet.push({type: 'remove', value: id, editId: c.editId})
			currentValue[id] = newValue
			
			/*if(keysAreBoolean) value = !!value

			var newSet = permanentCache[value]
			if(!newSet) newSet = permanentCache[value] = []
			newSet.push({type: 'add', value: id, editId: c.editId})
		
			var old = currentValue[id]

			if(old !== undefined){
				var oldSet = permanentCache[old]
				oldSet.push({type: 'remove', value: id, editId: c.editId})
			}else if(keysAreBoolean){
				var oldSet = permanentCache['false']
				oldSet.push({type: 'remove', value: id, editId: c.editId})
			}
			currentValue[id] = c.value*/
		}else if(c.type === 'clear'){
			_.assertDefined(c.old)
			var oldSet = permanentCache[c.old]
			oldSet.push({type: 'remove', value: id, editId: c.editId})
			currentValue[id] = undefined
		}else if(c.type === 'destroyed'){
			var old = currentValue[id]
			var oldSet = permanentCache[old]
			oldSet.push({type: 'remove', value: id, editId: c.editId})
			currentValue[id] = undefined
		}else{
			_.errout('TODO: ' + JSON.stringify(c))
		}
		//if(pn === 'webpage.creator') console.log(JSON.stringify(permanentCache))
	}, function(typeCode, id, editId){
		if(keysAreBoolean){
			var newSet = permanentCache['false']
			if(!newSet) newSet = permanentCache['false'] = []
			newSet.push({type: 'add', value: id, editId: editId})
		}else{
			//TODO?
		}
	})
	
	var handle = {
		getValueAt: function(bindings, key, editId){
			_.assertLength(arguments, 3)
			_.assertObject(bindings)
			
			if(keysAreBoolean){key = !!key}
		
			var changes = permanentCache[key]
			if(!changes){
			//	console.log(editId + ' no changes: ' + key + ' ' + objSchema.name+'.'+property.name)
				return []
			}
			
			var state = []
			
			//console.log('changes: ' + JSON.stringify(changes))
			
			//here we're pre-masking remove
			var removed = {}
			for(var i=0;i<changes.length;++i){
				var c = changes[i]
				if(c.editId > editId) break
				if(c.type === 'add'){
					if(removed[c.value]) removed[c.value] = false
				}else if(c.type === 'remove'){
					removed[c.value] = true
				}else{
					_.errout('TODO: ' + JSON.stringify(c))
				}
			}
			
			
			for(var i=0;i<changes.length;++i){
				var c = changes[i]
				if(c.editId > editId) break
				if(c.type === 'add'){
					if(!removed[c.value]){
						state.push(c.value)
					}
				}else if(c.type === 'remove'){
					//console.log(JSON.stringify([c, state]))
					//var index = state.indexOf(c.value)
					//_.assert(index !== -1)
					//state.splice(index, 1)
				}else{
					_.errout('TODO: ' + JSON.stringify(c))
				}
			}
			//console.log(key + ' computed value: ' + JSON.stringify(state) + ' ' + editId)
			return state
		},
		getValueChangesBetween: function(bindings, key, startEditId, endEditId){
			_.assertLength(arguments, 4)
			
			if(keysAreBoolean){key = !!key}
		
			var changes = permanentCache[key]
			if(!changes){
				//console.log('no changes' + JSON.stringify([key, startEditId, endEditId, realChanges, changes, permanentCache]))
				return []
			}
			var realChanges = []//TODO optimize to slice
			for(var i=0;i<changes.length;++i){
				var c = changes[i]
				if(c.editId > endEditId) break
				if(c.editId > startEditId){
					realChanges.push(c)
				}
			}
			//console.log('value changes: ' + JSON.stringify([key, startEditId, endEditId, realChanges, changes, permanentCache]))
			return realChanges
		}
	}
	
	return handle
}

