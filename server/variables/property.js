"use strict";

var _ = require('underscorem')

var Cache = require('./../variable_cache')
var listenerSet = require('./../variable_listeners')
var schema = require('./../../shared/schema')

var fixedPrimitive = require('./../fixed/primitive')
var fixedObject = require('./../fixed/object')

var makeKeyParser = require('./map').makeKeyParser

function propertyType(rel, ch){

	_.assertLength(rel.params, 2)
	if(rel.params[1].schemaType === undefined) _.errout(JSON.stringify(rel))
	_.assertObject(rel.params[1].schemaType)
	
	var st = rel.params[1].schemaType
	var propertyName = rel.params[0].value

	//console.log('property(' + propertyName + ') type of ' + JSON.stringify(st))
	
	if(propertyName === 'values'){
		//_.assertEqual(st.value.type, 'primitive')//TODO
		if(st.value.type === 'set' || st.value.type === 'list') _.errout('TODO')
		return {type: 'set', members: st.value}
	}
	
	if(st.type === 'primitive') throw new Error('cannot compute property "' + propertyName + '" of a non-object: ' + st.primitive)
	if(st.type === 'object'){
		if(propertyName === 'id'){
			return {type: 'primitive', primitive: 'int'}
		}else{
			var objSchema = ch.schema[st.object]
			if(objSchema === undefined) _.errout('cannot find object type: ' + st.object)
			var p = objSchema.properties[propertyName]
			if(p === undefined) _.errout('cannot find property "' + propertyName + '" of ' + objSchema.name);
			return p.type
		}
	}else if(st.type === 'view'){
		var objSchema = ch.viewMap[st.view].schema
		if(objSchema === undefined) _.errout('cannot find view schema: ' + st.view);

		//if(objSchema.name === undefined) _.errout('no name for view schema: ' + st.view);

		//console.log(propertyName + ' ' + JSON.stringify(objSchema) + '\n'+JSON.stringify(ch.viewMap[st.view]))
		if(objSchema.properties === undefined){
			_.errout('cannot find property (or any properties) "' + propertyName + '" of ' + objSchema.name + ' (' + st.view + ')');
		}
		var p = objSchema.properties[propertyName]
		if(p === undefined) _.errout('cannot find property "' + propertyName + '" of ' + objSchema.name);
		return p.type
	}else{
		if(st.members.type === 'object'){
			var objName = st.members.object
			var objSchema = ch.schema[objName]
			if(objSchema === undefined) throw new Error('cannot find object type: ' + objName + ' ' + JSON.stringify(st))
			var p = objSchema.properties[propertyName].type
			if(p === undefined) _.errout('cannot find property "' + propertyName + '" of ' + objSchema.name);
			if(p.type === 'set' || p.type === 'list'){
				p = p.members
			}
			if(p.type === 'map'){
				return p
			}
			return {type: st.type, members: p};
		}else{
			var objName = st.members.view
			var objSchema = ch.viewMap[objName].schema
			if(objSchema === undefined) throw new Error('cannot find view/object type: ' + objName + ' ' + JSON.stringify(st))
			var kp = objSchema.properties[propertyName]
			if(kp === undefined) _.errout('cannot find property "' + propertyName + '" of ' + objSchema.name);
			var p = kp.type
			if(p.type === 'set' || p.type === 'list'){
				p = p.members
			}
			_.assert(p.type !== 'map')
			return {type: st.type, members: p};
		}
	}
}

schema.addFunction('property', {
	schemaType: propertyType,
	implementation: propertyMaker,
	minParams: 2,
	maxParams: 2,
	callSyntax: 'property(propertyname,object|collection:object)'
})

function propertyMaker(s, self, rel, typeBindings){
	//console.log('^: ' + JSON.stringify(rel))
	//console.log('!: ' + JSON.stringify( rel.params[1].schemaType))
	var st = rel.params[1].schemaType
	if(st.type === 'object'){
		return objectPropertyMaker(s, self, rel, typeBindings)
	}else if(st.type === 'view'){
		return viewPropertyMaker(s, self, rel, typeBindings)
	}else if(st.type === 'set'){
		return objectSetPropertyMaker(s, self, rel, typeBindings)
	}else if(st.type === 'list'){
		_.errout('TODO?: ' + JSON.stringify(rel))
	}else if(st.type === 'map'){
		if(rel.params[0].value === 'values'){
			//_.errout('TODO')
			return mapValuesPropertyMaker(s, self, rel, typeBindings)
		}else{
			_.errout('TODO?: ' + JSON.stringify(rel))
		}
	}else{
		_.errout('TODO?: ' + JSON.stringify(rel))
	}
}

function viewPropertyMaker(s, self, rel, typeBindings){
	var contextGetter = self(rel.params[1], typeBindings)
	//console.log(JSON.stringify(rel))
	_.assertObject(contextGetter.wrappers)
	//console.log('object: ' + rel.params[1].schemaType.object)
	var objSchema = s.schema[rel.params[1].schemaType.view]

	var contextGetter = self(rel.params[1], typeBindings)
	
	var property = objSchema.properties[rel.params[0].value]
	var propertyCode = property.code
	_.assertInt(propertyCode)
	var cache = new Cache()
	
//	_.errout('TODO')


	var f = function(bindings, editId){
		var context = contextGetter(bindings, editId)
		return context.getProperty(propertyCode)	
	}
	
	f.wrapAsSet = contextGetter.wrappers[propertyCode]
	_.assertFunction(f.wrapAsSet)
	return f

}

