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


	if(schemaType.type === 'primitive'){
		return function(bindings, editId){

			var listeners = listenerSet()

			var t = v(bindings, editId)
			var cachedValue
			t.attach({
				set: function(v, oldV, editId){
					cachedValue = v
					listeners.emitChanged(editId)
				}
			}, editId)
			return {
				name: 'syncplugin-primitive-wrapper',
				attach: function(listener, editId){
					_.assertInt(editId)
					listeners.add(listener)
					if(cachedValue !== undefined){
						listener.changed(editId)
					}
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
				}
			}, editId)
			return {
				name: 'syncplugin-object-wrapper',
				attach: function(listener, editId){
					_.assertInt(editId)
					listeners.add(listener)
					if(cachedValue !== undefined){
						listener.changed(editId)
					}
				},
				get: function(){return cachedValue;},
				oldest: t.oldest
			}
		}
	}else if(schemaType.type === 'set'){
		//if(schemaType.members.type === 'primitive'){
			return function(bindings, editId){
				var listeners = listenerSet()

				var t = v(bindings, editId)
				var cachedValues = []
				var re = Math.random()
				s.log('attaching ' + re + ' ' + t.attach)

				t.attach({
					name: 'syncplugin-set-primitive-wrapper',
					add: function(v, editId){
						//console.log(re + ' cachedValues: ' + JSON.stringify(cachedValues))
						//console.log('adding: ' + v)
						_.assert(cachedValues.indexOf(v) === -1)
						cachedValues.push(v)
						listeners.emitChanged(editId)
					},
					remove: function(v, editId){
						//console.log('removed: ' + v)
						cachedValues.splice(cachedValues.indexOf(v), 1)
						listeners.emitChanged(editId)
					},
					objectChange: function(){_.errout('TODO?');}
				}, editId)
				return {
					attach: function(listener, editId){
						listeners.add(listener)
						if(cachedValues.length > 0){
							listener.changed(editId)
						}
					},
					get: function(){return cachedValues;},
					oldest: t.oldest
				}
			}
		//}else{
		//	_.errout('TODO')
		//}
	}else if(schemaType.type === 'list'){
		if(schemaType.members.type === 'primitive'){
			return function(bindings, editId){
				var listeners = listenerSet()

				var t = v(bindings, editId)
				var cachedValues = []
				var re = Math.random()
				s.log('attaching ' + re + ' ' + t.attach)

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
					}
				}, editId)
				return {
					name: 'syncplugin-list-primitive-wrapper',
					attach: function(listener, editId){
						listeners.add(listener)
						if(cachedValues.length > 0){
							listener.changed(editId)
						}
					},
					get: function(){return cachedValues;},
					oldest: t.oldest
				}
			}
		}else{
			_.errout('TODO')
		}
	}else if(schemaType.type === 'map'){
		return function(bindings, editId){
			var listeners = listenerSet()

			var t = v(bindings, editId)
			var cachedValues = {}
			var re = Math.random()
			s.log('*attaching ' + re + ' ' + t.attach+'^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^')

			t.attach({
				put: function(key, value, oldValue, editId){
					s.log('GOT PUT: ' + key + ' ' + value + ' ' + oldValue + ' ' + editId + ' $$$$$$$$$$$$$4')
					cachedValues[key] = value
					listeners.emitChanged(editId)
				},
				del: function(key){
					delete cachedValues[key]
					listeners.emitChanged(editId)
				},
				objectChange: function(){
					_.errout('TODO')
				}
			}, editId)
			var handle = {
				name: 'syncplugin-map-primitive-wrapper',
				attach: function(listener, editId){
					listeners.add(listener)
					if(_.size(cachedValues) > 0){
						listener.changed(editId)
					}
				},
				get: function(){return cachedValues;},
				oldest: t.oldest
			}

			if(schemaType.value.type !== 'primitive'){
				//TODO?
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

function setupOutputHandler(schemaType, s){


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
	}else if(schemaType.type === 'set'){
		//if(schemaType.members.type === 'primitive'){
			var f = function(oldest){

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
					key: Math.random(),
					getType: function(id){//TODO? more complicated than this?
						//_.errout('TODO')
						return s.objectState.getObjectType(id)
					}
				}
				if(schemaType.members.type !== 'primitive'){
					handle.descend = function(path, editId, cb, continueListening){
						_.assertFunction(cb)
						//_.assertInt(path[0])
						//_.assertInt(path[1])
						s.objectState.streamProperty(path, editId, cb, continueListening)
					}
					handle.descendTypes = function(path, editId, cb, continueListening){
						_.assertFunction(cb)
						//_.assertInt(path[0])
						//_.assertInt(path[1])
						s.objectState.streamPropertyTypes(path, editId, cb, continueListening)
					}
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
						if(_.size(result) === 0 && _size(map) === 0) return

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
		_.errout('TODO')
	}
}

exports.wrapParam = wrapParam

exports.wrap = function(s, self, callExpr, typeBindings, plugin){

	/*
		1.  Make a sync cache/wrapper for each parameter
		2.  Make a diff-analysing output wrapper that converts the static snapshot to a series of edits

		a)  Every time any of the parameter wrapper's value changes, call the plugin.implementation function with the value array
	*/
	
	var cache = new Cache()

	//1. one set for each parameter
	var paramSets = []
	callExpr.params.forEach(function(param, index){
		var v = self(param, typeBindings)
		var wv = wrapParam(v, param.schemaType, s)
		paramSets.push(wv)
	})
	
	_.assert(paramSets.length >= plugin.minParams)
	_.assert(plugin.maxParams === -1 || paramSets.length <= plugin.maxParams)

	var makeOutputHandle = setupOutputHandler(plugin.schemaType(callExpr), s)

	var f = svgSyncPlugin.bind(undefined, s, cache, paramSets, plugin, makeOutputHandle)
	
	f.wrapAsSet = function(v, editId, context){
		//_.errout('TODO')
		return makeOutputHandle.wrapAsSet(v, editId, context)
	}
	f.getDescender = function(){
		_.errout('TODO')
	}
	
	return f
}


function svgSyncPlugin(s, cache, paramSets, plugin, makeOutputHandle, bindings, editId){

	var outputHandler = makeOutputHandle(oldest)
	
	
	var recomputing = false
	var listener = {
		changed: function(editId){
			_.assertInt(editId)
			_.assertNot(recomputing)
			s.log('recomputing: ' + plugin.callSyntax)
			recomputing = true
			recompute(editId)
			recomputing = false
		}
	}

	_.assert(paramSets.length > 0)
	
	var params = []
	for(var i=0;i<paramSets.length;++i){
		var ps = paramSets[i](bindings, editId)
		_.assertDefined(ps)
		params.push(ps)
	}

	for(var i=0;i<params.length;++i){
		params[i].attach(listener, editId)
	}
	
	function oldest(){
		//console.log(new Error().stack)
		var o = s.objectState.getCurrentEditId()
		for(var i=0;i<params.length;++i){
			var p = params[i]
			var old = p.oldest()
			if(old < o) o = old
		}
		return o
	}
	var result;
	var nr = Math.random()
	function recompute(editId){
		var valueArray = []
		for(var i=0;i<params.length;++i){
			valueArray[i] = params[i].get()
			//_.assertDefined(valueArray[i])
			if(valueArray[i] === undefined && !plugin.nullsOk){
				s.log('WARNING: null input found for plugin that will not take nulls: ' + plugin.callSyntax)
				return
			}
		}
		//console.log('recomputing with: ' + JSON.stringify(valueArray))
		var rr = plugin.implementation(valueArray)
		//console.log(nr + ' ' + plugin.callSyntax + ' recomputed ' + JSON.stringify(result) + ' -> ' + JSON.stringify(rr))
		result = rr
		outputHandler.update(result, editId)
	}	
	
	return outputHandler
}

