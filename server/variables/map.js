"use strict";

var Cache = require('./../variable_cache')

var schema = require('./../../shared/schema')
var listenerSet = require('./../variable_listeners')

var _ = require('underscorem')


function mapType(rel, ch){
	var inputType = rel.params[0].schemaType//ch.computeType(rel.params[0], ch.bindingTypes)
	var singleInputType = inputType.members
	//console.log('singleInputType: ' + JSON.stringify(singleInputType))
	//console.log('inputType: ' + JSON.stringify(inputType))
	_.assertDefined(singleInputType)
	
	var implicits1 = rel.params[1].implicits
	var implicits2 = rel.params[2].implicits
	
	var binding1 = {}
	binding1[implicits1[0]] = singleInputType
	var binding2 = {}
	binding2[implicits2[0]] = singleInputType
	
	//s.log('map bound key ' + implicits1[1])
	//s.log('map bound value ' + implicits1[1])
	
	var keyType = ch.computeMacroType(rel.params[1], ch.bindingTypes, binding1)
	var valueType = ch.computeMacroType(rel.params[2], ch.bindingTypes, binding2)
	if(rel.params.length === 4){
		var implicits3 = rel.params[3].implicits
		var moreBinding = {}
		moreBinding[implicits3[0]] = valueType
		moreBinding[implicits3[1]] = valueType
		ch.computeMacroType(rel.params[3], ch.bindingTypes, moreBinding)
	}

	return {type: 'map', key: keyType, value: valueType}
}
schema.addFunction('map', {
	schemaType: mapType,
	implementation: mapMaker,
	minParams: 3,
	maxParams: 4,
	callSyntax: 'map(collection,key-macro,value-macro[,reduce-macro])'
})

function makeKeyParser(kt){
	var keyParser;
	if(kt.type === 'object'){
		keyParser = function(key){return parseInt(key);}
	}else if(kt.type === 'primitive'){
		if(kt.primitive === 'int'){
			keyParser = function(key){return parseInt(key);}
		}else if(kt.primitive === 'string'){
			keyParser = function(key){return key;}
		}else if(kt.primitive === 'long'){
			keyParser = function(key){return Number(key);}
		}else{
			_.errout('TODO: ' + JSON.stringify(kt))
		}
	}else{
		_.errout('TODO: ' + JSON.stringify(kt))
	}
	return keyParser
}
exports.makeKeyParser = makeKeyParser