function objectPropertyMaker(s, self, rel, typeBindings){
	var contextGetter = self(rel.params[1], typeBindings)
	//console.log(JSON.stringify(rel))
	var objSchema = s.schema[rel.params[1].schemaType.object]

	//console.log('value: ' + rel.params[0].value)
	if(rel.params[0].value === 'id'){
		var f = function(bindings, editId){
			var context = contextGetter(bindings, editId)
			//console.log('context: ' + JSON.stringify(Object.keys(context)))
			var listeners = listenerSet()
			var value
			context.attach({set: function(v, oldV, editId){
				value = v
				listeners.emitSet(value, oldV||-1, editId)
			},
			}, editId)
			var handle = {
				name: 'object-property-handle?',
				attach: function(listener, editId){
					listeners.add(listener)
					if(value !== undefined) listener.set(value, -1, editId)
				},
				detach: function(listener, editId){
					listeners.remove(listener)
					if(editId){
						listener.set(-1, value, editId)
					}
				},
				oldest: context.oldest
			}
			return handle
		}
		f.wrapAsSet = function(v, editId){
			return fixedPrimitive.make(s)(v, editId)
		}
		return f
	}
	
	var property = objSchema.properties[rel.params[0].value]


	var propertyCode = property.code
	_.assertInt(propertyCode)
	var cache = new Cache()

	var isObjectValue
	
	var c
	if(property.type.type === 'set' || property.type.type === 'list'){
		c = svgObjectCollectionValue
		isObjectValue = property.type.members.type === 'object'
	}else if(property.type.type === 'map'){
		//_.errout('TODO')
		c = svgObjectSingleMapValue
		isObjectValue = property.type.value.type === 'object'
	}else{
		c = svgObjectSingleValue
		isObjectValue = property.type.type === 'object'
	}
	var f = c.bind(undefined, s, cache, contextGetter, isObjectValue, propertyCode, rel)
	if(c === svgObjectSingleValue){
		f.wrapAsSet = function(v, editId){
			var res
			if(property.type.type === 'object'){
				res = fixedObject.make(s)(v, editId)
			}else{		
				res = fixedPrimitive.make(s)(v, editId)
			}
			_.assertObject(res)
			return res
		}
	}else{

		f.wrapAsSet = function(v, editId, context){
			var res
			if(property.type.members.type === 'object'){
				res = fixedObject.make(s)(v, editId, context)
			}else{		
				res = fixedPrimitive.make(s)(v, editId)
			}
			_.assertObject(res)
			return res
		}
	}
	return f
}

function mapValuesPropertyMaker(s, self, rel, typeBindings){
	
	var contextGetter = self(rel.params[1].params[1], typeBindings)
	var objSchema = s.schema[rel.params[1].params[1].schemaType.object]
	
	var property = objSchema.properties[rel.params[1].params[0].value]


	var propertyCode = property.code
	//_.assertInt(propertyCode)
	var cache = new Cache()

	var isObjectProperty = false
	if(property.type.value.type === 'object'){
		isObjectProperty = true
	}
	
	var f = svgMapValues.bind(undefined, s, cache, contextGetter, isObjectProperty, propertyCode)

	if(property.type.value.type === 'object'){
		var fo = fixedObject.make(s)
		f.wrapAsSet = function(v, editId, context){
			var r = fo(v, editId, context)
			_.assertString(r.name)
			return r
		}
	}else{
		var fp = fixedPrimitive.make(s)
		f.wrapAsSet = function(v, editId, context){
			return fp(v, editId)
			//_.errout('TODO: ' + v + ' ' + JSON.stringify(property.type))
		}
	}

	return f
}

