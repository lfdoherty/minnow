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
			//console.log('*descending: ' + t.descend)
			var worked = t.descend(path, editId, cb, continueListening)
			if(!_.isBoolean(worked)) _.errout('did not provide a boolean: ' + t.name)
			return worked
		}
		
		if(t.getTopParent){
			handle.getTopParent = function(id){
				if(s.objectState.isTopLevelObject(id)) return id
				if(!t.getTopParent) _.errout('no getTopParent: ' + t.name)
				return t.getTopParent(id)
			}
		}else{
			handle.getTopParent = function(id){
				_.errout('TODO getTopParent: ' + t.name)
			}
		}
	}
	
	if(schemaType.type === 'primitive'){
		return function(bindings, editId){

			var listeners = listenerSet()
			
			//console.log('created primitive param wrapper')
			//console.log(new Error().stack)

			var t = v(bindings, editId)
			if(t.key === undefined) _.errout('no key: ' + t.name)
			var cachedValue
			var tListener = {
				set: function(v, oldV, editId){
					cachedValue = v
					//console.log('primitive set happened: ' + v + ' ' + oldV + ' ' + listeners.many())
					//console.log(new Error().stack)
					listeners.emitChanged(editId)
				},
				includeView: stub,
				removeView: stub
			}
			t.attach(tListener, editId)
			var handle = {
				name: 'syncplugin-primitive-wrapper',
				attach: function(listener, editId){
					_.assertInt(editId)
					listeners.add(listener)

					listener.changed(editId)
					//console.log('attached to primitive: ' + cachedValue)
				},
				detach: function(listener, editId){
					listeners.remove(listener)
					_.assertEqual(listeners.many(), 0)
					t.detach(tListener, editId)
					handle.attach = handle.detach = handle.oldest = function(){_.errout('destroyed');}
					//console.log('detaching primitive: ' + cachedValue)
				},
				get: function(){return cachedValue;},
				oldest: t.oldest,
				key: t.key
			}
			return handle
		}
	}else if(schemaType.type === 'object'){
		return function(bindings, editId){

			var listeners = listenerSet()

			var t = v(bindings, editId)
			var cachedValue
			var tListener = {
				set: function(v, oldV, editId){
					cachedValue = v
					listeners.emitChanged(editId)
				},
				includeView: listeners.emitIncludeView.bind(listeners),
				removeView: listeners.emitRemoveView.bind(listeners)
			}
			t.attach(tListener, editId)
			var handle = {
				name: 'syncplugin-object-wrapper (' + t.name + ')',
				attach: function(listener, editId){
					_.assertInt(editId)
					listeners.add(listener)
					listener.changed(editId)
				},
				detach: function(listener, editId){
					listeners.remove(listener)
					_.assertEqual(listeners.many(), 0)
					t.detach(tListener, editId)
					handle.attach = handle.detach = handle.oldest = function(){_.errout('destroyed');}
				},
				get: function(){return cachedValue;},
				oldest: t.oldest,
				key: t.key
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

			var tListener = {
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
			}
			
			t.attach(tListener, editId)
			
			var handle = {
				name: 'syncplugin-set-wrapper ('+t.name+')',
				attach: function(listener, editId){
					listeners.add(listener)
					listener.changed(editId)
				},
				detach: function(listener, editId){
					listeners.remove(listener)
					_.assertEqual(listeners.many(), 0)
					t.detach(tListener, editId)
					handle.attach = handle.detach = handle.oldest = function(){_.errout('destroyed');}
				},
				get: function(){return cachedValues;},
				oldest: t.oldest,
				key: t.key
			}
			
			if(schemaType.members.type === 'object'){
				addDescend(handle, t)
			}
			
			return handle
		}
	}else if(schemaType.type === 'list'){
		return function(bindings, editId){
			var listeners = listenerSet()

			var t = v(bindings, editId)
			var cachedValues = []
			var re = Math.random()
			//s.log('attaching ' + re + ' ' + t.attach)

			var tListener = {
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
			}
			t.attach(tListener, editId)
			var handle = {
				name: 'syncplugin-list-wrapper (' + t.name + ')',
				attach: function(listener, editId){
					listeners.add(listener)
					listener.changed(editId)
				},
				detach: function(listener, editId){
					listeners.remove(listener)
					_.assertEqual(listeners.many(), 0)
					t.detach(tListener, editId)
					handle.attach = handle.detach = handle.oldest = function(){_.errout('destroyed');}
				},
				get: function(){return cachedValues;},
				oldest: t.oldest,
				key: t.key
			}
			
			if(schemaType.members.type === 'object'){
				addDescend(handle, t)
			}
			
			return handle
		}
	}else if(schemaType.type === 'map'){
		return function(bindings, editId){
			var listeners = listenerSet()

			var t = v(bindings, editId)
			var cachedValues = {}

			var tListener = {
				put: function(key, value, oldValue, editId){
					cachedValues[key] = value
					listeners.emitChanged(editId)
				},
				del: function(key, editId){
					delete cachedValues[key]
					listeners.emitChanged(editId)
				},
				objectChange: function(){
					_.errout('TODO')
				},
				includeView: listeners.emitIncludeView.bind(listeners),
				removeView: listeners.emitRemoveView.bind(listeners)
			}
			t.attach(tListener, editId)
			var handle = {
				name: 'syncplugin-map-wrapper',
				attach: function(listener, editId){
					listeners.add(listener)
					listener.changed(editId)
				},
				detach: function(listener, editId){
					listeners.remove(listener)
					_.assertEqual(listeners.many(), 0)
					t.detach(tListener, editId)
					handle.attach = handle.detach = handle.oldest = function(){_.errout('destroyed');}
				},
				get: function(){return cachedValues;},
				oldest: t.oldest,
				key: t.key
			}

			if(schemaType.value.type === 'object' || schemaType.key.type === 'object'){
				//TODO?
				addDescend(handle, t)
			}

			return handle;
		}
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
				//console.log('sync descending: ' + descender)
				var res = descender(handle.lastInputs)
				_.assertInt(res.index)
				_.assertArray(res.prefix)
				//console.log('sync descending*: ' + handle.descenders[res.index])
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
		handle.getTopParent = function(id){
			if(s.objectState.isTopLevelObject(id)) return id
			for(var i=0;i<paramsForDescent.length;++i){
				var pt = paramsForDescent[i]
				
				if(pt.getTopParent) return pt.getTopParent(id)
				
				/*var worked = pt.descend(path, editId, cb, continueListening)
				if(worked){
					//console.log('trying all parameters for descend worked: ' + JSON.stringify(path))
					//console.log(new Error().stack)
					return true
				}*/
			}
			//console.log('output handler tried all, could not descend: ' + JSON.stringify(path))
			//console.log(JSON.stringify(paramsForDescent))
			//return false
			_.errout('getTopParent must be uniquely findable: ' + id + ' ' + JSON.stringify(_.map(paramsForDescent, function(t){return t.name})))
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
	}else if(schemaType.type === 'set'){
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
						console.log('removing: ' + JSON.stringify(list))
						for(var i=0;i<list.length;++i){
							listener.remove(list[i], editId)
						}
					}
				},
				oldest: oldest,
				key: Math.random()
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
	}else if(schemaType.type === 'list'){
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

					updating = true
					if(result.length === list.length){
						var failed = false
						for(var i=0;i<result.length;++i){
							if(result[i] !== list[i]){
								failed = true
								break
							}
						}
						if(!failed) return
					}
					
					//TODO optimize
					
					for(var i=0;i<list.length;++i){
						listeners.emitRemove(list[i], editId)
					}
					has = {}
					for(var i=0;i<result.length;++i){
						listeners.emitAdd(result[i], editId)
						has[result[i]] = true
					}
					list = [].concat(result)
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
				key: Math.random()
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

	var key = ''
	var params = []
	for(var i=0;i<paramSets.length;++i){
		var ps = paramSets[i](bindings, editId)
		if(ps.key === undefined) _.errout('no key: ' + ps.name)
		_.assertDefined(ps.key)
		key += ps.key+','
		_.assertDefined(ps)
		params.push(ps)
		if(descendableParams[i]){
			if(ps.descend === undefined) _.errout('should be descendable, but missing descend: ' 
				+ ps.name + ' ' + JSON.stringify(paramSets[i].schemaType))
			_.assertFunction(ps.descend)
			paramsForDescent.push(ps)
		}
	}
	
	if(cache.has(key)){
		return cache.get(key)
	}
	
	var outputHandler = makeOutputHandle(oldest, paramsForDescent)
	
	var settingUp = true
	var recomputeAfter = false
	
	var recomputing
	var listener = {
		changed: function(editId){
			_.assertInt(editId)
			_.assertNot(recomputing)
			if(settingUp){
				recomputeAfter = true
				return
			}
			//console.log('recomputing: ' + plugin.callSyntax)
			//console.log(new Error().stack)
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

	var isDestroyed = false
	outputHandler.destroy = function(){
		isDestroyed = true
		params.forEach(function(p, i){
			if(p.detach === undefined) _.errout('missing detach method: ' + p.name)
			p.detach(listener)
		})
		outputHandler.attach = outputHandler.detach = outputHandler.oldest = function(){_.errout('destroyed');}
	}
	

	var valueArray = []
	valueArray.length = params.length
	
	outputHandler.descenders = []

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
		if(isDestroyed) _.errout('destroyed')
		
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
		//console.log('updating: ' + editId)
		outputHandler.update(result, editId)
	}	

	if(recomputeAfter){
		//console.log('doing initial recompute')
		recomputing = true
		recompute(editId)
		recomputing = false
	}
	settingUp = false
	
	//if(recomputing === undefined) recompute(editId)
	
	return cache.store(key, outputHandler)
}