function mapMaker(s, self, rel, typeBindings){
	var contextGetter = self(rel.params[0], typeBindings)

	_.assert(rel.params[1].type === 'macro')
	_.assert(rel.params[2].type === 'macro')

	var keyImplicit = rel.params[1].implicits[0]
	var valueImplicit = rel.params[2].implicits[0]
	var reduceImplicitFirst
	var reduceImplicitSecond
	if(rel.params[3]){
		reduceImplicitFirst = rel.params[3].implicits[0]
		reduceImplicitSecond = rel.params[3].implicits[1]
	}

	var newTypeBindingsKey = _.extend({}, typeBindings)
	var newTypeBindingsValue = _.extend({}, typeBindings)
	newTypeBindingsKey[keyImplicit] = contextGetter
	newTypeBindingsValue[valueImplicit] = contextGetter

	var keyGetter = self(rel.params[1], newTypeBindingsKey)
	var valueGetter = self(rel.params[2], newTypeBindingsValue)
	var reduceGetter;
	if(rel.params.length > 3){
		_.assert(rel.params[3].type === 'macro')
		var newTypeBindingsReduce = _.extend({}, typeBindings)
		newTypeBindingsReduce[reduceImplicitFirst] = keyGetter
		newTypeBindingsReduce[reduceImplicitSecond] = valueGetter
		reduceGetter = self(rel.params[3], newTypeBindingsReduce)
	}

	var cache = new Cache()
	
	var kt = rel.params[1].schemaType
	var t = rel.params[2].schemaType
	
	var keyParser = makeKeyParser(kt)
	
	if(t.type === 'set' || t.type === 'list'){//if the result of the values macro is a set
		if(reduceGetter === undefined) throw new Error('a reduce-macro is required for map(collection,key-macro,value-macro,reduce-macro) when the result of the value macro has multiple values.')
		//return svgMapMultiple.bind(undefined, s, cache, contextGetter, keyGetter, valueGetter, reduceGetter, keyImplicit, valueImplicit, reduceImplicitFirst, reduceImplicitSecond)
		_.errout('TODO')
	}else{//if the result of the values macro is a single value
		var hasObjectValues = t.type === 'object'
		if(kt.type === 'set' || kt.type === 'list'){
			return svgMapKeyMultiple.bind(undefined, s, cache, keyParser, hasObjectValues, contextGetter, keyGetter, valueGetter, reduceGetter, keyImplicit, valueImplicit, reduceImplicitFirst, reduceImplicitSecond)
		}else{
			return svgMapSingle.bind(undefined, s, cache, keyParser, hasObjectValues, contextGetter, keyGetter, valueGetter, reduceGetter, keyImplicit, valueImplicit, reduceImplicitFirst, reduceImplicitSecond)
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
/*
function svgMapMultiple(s, cache, contextGetter, keyGetter, valueGetter, reduceGetter, keyImplicit, valueImplicit, reduceImplicitFirst, reduceImplicitSecond, bindings, editId){

	_.errout('TODO')
	var elements = contextGetter(bindings, editId)

	var key = elements.key
	if(cache.has(key)) return cache.get(key)
	
	var listeners = listenerSet()
	
	var allSets = {}
	var counts = {}
	var values = []
	
	resultSetListener = {
		add: function(value, editId){
			if(!counts[value]){
				counts[value] = 1
				listeners.emitAdd(value, editId)
				values.push(value)
			}else{
				++counts[value]
			}
		},
		remove: function(value, editId){
			if(counts[value] === 1){
				delete counts[value]
				listener.emitRemove(value, editId)
				values.splice(values.indexOf(value), 1)
			}else{
				--counts[value]
			}
		}
	}
	
	function oldest(){
		var oldestEditId = elements.oldest()
		Object.keys(allSets).forEach(function(key){
			var valueSet = allSets[key]
			var old = valueSet.oldest()
			if(old < oldestEditId) oldestEditId = old
		})
		return oldestEditId
	}
	
	elements.attach({
		add: function(v, editId){
			var newBindingsKey = copyBindings(bindings)
			var newBindingsValue = copyBindings(bindings)
			newBindingsKey[keyImplicit] = newBindingsValue[valueImplicit] = elements.wrapAsSet(v)
			var newKeyVariable = keyGetter(newBindingsKey, editId)
			var newValueVariable = valueGetter(newBindingsValue, editId)
			//TODO if key already exists, apply
			newKeyVariable.attach(resultSetListener, editId)
			newValueVariable.attach(resultSetListener, editId)
		},
		remove: function(v, editId){
			var removedSet = allSets[v]
			removedSet.detach(resultSetListener, editId)
		}
	}, editId)
	
	var handle = {
		attach: function(listener, editId){
			listeners.add(listener)
			values.forEach(function(v){listener.add(v, editId)})
		},
		detach: function(listener, editId){
			listeners.remove(listener)
			values.forEach(function(v){listener.remove(v, editId)})
		},
		oldest: oldest,
		key: key
	}
		
	return cache.store(key, handle)
}
*/
function stub(){}

function reduceState(reduceImplicitFirst, reduceImplicitSecond, valueGetter, cReduceGetter, state, reducedState, listeners, bindings, key, editId){
	_.assertLength(arguments, 10)
	_.assertObject(state)
	
	var arr = state[key]
	var old = reducedState[key]
	if(arr.length === 1){
		var v = arr[0].value
		if(old !== v){
			reducedState[key] = v
			_.assertPrimitive(v)
			listeners.emitPut(key, v, old, editId)
		}
	}else{
		var cur = arr[0].value
		for(var i=1;i<arr.length;++i){
			var nv = arr[i].value
			var newBindingsReduce = copyBindings(bindings)
			newBindingsReduce[reduceImplicitFirst] = valueGetter.wrapAsSet(cur)
			newBindingsReduce[reduceImplicitSecond] = valueGetter.wrapAsSet(nv)
			//s.log(''+valueGetter.wrapAsSet)
			_.assertObject(newBindingsReduce[reduceImplicitFirst])
			_.assertObject(newBindingsReduce[reduceImplicitSecond])
			var newMerge = cReduceGetter(newBindingsReduce, editId)					
			var newResult
			var did = false
			newMerge.attach({
				set: function(value, oldValue, editId){
					newResult = value
					did = true
				}
			})
			if(!did) _.errout('reduce operation must be synchronous (this may be relaxed in future versions of minnow.)')
			cur = newResult
		}
		if(newResult !== old){
			_.assertPrimitive(newResult)
			listeners.emitPut(key, newResult, old, editId)
		}
	}
}

function svgMapSingle(s, cache, keyParser, hasObjectValues, contextGetter, keyGetter, valueGetter, reduceGetter, keyImplicit, valueImplicit, reduceImplicitFirst, reduceImplicitSecond, bindings, editId){
	var elements = contextGetter(bindings, editId)
	
	_.assertString(elements.name)
	
	//_.assertFunction(elements.descend)
	
	if(!_.isFunction(elements.descend)){
		_.errout('no descend defined for: ' + elements.name)
	}
	
	var cKeyGetter = keyGetter(bindings, editId)
	var cValueGetter = valueGetter(bindings, editId)
	var cReduceGetter;
	if(reduceGetter !== undefined){
		cReduceGetter = reduceGetter(bindings, editId)
	}
	
	var key = elements.key+cKeyGetter.key+cValueGetter.key
	if(reduceGetter !== undefined) key += cReduceGetter.key
	
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
	
	var state = {}
	var keys = []
	
	if(reduceGetter){
		var multiState = {}
		
		//TODO create an optimal reduce schedule, pairing halves recursively until only 1 value remains
		//if values are added during the operation, place them in a buffer and include them in the next iteration
		//if values are removed, return their partner to the buffer and etc.

		/*
			The tricky part is that we need to set up a consistent tree so that updates can propagate, 
			but at the same time elements will be added and removed, and ideally the tree will be balanced to minimize
			the number of operations and their latency.
			
			Eventually, we'll want to have specialized implementations for cases where the reduce operator is a synchronous
			function of only the values being reduced, in which case it should be implemented as a simple function call.
		*/
		elements.attach({
			add: function(v, editId){
				
				var newBindingsKey = copyBindings(bindings)
				var newBindingsValue = copyBindings(bindings)
				newBindingsKey[keyImplicit] = newBindingsValue[valueImplicit] = contextGetter.wrapAsSet(v, editId, elements)
				var newKeyVariable = cKeyGetter(newBindingsKey, editId)
				var newValueVariable = cValueGetter(newBindingsValue, editId)
				
				//console.log('map add: ' + v)
				var kv = {}
							
				function keyListener(value, oldValue, editId){
					if(oldValue !== undefined){
						var arr = multiState[oldValue]
						arr.splice(arr.indexOf(kv), 1)
						listeners.emitDelete(oldValue, editId)
					}
					//s.log('map key: ' + value)
					kv.key = value	
					if(kv.value !== undefined){				
						var oldValue = kv.value
						if(multiState[kv.key] === undefined) multiState[kv.key] = []
						multiState[kv.key].push(kv)
						reduceState(reduceImplicitFirst, reduceImplicitSecond, valueGetter, cReduceGetter, multiState, state, listeners, bindings, kv.key, editId)
					}
				}
				function valueListener(value, oldValue, editId){
					_.assertInt(editId)
					kv.value = value
					//s.log('map value: ' + kv.key + '->'+value)
					if(kv.key !== undefined){
						if(multiState[kv.key] === undefined) multiState[kv.key] = []
						multiState[kv.key].push(kv)
						reduceState(reduceImplicitFirst, reduceImplicitSecond, valueGetter, cReduceGetter, multiState, state, listeners, bindings, kv.key, editId)
					}
				}
				
				allSets[v] = {key: newKeyVariable, value: newValueVariable, keyListener: keyListener, valueListener: valueListener}

				newKeyVariable.attach({set: keyListener}, editId)
				newValueVariable.attach({set: valueListener}, editId)
			},
			remove: function(v, editId){
				var r = allSets[v]
				r.key.detach(r.keyListener, editId)
				r.value.detach(r.valueListener, editId)
			},
			objectChange: stub
		}, editId)
	}else{
		elements.attach({
			add: function(v, editId){

				//console.log('map add: ' + v)
				
				var newBindingsKey = copyBindings(bindings)
				var newBindingsValue = copyBindings(bindings)
				newBindingsKey[keyImplicit] = newBindingsValue[valueImplicit] = contextGetter.wrapAsSet(v, editId, elements)
				_.assertDefined(newBindingsKey[keyImplicit])
				var newKeyVariable = cKeyGetter(newBindingsKey, editId)
				var newValueVariable = cValueGetter(newBindingsValue, editId)
				
				var kv = {}
				
				function keyListener(value, oldValue, editId){
					kv.key = value	
					if(value === undefined){
						if(oldValue !== undefined){
							var oldKvValue = state[oldValue]
							if(oldKvValue !== undefined){
								delete state[oldValue]
								listeners.emitDel(oldValue, editId)
							}
						}
						//console.log('map key, value undefined: ' + value)
					}else{
						//console.log('map key: ' + value + ' ' + typeof(value))
						if(kv.value !== undefined){				
							var oldValue = kv.value
							state[kv.key] = kv.value
							_.assertPrimitive(kv.value)
							//console.log('putting: ' + kv.key + ' -> ' + kv.value)
							listeners.emitPut(kv.key, kv.value, oldValue, editId)
						}
					}
				}
				function valueListener(value, oldValue, editId){
					_.assertInt(editId)
					kv.value = value
					//s.log('map value: ' + kv.key + '->'+value)
					//console.log('map value: ' + kv.key + ' -> ' + value)
					if(kv.key !== undefined){
						state[kv.key] = kv.value
						//s.log('emitting put')
						_.assertPrimitive(kv.value)
						listeners.emitPut(kv.key, kv.value, oldValue, editId)
					}
				}
				
				var kl = {
					set: keyListener,
					shouldHaveObject: stub
				}
				var vl = {
					set: valueListener,
					shouldHaveObject: stub
				}
				
				allSets[v] = {key: newKeyVariable, value: newValueVariable, keyListener: kl, valueListener: vl}

				newKeyVariable.attach(kl, editId)
				newValueVariable.attach(vl, editId)
			},
			remove: function(v, editId){
				var r = allSets[v]
				r.key.detach(r.keyListener, editId)
				r.value.detach(r.valueListener, editId)
			},
			objectChange: stub
		}, editId)
	}
	
	var handle = {
		name: 'map-single',
		attach: function(listener, editId){
			listeners.add(listener)
			Object.keys(state).forEach(function(key){
				var value = state[key]
				if(value !== undefined){
					key = keyParser(key)
					listener.put(key, value, undefined, editId)
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

function svgMapKeyMultiple(s, cache, keyParser, hasObjectValues, contextGetter, keyGetter, valueGetter, reduceGetter, keyImplicit, valueImplicit, reduceImplicitFirst, reduceImplicitSecond, bindings, editId){
	var elements = contextGetter(bindings, editId)

	var cKeyGetter = keyGetter(bindings, editId)
	var cValueGetter = valueGetter(bindings, editId)
	var cReduceGetter;
	if(reduceGetter !== undefined){
		cReduceGetter = reduceGetter(bindings, editId)
	}
	
	var key = elements.key+cKeyGetter.key+cValueGetter.key
	if(reduceGetter !== undefined) key += cReduceGetter.key
	
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
	
	var state = {}
	if(reduceGetter){
		var multiState = {}
		
		//TODO create an optimal reduce schedule, pairing halves recursively until only 1 value remains
		//if values are added during the operation, place them in a buffer and include them in the next iteration
		//if values are removed, return their partner to the buffer and etc.

		/*
			The tricky part is that we need to set up a consistent tree so that updates can propagate, 
			but at the same time elements will be added and removed, and ideally the tree will be balanced to minimize
			the number of operations and their latency.
			
			Eventually, we'll want to have specialized implementations for cases where the reduce operator is a synchronous
			function of only the values being reduced, in which case it should be implemented as a simple function call.
		*/
		elements.attach({
			add: function(v, editId){
				
				var newBindingsKey = copyBindings(bindings)
				var newBindingsValue = copyBindings(bindings)
				newBindingsKey[keyImplicit] = newBindingsValue[valueImplicit] = contextGetter.wrapAsSet(v, editId)
				var newKeyVariable = cKeyGetter(newBindingsKey, editId)
				var newValueVariable = cValueGetter(newBindingsValue, editId)
				
				//s.log('map add: ' + v)
				var kvs = []
				var value
				/*function keyListener(value, oldValue, editId){
					if(oldValue !== undefined){
						var arr = multiState[oldValue]
						arr.splice(arr.indexOf(kv), 1)
						listeners.emitDelete(oldValue, editId)
					}
					//s.log('map key: ' + value)
					kv.key = value	
					if(kv.value !== undefined){				
						var oldValue = kv.value
						if(multiState[kv.key] === undefined) multiState[kv.key] = []
						multiState[kv.key].push(kv)
						//listeners.emitPut(kv.key, kv.value, oldValue, editId)
						//reduceState(kv.key)
						reduceState(reduceImplicitFirst, reduceImplicitSecond, valueGetter, cReduceGetter, multiState, state, listeners, bindings, kv.key, editId)
					}
				}*/
				function addKey(k, editId){
					var kv = {key: k, value: value}
					kvs.push(kv)
					if(value !== undefined){
						multiState[k].push(kv)
						reduceState(reduceImplicitFirst, reduceImplicitSecond, valueGetter, cReduceGetter, multiState, state, listeners, bindings, kv.key, editId)
						//listeners.emitDel(k, value, editId)
					}
				}
				function removeKey(k, editId){
					var i = kvs.indexOf(k)
					var ks = kvs[i]
					kvs.splice(i, 1)
					if(value !== undefined){
						multiState[k].splice(value)
					}
					if(value !== undefined){
						reduceState(reduceImplicitFirst, reduceImplicitSecond, valueGetter, cReduceGetter, multiState, state, listeners, bindings, kv.key, editId)
						//listeners.emitDel(k, value, editId)
					}
					/*if(oldValue !== undefined){
						var arr = multiState[oldValue]
						arr.splice(arr.indexOf(kv), 1)
						listeners.emitDelete(oldValue, editId)
					}
					//s.log('map key: ' + value)
					kv.key = value	
					if(kv.value !== undefined){				
						var oldValue = kv.value
						if(multiState[kv.key] === undefined) multiState[kv.key] = []
						multiState[kv.key].push(kv)
						//listeners.emitPut(kv.key, kv.value, oldValue, editId)
						//reduceState(kv.key)
						reduceState(reduceImplicitFirst, reduceImplicitSecond, valueGetter, cReduceGetter, multiState, state, listeners, bindings, kv.key, editId)
					}*/
				}
				function valueListener(v, oldValue, editId){
					_.assertInt(editId)
					value = v
					for(var i=0;i<kvs.length;++i){
						kvs[i].value = value
					}
					if(oldValue === undefined){
						for(var i=0;i<kvs.length;++i){
							var kv = kvs[i]
							multiState[kv.key].push(kv)
						}
					}

					reduceState(reduceImplicitFirst, reduceImplicitSecond, valueGetter, cReduceGetter, multiState, state, listeners, bindings, kv.key, editId)
				}
				
				allSets[v] = {key: newKeyVariable, value: newValueVariable, keyListener: keyListener, valueListener: valueListener}

				newKeyVariable.attach({set: keyListener}, editId)
				newValueVariable.attach({set: valueListener}, editId)
			},
			remove: function(v, editId){
				var r = allSets[v]
				r.key.detach(r.keyListener, editId)
				r.value.detach(r.valueListener, editId)
			},
			/*shouldHaveObject: function(id, flag, editId){
				if(hasObjectValues){
					_.errout('TODO')
				}
			},*/
			objectChange: stub
		}, editId)
	}else{
		_.errout('TODO?')
		/*elements.attach({
			add: function(v, editId){
				
				var newBindingsKey = copyBindings(bindings)
				var newBindingsValue = copyBindings(bindings)
				newBindingsKey[keyImplicit] = newBindingsValue[valueImplicit] = contextGetter.wrapAsSet(v, editId)
				var newKeyVariable = cKeyGetter(newBindingsKey, editId)
				var newValueVariable = cValueGetter(newBindingsValue, editId)
				
				//s.log('map add: ' + v)
				var kv = {}
				
				function keyListener(value, oldValue, editId){
					if(oldValue !== undefined){
						delete state[oldValue]
						listeners.emitDelete(oldValue, editId)
					}
					//console.log('map key: ' + value)
					kv.key = value	
					if(kv.value !== undefined){				
						var oldValue = kv.value
						state[kv.key] = kv.value
						_.assertPrimitive(kv.value)
						listeners.emitPut(kv.key, kv.value, oldValue, editId)
					}
				}
				function valueListener(value, oldValue, editId){
					_.assertInt(editId)
					kv.value = value
					//console.log('map value: ' + kv.key + '->'+value)
					if(kv.key !== undefined){
						state[kv.key] = kv.value
						//console.log('emitting put')
						_.assertPrimitive(kv.value)
						listeners.emitPut(kv.key, kv.value, oldValue, editId)
					}
				}
				
				allSets[v] = {key: newKeyVariable, value: newValueVariable, keyListener: keyListener, valueListener: valueListener}

				newKeyVariable.attach({
					set: keyListener,
					shouldHaveObject: stub
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
			shouldHaveObject: function(id, flag, editId){
				if(hasObjectValues){
					_.errout('TODO')
				}
			},
			objectChange: stub
		}, editId)*/
	}
	
	var handle = {
		name: 'map-key-multiple',
		attach: function(listener, editId){
			listeners.add(listener)
			Object.keys(state).forEach(function(key){
				var value = state[key]
				if(value !== undefined){
					key = keyParser(key)
					listener.put(key, value, undefined, editId)
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