function svgMapValues(s, cache, contextGetter, isObjectProperty, propertyCode, bindings, editId){
	
	var elements = contextGetter(bindings, editId)
	
	var key = elements.key
	
	if(cache.has(key)) return cache.get(key)
	
	var listeners = listenerSet()

	var values = []
	var counts = {}
	var oldValues = {}
	var keyForValue = {}
	
	var rootId
	
	var latestEditId
	
	function oldest(){
		return elements.oldest()
	}
	
	//console.log('made map-values variable: ' + elements.name)
	
	var oldTypeGetter;
	
	var handle = {
		name: 'map-values',
		attach: function(listener, editId){
			_.assertInt(editId)
			listeners.add(listener)
			for(var i=0;i<values.length;++i){
				listener.add(values[i], editId)
			}
		},
		detach: function singleObjectPropertyValue(listener, editId){
			listeners.remove(listener)
			if(editId){f
				for(var i=0;i<values.length;++i){
					listener.remove(values[i], editId)
				}
			}
		},
		oldest: oldest,
		key: key,
		descend: function(path, editId, cb, continueListening){
			//TODO if object is top, just go that way, otherwise junk it and use the key for the path?
			var id = path[0].edit.id
			if(s.objectState.isTopLevelObject(id)){
				//_.errout('TODO?')
				s.objectState.streamProperty(path, editId, cb, continueListening)
			}else{
				//_.errout('TODO?: ' + JSON.stringify(path))
				var key = keyForValue[id]
				if(key === undefined){
					//console.log('no value for id: ' + id)
					cb(undefined, editId)
				}else{
					//_.assertDefined(key)
					var np = [
						{op: 'selectObject', edit: {id: rootId}},
						{op: 'selectProperty', edit: {typeCode: propertyCode}},
						//{op: 'selectKey', edit: {key: key}}
						{op: 'selectObject', edit: {id: id}}
						]
					_.assert(path.length >= 2)
					np = np.concat(path.slice(1))
					//console.log('descending map-values: ' + JSON.stringify(np))
					elements.descend(np, editId, function(pv, editId){
						//console.log('descent result: ' + JSON.stringify(pv))
						cb(pv, editId)
					}, continueListening)
				}
			}
		},
		descendTypes: function(path, editId, cb, continueListening){
			//TODO if object is top, just go that way, otherwise junk it and use the key for the path?
			var id = path[0].edit.id
			if(s.objectState.isTopLevelObject(id)){
				//_.errout('TODO?')
				s.objectState.streamPropertyTypes(path, editId, cb, continueListening)
			}else{
				//_.errout('TODO?: ' + JSON.stringify(path))
				var key = keyForValue[id]
				if(key === undefined){
					//console.log('no value for id: ' + id)
					cb(undefined, editId)
				}else{
					//_.assertDefined(key)
					var np = [
						{op: 'selectObject', edit: {id: rootId}},
						{op: 'selectProperty', edit: {typeCode: propertyCode}},
						//{op: 'selectKey', edit: {key: key}}
						{op: 'selectObject', edit: {id: id}}
						]
					_.assert(path.length >= 2)
					np = np.concat(path.slice(1))
					//console.log('descending map-values: ' + JSON.stringify(np))
					elements.descendTypes(np, editId, function(pv, editId){
						//console.log('descent result: ' + JSON.stringify(pv))
						cb(pv, editId)
					}, continueListening)
				}
			}
		},
		getType: function(v){
			//_.errout('TODO')
			if(!isObjectProperty) _.errout('internal error')
			return oldTypeGetter(v)
		}
	}
	
	elements.attach({
		set: function(id, oldId, editId){
			rootId = id
			function listener(key, v, editId){
				var oldV = oldValues[key]
				if(oldV === v) return
				
				//console.log('property put ' + key + ' -> ' + v + ' (' + oldV + ')')
				if(oldV !== undefined){
					if(counts[oldV] === 1){
						delete counts[oldV]
						values.splice(values.indexOf(oldV), 1)
						listeners.emitRemove(oldV, editId)
						//console.log('remove: ' + oldV)
					}else{
						--counts[oldV]
					}
				}
				if(counts[v] === undefined){
					counts[v] = 1
					values.push(v)
					listeners.emitAdd(v, editId)
					//console.log('emit: ' + v)
				}else{
					++counts[v]
				}
				oldValues[key] = v
				keyForValue[v] = key
			}

			if(isObjectProperty){
				s.objectState.streamPropertyTypes([{op: 'selectObject', edit: {id: id}}, {op: 'selectProperty', edit: {typeCode: propertyCode}}], editId, function(typeGetter, editId){
					oldTypeGetter = typeGetter
				}, true)
			}
			
			var path = [
				{op: 'selectObject', edit: {id: id}}, 
				{op: 'selectProperty', edit: {typeCode: propertyCode}}
			]

			elements.descend(path, editId, function(pv, editId){
				//console.log('got pv: ' + JSON.stringify(pv))
				//_.errout('TODO')
				if(pv !== undefined){
					var keys = Object.keys(pv)
					keys.forEach(function(key){
						var v = pv[key]
						keyForValue[v] = key
						listener(key, v, editId)
					})
				}
				
			})
		},
	}, editId)

	
	return cache.store(key, handle)
	
}

function objectSetPropertyMaker(s, self, rel, typeBindings){
	var contextGetter = self(rel.params[1], typeBindings)
	
	var objSchema = s.schema[rel.params[1].schemaType.members.object]
	var property = objSchema.properties[rel.params[0].value]
	var propertyCode = property.code
	_.assertInt(propertyCode)
	var cache = new Cache()
	var c;
	
	var isObjectProperty
	if(property.type.type === 'set' || property.type.type === 'list'){
		//if(rel.schemaType.members.type !== 'primitive') _.errout('TODO: handl wrapAsSet for non-primitives')
		c = svgObjectSetCollectionValue
		isObjectProperty = property.type.members.type === 'object'
	}else if(property.type.type === 'map'){
		//_.errout('TODO')
		c = svgObjectSetMapValue
		var keyParser = makeKeyParser(property.type.key)
		var f = c.bind(undefined, s, cache, contextGetter, isObjectProperty, propertyCode, keyParser)
	
		/*var fo = fixedObject.make(s)
		f.wrapAsSet = function(v, editId, context){
			var r = fo(v, editId, context)
			_.assertString(r.name)
			return r
		}*/
	
		return f
		
	}else{
		c = svgObjectSetSingleValue
		isObjectProperty = property.type.type === 'object'
	}	
	var f = c.bind(undefined, s, cache, contextGetter, isObjectProperty, propertyCode)
	
	var fo = fixedObject.make(s)
	f.wrapAsSet = function(v, editId, context){
		var r = fo(v, editId, context)
		_.assertString(r.name)
		return r
	}
	
	return f
}

var ccc = 0


