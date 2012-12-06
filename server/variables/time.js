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

function stub(){}

function copyBindings(bindings){
	var newBindings = Object.create(null)
	Object.keys(bindings).forEach(function(key){
		newBindings[key] = bindings[key]
	})
	return newBindings
}

var variables = require('./../variables')
var cache = new Cache(variables.makeAnalytics({}, {children:[]}, 'time-global'))

function walkAndRemove(n, cb){
	var keys = Object.keys(n)
	keys.forEach(function(p){
		if(cb(n,p) === true){
			delete n[p]
		}else{
			if(_.isObject(n[p])){
				walkAndRemove(n[p], cb)
			}
		}
	})
}

function nowMaker(s, self, rel, typeBindings){

	var delayGetter = self(rel.params[0], typeBindings)
	
	//console.log('now maker')
	//console.log(new Error().stack)
	var dkp = JSON.parse(JSON.stringify(rel.params[0]))
	walkAndRemove(dkp, function(n,p){
		return p === 'implicits' || p === 'schemaType'
	})
	var delayKey = JSON.stringify(dkp)
	
	return svgNow.bind(undefined, s, cache, delayGetter, delayKey, rel.params[0].implicits)
}

function svgNow(s, cache, delayGetter, delayKey, implicits, bindings, editId){

	var concreteDelayGetter = delayGetter(bindings, editId)

	var key = concreteDelayGetter.key+delayKey
	if(cache.has(key)){
		//s.log('already got now: ' + key)
		return cache.get(key)
	}//else{
		//s.log('not already got: ' + key)
	//}
	
	var rr = Math.random()
	
	var listeners = listenerSet()

	var delayValue
	
	var oldTime = 0
	var oldEditId
	
	var oldest = s.objectState.getCurrentEditId
	
	function updateNow(givenEditId){
		var newTime = Date.now()
		//s.log('(' + key + ')(' + rr + ') emitting time: ' + newTime)
		if(givenEditId && oldEditId > givenEditId){
			_.errout('out of order edit')
		}
		oldEditId = givenEditId || s.objectState.syntheticEditId()

		//console.log(rr+' ' + key + ' emitting timed update ' + givenEditId + ' ' + oldEditId)
		//console.log(new Error().stack)
		
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
		//s.log('updating later')
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
			//s.log('got delay set: ' + value)
			delayValue = value
			var nextUpdateTime = oldTime + delayValue
			if(timeoutHandle) clearTimeout(timeoutHandle)
			var now = Date.now()
			if(nextUpdateTime <= now){
				updateNow()
			}

			//s.log('set timeout to ' + delayValue)
			timeoutHandle = setTimeout(update, delayValue)
		},
		includeView: stub,
		removeView: stub
	}
	
	recomputeDelay()

	var handle = {
		name: 'now',
		attach: function(listener, editId){
			listeners.add(listener)
			if(editId > oldEditId){//Date.now() > oldTime && editId + 1 === oldest()){
				updateNow(editId)
			}else{//updateNow will emit for all listeners, hence the else
				//listener.set(oldTime, undefined, oldEditId)
				listener.set(Date.now(), undefined, oldEditId)
			}
		},
		detach: function(listener, editId){
			listeners.remove(listener)
			if(oldTime !== undefined){
				listener.set(undefined, oldTime, oldEditId)
			}
		},
		oldest: oldest,
		neverGetsOld: true,
		key: key
	}
	
	return cache.store(key, handle)
}

