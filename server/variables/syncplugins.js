"use strict";

var _ = require('underscorem')

var Cache = require('./../variable_cache')
//var schema = require('./../../shared/schema')
var listenerSet = require('./../variable_listeners')

var fixedPrimitive = require('./../fixed/primitive')
var fixedObject = require('./../fixed/object')

var makeKeyParser = require('./map').makeKeyParser

function stub(){}

/*
TODO: implement proper caching
*/

function wrapParam(v, schemaType, s){

	function addDescend(handle, t){
		_.assertDefined(t)
		
		if(!_.isFunction(t.descend)) _.errout('needs descend: ' + t.name)
		
		handle.descend = function(path, editId, cb, continueListening){
			_.assertFunction(cb)
			var worked = t.descend(path, editId, cb, continueListening)
			if(!_.isBoolean(worked)) _.errout('did not provide a boolean: ' + t.name)
			return worked
		}
	}
	
	if(schemaType.type === 'primitive'){
		return function(bindings, editId){

			var listeners = listenerSet()

			var t = v(bindings, editId)
			var cachedValue
			t.attach({
				set: function(v, oldV, editId){
					cachedValue = v
					listeners.emitChanged(editId)
				},
				includeView: stub,
				removeView: stub
			}, editId)
			return {
				name: 'syncplugin-primitive-wrapper',
				attach: function(listener, editId){
					_.assertInt(editId)
					listeners.add(listener)

					listener.changed(editId)
				},
				get: function(){return cachedValue;},
				oldest: t.oldest
			}
		}
	}else if(schemaType.type === 'object'){
		return function(bindings, editId){

			var listeners = listenerSet()

			var t = v(bindings, editId)
			var cachedValue
			t.attach({
				set: function(v, oldV, editId){
					cachedValue = v
					listeners.emitChanged(editId)
				},
				includeView: listeners.emitIncludeView.bind(listeners),
				removeView: listeners.emitRemoveView.bind(listeners)
			}, editId)
			var handle = {
				name: 'syncplugin-object-wrapper (' + t.name + ')',
				attach: function(listener, editId){
					_.assertInt(editId)
					listeners.add(listener)
					//if(cachedValue !== undefined){
						listener.changed(editId)
					//}
				},
				get: function(){return cachedValue;},
				oldest: t.oldest
			}
			addDescend(handle, t)
			return handle
		}
	}else if(schemaType.type === 'set'){
		return function(bindings, editId){
			var listeners = listenerSet()

			var t = v(bindings, editId)
			var cachedValues = []
			var re = Math.random()

			t.attach({
				add: function(v, editId){
					_.assert(cachedValues.indexOf(v) === -1)
					cachedValues.push(v)
					listeners.emitChanged(editId)
				},
				remove: function(v, editId){
					cachedValues.splice(cachedValues.indexOf(v), 1)
					listeners.emitChanged(editId)
				},
				objectChange: function(){_.errout('TODO?');},
				includeView: listeners.emitIncludeView.bind(listeners),
				removeView: listeners.emitRemoveView.bind(listeners)
			}, editId)
			var handle = {
				name: 'syncplugin-set-wrapper ('+t.name+')',
				attach: function(listener, editId){
					listeners.add(listener)
					//if(cachedValues.length > 0){
						listener.changed(editId)
					//}
				},
				get: function(){return cachedValues;},
				oldest: t.oldest//,
				//getType: t.getType
			}
			
			if(schemaType.members.type === 'object'){
				addDescend(handle, t)
				//if(t.getType === undefined) _.errout('missing getType: ' + t.name)
			}
			
			return handle
		}
	}else if(schemaType.type === 'list'){
		//if(schemaType.members.type === 'primitive'){
			return function(bindings, editId){
				var listeners = listenerSet()

				var t = v(bindings, editId)
				var cachedValues = []
				var re = Math.random()
				//s.log('attaching ' + re + ' ' + t.attach)

				t.attach({
					add: function(v, editId){
						//console.log(re + ' cachedValues: ' + JSON.stringify(cachedValues))
						//console.log('adding: ' + v)
						_.assert(cachedValues.indexOf(v) === -1)
						cachedValues.push(v)
						listeners.emitChanged(editId)
					},
					remove: function(v, editId){
						cachedValues.splice(cachedValues.indexOf(v), 1)
					},
					objectChange: function(){
						_.errout('TODO')
					},
					includeView: function(){
						_.errout('TODO')
					},
					removeView: function(){
						_.errout('TODO')
					}
				}, editId)
				var handle = {
					name: 'syncplugin-list-wrapper (' + t.name + ')',
					attach: function(listener, editId){
						listeners.add(listener)
						//if(cachedValues.length > 0){
							listener.changed(editId)
						//}
					},
					get: function(){return cachedValues;},
					oldest: t.oldest
				}
				
				if(schemaType.members.type === 'object'){
					addDescend(handle, t)
				}
				
				return handle
			}
		//}else{
		//	_.errout('TODO: ' + JSON.stringify(schemaType))
		//}
	}else if(schemaType.type === 'map'){
		return function(bindings, editId){
			var listeners = listenerSet()

			var t = v(bindings, editId)
			var cachedValues = {}
			//var re = Math.random()
			//s.log('*attaching ' + re + ' ' + t.attach+'^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^')

			t.attach({
				put: function(key, value, oldValue, editId){
					//console.log('GOT PUT: ' + key + ' ' + value + ' ' + oldValue + ' ' + editId + ' $$$$$$$$$$$$$4')
					cachedValues[key] = value
					listeners.emitChanged(editId)
				},
				del: function(key){
					delete cachedValues[key]
					listeners.emitChanged(editId)
				},
				objectChange: function(){
					_.errout('TODO')
				},
				includeView: listeners.emitIncludeView.bind(listeners),
				removeView: listeners.emitRemoveView.bind(listeners)
			}, editId)
			var handle = {
				name: 'syncplugin-map-wrapper',
				attach: function(listener, editId){
					listeners.add(listener)
					//if(_.size(cachedValues) > 0){
						listener.changed(editId)
					//}
				},
				get: function(){return cachedValues;},
				oldest: t.oldest
			}

			if(schemaType.value.type === 'object' || schemaType.key.type === 'object'){
				//TODO?
				addDescend(handle, t)
			}

			return handle;
		}
		/*
		}else{
			_.errout('TODO')
		}*/
	}else{
		_.errout('TODO: ' + JSON.stringify(schemaType))
	}
}