function svgObjectSingleValue(s, cache, contextGetter, isObjectProperty, propertyCode, metadata, bindings, editId){
	_.assertInt(editId)
	var elements = contextGetter(bindings, editId)

	//console.log('property: ' + propertyCode)

	var key = elements.key
	if(cache.has(key)) return cache.get(key)
	
	var listeners = listenerSet()

	var value
	var ongoingEditId
	var latestEditId
	
	function oldest(){
		var oldestEditId = elements.oldest()
		//console.log('p(' + propertyCode + ') oldest ' + oldestEditId + ' ' + ongoingEditId)
		if(ongoingEditId !== undefined) return Math.min(oldestEditId, ongoingEditId)
		else return oldestEditId
	}
	
	var handle = {
		name: 'property-of-object',
		attach: function(listener, editId){
			_.assertInt(editId)
			//console.log(JSON.stringify(metadata))			
			_.assertFunction(listener.set)
			//console.log('property getting attach: ' + propertyCode + ' ' + isObjectProperty)
			listeners.add(listener)
			//console.log('attaching to property ' + propertyCode + ' ' + value + ' ' + editId)
			//if(propertyCode === 100) console.log(new Error().stack)
			//console.log('^'+JSON.stringify(Object.keys(listener)))
			if(value !== undefined){
				listener.set(value, undefined, editId)
			}
		},
		detach: function singleObjectPropertyValue(listener, editId){
			listeners.remove(listener)
			if(editId){
				//console.log(new Error().stack)
				//console.log('d: ' + listener.set)
				listener.set(undefined, value, editId)
			}
		},
		oldest: oldest,
		key: key,
		descend: function(){_.errout('TODO?')}
	}

	if(isObjectProperty){
		var innerLookup = {}
		handle.descend = function(path, editId, cb){
			_.assertInt(path[0].edit.id)
			var id = innerLookup[path[0].edit.id]
			_.assertInt(id)
			elements.descend([{op: 'selectObject', edit: {id: id}}, {op: 'selectProperty', edit: {typeCode: propertyCode}}]
				.concat(path), editId, cb)
		}
	}
	
	var uid = Math.random()
	
	elements.attach({
		set: function(id, oldId, editId){
			if(ongoingEditId === undefined) ongoingEditId = editId
			latestEditId = editId
			//TODO listen for changes to object
			_.assertInt(id)
			_.assertInt(editId)

			//s.log('GETTING(' + id + ') PBOJECR: ' + propertyCode)
			//s.log(elements.name + ': '+elements)
			//s.log(Object.keys(elements))
			_.assertInt(id)
			//console.log(id + ' ' + editId)
			elements.descend([{op: 'selectObject', edit: {id: id}}, {op: 'selectProperty', edit: {typeCode: propertyCode}}], 
				editId, function(pv, editId){
				//console.log(key + ' ' + uid+' got pv(' + id+','+propertyCode + '): ' + JSON.stringify(pv) + ' ' + value)
				if(pv !== undefined){
					if(pv !== value){
						if(isObjectProperty){
							innerLookup[pv] = id;
						}
						var oldValue = value
						value = pv
						//console.log('emitting value')
						listeners.emitSet(pv, oldValue, editId)
					}
				}
				ongoingEditId = undefined
			})
		}
	}, editId)
	
	return cache.store(key, handle)
}


function svgObjectCollectionValue(s, cache, contextGetter, isObjectProperty, propertyCode, metadata, bindings, editId){
	_.assertInt(editId)
	var elements = contextGetter(bindings, editId)

	var key = elements.key
	if(cache.has(key)) return cache.get(key)
	
	//console.log('making object collection variable: ' + key)
	
	var listeners = listenerSet()

	var values = []
	var counts = {}
	
	var ongoingEditId
	var latestEditId
	
	function oldest(){
		var oldestEditId = elements.oldest()
		//console.log('h: ' + oldestEditId + ' ' + ongoingEditId)
		if(ongoingEditId !== undefined) return Math.min(oldestEditId, ongoingEditId)
		else return oldestEditId
	}
	
	var handle = {
		name: 'property-of-object-collection',
		attach: function(listener, editId){
			_.assertInt(editId)
			listeners.add(listener)
			//console.log('#attaching to property ' + propertyCode + ' ' + JSON.stringify(values))
			values.forEach(function(v){
				listener.add(v, editId)
			})
		},
		detach: function(listener, editId){
			listeners.remove(listener)
			if(editId){
				values.forEach(function(v){
					listener.remove(v, editId)
				})
			}
		},
		oldest: oldest,
		key: key,
		descend: function(){_.errout('TODO?')},
		getType: function(v){
			//_.errout('TODO')
			if(!isObjectProperty) _.errout('internal error')
			return oldTypeGetter(v)
		}
	}
	//TODO listen for changes
	
	if(isObjectProperty){
		var innerLookup = {}
		handle.descend = function(path, editId, cb){
			_.assertEqual(path[0].op, 'selectObject')
			var id = innerLookup[path[0].edit.id]
			if(id === undefined){
				s.log(JSON.stringify(innerLookup))
				_.errout('tried to descend into unknown id: ' + path[0].edit.id)
			}
			elements.descend([{op: 'selectObject', edit: {id: id}}, {op: 'selectProperty', edit: {typeCode: propertyCode}}]
				.concat(path), editId, cb)
		}
		handle.descendTypes = function(path, editId, cb){
			_.assertEqual(path[0].op, 'selectObject')
			var id = innerLookup[path[0].edit.id]
			if(id === undefined){
				s.log(JSON.stringify(innerLookup))
				_.errout('tried to descend into unknown id: ' + path[0].edit.id)
			}
			elements.descendTypes([{op: 'selectObject', edit: {id: id}}, {op: 'selectProperty', edit: {typeCode: propertyCode}}]
				.concat(path), editId, cb)
		}
	}
	
	var oldPv
	var oldTypeGetter
	
	var previousStreamListener
	elements.attach({
		set: function(id, oldId, editId){
			if(ongoingEditId === undefined) ongoingEditId = editId
			latestEditId = editId
			_.assertInt(id)
			_.assertInt(editId)
			
			//TODO stop streaming previous
			if(previousStreamListener){
				//s.objectState.stopStreamingProperty(id, propertyCode, previousStreamListener)
				_.errout('TODO')
			}
			function streamListener(pv, editId){
				ongoingEditId = undefined
				
				//console.log('streaming object property: ' + JSON.stringify(pv))

				if(oldPv !== undefined){
					//console.log('cleaning up oldPv ' + JSON.stringify(oldPv) + ' -> ' + JSON.stringify(pv))
					//console.log('counts: ' + JSON.stringify(counts))
					oldPv.forEach(function(v){
						if(pv.indexOf(v) === -1){
							--counts[v]
							if(counts[v] === 0){
								//console.log('emitting remove')
								listeners.emitRemove(v, editId)
							}
						}
					})
				}
				oldPv = [].concat(pv)

				if(isObjectProperty && pv !== undefined){
					//_.assertInt(pv)
					pv.forEach(function(v){
						innerLookup[v] = id
					})
				}
				s.log('streaming property(', propertyCode, '): ', pv)
				//console.log('streaming property(' + propertyCode + '): ' + JSON.stringify(pv))
				//var pv = obj[propertyCode]
				if(pv !== undefined){
					pv.forEach(function(v){
						if(!counts[v]){
							counts[v] = 1
							values.push(v)
							s.log('emitting add: ', v)
							//console.log('emitting add')
							listeners.emitAdd(v, editId)
						}else if(oldPv.indexOf(v) === -1){
							++counts[v]
						}
					})
				}
			}
			previousStreamListener = streamListener

			if(isObjectProperty){
				s.objectState.streamPropertyTypes([{op: 'selectObject', edit: {id: id}}, {op: 'selectProperty', edit: {typeCode: propertyCode}}], editId, function(typeGetter, editId){
					oldTypeGetter = typeGetter
				}, true)
			}
			
			elements.descend([{op: 'selectObject', edit: {id: id}}, {op: 'selectProperty', edit: {typeCode: propertyCode}}],
				editId, streamListener)
			
		},
		objectChange: function(subjTypeCode, subjId, typeCode, id, path, op, edit, syncId, editId){
			//TODO?
			_.errout('TODO')
		}
	}, editId)
	
	return cache.store(key, handle)
}

