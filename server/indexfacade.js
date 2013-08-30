
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
				return basic[key] = makePropertyIndex(objSchema, property, propertyIndex, handle.makePropertyIndex, handle.makeReversePropertyIndex)
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
				return reverse[key] = makeCopySourceReverseIndex(objSchema, propertyIndex, handle.makePropertyIndex.bind(undefined, objSchema, -3))				
			}else{
				var key = objSchema.code+':'+property.code
				var existing = reverse[key]
				if(existing) return existing
				return reverse[key] = makeReversePropertyIndex(objSchema, property, propertyIndex, handle.makePropertyIndex, handle.makeReversePropertyIndex)
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
			
			/*var creationEditId = editIds[id]
			if(creationEditId <= editId){
				
				var value = permanentCache[id]
				return [value]
			}else{
				return []
			}*/
			var value = permanentCache[id]
			return [value]
		}
	}

	handle.reverse = function(){
		_.errout('TODO')
	}
	handle.get = function(id){
		var value = permanentCache[id]
		return [value]
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
			
			var value = permanentCache[id]
			return value
		},
		get: function(id){
			var value = permanentCache[id]
			return value
		}
	}

	handle.reverse = function(){
		_.errout('TODO')
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
			
			var id = permanentCache[key]
			return [id]
		},
		get: function(key){
			var id = permanentCache[key]
			return [id]
		}
	}
	
	handle.reverse = function(){
		_.errout('TODO')
	}
	
	return handle
}