function setupOutputHandler(schemaType, s, makeDescend, paramTypes){


	function setupDescent(handle, paramsForDescent){
		if(makeDescend){//TODO require makeDescend for object results?
			var descender = makeDescend(paramTypes)
			_.assertFunction(descender)
			handle.descend = function(path, editId, cb, continueListening){
				var res = descender(handle.lastInputs)
				_.assertInt(res.index)
				_.assertArray(res.prefix)
				var worked = handle.descenders[res.index](res.prefix.concat(path), editId, cb, continueListening)
				if(!_.isBoolean(worked)) _.errout('did not provide a boolean: ' + handle.descenders[res.index].pName)
				_.assertBoolean(worked)
				return worked
			}
		}else{
			handle.descend = function(path, editId, cb, continueListening){
				_.assertFunction(cb)
				//console.log('path: ' + JSON.stringify(path))
				if(s.objectState.isTopLevelObject(path[0].edit.id)){
					s.objectState.streamProperty(path, editId, cb, continueListening)
					return true
				}else{
					//_.errout('TODO')
					for(var i=0;i<paramsForDescent.length;++i){
						var pt = paramsForDescent[i]
						
						var worked = pt.descend(path, editId, cb, continueListening)
						if(worked){
							//console.log('trying all parameters for descend worked: ' + JSON.stringify(path))
							//console.log(new Error().stack)
							return true
						}
					}
					//console.log('output handler tried all, could not descend: ' + JSON.stringify(path))
					//console.log(JSON.stringify(paramsForDescent))
					return false
				}
				//_.errout('TODO use makeDescend if available')
			}
		}
	}
	
	if(schemaType.type === 'primitive'){
		//_.errout('TODO')
		var f= function(oldest){

			var listeners = listenerSet()
			
			var last
			return {
				name: 'syncplugin-primitive',
				update: function(result, editId){
					if(last !== result){
						listeners.emitSet(result, last, editId)
						last = result
					}
				},
				attach: function(listener, editId){
					listeners.add(listener)
					if(last !== undefined){
						listener.set(last, undefined, editId)
					}
				},
				detach: function(listener, editId){
					listeners.remove(listener)
					if(editId && last !== undefined){
						listener.set(undefined, last, editId)
					}
				},
				oldest: oldest,
				key: Math.random()
			}
		}
		f.wrapAsSet = function(v, editId){
			//_.errout('TODO')
			return fixedPrimitive.make(s)(v, {}, editId);
		}
		return f
	}else if(schemaType.type === 'object'){
		var f = function(oldest, paramsForDescent){

			var listeners = listenerSet()
			_.assertFunction(oldest)
			var objId;
			var updating = false
			var handle = {
				name: 'syncplugin-object',
				update: function(result, editId){
					if(result !== objId){
						updating = true
						var old = objId
						objId = result
						listeners.emitSet(result, old, editId)
						updating = false
					}
				},
				attach: function(listener, editId){
					listeners.add(listener)
					_.assertFunction(listener.set)
					if(objId !== undefined){
						listener.set(objId, undefined, editId)
					}
				},
				detach: function(listener, editId){
					listeners.remove(listener)
					if(editId && objId !== undefined){
						listener.set(undefined, objId, editId)
					}
				},
				oldest: oldest,
				key: Math.random()
			}
			setupDescent(handle, paramsForDescent)
			return handle;
		}
		var fo = fixedObject.make(s)
		f.wrapAsSet = function(v, editId, context){
			//if(!s.isTopLevelObject(v)) _.errout('TODO fix descend')
			return fo(v, editId, context)
		}		
		return f
	}else if(schemaType.type === 'set' || schemaType.type === 'list'){//TODO support list properly
		//if(schemaType.members.type === 'primitive'){
			var f = function(oldest, paramsForDescent){

				var listeners = listenerSet()

				_.assertFunction(oldest)
				var has = {}
				var list = []
				var r = Math.random()
				var updating = false
				var handle = {
					name: 'syncplugin-set',
					update: function(result, editId){
						if(list.length === 0 && result.length === 0) return
						
						_.assertNot(updating)
						updating = true
						var newHas = {}
						for(var i=0;i<result.length;++i){
							var v = result[i]
							_.assertDefined(v)
							newHas[v] = true
							//console.log(r + ' emitting adds?: ' + JSON.stringify(result))
							if(has[v] === undefined){
								//console.log(r + ' adding: ' + v)
								//console.log('has: ' + JSON.stringify(has))
								//console.log('result: ' + JSON.stringify(result))
								listeners.emitAdd(v, editId)
							}
						}
						for(var i=0;i<list.length;++i){
							var v = list[i]
							if(newHas[v] === undefined){
								listeners.emitRemove(v, editId)
							}
						}
						//console.log(r + ' ' + JSON.stringify(has) + ' -> ' + JSON.stringify(newHas))
						list = [].concat(result)
						has = newHas
						updating = false
					},
					attach: function(listener, editId){
						listeners.add(listener)
						_.assertFunction(listener.add)
						//console.log('attached(' + list.length + '): ' + new Error().stack)
						//console.log(''+listener.add)
						for(var i=0;i<list.length;++i){
							listener.add(list[i], editId)
						}
					},
					detach: function(listener, editId){
						listeners.remove(listener)
						if(editId){
							for(var i=0;i<list.length;++i){
								listener.remove(list[i], editId)
							}
						}
					},
					oldest: oldest,
					key: Math.random()/*,
					getType: function(id){//TODO? more complicated than this?
						//_.errout('TODO')
						if(s.objectState.isTopLevelObject(id)){
							return s.objectState.getObjectType(id)
						}
						
						for(var i=0;i<paramsForDescent.length;++i){
							var pfd = paramsForDescent[i]
							if(pfd.getType === undefined) _.errout("missing getType: " + pfd.name)
							var type = pfd.getType(id)
							if(type !== undefined){
								return type
							}
						}
						//_.errout('failure - could not find type of id in any param sets: ' + id + ' ' + JSON.stringify(pfd))
						
						//_.errout('TODO: ' + JSON.stringify(paramTypes))
						//return s.objectState.getObjectType(id)
					}*/
				}
				if(schemaType.members.type !== 'primitive'){
					setupDescent(handle, paramsForDescent)
				}
				return handle;
			}
			if(schemaType.members.type === 'primitive'){
				f.wrapAsSet = function(v, editId, context){
					return fixedPrimitive.make(s)(v, {}, editId);
				}
			}else{
				var fo = fixedObject.make(s)
				f.wrapAsSet = function(v, editId, context){
					return fo(v, editId, context)
				}
			}
			return f
		//}else{
		//	_.errout('TODO')
		//}
	}else if(schemaType.type === 'map'){
		var keyParser = makeKeyParser(schemaType.key)
		//if(schemaType.value.type === 'primitive'){

			var f = function(oldest){

				var listeners = listenerSet()

				_.assertFunction(oldest)

				var map = {}
				var r = Math.random()
				var updating = false
				return {
					name: 'syncplugin-map',
					update: function(result, editId){
						_.assertInt(editId)
						if(_.size(result) === 0 && _.size(map) === 0) return

						Object.keys(result).forEach(function(key){
							var value = result[key]
							if(map[key] !== value){//=== undefined){
								key = keyParser(key)
								listeners.emitPut(key, value, map[key], editId)
							}
						})
						Object.keys(map).forEach(function(key){
							var value = map[key]
							if(result[key] === undefined){
								key = keyParser(key)
								listeners.emitDel(key, editId)
							}
						})
						
						map = result
						updating = false
					},
					attach: function(listener, editId){
						listeners.add(listener)
						_.assertFunction(listener.put)
						//_.each(map, function(value, key){
						Object.keys(map).forEach(function(key){
							var value = map[key]
							key = keyParser(key)
							listener.put(key, value, undefined, editId)
						})
					},
					detach: function(listener, editId){
						listeners.remove(listener)
						if(editId){
							Object.keys(map).forEach(function(key){
								//var value = map[key]
								key = keyParser(key)
								listener.del(key, editId)
							})
						}
					},
					oldest: oldest,
					key: Math.random()
				}
			}
			f.wrapAsSet = function(){
				_.errout('TODO')
			}
			return f
		/*}else{
			_.errout('TODO')
		}*/
	}else{
		_.errout('TODO: ' + JSON.stringify(schemaType))
	}
}