function svgObjectSingleMapValue(s, cache, contextGetter, isObjectProperty, propertyCode, metadata, bindings, editId){
	_.assertInt(editId)
	var elements = contextGetter(bindings, editId)

	var key = elements.key
	if(cache.has(key)) return cache.get(key)
	
	//console.log('making object collection variable: ' + key)
	
	var listeners = listenerSet()

	var values = {}
	
	var ongoingEditId
	var latestEditId
	
	function oldest(){
		var oldestEditId = elements.oldest()
		//console.log('h: ' + oldestEditId + ' ' + ongoingEditId)
		if(ongoingEditId !== undefined) return Math.min(oldestEditId, ongoingEditId)
		else return oldestEditId
	}
	
	var handle = {
		name: 'property-of-object-map',
		attach: function(listener, editId){
			_.assertInt(editId)
			listeners.add(listener)
			//console.log('#attaching to property ' + propertyCode + ' ' + JSON.stringify(values))
			Object.keys(values).forEach(function(key){
				var v = values[key]
				listener.put(key, v, undefined, editId)
			})
		},
		detach: function(listener, editId){
			listeners.remove(listener)
			if(editId){
				Object.keys(values).forEach(function(key){
					listener.del(key, editId)
				})
			}
		},
		oldest: oldest,
		key: key,
		descend: function(){_.errout('TODO?')},
		getType: function(v){
			//_.errout('TODO')
			if(!isObjectProperty) _.errout('internal error')
			return oldTypeGetter(v)
		}
	}
	//TODO listen for changes
	
	if(isObjectProperty){
		//var innerLookup = {}
		var currentId
		handle.descend = function(path, editId, cb){
			_.assertEqual(path[0].op, 'selectObject')
			var id = currentId//innerLookup[path[0].edit.id]
			if(id === undefined){
				s.log(JSON.stringify(innerLookup))
				_.errout('tried to descend into unknown id: ' + path[0].edit.id)
			}
			elements.descend([{op: 'selectObject', edit: {id: id}}, {op: 'selectProperty', edit: {typeCode: propertyCode}}]
				.concat(path), editId, cb)
		}
		handle.descendTypes = function(path, editId, cb){
			_.assertEqual(path[0].op, 'selectObject')
			var id = currentId//innerLookup[path[0].edit.id]
			if(id === undefined){
				s.log(JSON.stringify(innerLookup))
				_.errout('tried to descend into unknown id: ' + path[0].edit.id)
			}
			elements.descendTypes([{op: 'selectObject', edit: {id: id}}, {op: 'selectProperty', edit: {typeCode: propertyCode}}]
				.concat(path), editId, cb)
		}
	}
	
	//var oldPv
	var oldTypeGetter
	
	var previousStreamListener
	elements.attach({
		set: function(id, oldId, editId){
			if(ongoingEditId === undefined) ongoingEditId = editId
			latestEditId = editId
			_.assertInt(id)
			_.assertInt(editId)
			
			if(isObjectProperty){
				currentId = id
			}
			//TODO stop streaming previous
			if(previousStreamListener){
				//s.objectState.stopStreamingProperty(id, propertyCode, previousStreamListener)
				_.errout('TODO')
			}
			function streamListener(pv, editId){
				ongoingEditId = undefined
				
				pv = pv || {}
				//console.log('streaming object property: ' + JSON.stringify(pv))

				if(values !== undefined){
					//console.log('cleaning up oldPv ' + JSON.stringify(oldPv) + ' -> ' + JSON.stringify(pv))
					//console.log('counts: ' + JSON.stringify(counts))
					Object.keys(values).forEach(function(key){
						var v = values[key]
						if(pv[key] === undefined){//.indexOf(v) === -1){
							//--counts[v]
							//if(counts[v] === 0){
								//console.log('emitting remove')
								listeners.emitDel(key, editId)
							//}
						}
					})
				}

				/*if(isObjectProperty && pv !== undefined){
					//_.assertInt(pv)
					Object.keys(pv).forEach(function(v){
						innerLookup[v] = id
					})
				}*/
				s.log('streaming property(', propertyCode, '): ', pv)
				//console.log('streaming property(' + propertyCode + '): ' + JSON.stringify(pv))
				//var pv = obj[propertyCode]
				if(pv !== undefined){
					Object.keys(pv).forEach(function(key){
						var v = pv[key]
						
						if(values[key] !== v){
							listeners.emitPut(key, v, values[key], editId)
						}
						/*if(!counts[v]){
							counts[v] = 1
							values.push(v)
							s.log('emitting add: ', v)
							//console.log('emitting add')
							listeners.emitAdd(v, editId)
						}else if(oldPv.indexOf(v) === -1){
							++counts[v]
						}*/
					})
				}

				values = {}
				Object.keys(pv).forEach(function(key){values[key] = pv[key];})

			}
			previousStreamListener = streamListener

			if(isObjectProperty){
				s.objectState.streamPropertyTypes([{op: 'selectObject', edit: {id: id}}, {op: 'selectProperty', edit: {typeCode: propertyCode}}], editId, function(typeGetter, editId){
					oldTypeGetter = typeGetter
				}, true)
			}
			
			elements.descend([{op: 'selectObject', edit: {id: id}}, {op: 'selectProperty', edit: {typeCode: propertyCode}}],
				editId, streamListener)
			
		},
		objectChange: function(subjTypeCode, subjId, typeCode, id, path, op, edit, syncId, editId){
			//TODO?
			_.errout('TODO')
		}
	}, editId)
	
	return cache.store(key, handle)
}

