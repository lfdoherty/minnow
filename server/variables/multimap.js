"use strict";

var Cache = require('./../variable_cache')

var schema = require('./../../shared/schema')
var listenerSet = require('./../variable_listeners')

var _ = require('underscorem')


function multimapType(rel, ch){
	var inputType = rel.params[0].schemaType//ch.computeType(rel.params[0], ch.bindingTypes)
	var singleInputType = inputType.members
	//s.log('singleInputType: ' + JSON.stringify(singleInputType))
	//s.log('inputType: ' + JSON.stringify(inputType))
	_.assertDefined(singleInputType)
	
	var implicits1 = rel.params[1].implicits
	var implicits2 = rel.params[2].implicits
	
	var binding1 = {}
	binding1[implicits1[0]] = singleInputType
	var binding2 = {}
	binding2[implicits2[0]] = singleInputType
	
	var keyType = ch.computeMacroType(rel.params[1], ch.bindingTypes, binding1)
	if(keyType.type === 'list' || keyType.type === 'set'){
		keyType = keyType.members
	}
	var valueType = ch.computeMacroType(rel.params[2], ch.bindingTypes, binding2)
	if(valueType.type !== 'list' && valueType.type !== 'set'){
		valueType = {type: 'set', members: valueType}
	}else{// if(valueType.type !== 'list'){
		valueType = {type: 'set', members: valueType.members}
	}
	return {type: 'map', key: keyType, value: valueType}
}
schema.addFunction('multimap', {
	schemaType: multimapType,
	implementation: multimapMaker,
	minParams: 3,
	maxParams: 3,
	callSyntax: 'multimap(collection,key-macro,value-macro)'
})

function multimapMaker(s, self, rel, typeBindings){
	var contextGetter = self(rel.params[0], typeBindings)

	_.assert(rel.params[1].type === 'macro')
	_.assert(rel.params[2].type === 'macro')

	var keyImplicit = rel.params[1].implicits[0]
	var valueImplicit = rel.params[2].implicits[0]

	var newTypeBindingsKey = _.extend({}, typeBindings)
	var newTypeBindingsValue = _.extend({}, typeBindings)
	newTypeBindingsKey[keyImplicit] = contextGetter
	newTypeBindingsValue[valueImplicit] = contextGetter

	var keyGetter = self(rel.params[1], newTypeBindingsKey)
	var valueGetter = self(rel.params[2], newTypeBindingsValue)

	var cache = new Cache()
	
	var kt = rel.params[1].schemaType
	var t = rel.params[2].schemaType
	if(t.type === 'set' || t.type === 'list'){//if the result of the values macro is a set

		if(kt.type === 'set' || kt.type === 'list'){
			//if(reduceGetter === undefined) throw new Error('a reduce-macro is required for multimap(collection,key-macro,value-macro,reduce-macro) when both the key and value macros produce multiple values.')
			_.errout('TODO')
		}else{
			//_.errout('TODO')
			return svgMapValueMultiple.bind(undefined, s, cache, hasObjectValues, contextGetter, keyGetter, valueGetter, keyImplicit, valueImplicit)
		}
		//return svgMapMultiple.bind(undefined, s, cache, contextGetter, keyGetter, valueGetter, keyImplicit, valueImplicit)
	}else if(t.type === 'map'){
		_.errout('cannot make multimap with map values: ' + JSON.stringify(t))
	}else{//if the result of the values macro is a single value
		var hasObjectValues = t.type === 'object'
		if(kt.type === 'set' || kt.type === 'list'){
			return svgMapKeyMultiple.bind(undefined, s, cache, hasObjectValues, contextGetter, keyGetter, valueGetter, keyImplicit, valueImplicit)
		}else{
			//return svgMapSingle.bind(undefined, s, cache, hasObjectValues, contextGetter, keyGetter, valueGetter, keyImplicit, valueImplicit)
			_.errout('TODO: ' + JSON.stringify(kt) + '\n' + JSON.stringify(t))
		}
	}
}

function copyBindings(bindings){
	var newBindings = Object.create(null)
	Object.keys(bindings).forEach(function(key){
		newBindings[key] = bindings[key]
	})
	return newBindings
}

function stub(){}