exports.wrapParam = wrapParam

function typeHasObjects(t){
	if(t.type === 'object') return true
	if(t.type === 'set' || t.type === 'list') return typeHasObjects(t.members)
	if(t.type === 'map'){
		return typeHasObjects(t.key) || typeHasObjects(t.value)
	}
	return false
}

exports.wrap = function(s, self, callExpr, typeBindings, plugin){

	/*
		1.  Make a sync cache/wrapper for each parameter
		2.  Make a diff-analysing output wrapper that converts the static snapshot to a series of edits

		a)  Every time any of the parameter wrapper's value changes, call the plugin.implementation function with the value array
	*/
	
	var cache = new Cache(s.analytics)

	//1. one set for each parameter
	var paramSets = []
	callExpr.params.forEach(function(param, index){
		var v = self(param, typeBindings)
		var wv = wrapParam(v, param.schemaType, s)
		paramSets.push(wv)
		wv.schemaType = param.schemaType
	})
	
	_.assert(paramSets.length >= plugin.minParams)
	_.assert(plugin.maxParams === -1 || paramSets.length <= plugin.maxParams)

	var res = plugin.schemaType(callExpr)
	//console.log('wrapping: ' + JSON.stringify(callExpr))

	var paramsForDescent = {}
	callExpr.params.forEach(function(param, index){
		if(typeHasObjects(param.schemaType)){
			paramsForDescent[index] = true//.push(paramSets[index])
		}
	})	
	
	var makeOutputHandle = setupOutputHandler(res.schemaType, s, plugin.descender, res.paramTypes)

	var f = svgSyncPlugin.bind(undefined, s, cache, paramSets, plugin, makeOutputHandle, paramsForDescent)
	
	f.wrapAsSet = function(v, editId, context){
		//_.errout('TODO')
		return makeOutputHandle.wrapAsSet(v, editId, context)
	}
	f.getDescender = function(){
		_.errout('TODO')
	}
	
	return f
}


