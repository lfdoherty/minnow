
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
			}else if(property === -3){
				var key = objSchema.code+':-3'
				var existing = reverse[key]
				if(existing) return existing
				return basic[key] = makeCopySourceIndex(objSchema, propertyIndex)				
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
			}else if(property === -3){
				var key = objSchema.code+':-3'
				var existing = reverse[key]
				if(existing) return existing
				return reverse[key] = makeCopySourceReverseIndex(objSchema, propertyIndex)				
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
		getValueAt: function(bindings, id){//, editId){
			_.assertLength(arguments, 2)
			
			var creationEditId = editIds[id]
			if(creationEditId <= editId){
				
				var value = permanentCache[id]
				return [value]
			}else{
				return []
			}
		}/*,
		getValueChangesBetween: function(bindings, id, startEditId, endEditId){
			_.assertLength(arguments, 4)
			
			var editId = editIds[id]
			if(editId >= startEditId && editId <= endEditId){
				var value = permanentCache[id]
				return [{type: 'set', value: value, editId: editId}]
			}else{
				return []
			}
		}*/
	}
	
	return handle
}

function makeCopySourceIndex(objSchema, propertyIndex){
	var permanentCache = {}
	var editIds = {}
	propertyIndex.attachIndex(objSchema.code, -3, function(id, c){
		//console.log('got uuid change')
		_.assertEqual(c.type, 'set')
		permanentCache[id] = value
		editIds[id] = c.editId
	})
	
	var handle = {
		getValueAt: function(bindings, id){//, editId){
			_.assertLength(arguments, 2)
			
			//var creationEditId = editIds[id]
			//if(creationEditId <= editId){
				
				var value = permanentCache[id]
				return [value]
			//}else{
			//	return []
			//}
		}/*,
		getValueChangesBetween: function(bindings, id, startEditId, endEditId){
			_.assertLength(arguments, 4)
			
			var editId = editIds[id]
			if(editId >= startEditId && editId <= endEditId){
				var value = permanentCache[id]
				return [{type: 'set', value: value, editId: editId}]
			}else{
				return []
			}
		}*/
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
		getValueAt: function(bindings, key){//, editId){
			_.assertLength(arguments, 2)
			
			/*var creationEditId = editIds[key]
			if(creationEditId <= editId){*/
				
				var id = permanentCache[key]
				return [id]
			/*}else{
				return []
			}*/
		}/*,
		getValueChangesBetween: function(bindings, key, startEditId, endEditId){
			_.assertLength(arguments, 4)
			
			var editId = editIds[key]
			if(editId >= startEditId && editId <= endEditId){
				var id = permanentCache[key]
				return [{type: 'set', value: id, editId: editId}]
			}else{
				return []
			}
		}*/
	}
	
	return handle
}

