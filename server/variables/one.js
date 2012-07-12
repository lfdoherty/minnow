"use strict";

var _ = require('underscorem')

var Cache = require('./../variable_cache')
var listenerSet = require('./../variable_listeners')

var schema = require('./../../shared/schema')
var _ = require('underscorem')

function oneType(rel){
	return rel.params[0].schemaType.members;
}
schema.addFunction('one', {
	schemaType: oneType,
	implementation: oneMaker,
	minParams: 1,
	maxParams: 1,
	callSyntax: 'one(collection)'
})


function oneMaker(s, self, rel, typeBindings){
	var elementsGetter = self(rel.params[0], typeBindings)
	var cache = new Cache()
	return svgGeneralOne.bind(undefined, s, cache, elementsGetter)
}

function svgGeneralOne(s, cache, elementsExprGetter, bindings, editId){

	var elements = elementsExprGetter(bindings, editId)
	var key = elements.key
	if(cache.has(key)) return cache.get(key)
	
	var listeners = listenerSet()
	

	var value;	
	var all = []
	
	var handle = {
		attach: function(listener, editId){
			listeners.add(listener)
			_.assertInt(editId)
			if(value !== undefined){
				listener.set(value, undefined, editId)
			}
		},
		detach: function(listener, editId){
			listeners.remove(listener)
			if(editId){
				if(value !== undefined){
					listener.set(undefined, value, editId)
				}
			}
		},
		oldest: elements.oldest,
		key: key/*,
		getId: function(){
			return value
		}*/
	}
	
	elements.attach({
		add: function(v, editId){
			all.push(v)
			//console.log('one got add: ' + value)
			if(value === undefined){
				value = v
				//console.log('one emitted set')
				listeners.emitSet(value, undefined, editId)
			}
		},
		remove: function(v, editId){
			var i = all.indexOf(v)
			if(i === -1) throw new Error('internal error, removed non-existent value')
			all.splice(i, 1)
			if(i === 0){
				if(all.length > 0){
					value = all[0]
				}else{
					value = undefined
				}
				listeners.emitSet(value, v, editId)
			}
		},
		shouldHaveObject: function(id, flag, editId){
			listeners.emitShould(id, flag, editId)
		},
		objectChange: listeners.emitObjectChange//Unfortunately, there's no easy way to optimize this

	}, editId)
	return cache.store(key, handle)
}