function svgObjectSetSingleValue(s, cache, contextGetter, isObjectProperty, propertyCode, bindings, editId){
	var elements = contextGetter(bindings, editId)

	var key = elements.key
	if(cache.has(key)) return cache.get(key)
	
	var listeners = listenerSet()

	var propertyValues = []
	var pvCounts = {}
	var ongoingEditIds = {}
	
	function wait(editId){
		ongoingEditIds[editId] = 1 + (ongoingEditIds[editId] || 0)
	}
	function resume(editId){
		--ongoingEditIds[editId]
		if(ongoingEditIds[editId] === 0) delete ongoingEditIds[editId]
	}
	
	function oldest(){
		var oldestEditId = elements.oldest()
		Object.keys(ongoingEditIds).forEach(function(v){
			v = parseInt(v)
			if(v < oldestEditId) oldestEditId = v
		})
		return oldestEditId
	}
	
	var oldTypeGetters = []//TODO optimize this
	
	var handle = {
		name: 'object-set-single-value-property',
		attach: function(listener, editId){
			listeners.add(listener)
			//console.log('attached to property %^^^^^^^^^^^^^^^^^^^^^^6')
			propertyValues.forEach(function(v){listener.add(v,editId);})
		},
		detach: function(listener, editId){
			listeners.remove(listener)
			//console.log('detached from property %^^^^^^^^^^^^^^^^^^^^^^6')
			if(editId){
				propertyValues.forEach(function(v){listener.remove(v,editId);})
			}
		},
		oldest: oldest,
		key: key,
		descend: function(){
			_.errout('TODO?')
		},
		descendTypes: function(){
			_.errout('TODO?')
		},
		getType: function(v){
			//_.errout('TODO?: ' + v)
			if(!isObjectProperty) _.errout('internal error')
			
			//return oldTypeGetter(v)
			var res
			for(var i=0;i<oldTypeGetters.length;++i){
				res = oldTypeGetters[i](v, true)
				if(res) break;
			}
			if(res === undefined) _.errout('cannot find type of id: ' + v)
			return res
		}
	}
	
	if(isObjectProperty){
		var innerLookup = {}
		handle.descend = function(path, editId, cb){
			_.assertEqual(path[0].op, 'selectObject')
			var id = innerLookup[path[0].edit.id]
			_.assertInt(id)
			//console.log('descending')
			elements.descend([{op: 'selectObject', edit: {id: id}}, {op: 'selectProperty', edit: {typeCode: propertyCode}}]
				.concat(path), editId, cb)
		}
		
		handle.descendTypes = function(path, editId, cb, continueListening){
			var id = path[0].edit.id
			var id = innerLookup[path[0].edit.id]
			_.assertInt(id)
			elements.descendTypes([{op: 'selectObject', edit: {id: id}}, {op: 'selectProperty', edit: {typeCode: propertyCode}}]
				.concat(path), editId, cb)
				/*
			var np = [
				{op: 'selectObject', edit: {id: rootId}},
				{op: 'selectProperty', edit: {typeCode: propertyCode}},
				{op: 'selectObject', edit: {id: id}}
				]
			_.assert(path.length >= 2)
			np = np.concat(path.slice(1))
			elements.descendTypes(np, editId, function(pv, editId){
				cb(pv, editId)
			}, continueListening)*/
		}
	}

	if(elements.descendTypes === undefined) _.errout('must provide descendTypes for ' + elements.name)
	
	elements.attach({
		add: function(id, outerEditId){
			wait(outerEditId)
			
			//_.errout('TODO stream property state')
			var cur;
			var first = true
			//console.log('added id: ' + id)
			//s.objectState.streamProperty(id, propertyCode, editId, function(pv, editId){
			
			if(isObjectProperty){
				//s.objectState.streamPropertyTypes([{op: 'selectObject', edit: {id: id}}, {op: 'selectProperty', edit: {typeCode: propertyCode}}], outerEditId, function(typeGetter, editId){
				elements.descendTypes([{op: 'selectObject', edit: {id: id}}, {op: 'selectProperty', edit: {typeCode: propertyCode}}], outerEditId, function(typeGetter, editId){
					oldTypeGetters.push(typeGetter)
				}, true)
			}
			
			elements.descend([{op: 'selectObject', edit: {id: id}}, {op: 'selectProperty', edit: {typeCode: propertyCode}}], 
				outerEditId, function(pv, editId){
				//console.log('GOT PROPERTY VALUE: ' + id + ' ' + pv + ' ' + editId + ' ' + propertyCode)
				//console.log(new Error().stack)
				if(!first){
					if(pvCounts[cur] === 1){
						delete pvCounts[cur]
						propertyValues.splice(propertyValues.indexOf(cur), 1)
						//console.log('removing old')
						listeners.emitRemove(cur, editId)
					}
				}
				if(pv !== undefined){
				
					if(isObjectProperty){
						innerLookup[pv] = id
					}
					
					cur = pv
					if(pvCounts[pv] === undefined){
						pvCounts[pv] = 1
						propertyValues.push(pv)
						//console.log('calling add: ' + pv)
						listeners.emitAdd(pv, editId)
					}else{
						++pvCounts[pv]
					}
				}else{
					if(cur !== undefined){
						_.errout('TODO remove')
					}
				}
				if(first){
					resume(outerEditId)
					first = false
				}
			})
			
			
		},
		remove: function(id, editId){
			wait(editId)
			//console.log('removing value of: ' + id)
			elements.descend([{op: 'selectObject', edit: {id: id}}, {op: 'selectProperty', edit: {typeCode: propertyCode}}], 
				editId, function(pv, editId){//TODO stop listening after first get
				if(pvCounts[pv] === 1){
					delete pvCounts[pv]
					propertyValues.splice(propertyValues.indexOf(pv), 1)
					listeners.emitRemove(pv, editId)
				}else{
					--pvCounts[pv]
				}
				resume(editId)				
			})
		},
		objectChange: function(subjTypeCode, subjId, typeCode, id, path, op, edit, syncId, editId){
			//TODO?
			_.errout('TODO')
		}
	}, editId)
	
	return cache.store(key, handle)
}