function makeCopySourceReverseIndex(objSchema, propertyIndex){
	var permanentCache = {}
	var editIds = {}
	propertyIndex.attachIndex(objSchema.code, -3, function(id, c){
		//console.log('*got uuid change')
		_.assertEqual(c.type, 'set')
		permanentCache[c.value] = id
		editIds[c.value] = c.editId
	})
	
	var handle = {
		getValueAt: function(bindings, key){
			_.assertLength(arguments, 2)
			
			var id = permanentCache[key]
			return [id]
			/*var creationEditId = editIds[key]
			if(creationEditId <= editId){
				
			}else{
				return []
			}*/
		}/*,
		getValueChangesBetween: function(bindings, key, startEditId, endEditId){
			_.assertLength(arguments, 4)
			
			var editId = editIds[key]
			if(editId >= startEditId && editId <= endEditId){
				var id = permanentCache[key]
				return [{type: 'set', value: id, editId: editId}]
			}else{
				return []
			}
		}*/
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

function makeSinglePropertyIndex(objSchema, property, propertyIndex){

	var index = {}
	
	//var changeIndex = {}
	
	propertyIndex.attachIndex(objSchema.code, property.code, function(id, c){
	
		//if(!changeIndex[id]) changeIndex[id] = []
		//changeIndex[id].push(c)
		
		if(c.type === 'set'){
			index[id] = c.value
		}else if(c.type === 'clear' || c.type === 'destroyed'){
			index[id] = undefined
		}else if(c.type === 'insert'){
			var old = index[id]
			_.assertInt(c.index)
			index[id] = old.substr(0, c.index) + c.value + old.substr(c.index)
		}else{
			_.errout('TODO?: '  + JSON.stringify(c))
		}
	})
	
	var handle = {}
	
	handle.getStateAt = function(){_.errout('TODO?')}
	handle.getPartialStateAt = function(){_.errout('TODO?')}
	
	handle.getValueAt = function(bindings, id){
		return index[id]
	}
	
	/*handle.getValueChangesBetween = function(bindings, id){//, startEditId, endEditId){
		return changeIndex[id] || []
	}*/

	return handle
}


function makePropertyIndex(objSchema, property, propertyIndex){
	_.assertLength(arguments, 3)

	if(property.type.type === 'object' || property.type.type === 'primitive'){
		return makeSinglePropertyIndex(objSchema, property, propertyIndex)
	}
		
	var permanentCache = {}
	var ids = []
	var propertyCode = property.code
	
	var applyEdit
	
	//var allChanges
	//var savingChanges = false
	
	var isSetProperty = property.type.type === 'list' || property.type.type === 'set'
	
	propertyIndex.attachIndex(objSchema.code, propertyCode, function(id, c){
		//if(property.name === 'url' && objSchema.name === 'webpage') console.log('*index update: ' + id + ' ' + JSON.stringify(c) + ' ' + objSchema.name + '.'+property.name)
		//if(property.name === 'form' && property.code === 111 && c.value === true) _.errout('invalid combination: ' + JSON.stringify(c) + ' ' + id)
		
		if(c.type === 'set' && isSetProperty){
			_.errout('invalid change for set property: ' + JSON.stringify(c) + ' ' + JSON.stringify(property))
		}
		
		/*var results = permanentCache[id]
		if(!results){
			results = permanentCache[id] = []
			ids.push(id)
		}
		results.push(c)
		
		*/
		permanentCache[id] = applyEdit(permanentCache[id], c)

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
	
	//var currentValueCache = {}
	//var lastEditIdCache = {}
	
	function applyEditForSingle(v, c){
		if(c.type === 'set'){
			v = c.value
		}else if(lastChange.type === 'clear'){
			v = undefined
		}else if(lastChange.type === 'insert'){
			if(v !== undefined){
				v = v.substr(0, c.index) + c.value + v.substr(c.index)
			}
		}else if(lastChange.type === 'destroyed'){
			v = undefined
		}else{
			_.errout('tODO: ' + JSON.stringify(lastChange))
		}
		return v
	}
	
	function getValueAtForSingle(bindings, id){//, editId){
		_.assertLength(arguments, 2)
		if(editId === -1) return
		
		/*if(editId >= lastEditIdCache[id]){
			return currentValueCache[id]
		}*/
		return computeValueAt(id, editId)
	}
	function computeValueAt(id){//, editId){
		var value = permanentCache[id]
		return value
		//console.log('indexed single property: ' + id + ' ' + JSON.stringify(changes) + ' ' + editId + ' ' + objSchema.name + '.'+property.name)
		//console.log(JSON.stringify(permanentCache))
		/*
		var changes = permanentCache[id]
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
		}else if(lastChange.type === 'destroyed'){
			return undefined
		}else{
			_.errout('tODO: ' + JSON.stringify(lastChange))
		}*/
	}
		
	function getStateAt(){//editId){
		var result = {}
		ids.forEach(function(id){
			result[id] = handle.getValueAt(id)//, editId)
		})
		return result
	}
	
	function getPartialStateAt(bindings, ids){//, editId){
		_.assertLength(arguments, 2)
		var result = {}
		ids.forEach(function(id){
			result[id] = handle.getValueAt(bindings, id)//, editId)
		})
		return result
	}
	
	function applyEditForSet(v, c){
		if(!v) v = []
		if(c.type === 'add'){
			v.push(c.value)
		}else if(c.type === 'remove'){
			var index = indexOfRawId(v, c.value)//set.indexOf(c.value)
			if(index !== -1){
				v.splice(index, 1)
			}else{
				console.log('failed to remove: ' + c.value + ' ' + JSON.stringify(v))// + ' ' + JSON.stringify(changes))
			}
		}else{
			_.errout('tODO: ' + JSON.stringify(c))
		}
		return v
	}
	
	function getValueAtForSet(bindings, id){//, editId){
		_.assertLength(arguments, 2)

		/*var changes = permanentCache[id]
		if(!changes) return []
		var set = []
		for(var i=0;i<changes.length;++i){
			var c = changes[i]
			//if(c.editId > editId) break
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
		return set*/
		return permanentCache[id] || []
	}
	
	function applyEditForMap(v, c){
		if(!v) v = {}
		if(c.type === 'put'){
			v[c.key] = c.value
		}else if(c.type === 'removeKey'){
			delete v[c.key]
		}else{
			_.errout('tODO: ' + JSON.stringify(c))
		}
		return v
	}
	
	function getValueAtForMap(bindings, id){
		_.assertLength(arguments, 2)

		/*var changes = permanentCache[id]
		if(!changes) return {}
		var res = {}
		for(var i=0;i<changes.length;++i){
			var c = changes[i]
			//if(c.editId > editId) break
			if(c.type === 'put'){
				res[c.key] = c.value
			}else if(c.type === 'removeKey'){
				delete res[c.key]
			}else{
				_.errout('tODO: ' + JSON.stringify(c))
			}
		}
		return res*/
		return permanentCache[id] || {}
	}
	
	//function 
	
	var handle = {}
	
	handle.getStateAt = getStateAt	
	handle.getPartialStateAt = getPartialStateAt

	if(property.type.type === 'object' || property.type.type === 'primitive'){
		handle.getValueAt = getValueAtForSingle
		applyEdit = applyEditForSingle
	}else if(isSetProperty){
		handle.getValueAt = getValueAtForSet
		applyEdit = applyEditForSet
	}else if(property.type.type === 'map'){
		handle.getValueAt = getValueAtForMap
		applyEdit = applyEditForMap
	}else{
		_.errout('TODO: ' + JSON.stringify(property.type))
	}
	
	//newHandle.getHistoricalChangesBetween = handle.getChangesBetween
	return handle
}

function PrimitiveSet(){
	this.list = []
	this.removed = {}
	this.dirty = false
}
PrimitiveSet.prototype.add = function(v){
	if(this.dirty && this.removed[v]){
		this._clean()
	}else if(this.shown){
		this.list = [].concat(this.list)
		this.shown = false
	}
	//if(this.list.indexOf(v) !== -1) _.errout('invalid already has: ' + v)
	this.list.push(v)
}
PrimitiveSet.prototype.remove = function(v){
	//if(this.list.indexOf(v) === -1) _.errout('removing but does not have: ' + v)
	//console.log('removing: ' + v)
	this.removed[v] = true
	this.dirty = true
}
PrimitiveSet.prototype._clean = function(){
	var newList = []
	for(var i=0;i<this.list.length;++i){
		var v = this.list[i]
		if(!this.removed[v]){
			newList.push(v)
		}
	}
	//console.log('cleaned: ' + newList.length + ' ' + this.list.length)
	this.list = newList
	this.removed = {}
	this.dirty = false
	this.shown = false
}
PrimitiveSet.prototype.getRaw = function(){
	//console.log('getting raw')
	if(this.dirty){
		this._clean()
	}
	//console.log(JSON.stringify(this.list))
	this.shown = true
	return this.list//[].concat(this.list)
}

function makeReversePropertyIndex(objSchema, property, propertyIndex){

	if(property.type.type === 'set' || property.type.type === 'map' || property.type.type === 'list'){
		_.errout('TODO')
	}
	
	var keysAreBoolean = property.type.primitive === 'boolean'
	
	//var permanentCache = {}
	var stateCache = {}
	
	function removeStateValue(key, value){
		var oldSetValue = stateCache[key]
		/*var index = oldSetValue.indexOf(value)
		_.assert(index !== -1)
		console.log('removing state value: ' + key + ' ' + value)
		oldSetValue.splice(index, 1)*/
		oldSetValue.remove(value)
	}
	

	//in order to know the old value when a value is reset, we need to store the current value
	//TODO optimize this somehow, given that it will likely be rare for values to be reset?
	var currentValue = {}//TODO externalize via makePropertyIndex?
	
	var propertyCode = property.code
	
	propertyIndex.attachIndex(objSchema.code, propertyCode, function(id, c){
		_.assertDefined(id)
		if(c.type === 'set'){


			var value = c.value
			_.assertDefined(value)
			if(keysAreBoolean) value = !!value

		
			var old = currentValue[id]

			if(keysAreBoolean) old = !!old

			/*if(propertyCode === 3){
				console.log(' got c: ' + id + ' ' + JSON.stringify(c) + ' ' + old)
			}*/
			
			if(old !== value){

				//var newSet = permanentCache[value]
				var newSetValue = stateCache[value]
				if(!newSetValue){
					//newSet = permanentCache[value] = []
					newSetValue = stateCache[value] = new PrimitiveSet()
				}
				//newSet.push({type: 'add', value: id, editId: c.editId})

				if(old !== undefined){
					//var oldSet = permanentCache[old]
					//oldSet.push({type: 'remove', value: id, editId: c.editId})
					//console.log(propertyCode + ' removing from ' + old + ' set: ' + id)
					removeStateValue(old, id)
					//console.log('after: ' + JSON.stringify(stateCache))
				}else if(keysAreBoolean){
					//var oldSet = permanentCache['false']
					//console.log(propertyCode + ' removing undefined old: ' + id + ' ' + value + ' ' + JSON.stringify(stateCache))
					//oldSet.push({type: 'remove', value: id, editId: c.editId})
					removeStateValue('false', id)
				}
				//console.log(propertyCode + ' adding to ' + value + ' set: ' + id + ' old: ' + old)
				newSetValue.add(id)
				//if(propertyCode === 3) console.log('now: ' + value + ' is ' + JSON.stringify(stateCache))
				currentValue[id] = c.value
			}
		}else if(c.type === 'insert'){
			var value = c.value
			_.assertDefined(value)
			
			var old = currentValue[id]
			var newValue = old.substr(0, c.index)+c.value+old.substr(c.index)

			//var newSet = permanentCache[newValue]
			var newSetValue = stateCache[newValue]
			if(!newSetValue){
				//newSet = permanentCache[newValue] = []
				newSetValue = stateCache[newValue] = new PrimitiveSet()
			}
			//newSet.push({type: 'add', value: id, editId: c.editId})
			newSetValue.add(id)

			//var oldSet = permanentCache[old]
			//oldSet.push({type: 'remove', value: id, editId: c.editId})
			currentValue[id] = newValue
			removeStateValue(old, id)
			
			
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
			//var oldSet = permanentCache[c.old]
			//oldSet.push({type: 'remove', value: id, editId: c.editId})
			currentValue[id] = undefined
			removeStateValue(c.old, id)
		}else if(c.type === 'destroyed'){
			var old = currentValue[id]
			//var oldSet = permanentCache[old]
			//oldSet.push({type: 'remove', value: id, editId: c.editId})
			currentValue[id] = undefined
			removeStateValue(old, id)
		}else{
			_.errout('TODO: ' + JSON.stringify(c))
		}
		//if(pn === 'webpage.creator') console.log(JSON.stringify(permanentCache))
	}, function(typeCode, id, editId){
		if(keysAreBoolean){
			//var newSet = permanentCache['false']
			var newSetValue = stateCache['false']
			if(!newSetValue){
				//newSet = permanentCache['false'] = []
				newSetValue = stateCache['false'] = new PrimitiveSet()
			}
			//newSet.push({type: 'add', value: id, editId: editId})
			newSetValue.add(id)
			
		}else{
			//TODO?
		}
	})
	
	var handle = {
		getValueAt: function(bindings, key){//, editId){
			_.assertLength(arguments, 2)
			_.assertObject(bindings)
			
			if(keysAreBoolean){key = !!key}

			/*if(propertyCode === 3){
				console.log('getting ' + key + ' from ' + JSON.stringify(stateCache))
			}*/
			
			var state = stateCache[key]
			if(!state) return []
			return state.getRaw()
		
			/*var changes = permanentCache[key]
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
				//if(c.editId > editId) break
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
				//if(c.editId > editId) break
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
			return state*/
		}/*,
		getValueChangesBetween: function(bindings, key){//, startEditId, endEditId){
			_.assertLength(arguments, 2)
			_.assert('TODO?')
			
			if(keysAreBoolean){key = !!key}
		
			var changes = permanentCache[key]
			if(!changes){
				//console.log('no changes' + JSON.stringify([key, startEditId, endEditId, realChanges, changes, permanentCache]))
				return []
			}
			return changes
			
		}*/
	}
	
	return handle
}

