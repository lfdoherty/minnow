"use strict";

var _ = require('underscorem')

var Cache = require('./../variable_cache')
//var schema = require('./../../shared/schema')
var listenerSet = require('./../variable_listeners')

function stub(){}

/*
TODO: implement proper caching
*/

function wrapParam(v, schemaType){


	if(schemaType.type === 'primitive'){
		return function(bindings, editId){

			var listeners = listenerSet()

			var t = v(bindings, editId)
			var cachedValue
			t.attach({
				set: function(v, oldV, editId){
					cachedValue = v
					listeners.emitChanged()
				},
				shouldHaveObject: stub
			}, editId)
			return {
				attach: function(listener, editId){
					listeners.add(listener)
					if(cachedValue)
					listener.changed()
				},
				get: function(){return cachedValue;},
				oldest: t.oldest
			}
		}
	}else if(schemaType.type === 'set'){
		if(schemaType.members.type === 'primitive'){
			return function(bindings, editId){
				var listeners = listenerSet()

				var t = v(bindings, editId)
				var cachedValues = []
				var re = Math.random()
				console.log('attaching ' + re + ' ' + t.attach)
				//process.exit(0)
				t.attach({
					add: function(v, editId){
						//console.log(re + ' cachedValues: ' + JSON.stringify(cachedValues))
						//console.log('adding: ' + v)
						_.assert(cachedValues.indexOf(v) === -1)
						cachedValues.push(v)
						listeners.emitChanged()
					},
					remove: function(v, editId){
						cachedValues.splice(cachedValues.indexOf(v), 1)
					},
					shouldHaveObject: stub
				}, editId)
				return {
					attach: function(listener, editId){
						listeners.add(listener)
						/*for(var i=0;i<cachedValues.length;++i){
							listener.add(cachedValues[i], editId)
						}*/
						if(cachedValues.length > 0){
							listener.changed()
						}
					},
					get: function(){return cachedValues;},
					oldest: t.oldest
				}
			}
		}else{
			_.errout('TODO')
		}
	}else{
		_.errout('TODO: ' + JSON.stringify(schemaType))
	}
}

function setupOutputHandler(schemaType){


	if(schemaType.type === 'primitive'){
		_.errout('TODO')
	}else if(schemaType.type === 'set'){
		if(schemaType.members.type === 'primitive'){
			return function(oldest){

				var listeners = listenerSet()

				_.assertFunction(oldest)
				var has = {}
				var list = []
				var r = Math.random()
				var updating = false
				return {
					update: function(result){
						if(list.length === 0 && result.length === 0) return
						
						_.assertNot(updating)
						updating = true
						var newHas = {}
						for(var i=0;i<result.length;++i){
							var v = result[i]
							newHas[v] = true
							//console.log(r + ' emitting adds?: ' + JSON.stringify(result))
							if(has[v] === undefined){
								//console.log(r + ' adding: ' + v)
								//console.log('has: ' + JSON.stringify(has))
								//console.log('result: ' + JSON.stringify(result))
								listeners.emitAdd(v)
							}
						}
						for(var i=0;i<list.length;++i){
							var v = list[i]
							if(newHas[v] === undefined){
								listeners.emitRemove(v)
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
					key: Math.random()
				}
			}
		}else{
			_.errout('TODO')
		}
	}else{
		_.errout('TODO')
	}
}

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
		var wv = wrapParam(v, param.schemaType)
		paramSets.push(wv)
	})
	
	_.assert(paramSets.length >= plugin.minParams)
	_.assert(paramSets.length <= plugin.maxParams)

	var makeOutputHandle = setupOutputHandler(plugin.schemaType(callExpr))

	var f = svgSyncPlugin.bind(undefined, s, cache, paramSets, plugin, makeOutputHandle)
	
	return f
}


function svgSyncPlugin(s, cache, paramSets, plugin, makeOutputHandle, bindings, editId){

	var outputHandler = makeOutputHandle(oldest)
	
	
	var recomputing = false
	var listener = {
		changed: function(){
			_.assertNot(recomputing)
			recomputing = true
			recompute()
			recomputing = false
		}
	}
	
	var params = []
	for(var i=0;i<paramSets.length;++i){
		var ps = paramSets[i](bindings, editId)
		_.assertDefined(ps)
		params.push(ps)
	}

	for(var i=0;i<params.length;++i){
		params[i].attach(listener)
	}
	
	function oldest(){
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
	function recompute(){
		var valueArray = []
		for(var i=0;i<params.length;++i){
			valueArray[i] = params[i].get()
			_.assertDefined(valueArray[i])
		}
		//console.log('recomputing with: ' + JSON.stringify(valueArray))
		var rr = plugin.implementation(valueArray)
		//console.log(nr + ' ' + plugin.callSyntax + ' recomputed ' + JSON.stringify(result) + ' -> ' + JSON.stringify(rr))
		result = rr
		outputHandler.update(result)
	}	
	
	return outputHandler
}