function stub(){}


function svgObjectSetMapValue(s, cache, contextGetter, isObjectProperty, propertyCode, keyParser, bindings, editId){
	var elements = contextGetter(bindings, editId)

	//_.errout('propertyCode: ' + propertyCode)
	
	var key = elements.key
	if(cache.has(key)) return cache.get(key)
	
	var listeners = listenerSet()

	var keyValues = []
	var values = {}
	var keyCounts = {}
	var ongoingEditIds = {}
	
	function wait(editId){
		ongoingEditIds[editId] = 1 + (ongoingEditIds[editId] || 0)
	}
	function resume(editId){
		--ongoingEditIds[editId]
		if(ongoingEditIds[editId] === 0) delete ongoingEditIds[editId]
	}
	
	function oldest(){
		var oldestEditId = elements.oldest()
		Object.keys(ongoingEditIds).forEach(function(v){
			v = parseInt(v)
			if(v < oldestEditId) oldestEditId = v
		})
		return oldestEditId
	}
	
	var handle = {
		name: 'property-of-object-set-map',
		attach: function(listener, editId){
			listeners.add(listener)
			//console.log('attached to property %^^^^^^^^^^^^^^^^^^^^^^6')
			//console.log(JSON.stringify(keyValues))
			//console.log(JSON.stringify(values))
			keyValues.forEach(function(key){listener.put(key,values[key],undefined,editId);})
		},
		detach: function(listener, editId){
			listeners.remove(listener)
			//console.log('detached from property %^^^^^^^^^^^^^^^^^^^^^^6')
			if(editId){
				keyValues.forEach(function(key){listener.del(key,editId);})
			}
		},
		oldest: oldest,
		key: key,
		descend: function(){_.errout('TODO?')}
	}
	
	if(isObjectProperty){
		var innerLookup = {}
		handle.descend = function(path, editId, cb){
			_.assertEqual(path[0].op, 'selectObject')
			var id = innerLookup[path[0].edit.id]
			elements.descend([{op: 'selectObject', edit: {id: id}}, {op: 'selectProperty', edit: {typeCode: propertyCode}}]
				.concat(path), editId, cb)
		}
	}
	
	elements.attach({
		add: function(id, outerEditId){
			wait(outerEditId)
			//s.log('got add ^@#@#@#@#@#@#@#@#@#@#: ', id, ' ', editId, ' ', propertyCode)
			//_.errout('TODO')
			//TODO listen for changes to object
			var first = true
			var old;
			
			elements.descend([{op: 'selectObject', edit: {id: id}}, {op: 'selectProperty', edit: {typeCode: propertyCode}}],
				editId, function(v, editId){
				
				_.assertInt(editId)
				
				if(isObjectProperty){
					innerLookup[v] = id
				}
				if(!first){
					_.errout('TODO remove old?')
				}
				if(v !== undefined){
					_.assertObject(v)
					//console.log('got: ' + JSON.stringify(v))
					Object.keys(v).forEach(function(key){
						key = keyParser(key)
						var value = v[key]
						if(keyCounts[key] === undefined){
							keyCounts[key] = 1
							keyValues.push(key)
							values[key] = value
							//s.log('calling add')
							//listeners.emitAdd(pv, editId)
							//if(values[key] !== value){
								listeners.emitPut(key, value, undefined, editId)
							//}
						}else{
							++keyCounts[pv]
						}
					})
				}
				if(first){
					first = false
					resume(outerEditId)
				}
				old = v
			})
		},
		remove: function(id, editId){
			wait(editId)
			//console.log('remov..')
			elements.descend([{op: 'selectObject', edit: {id: id}}, {op: 'selectProperty', edit: {typeCode: propertyCode}}], 
				editId, function(v, editId){
				if(v === undefined){
					resume(editId)
					return
				}
				//console.log('remov..')
				v.forEach(function(pv){
					if(keyCounts[pv] === 1){
						delete keyCounts[pv]
						propertyValues.splice(propertyValues.indexOf(pv), 1)
						listeners.emitRemove(pv, editId)
					}else{
						--keyCounts[pv]
					}
				})
				resume(editId)
			})
		},
		objectChange: function(subjTypeCode, subjId, typeCode, id, path, op, edit, syncId, editId){
			//TODO?
			_.errout('TODO')
		}
	}, editId)
	
	return cache.store(key, handle)
}

