"use strict";

var Cache = require('./../variable_cache')

var schema = require('./../../shared/schema')
var listenerSet = require('./../variable_listeners')

var _ = require('underscorem')

var map = require('./map')

var eachSubsetOptimization = require('./each_subset_optimization')//TODO refactor to shared utility file

schema.addFunction('map', {
	schemaType: map.mapType,
	implementation: mapMaker,
	minParams: 3,
	maxParams: 4,
	callSyntax: 'map(collection,key-macro,value-macro[,reduce-macro])'
})

function stub(){}


function mapMaker(s, self, rel, typeBindings){

	var contextGetter = self(rel.params[0], typeBindings)

	_.assert(rel.params[1].type === 'macro')
	_.assert(rel.params[2].type === 'macro')
	
	//if(rel.params.length > 3){
	//	return
	//}
/*
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
		return//TODO support sync optimization with reduce
		_.assert(rel.params[3].type === 'macro')
		var newTypeBindingsReduce = _.extend({}, typeBindings)
		newTypeBindingsReduce[reduceImplicitFirst] = keyGetter
		newTypeBindingsReduce[reduceImplicitSecond] = valueGetter
		reduceGetter = self(rel.params[3], newTypeBindingsReduce)
	}*/

	var cache = new Cache(s.analytics)
	
	var kt = rel.params[1].schemaType
	var t = rel.params[2].schemaType
	
	var keyParser = map.makeKeyParser(kt)
	
	if(t.type === 'set' || t.type === 'list'){//if the result of the values macro is a set
		return
		//if(reduceGetter === undefined){
		//	throw new Error('a reduce-macro is required for map(collection,key-macro,value-macro,reduce-macro) when the result of the value macro has multiple values: ' + JSON.stringify(kt) + ' -> ' + JSON.stringify(t))
		//}
		//return svgMapMultiple.bind(undefined, s, cache, contextGetter, keyGetter, valueGetter, reduceGetter, keyImplicit, valueImplicit, reduceImplicitFirst, reduceImplicitSecond)
		//_.errout('TODO')
		if(kt.type === 'set' || kt.type === 'list'){
			//return svgMapKeyMultipleValueMultiple.bind(undefined, s, cache, keyParser, hasObjectValues, contextGetter, keyGetter, valueGetter, reduceGetter, keyImplicit, valueImplicit, reduceImplicitFirst, reduceImplicitSecond)
			//_.errout('TODO')
		}else{
			//_.errout('TODO')
			//return svgMapKeySingleValueMultiple.bind(undefined, s, cache, keyParser, hasObjectValues, contextGetter, keyGetter, valueGetter, reduceGetter, keyImplicit, valueImplicit, reduceImplicitFirst, reduceImplicitSecond)
		}
	}else if(t.type === 'map'){
		_.errout('cannot make map with maps as values')
	}else{//if the result of the values macro is a single value
		var hasObjectValues = t.type === 'object'
		if(kt.type === 'set' || kt.type === 'list'){
			//_.errout('TODO')
			//return svgMapKeyMultiple.bind(undefined, s, cache, keyParser, hasObjectValues, contextGetter, keyGetter, valueGetter, reduceGetter, keyImplicit, valueImplicit, reduceImplicitFirst, reduceImplicitSecond)
			return
		}else{

			//console.log('beginning specifics: ' + JSON.stringify(rel.params[0].schemaType))

			var objSchema = s.schema[rel.params[0].schemaType.members.object]
			if(objSchema === undefined){
				throw new Error('input members are not objects')
			}
			_.assertObject(objSchema)
			
			var keyPes
			try{
				keyPes = eachSubsetOptimization.extractMacroPropertyExpressions(rel.params[1].expr, rel.params[1].implicits)
			}catch(e){
				throw e
				return
			}
			var valuePes
			try{
				valuePes = eachSubsetOptimization.extractMacroPropertyExpressions(rel.params[2].expr, rel.params[2].implicits)
			}catch(e){
				return
			}
			
			var reducePes
			if(rel.params.length > 3){
				try{
					reducePes = eachSubsetOptimization.extractMacroPropertyExpressions(rel.params[3].expr, rel.params[3].implicits)
				}catch(e){
					return
				}
			}
						
			var propertyCodes = []
			for(var i=0;i<keyPes.length;++i){
	
				if(keyPes[i].params[1].type !== 'param') return//must be single-property descent (for now)
				var propertyName = keyPes[i].params[0].value
				propertyCodes.push(objSchema.properties[propertyName].code)
			}
			for(var i=0;i<valuePes.length;++i){
	
				if(valuePes[i].params[1].type !== 'param') return//must be single-property descent (for now)
				var propertyName = valuePes[i].params[0].value
				propertyCodes.push(objSchema.properties[propertyName].code)
			}
			
			if(rel.params.length > 3){			
				for(var i=0;i<reducePes.length;++i){
	
					if(reducePes[i].params[1].type !== 'param') return//must be single-property descent (for now)
					var propertyName = reducePes[i].params[0].value
					propertyCodes.push(objSchema.properties[propertyName].code)
				}
			}

			try{	
				var keyWrapper = eachSubsetOptimization.makeSynchronousFunction(s, keyPes, typeBindings, objSchema, rel.params[1].implicits, rel.params[1].expr)
				var valueWrapper = eachSubsetOptimization.makeSynchronousFunction(s, valuePes, typeBindings, objSchema, rel.params[2].implicits, rel.params[2].expr)
				if(rel.params.length > 3){
					var reduceWrapper = eachSubsetOptimization.makeSynchronousFunction(s, reducePes, typeBindings, objSchema, rel.params[3].implicits, rel.params[3].expr)
				}
			}catch(e){
				throw e
				return
			}

			var makeKeyBindingWrappers = eachSubsetOptimization.makeBindingWrappersFunction(s, self, rel.params[1], typeBindings)
			var makeValueBindingWrappers = eachSubsetOptimization.makeBindingWrappersFunction(s, self, rel.params[2], typeBindings)
			if(rel.params.length > 3){
				var makeReduceBindingWrappers = eachSubsetOptimization.makeBindingWrappersFunction(s, self, rel.params[3], typeBindings)
			}
			
			return svgMapSingle.bind(undefined, s, cache, keyParser, rel, hasObjectValues, contextGetter, keyWrapper, valueWrapper, reduceWrapper, propertyCodes, makeKeyBindingWrappers, makeValueBindingWrappers, makeReduceBindingWrappers)
		}
	}
}

