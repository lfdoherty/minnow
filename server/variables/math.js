"use strict";

var _ = require('underscorem')

var Cache = require('./../variable_cache')
var schema = require('./../../shared/schema')
var listenerSet = require('./../variable_listeners')

function realType(){return {type: 'primitive', primitive: 'real'};}

function lnFunction(value){return Math.log(value)}

schema.addFunction('ln', {
	schemaType: realType,
	implementation: unaryMaker.bind(undefined, lnFunction),
	minParams: 1,
	maxParams: 1,
	callSyntax: 'ln(value)'
})


function unaryMaker(f, s, self, rel, typeBindings){

	if(rel.params.length !== 1) throw new Error('wrong number of params for ' + rel.view + ': ' + rel.params.length)
	
	var getter = self(rel.params[0], typeBindings)
	
	var cache = new Cache()	
	return svgUnary.bind(undefined, s, cache, f, getter)
}

function svgUnary(s, cache, func, getter, bindings, editId){

	var a = getter(bindings, editId)

	var key = a.key
	if(cache.has(key)) return cache.get(key)
	
	var listeners = listenerSet()

	var av
	var result
	
	function update(editId){
		var oldResult = result
		result = func(av)
		if(result !== oldResult) listeners.emitSet(result, oldResult, editId)
	}
	
	a.attach({
		set: function(value, oldValue, editId){
			av = value
			update(editId)
		}
	}, editId)
	
	var handle = {
		attach: function(listener, editId){
			listeners.add(listener)
			if(result !== undefined){
				listener.set(result, undefined, editId)
			}
		},
		detach: function(listener, editId){
			listeners.remove(listener)
			if(editId !== undefined){
				if(result !== undefined){
					listener.set(undefined, result, editId)
				}
			}
		},
		oldest: a.oldest,
		key: key
	}
	
	return cache.store(key, handle)
}