function svgObjectSetCollectionValue(s, cache, contextGetter, isObjectProperty, propertyCode, bindings, editId){
	var elements = contextGetter(bindings, editId)

	var key = elements.key
	if(cache.has(key)) return cache.get(key)
	
	var listeners = listenerSet()

	var propertyValues = []
	var pvCounts = {}
	var ongoingEditIds = {}
	
	function wait(editId){
		ongoingEditIds[editId] = 1 + (ongoingEditIds[editId] || 0)
	}
	function resume(editId){
		--ongoingEditIds[editId]
		if(ongoingEditIds[editId] === 0) delete ongoingEditIds[editId]
	}
	
	function oldest(){
		var oldestEditId = elements.oldest()
		Object.keys(ongoingEditIds).forEach(function(v){
			v = parseInt(v)
			if(v < oldestEditId) oldestEditId = v
		})
		return oldestEditId
	}
	
	var handle = {
		name: 'property-of-object-set-collection',
		attach: function(listener, editId){
			listeners.add(listener)
			//console.log('attached to property %^^^^^^^^^^^^^^^^^^^^^^6')
			propertyValues.forEach(function(v){listener.add(v,editId);})
		},
		detach: function(listener, editId){
			listeners.remove(listener)
			//console.log('detached from property %^^^^^^^^^^^^^^^^^^^^^^6')
			if(editId){
				propertyValues.forEach(function(v){listener.remove(v,editId);})
			}
		},
		oldest: oldest,
		key: key,
		descend: function(){_.errout('TODO?')}
	}
	
	if(isObjectProperty){
		var innerLookup = {}
		handle.descend = function(path, editId, cb){
			_.assertEqual(path[0].op, 'selectObject')
			var id = innerLookup[path[0].edit.id]
			//console.log('getting: ' + path[0].edit.id + '-> ?')
			//console.log(JSON.stringify(innerLookup))
			_.assertInt(id)
			elements.descend([{op: 'selectObject', edit: {id: id}}, {op: 'selectProperty', edit: {typeCode: propertyCode}}]
				.concat(path), editId, cb)
		}
	}
	
	//var uid = Math.random()
	
	elements.attach({
		add: function(id, outerEditId){
			wait(outerEditId)
			//console.log('got add $$$$$$$$$$$$$$$$$$$$$$: ', id, ' ', outerEditId, ' ', propertyCode)

			var first = true
			var currentV
			elements.descend([{op: 'selectObject', edit: {id: id}}, {op: 'selectProperty', edit: {typeCode: propertyCode}}],
				outerEditId, function(v, editId){
				if(currentV !== undefined){
					currentV.forEach(function(pv){
						//console.log('currentV: ' + pv)
						if(v.indexOf(pv) === -1){
							--pvCounts[pv]
							//console.log('pvCounts: ' + JSON.stringify(pvCounts) + ' ' + pv)
							if(pvCounts[pv] === 0){
								//console.log('calling remove: ' + pv)
								listeners.emitRemove(pv, editId)
								delete pvCounts[pv]
								propertyValues.splice(propertyValues.indexOf(pv), 1)
								if(isObjectProperty){
									_.assertEqual(innerLookup[pv], id)
									delete innerLookup[pv]
								}
							}
						}
					})
				}
				if(v !== undefined){
					//console.log(id + ' got v: ' + JSON.stringify(v) + '\t\t' + uid)
					_.assertArray(v)
					v.forEach(function(pv){

						if(isObjectProperty){
							innerLookup[pv] = id
						}

						if(pvCounts[pv] === undefined){
							pvCounts[pv] = 1
							propertyValues.push(pv)
							//console.log('calling add: ' + pv)
							listeners.emitAdd(pv, editId)
						}else{
							++pvCounts[pv]
						}
					})
				}else{
					console.log('descend got undefined')
					_.assertUndefined(currentV)
				}
				currentV = [].concat(v)
				if(first){
					first = false
					resume(outerEditId)
				}
			})
		},
		remove: function(id, editId){
			wait(editId)
			//console.log('remov..')
			elements.descend([{op: 'selectObject', edit: {id: id}}, {op: 'selectProperty', edit: {typeCode: propertyCode}}], 
				editId, function(v, editId){
				if(v === undefined){
					resume(editId)
					return
				}
				//console.log('remov.. ' + JSON.stringify(v))
				v.forEach(function(pv){
					if(pvCounts[pv] === 1){
						delete pvCounts[pv]
						propertyValues.splice(propertyValues.indexOf(pv), 1)
						listeners.emitRemove(pv, editId)
					}else{
						--pvCounts[pv]
					}
				})
				resume(editId)
			})
		},
		objectChange: function(subjTypeCode, subjId, typeCode, id, path, op, edit, syncId, editId){
			//TODO?
			_.errout('TODO')
		}
	}, editId)
	
	return cache.store(key, handle)
}