exports.make = mapMaker


function copyBindings(bindings){
	var newBindings = Object.create(null)
	Object.keys(bindings).forEach(function(key){
		newBindings[key] = bindings[key]
	})
	return newBindings
}

function svgMapSingle(s, cache, keyParser, rel, hasObjectValues, contextGetter, keyWrapper, valueWrapper, reduceWrapper, propertyCodes, makeKeyBindingWrappers, makeValueBindingWrappers, makeReduceBindingWrappers, bindings, editId){
	var elements = contextGetter(bindings, editId)
	
	_.assertString(elements.name)

	//var ids = []
	//var has = {}
	//console.log('trying to make map: ' + editId)
	//console.log(new Error().stack)
	//return
	
	var streamingEditId = -1
	
	var key = ''
	_.each(bindings, function(value, k){
		key += bindings[k].key + ';'
	})

	key += JSON.stringify(rel.params[1].expr)//TODO better keys?
	key += JSON.stringify(rel.params[2].expr)//TODO better keys?
	if(rel.params.length > 3){
		key += JSON.stringify(rel.params[3].expr)//TODO better keys?
	}

	if(cache.has(key)){
		//console.log('returning cached each_subset_optimization')
		return cache.get(key)
	}else{
		//console.log('keys different: ' + key)
	}

	var keyBindingWrappers = makeKeyBindingWrappers(bindings, editId)
	var keyBindingWrapperKeys = Object.keys(keyBindingWrappers)

	var valueBindingWrappers = makeValueBindingWrappers(bindings, editId)
	var valueBindingWrapperKeys = Object.keys(valueBindingWrappers)

	if(reduceWrapper){	
		var reduceBindingWrappers = makeReduceBindingWrappers(bindings, editId)
		var reduceBindingWrapperKeys = Object.keys(reduceBindingWrappers)
	}

	function oldest(){
		var old = s.objectState.getCurrentEditId()
		//console.log('o: ' + old)
		for(var i=0;i<keyBindingWrapperKeys.length;++i){
			var bw = keyBindingWrappers[keyBindingWrapperKeys[i]]
			var o = bw.oldest()
			if(o < old) old = o
		}
		for(var i=0;i<valueBindingWrapperKeys.length;++i){
			var bw = valueBindingWrappers[valueBindingWrapperKeys[i]]
			var o = bw.oldest()
			if(o < old) old = o
		}
		
		if(reduceWrapper){
			for(var i=0;i<reduceBindingWrapperKeys.length;++i){
				var bw = reduceBindingWrappers[reduceBindingWrapperKeys[i]]
				var o = bw.oldest()
				if(o < old) old = o
			}
		}
		
		if(!streamUpToDate){
			//console.log('stream not up to date: ' + streamLast + ' ' + elements.oldest() + ' ' + elements.name)
			if(old > streamLast) old = streamLast
		}
		
		var o = elements.oldest()
		if(o < old) old = o
		
		//console.log('old: ' + old)
		return old
	}

	var listeners = listenerSet()

	var state = {}
	var keyForId = {}

	var multiState = {}
	
	//_.assertFunction(elements.descendTypes)
	
	var handle = {
		name: 'map-single-sync-optimization (' + elements.name + ')',
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
		key: key,
		descend: elements.descend,
		descendTypes: elements.descendTypes,
		getType: elements.getType
	}
	
	var streamUpToDate = false
	var streamLast = -1
	
	var objSchema = s.schema[rel.params[0].schemaType.members.object]
	var objTypeCode = objSchema.code
	_.assertInt(objTypeCode)
	
	if(reduceWrapper){
	
		
		var idSet = s.objectState.streamAllPropertyValuesForSet(objTypeCode, propertyCodes, editId, function(id, propertyValueMap, editId){
			//console.log('got property values: ' + id + ' ' + JSON.stringify(propertyValueMap) + ' ' + editId)

			function doReduce(a, b){
				var reduceParams = [a,b]
				var reduceResult = reduceWrapper(reduceBindingWrappers, propertyValueMap, reduceParams)
				return reduceResult
				//console.log('*reduced: ' + v)
			}
			function reduceState(ms){
				var keys = Object.keys(ms)
				_.assert(keys.length > 0)
				
				var v = ms[keys[0]]
				//var values = [v]
				for(var i=1;i<keys.length;++i){
					var nextValue = ms[keys[i]]
					//values.push(nextValue)
					var reduceParams = [v,nextValue]
					v = reduceWrapper(reduceBindingWrappers, propertyValueMap, reduceParams)
				}
				//console.log('reduced: ' + v + ' ' + keys.length)
				return v
			}

			var macroParams = [id]
			var keyResult = keyWrapper(keyBindingWrappers, propertyValueMap, macroParams)
			var valueResult = valueWrapper(valueBindingWrappers, propertyValueMap, macroParams)
			
			var oldKey = keyForId[id]
			var oldValue
			var oldMs
			if(oldKey !== undefined){
				oldMs = multiState[oldKey]
				oldValue = oldMs[id]
				//console.log(JSON.stringify(oldMs))
				
				if(keyResult !== oldKey){//remove the old key value from the state (note that oldKey will always be undefined if oldValue was undefined
					delete keyForId[id]
					delete oldMs[id]
					if(Object.keys(oldMs).length === 0){
						delete state[oldKey]
						listeners.emitDel(oldKey, editId)
					}else{
						var oldStateValue = state[oldKey]
						var newStateValue = state[oldKey] = reduceState(oldMs)
						listeners.emitPut(oldKey, newStateValue, oldStateValue, editId)
					}
				}
			}
			if(keyResult !== undefined && valueResult !== undefined){
				if(valueResult !== oldValue || keyResult !== oldKey){

					var ms = multiState[keyResult]
					if(ms === undefined) ms = multiState[keyResult] = {}
					ms[id] = valueResult

					if(keyResult !== oldKey){
					
						var oldStateValue = state[keyResult]
						if(state[keyResult] === undefined){
							state[keyResult] = valueResult
						}else{
							state[keyResult] = doReduce(state[keyResult], valueResult)
						}
						var newStateValue = state[keyResult]
						if(newStateValue !== oldStateValue){
							listeners.emitPut(keyResult, newStateValue, oldStateValue, editId)
						}
					}else{//value has been replaced, so we have to redo the entire reduce
						var oldStateValue = state[keyResult]
						//console.log('replaced value: ' + valueResult + ' <- ' + oldValue)
						var newStateValue = state[keyResult] = reduceState(ms)
						if(newStateValue !== oldStateValue){
							listeners.emitPut(keyResult, newStateValue, oldStateValue, editId)
						} 
					}
				}
			}
			if(valueResult !== undefined){
				keyForId[id] = keyResult
			}
		
		}, function(live, editId){
			console.log('*has streamed all initial object property values: ' + live + ' ' + editId)
			//if(editId === 1187) _.errout('TODO')
			streamUpToDate = live
			streamLast = editId
		}, function(id, editId){
			_.assertInt(editId)
			if(keyForId[id] !== undefined){
				//console.log('deleting id')
				var key = keyForId[id]
				if(key !== undefined){
					listeners.emitDel(key, editId)
					delete keyForId[id]
					delete state[key]
				}
			}			
		})
	}else{
		var idSet = s.objectState.streamAllPropertyValuesForSet(objTypeCode, propertyCodes, editId, function(id, propertyValueMap, editId){
			//console.log('got property values: ' + id + ' ' + JSON.stringify(propertyValueMap) + ' ' + editId)
			var macroParams = [id]
			var keyResult = keyWrapper(keyBindingWrappers, propertyValueMap, macroParams)
			var valueResult = valueWrapper(valueBindingWrappers, propertyValueMap, macroParams)
		
			if(keyForId[id] !== undefined && keyForId[id] !== keyResult && state[keyForId[id]] !== undefined){
				var oldKey = keyForId[id]
				listeners.emitDel(oldKey, editId)
				delete state[oldKey]
			}
			if(keyResult !== undefined && state[keyResult] !== valueResult){
				if(valueResult !== undefined){
					var oldValue = state[keyResult]
					state[keyResult] = valueResult
					listeners.emitPut(keyResult, valueResult, state[keyResult], editId)
				}else{
					if(keyForId[id]){
						delete state[keyForId[id]]
						listeners.emitDel(keyForId[id], editId)
					}
				}
			}
			keyForId[id] = keyResult
		
		}, function(live, editId){
			//_.assertInt(editId)
			//console.log('has streamed all initial object property values: ' + live + ' ' + editId + ' (' + streamLast + ')')
			//if(editId === 1187) _.errout('TODO')
			//console.log(new Error().stack)
			streamUpToDate = live
			streamLast = editId
		}, function(id, editId){
			_.assertInt(editId)
			if(keyForId[id] !== undefined){
				//console.log('deleting id')
				var key = keyForId[id]
				if(key){
					listeners.emitDel(key, editId)
					delete keyForId[id]
					delete state[key]
				}
			}			
		})
	}
		
	elements.attach({
		add: function(v, editId){
			//console.log('added: ' + v + ' ' + editId)
			idSet.add(v, editId)
		},
		remove: function(v, editId){
			idSet.remove(v, editId)
		},
		objectChange: stub,
		includeView: listeners.emitIncludeView.bind(listeners),//TODO may pass invalid inclusions through
		removeView: listeners.emitRemoveView.bind(listeners)
	}, editId)

	//console.log('successfully made sync optimized map')
	
	return cache.store(key, handle)
	//_.assertFunction(elements.descend)
/*	
	if(!_.isFunction(elements.descend)){
		_.errout('no descend defined for: ' + elements.name)
	}
	
	var cKeyGetter = keyGetter(bindings, editId)
	var cValueGetter = valueGetter(bindings, editId)
	var cReduceGetter;
	if(reduceGetter !== undefined){
		cReduceGetter = reduceGetter.asSyncMacro(bindings, editId)
	}
	
	var key = elements.key+cKeyGetter.key+cValueGetter.key
	console.log('single map key: ' + key)
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

				newKeyVariable.attach({
					set: keyListener,
					includeView: listeners.emitIncludeView.bind(listeners),
					removeView: listeners.emitRemoveView.bind(listeners)
				}, editId)
				newValueVariable.attach({
					set: valueListener,
					includeView: listeners.emitIncludeView.bind(listeners),
					removeView: listeners.emitRemoveView.bind(listeners)
				}, editId)
			},
			remove: function(v, editId){
				var r = allSets[v]
				r.key.detach(r.keyListener, editId)
				r.value.detach(r.valueListener, editId)
			},
			objectChange: stub,
			includeView: listeners.emitIncludeView.bind(listeners),
			removeView: listeners.emitRemoveView.bind(listeners)
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
						//console.log('got undefined value , old: ' + oldValue)
						if(oldValue !== undefined){
							var oldKvValue = state[oldValue]
							if(oldKvValue !== undefined){
								delete state[oldValue]
								//console.log('emitting del')
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
					includeView: listeners.emitIncludeView.bind(listeners),
					removeView: listeners.emitRemoveView.bind(listeners)
				}
				var vl = {
					set: valueListener,
					//TODO cache object changes?
					objectChange: function(typeCode, id, path, op, edit, syncId, editId){
						_.errout('TODO: ' + JSON.stringify(arguments))
						listeners.emitObjectChange(typeCode, id, path, op, edit, syncId, editId)
					},
					includeView: listeners.emitIncludeView.bind(listeners),
					removeView: listeners.emitRemoveView.bind(listeners)
				}
				
				allSets[v] = {key: newKeyVariable, value: newValueVariable, keyListener: kl, valueListener: vl}

				newKeyVariable.attach(kl, editId)
				newValueVariable.attach(vl, editId)
			},
			remove: function(v, editId){
				var r = allSets[v]
				//console.log('detaching from map')
				r.key.detach(r.keyListener, editId)
				r.value.detach(r.valueListener, editId)
			},
			objectChange: stub,
			includeView: listeners.emitIncludeView.bind(listeners),
			removeView: listeners.emitRemoveView.bind(listeners)
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
		
	return cache.store(key, handle)*/
}

