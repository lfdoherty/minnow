"use strict";

var _ = require('underscorem')

var Cache = require('./../variable_cache')
var listenerSet = require('./../variable_listeners')
var schema = require('./../../shared/schema')

var fixedPrimitive = require('./../fixed/primitive')
var fixedObject = require('./../fixed/object')

function propertyType(rel, ch){

	_.assertLength(rel.params, 2)
	_.assertObject(rel.params[1].schemaType)
	
	var st = rel.params[1].schemaType
	var propertyName = rel.params[0].value

	//console.log('property type of ' + JSON.stringify(st))
	
	if(st.type === 'primitive') throw new Error('cannot compute property "' + propertyName + '" of a non-object: ' + st.primitive)
	if(st.type === 'object'){
		if(propertyName === 'id'){
			return {type: 'primitive', primitive: 'int'}
		}else{
			var objSchema = ch.schema[st.object]
			var p = objSchema.properties[propertyName]
			if(p === undefined) _.errout('cannot find property "' + propertyName + '" of ' + objSchema.name);
			return p.type
		}
	}else if(st.type === 'view'){
		var objSchema = ch.viewMap[st.view].schema
		//console.log(JSON.stringify(objSchema))
		var p = objSchema.properties[propertyName]
		return p.type
	}else{
		if(st.members.type === 'object'){
			var objName = st.members.object
			var objSchema = ch.schema[objName]
			if(objSchema === undefined) throw new Error('cannot find object type: ' + objName + ' ' + JSON.stringify(st))
			var p = objSchema.properties[propertyName].type
			if(p.type === 'set' || p.type === 'list'){
				p = p.members
			}
			return {type: st.type, members: p};
		}else{
			var objName = st.members.view
			var objSchema = ch.viewMap[objName].schema
			if(objSchema === undefined) throw new Error('cannot find view/object type: ' + objName + ' ' + JSON.stringify(st))
			var p = objSchema.properties[propertyName].type
			if(p.type === 'set' || p.type === 'list'){
				p = p.members
			}
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
		_.errout('TODO?: ' + JSON.stringify(rel))
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
	}else{
		c = svgObjectSingleValue
		isObjectValue = property.type.type === 'object'
	}
	var f = c.bind(undefined, s, cache, contextGetter, isObjectValue, propertyCode)
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

function objectSetPropertyMaker(s, self, rel, typeBindings){
	var contextGetter = self(rel.params[1], typeBindings)
	
	//_.assertFunction(contextGetter.getDescender)
	
	//console.log('\n\n###' + JSON.stringify(rel))
	//console.log('+object: ' + rel.params[1].schemaType.members.object)
	var objSchema = s.schema[rel.params[1].schemaType.members.object]
	var property = objSchema.properties[rel.params[0].value]
	var propertyCode = property.code
	_.assertInt(propertyCode)
	var cache = new Cache()
	var c;

	//console.log('property: ' + JSON.stringify(property))
	//if(property.name === 'age') throw new Error()
	
	var isObjectProperty
	if(property.type.type === 'set' || property.type.type === 'list'){
		if(rel.schemaType.members.type !== 'primitive') _.errout('TODO: handl wrapAsSet for non-primitives')
		c = svgObjectSetCollectionValue
		isObjectProperty = property.type.members.type === 'object'
	}else{
		c = svgObjectSetSingleValue
		isObjectProperty = property.type === 'object'
	}	
	return c.bind(undefined, s, cache, contextGetter, isObjectProperty, propertyCode)
}

var ccc = 0


function svgObjectSingleValue(s, cache, contextGetter, isObjectProperty, propertyCode, bindings, editId){
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
			listeners.add(listener)
			//console.log('attaching to property ' + propertyCode + ' ' + value + ' ' + editId)
			//console.log('^'+JSON.stringify(Object.keys(listener)))
			if(value){
				listener.set(value, undefined, editId)
			}
		},
		detach: function(listener, editId){
			listeners.remove(listener)
			if(editId){
				listener.set(undefined, value, editId)
			}
		},
		oldest: oldest,
		key: key
	}

	if(isObjectProperty){
		var innerLookup = {}
		handle.descend = function(path, editId, cb){
			elements.descend([innerLookup[path[0]], propertyCode].concat(path), editId, cb)
		}
	}
	
	elements.attach({
		set: function(id, oldId, editId){
			if(ongoingEditId === undefined) ongoingEditId = editId
			latestEditId = editId
			//TODO listen for changes to object
			_.assertInt(id)
			_.assertInt(editId)

			s.log('GETTING(' + id + ') PBOJECR: ' + propertyCode)
			s.log(elements.name + ': '+elements)
			s.log(JSON.stringify(Object.keys(elements)))
			_.assertInt(id)
			elements.descend([id, propertyCode], editId, function(pv, editId){
				if(pv !== value){
					if(isObjectProperty){
						innerLookup[pv] = id;
					}
					listeners.emitSet(pv, value, editId)
					value = pv
				}
				ongoingEditId = undefined
			})
		}
	}, editId)
	
	return cache.store(key, handle)
}