function svgMapKeyMultiple(s, cache, hasObjectValues, contextGetter, keyGetter, valueGetter, keyImplicit, valueImplicit, bindings, editId){
	var elements = contextGetter(bindings, editId)

	var cKeyGetter = keyGetter(bindings, editId)
	var cValueGetter = valueGetter(bindings, editId)

	//_.assert(hasObjectValues)
	
	var key = elements.key+cKeyGetter.key+cValueGetter.key
	
	if(cache.has(key)) return cache.get(key)
	
	var listeners = listenerSet()
	
	var allSets = {}
	function oldest(){
		var oldestEditId = elements.oldest()
		//s.log('*map: ' + oldestEditId)
		Object.keys(allSets).forEach(function(key){
			var v = allSets[key]
			var old = v.key.oldest()
			if(old < oldestEditId) oldestEditId = old
			old = v.value.oldest()
			if(old < oldestEditId) oldestEditId = old
		})
		//s.log('map: ' + oldestEditId)
		return oldestEditId
	}
	

	var multiCounts = {}
	var multiValues = {}

	var should = {}

	var state = multiValues

	elements.attach({
		add: function(v, editId){
			//console.log('ADDED: ' + v)
			
			var newBindingsKey = copyBindings(bindings)
			var newBindingsValue = copyBindings(bindings)
			newBindingsKey[keyImplicit] = newBindingsValue[valueImplicit] = contextGetter.wrapAsSet(v, editId, elements)
			var newKeyVariable = cKeyGetter(newBindingsKey, editId)
			var newValueVariable = cValueGetter(newBindingsValue, editId)
			
			var keys = []
			var value

			function addKey(k, editId){
				keys.push(k)
				//console.log('ADD KEY: ' + k + ' ' + value)
				if(value !== undefined){
					var kvk = k+':'+value
					if(multiCounts[kvk] === undefined){
						multiCounts[kvk] = 1
						if(multiValues[k] === undefined) multiValues[k] = []
						multiValues[k].push(value)
					}else{
						++multiCounts[kvk]
					}
				}
			}
			function removeKey(k, editId){
				var i = keys.indexOf(k)
				keys.splice(i, 1)
				if(value === undefined) return
				var kvk = k+':'+value
				--multiCounts[kvk]
				if(multiCounts[kvk] === 0){
					delete multiCounts[kvk]
					multiValues[k].splice(multiValues[k].indexOf(value), 1)
					//listeners.emitDel(k, editId)
					listeners.emitPutRemove(k, value, editId)
				}
			}
			function valueListener(v, oldValue, editId){
				_.assertInt(editId)
				value = v
				//console.log('GOT VALUE: ' + v)
				if(oldValue !== undefined){
					for(var i=0;i<keys.length;++i){
						var k = keys[i]
						var kvk = k+':'+oldValue
						--multiCounts[kvk]
						if(multiCounts[kvk] === 0){
							delete multiCounts[kvk]
							multiValues[k].splice(multiValues[k].indexOf(oldValue), 1)
							listeners.emitPutRemove(k, oldValue, editId)
						}
					}
				}
				for(var i=0;i<keys.length;++i){
					var k = keys[i]
					var kvk = k+':'+value
					//multiState[kvk] = multiState[kvk] ? multiState[kvk]+1 : 1
					if(multiCounts[kvk] === undefined){
						multiCounts[kvk] = 1
						if(multiValues[k] === undefined) multiValues[k] = []
						multiValues[k].push(value)
					}else{
						++multiCounts[kvk]
					}					
					listeners.emitPutAdd(k, value, editId)
				}
			}
			
			allSets[v] = {key: newKeyVariable, value: newValueVariable/*, keyListener: keyListener, valueListener: valueListener*/}

			newKeyVariable.attach({
				add: addKey, 
				remove: removeKey
			}, editId)
			
			newValueVariable.attach({
				set: valueListener, 
				shouldHaveObject: stub
			}, editId)
		},
		remove: function(v, editId){
			var r = allSets[v]
			r.key.detach(r.keyListener, editId)
			r.value.detach(r.valueListener, editId)
		},
		objectChange: stub
	}, editId)

	
	var handle = {
		name: 'multimap-multikey',
		attach: function(listener, editId){
			listeners.add(listener)
			Object.keys(state).forEach(function(key){
				var value = state[key]
				for(var i=0;i<value.length;++i){
					listener.putAdd(key, value[i], editId)
				}
			})
		},
		detach: function(listener, editId){
			listeners.remove(listener)
			if(editId){
				throw new Error('TODO')
			}
		},
		oldest: oldest,
		key: key
	}
		
	return cache.store(key, handle)
}