function svgSyncPlugin(s, cache, paramSets, plugin, makeOutputHandle, descendableParams, bindings, editId){

	var paramsForDescent = []

	var params = []
	for(var i=0;i<paramSets.length;++i){
		var ps = paramSets[i](bindings, editId)
		_.assertDefined(ps)
		params.push(ps)
		if(descendableParams[i]){
			if(ps.descend === undefined) _.errout('should be descendable, but missing descend: ' 
				+ ps.name + ' ' + JSON.stringify(paramSets[i].schemaType))
			_.assertFunction(ps.descend)
			paramsForDescent.push(ps)
		}
	}
	
	var outputHandler = makeOutputHandle(oldest, paramsForDescent)
	
	
	var recomputing
	var listener = {
		changed: function(editId){
			_.assertInt(editId)
			_.assertNot(recomputing)
			//console.log('recomputing: ' + plugin.callSyntax)
			recomputing = true
			recompute(editId)
			recomputing = false
		},
		includeView: function(){
			_.errout('TODO')
		},
		removeView: function(){
			_.errout('TODO')
		}
	}

	//_.assert(paramSets.length > 0)


	var valueArray = []
	valueArray.length = params.length
	
	outputHandler.descenders = []
	//outputHandler.typeDescenders = []

	var oldestParams = []

	params.forEach(function(p, i){
		_.assertString(p.name)
		p.attach(listener, editId)
		outputHandler.descenders[i] = p.descend
		
		if(outputHandler.descenders[i] === undefined){
			//_.errout('no descender for ' + params[0].name)
			outputHandler.descenders[i] = function(){
				_.errout('no descender specified for variable ' + p.name)
			}
		}
		
		if(!p.neverGetsOld){
			oldestParams.push(p)
		}
	})
	

	
	function oldest(){
		//console.log(new Error().stack)
		var o = s.objectState.getCurrentEditId()
		for(var i=0;i<oldestParams.length;++i){
			var p = oldestParams[i]
			var old = p.oldest()
			//if(old === 1187) console.log('here: ' + p.oldest)
			if(old < o) o = old
		}
		return o
	}
	
	var result;
	var nr = Math.random()
	
	
	function recompute(editId){
		for(var i=0;i<params.length;++i){
			valueArray[i] = params[i].get()
			//_.assertDefined(valueArray[i])
			if(valueArray[i] === undefined && !plugin.nullsOk){
				console.log('WARNING: null input found for plugin that will not take nulls: ' + plugin.callSyntax + ' ' + JSON.stringify(valueArray))
				return
			}
		}
		//console.log('value array: ' + JSON.stringify(valueArray))
		outputHandler.lastInputs = valueArray
		
		//console.log('recomputing with: ' + JSON.stringify(valueArray))
		var rr = plugin.implementation(valueArray)
		//console.log(nr + ' ' + plugin.callSyntax + ' recomputed('+JSON.stringify(valueArray)+ '): '+ JSON.stringify(result) + ' -> ' + JSON.stringify(rr))
		result = rr
		outputHandler.update(result, editId)
	}	
	
	//if(recomputing === undefined) recompute(editId)
	
	return outputHandler
}