function makeCopySourceReverseIndex(objSchema, propertyIndex, makeCopySourceIndex){
	var permanentCache = {}
	var editIds = {}
	var listeners = []
	propertyIndex.attachIndex(objSchema.code, -3, function(id, c){
		//console.log('*got uuid change')
		_.assertEqual(c.type, 'set')
		permanentCache[c.value] = id
		editIds[c.value] = c.editId
		
		for(var i=0;i<listeners.length;++i){
			listeners[i](c.value)
		}
	})
	
	var handle = {
		getValueAt: function(bindings, key){
			_.assertLength(arguments, 2)
			
			var id = permanentCache[key]
			return [id]
		},
		get: function(key){
			var id = permanentCache[key]
			return [id]
		}
	}
	
	handle.reverse = function(){
		return makeCopySourceIndex()
	}
	
	handle.listen = function(cb){
		listeners.push(cb)
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

function makeSinglePropertyIndex(objSchema, property, propertyIndex, makeReversePropertyIndex){

	var index = {}
	
	var listeners = []
	
	function updateListeners(id, oldValue, newValue){
		for(var i=0;i<listeners.length;++i){
			listeners[i](id, oldValue, newValue)
		}
	}

	propertyIndex.attachIndex(objSchema.code, property.code, function(id, c){

		if(c.type === 'set'){
			var oldValue = index[id]
			index[id] = c.value
			updateListeners(id, oldValue, c.value)
		}else if(c.type === 'clear' || c.type === 'destroyed'){
			var oldValue = index[id]
			index[id] = undefined
			updateListeners(id, oldValue, undefined)
		}else if(c.type === 'insert'){
			var old = index[id]
			if(old !== undefined){
				_.assertInt(c.index)
				var oldValue = index[id]
				var newValue = index[id] = old.substr(0, c.index) + c.value + old.substr(c.index)
				updateListeners(id, oldValue, newValue)
			}
		}else{
			_.errout('TODO?: '  + JSON.stringify(c))
		}
	})
	
	var handle = {}
	
	//handle.getStateAt = function(){_.errout('TODO?')}
	//handle.getPartialStateAt = function(){_.errout('TODO?')}
	
	handle.getValueAt = function(bindings, id){
		return index[id]
	}
	handle.get = function(id){
		return index[id]
	}
	
	handle.reverse = function(){
		return makeReversePropertyIndex(objSchema, property)
	}
	
	handle.listen = function(listener){
		listeners.push(listener)
	}

	return handle
}


function makePropertyIndex(objSchema, property, propertyIndex, makePropertyIndex, makeReversePropertyIndex){
	_.assertLength(arguments, 5)

	if(property.type.type === 'object' || property.type.type === 'primitive'){
		return makeSinglePropertyIndex(objSchema, property, propertyIndex, makeReversePropertyIndex)
	}
		
	var permanentCache = {}
	var ids = []
	var propertyCode = property.code
	
	var applyEdit

	var isSetProperty = property.type.type === 'list' || property.type.type === 'set'

	var listeners = []	
	function updateListeners(id, oldValue, newValue){
		for(var i=0;i<listeners.length;++i){
			listeners[i](id, oldValue, newValue)
		}
	}
		
	propertyIndex.attachIndex(objSchema.code, propertyCode, function(id, c){

		if(c.type === 'set' && isSetProperty){
			_.errout('invalid change for set property: ' + JSON.stringify(c) + ' ' + JSON.stringify(property))
		}
		
		var oldValue = permanentCache[id]
		var newValue = permanentCache[id] = applyEdit(permanentCache[id], c)

		updateListeners(id, oldValue, newValue)
	})
	
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
	
	function getValueAtForSingle(bindings, id){
		_.assertLength(arguments, 2)
		if(editId === -1) return

		return computeValueAt(id, editId)
	}
	function computeValueAt(id){
		var value = permanentCache[id]
		return value
	}
		
	function getStateAt(){
		var result = {}
		ids.forEach(function(id){
			result[id] = handle.getValueAt(id)
		})
		return result
	}
	
	function getPartialStateAt(bindings, ids){
		_.assertLength(arguments, 2)
		var result = {}
		ids.forEach(function(id){
			result[id] = handle.getValueAt(bindings, id)
		})
		return result
	}
	
	function applyEditForSet(v, c){
		if(!v) v = []
		if(c.type === 'add'){
			v.push(c.value)
		}else if(c.type === 'remove'){
			var index = indexOfRawId(v, c.value)
			if(index !== -1){
				v.splice(index, 1)
			}else{
				console.log('failed to remove: ' + c.value + ' ' + JSON.stringify(v))
			}
		}else{
			_.errout('tODO: ' + JSON.stringify(c))
		}
		return v
	}
	
	function getValueAtForSet(bindings, id){
		_.assertLength(arguments, 2)

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

		return permanentCache[id] || {}
	}
	
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
	
	handle.listen = function(listener){
		listeners.push(listener)
	}
	handle.get = function(key){
		return handle.getValueAt(undefined, key)
	}
	handle.reverse = function(){
		return makeReversePropertyIndex(objSchema, property)
	}
	
	return handle
}

function PrimitiveSet(){
	this.list = []
	this.removed = {}
	this.dirty = false
	this.uid = Math.random()
}
PrimitiveSet.prototype.add = function(v){
	//console.log('adding: ' + v + ' ' + this.uid)
	if(this.dirty && this.removed[v]){
		/*console.log('cleaning: ' + v + ' ' + this.uid)
		console.log(new Error().stack)
		this._clean()*/
		this.removed[v] = false
		return
	}else if(this.shown){
		this.list = [].concat(this.list)
		this.shown = false
	}
	//if(this.list.indexOf(v) !== -1) _.errout('invalid already has: ' + v)
	this.list.push(v)
}
PrimitiveSet.prototype.remove = function(v){
	//if(this.list.indexOf(v) === -1) _.errout('removing but does not have: ' + v)
	//console.log('removing: ' + v + ' ' + this.uid)
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

function makeSetReversePropertyIndex(objSchema, property, propertyIndex, makePropertyIndex){
	
	var keysAreBoolean = property.type.primitive === 'boolean'
	
	var stateCache = {}

	var propertyCode = property.code
	
	propertyIndex.attachIndex(objSchema.code, propertyCode, function(id, c){
		_.assertDefined(id)
		if(c.type === 'add'){
			var value = c.value
			if(keysAreBoolean) value = !!value
			var newSetValue = stateCache[value]
			if(!newSetValue){
				newSetValue = stateCache[value] = new PrimitiveSet()
			}
			newSetValue.add(id)
			//console.log('added ' + value + ' ' + id)
			updateListeners(value)//, id)
		}else if(c.type === 'remove'){
			var value = c.value
			if(keysAreBoolean) value = !!value
			var setValue = stateCache[value]
			setValue.remove(id)
			//console.log('removed ' + value + ' ' + id)
			updateListeners(value)//, undefined)
		}else{
			_.errout('TODO: ' + c.type + ' ' + JSON.stringify(c))
		}
		
	}, function(typeCode, id, editId){
		
	})
	
	var handle = {
		getValueAt: function(bindings, key){
			_.assertLength(arguments, 2)
			_.assertObject(bindings)
			
			if(keysAreBoolean){key = !!key}
			
			var state = stateCache[key]
			if(!state) return []
			return state.getRaw()
		}
	}
	handle.get = function(key){
		if(keysAreBoolean){key = !!key}
		
		var state = stateCache[key]
		if(!state) return []
		return state.getRaw()
	}
	handle.reverse = function(){
		return makePropertyIndex(objSchema, property)
	}
	
	var listeners = []	
	function updateListeners(key){//, value){
		for(var i=0;i<listeners.length;++i){
			listeners[i](key)//, value)
		}
	}
	handle.listen = function(cb){
		listeners.push(cb)
	}
	return handle
}

function makeReversePropertyIndex(objSchema, property, propertyIndex, makePropertyIndex){

	if(property.type.type === 'set' || property.type.type === 'map' || property.type.type === 'list'){
		return makeSetReversePropertyIndex(objSchema, property, propertyIndex, makePropertyIndex)
	}

	if(property.type.type === 'map'){
		_.errout('TODO?')
	}
	
	var keysAreBoolean = property.type.primitive === 'boolean'
	
	//var permanentCache = {}
	var stateCache = {}
	
	function removeStateValue(key, value){
		var oldSetValue = stateCache[key]
		oldSetValue.remove(value)
		updateListeners(key)//, oldSetValue.getRaw())
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
				
				updateListeners(value)//, newSetValue.getRaw())
				
				//if(propertyCode === 3) console.log('now: ' + value + ' is ' + JSON.stringify(stateCache))
				currentValue[id] = c.value
			}
		}else if(c.type === 'insert'){
			var value = c.value
			_.assertDefined(value)
			
			var old = currentValue[id]
			var newValue = old.substr(0, c.index)+c.value+old.substr(c.index)

			var newSetValue = stateCache[newValue]
			if(!newSetValue){
				newSetValue = stateCache[newValue] = new PrimitiveSet()
			}

			newSetValue.add(id)

			updateListeners(newValue)//, newSetValue.getRaw())

			currentValue[id] = newValue
			removeStateValue(old, id)

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

			updateListeners('false')//, newSetValue.getRaw())
			
		}else{
			//TODO?
		}
	})
	
	var handle = {
		getValueAt: function(bindings, key){//, editId){
			_.assertLength(arguments, 2)
			_.assertObject(bindings)
			
			if(keysAreBoolean){key = !!key}
			
			var state = stateCache[key]
			if(!state) return []
			return state.getRaw()
		
			
		}
	}
	handle.get = function(key){
		if(keysAreBoolean){key = !!key}
		
		var state = stateCache[key]
		if(!state) return []
		return state.getRaw()
	}
	handle.reverse = function(){
		return makePropertyIndex(objSchema, property)
	}
	
	var listeners = []	
	function updateListeners(key){//, value){//, oldValue, newValue){
		for(var i=0;i<listeners.length;++i){
			listeners[i](key)//, value)//{, oldValue, newValue)
		}
	}
	handle.listen = function(cb){
		listeners.push(cb)
	}
	return handle
}