function svgMapValueMultiple(s, cache, hasObjectValues, contextGetter, keyGetter, valueGetter, keyImplicit, valueImplicit, bindings, editId){
	var elements = contextGetter(bindings, editId)

	var cKeyGetter = keyGetter(bindings, editId)
	var cValueGetter = valueGetter(bindings, editId)

	//_.assert(hasObjectValues)
	
	var key = elements.key+cKeyGetter.key+cValueGetter.key
	
	if(cache.has(key)) return cache.get(key)
	
	var listeners = listenerSet()
	
	var allSets = {}
	function oldest(){
		var oldestEditId = elements.oldest()
		//s.log('*map: ' + oldestEditId)
		Object.keys(allSets).forEach(function(key){
			var v = allSets[key]
			var old = v.key.oldest()
			if(old < oldestEditId) oldestEditId = old
			old = v.value.oldest()
			if(old < oldestEditId) oldestEditId = old
		})
		//s.log('map: ' + oldestEditId)
		return oldestEditId
	}
	

	var multiCounts = {}
	var multiValues = {}

	var should = {}

	var state = multiValues

	elements.attach({
		add: function(inputSetValue, editId){
			var newBindingsKey = copyBindings(bindings)
			var newBindingsValue = copyBindings(bindings)
			newBindingsKey[keyImplicit] = newBindingsValue[valueImplicit] = contextGetter.wrapAsSet(inputSetValue, editId, elements)
			var newKeyVariable = cKeyGetter(newBindingsKey, editId)
			var newValueVariable = cValueGetter(newBindingsValue, editId)
			
			var k
			var values = []

			function setKey(key, oldKey, editId){
				k = key
				s.log('SET KEY: ' + k + ' ' + oldKey + ' ' + JSON.stringify(values))
				if(oldKey !== undefined){
					for(var i=0;i<values.length;++i){
						var v = values[i]
						var kvk = oldKey+':'+v
						--multiCounts[kvk]
						if(multiCounts[kvk] === 0){
							delete multiCounts[kvk]
							multiValues[oldKey].splice(multiValues[oldKey].indexOf(v), 1)
							listeners.emitPutRemove(k, v, editId)
						}
					}
				}
				if(k !== undefined){
					for(var i=0;i<values.length;++i){
						var v = values[i]
						var kvk = k+':'+v
						//multiState[kvk] = multiState[kvk] ? multiState[kvk]+1 : 1
						if(multiCounts[kvk] === undefined){
							multiCounts[kvk] = 1
							if(multiValues[k] === undefined) multiValues[k] = []
							multiValues[k].push(v)
						}else{
							++multiCounts[kvk]
						}					
						listeners.emitPutAdd(k, v, editId)
					}
				}
			}
			
			function addValue(v, editId){
				if(values.indexOf(v) === -1){
					values.push(v)
				}
				if(k !== undefined){
					var kvk = k+':'+v
					if(multiCounts[kvk] === undefined){
						multiCounts[kvk] = 1
						if(multiValues[k] === undefined) multiValues[k] = []
						multiValues[k].push(v)
						listeners.emitPutAdd(k, v, editId)
					}else{
						++multiCounts[kvk]
					}
				}
			}
			function removeValue(v, editId){
				var i = values.indexOf(v)
				values.splice(i, 1)
				if(k !== undefined){
					var kvk = k+':'+v
					--multiCounts[kvk]
					if(multiCounts[kvk] === 0){
						delete multiCounts[kvk]
						multiValues[k].splice(multiValues[k].indexOf(v), 1)
						listeners.emitPutRemove(k, v, editId)
					}
				}
			}
			

			var keyListener = {
				set: setKey
			}
			var valueListener = {
				add: addValue,
				remove: removeValue
			}

			allSets[inputSetValue] = {key: newKeyVariable, value: newValueVariable, keyListener: keyListener, valueListener: valueListener}

			newKeyVariable.attach(keyListener, editId)
			newValueVariable.attach(valueListener, editId)			
		},
		remove: function(v, editId){
			var r = allSets[v]
			r.key.detach(r.keyListener, editId)
			r.value.detach(r.valueListener, editId)
			delete allSets[v]
		},
		objectChange: stub
	}, editId)

	var handle = {
		name: 'multimap-multivalue',
		attach: function(listener, editId){
			listeners.add(listener)
			Object.keys(state).forEach(function(key){
				var value = state[key]
				for(var i=0;i<value.length;++i){
					listener.putAdd(key, value[i], editId)
				}
			})
		},
		detach: function(listener, editId){
			listeners.remove(listener)
			if(editId){
				throw new Error('TODO')
			}
		},
		oldest: oldest,
		key: key
	}
		
	return cache.store(key, handle)
}