function svgObjectCollectionValue(s, cache, contextGetter, isObjectProperty, propertyCode, bindings, editId){
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
		key: key
	}
	//TODO listen for changes
	
	if(isObjectProperty){
		var innerLookup = {}
		handle.descend = function(path, editId, cb){
			var id = innerLookup[path[0]]
			if(id === undefined){
				s.log(JSON.stringify(innerLookup))
				_.errout('tried to descend into unknown id: ' + path[0])
			}
			elements.descend([id, propertyCode].concat(path), editId, cb)
		}
	}
	
	var previousStreamListener
	elements.attach({
		set: function(id, oldId, editId){
			if(ongoingEditId === undefined) ongoingEditId = editId
			latestEditId = editId
			_.assertInt(id)
			_.assertInt(editId)

			//TODO stop streaming previous
			if(previousStreamListener) s.objectState.stopStreamingProperty(id, propertyCode, previousStreamListener)
			function streamListener(pv, editId){
				ongoingEditId = undefined
				if(isObjectProperty && pv){
					//_.assertInt(pv)
					pv.forEach(function(v){
						innerLookup[v] = id
					})
				}
				s.log('streaming property(' + propertyCode + '): ' + JSON.stringify(pv))
				//var pv = obj[propertyCode]
				if(pv !== undefined){
					pv.forEach(function(v){
						if(!counts[v]){
							counts[v] = 1
							values.push(v)
							s.log('emitting add: ' + v)
							listeners.emitAdd(v, editId)
						}else{
							++counts[v]
						}
					})
				}
			}
			previousStreamListener = streamListener
			//s.objectState.streamProperty(id, propertyCode, editId, streamListener)
			elements.descend([id, propertyCode], editId, streamListener)
		},
		//shouldHaveObject: stub,
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
	
	var handle = {
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
		key: key
	}
	
	if(isObjectProperty){
		var innerLookup = {}
		handle.descend = function(path, editId, cb){
			var id = innerLookup[path[0]]
			elements.descend([id, propertyCode].concat(path), editId, cb)
		}
	}
	
	elements.attach({
		add: function(id, outerEditId){
			wait(outerEditId)
			
			//_.errout('TODO stream property state')
			var cur;
			var first = true
			//s.objectState.streamProperty(id, propertyCode, editId, function(pv, editId){
			elements.descend([id, propertyCode], editId, function(pv, editId){
				//console.log('GOT PROPERTY VALUE: ' + pv + ' ' + editId)
				if(pv !== undefined){
				
					if(isObjectProperty){
						innerLookup[pv] = id
					}
					
					cur = pv
					if(pvCounts[pv] === undefined){
						pvCounts[pv] = 1
						propertyValues.push(pv)
						//console.log('calling add')
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
			/*s.objectState.getObjectState(id, function(obj){
				var pv = obj[propertyCode]
				if(pvCounts[pv] === 1){
					delete pvCounts[pv]
					propertyValues.splice(propertyValues.indexOf(pv), 1)
					listeners.emitRemove(pv, editId)
				}else{
					--pvCounts[pv]
				}
				resume(editId)
			})*/
			elements.descend([id, propertyCode], editId, function(pv, editId){//TODO stop listening after first get
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
		//shouldHaveObject: stub,
		objectChange: function(subjTypeCode, subjId, typeCode, id, path, op, edit, syncId, editId){
			//TODO?
			_.errout('TODO')
		}
		//objectChange: stub//ignore object changes TODO listen for property changes
	}, editId)
	
	return cache.store(key, handle)
}

function stub(){}

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
		key: key
	}
	
	if(isObjectProperty){
		var innerLookup = {}
		handle.descend = function(path, editId, cb){
			var id = innerLookup[path[0]]
			elements.descend([id, propertyCode].concat(path), editId, cb)
		}
	}
	
	elements.attach({
		add: function(id, outerEditId){
			wait(outerEditId)
			s.log('got add $$$$$$$$$$$$$$$$$$$$$$: ' + id + ' ' + editId + ' ' + propertyCode)
			//TODO listen for changes to object
			var first = true
			elements.descend([id, propertyCode], editId, function(v, editId){
				if(isObjectProperty){
					innerLookup[v] = id
				}
				if(v !== undefined){
					_.assertArray(v)
					v.forEach(function(pv){
						if(pvCounts[pv] === undefined){
							pvCounts[pv] = 1
							propertyValues.push(pv)
							s.log('calling add')
							listeners.emitAdd(pv, editId)
						}else{
							++pvCounts[pv]
						}
					})
				}
				if(first){
					first = false
					resume(outerEditId)
				}
			})
		},
		remove: function(id, editId){
			wait(editId)
			elements.descend([id, propertyCode], editId, function(v, editId){
				if(v === undefined){
					resume(editId)
					return
				}
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
