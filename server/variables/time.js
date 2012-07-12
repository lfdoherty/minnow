"use strict";

var Cache = require('./../variable_cache')

var schema = require('./../../shared/schema')
var listenerSet = require('./../variable_listeners')
var fixedPrimitive = require('./../fixed/primitive')

var _ = require('underscorem')

var longType = {type: 'primitive', primitive: 'long'}
function nowType(rel, ch){
	var newBindingTypes = {}
	newBindingTypes[rel.params[0].implicits[0]] = longType
	ch.computeMacroType(rel.params[0], ch.bindingTypes, newBindingTypes)
	return longType;
}

schema.addFunction('now', {
	schemaType: nowType,
	implementation: nowMaker,
	minParams: 1,
	maxParams: 1,
	callSyntax: 'now(refresh-macro)'
})


function copyBindings(bindings){
	var newBindings = Object.create(null)
	Object.keys(bindings).forEach(function(key){
		newBindings[key] = bindings[key]
	})
	return newBindings
}

function nowMaker(s, self, rel, typeBindings){

	var delayGetter = self(rel.params[0], typeBindings)
	
	var cache = new Cache()
	//console.log('now maker')
	//console.log(new Error().stack)
	return svgNow.bind(undefined, s, cache, delayGetter, rel.params[0].implicits)
}

function svgNow(s, cache, delayGetter, implicits, bindings, editId){

	var concreteDelayGetter = delayGetter(bindings, editId)

	var key = concreteDelayGetter.key
	if(cache.has(key)){
		console.log('already got now: ' + key)
		return cache.get(key)
	}else{
		console.log('not already got: ' + key)
	}
	
	var rr = Math.random()
	
	var listeners = listenerSet()

	var delayValue
	
	var oldTime = 0
	var oldEditId
	
	var oldest = s.objectState.getCurrentEditId
	
	function updateNow(){
		var newTime = Date.now()
		console.log('(' + key + ')(' + rr + ') emitting time: ' + newTime)
		oldEditId = s.objectState.syntheticEditId()
		listeners.emitSet(newTime, oldTime, oldEditId);
		oldTime = newTime
	}
	var	timeoutHandle;
	function startInterval(){
		if(intervalHandle){
			clearInterval(intervalHandle)
		}
		intervalHandle = setInterval(updateNow, delayValue)
	}
	function update(){
		console.log('updating later')
		updateNow()
		recomputeDelay()
	}
	var delayVariable
	function recomputeDelay(){
		if(delayVariable) delayVariable.detach(delayListener)
		var newBindings = copyBindings(bindings)
		newBindings[implicits[0]] = fixedPrimitive.make(s, Date.now())
		delayVariable = concreteDelayGetter(newBindings, editId)
		delayVariable.attach(delayListener, editId)
	}
	var delayListener = {
		set: function(value, oldValue, editId){
			console.log('got delay set: ' + value)
			delayValue = value
			var nextUpdateTime = oldTime + delayValue
			if(timeoutHandle) clearTimeout(timeoutHandle)
			var now = Date.now()
			if(oldTime <= now){
				updateNow()
				console.log('immediate - set timeout to ' + (nextUpdateTime - now))
				timeoutHandle = setTimeout(update, nextUpdateTime - now)
			}else{
				console.log('later - set timeout to ' + delayValue)
				timeoutHandle = setTimeout(update, delayValue)
			}
		}
	}
	
	recomputeDelay()

	var handle = {
		attach: function(listener, editId){
			listeners.add(listener)
			if(oldTime !== undefined){
				listener.set(oldTime, undefined, oldEditId)
			}
		},
		detach: function(listener, editId){
			listeners.remove(listener)
			if(oldAgo !== undefined){
				listener.set(undefined, oldTime, oldEditId)
			}
		},
		oldest: oldest,
		key: key
	}
	
	return cache.store(key, handle)
}

