"use strict";

var _ = require('underscorem')

//var Cache = require('./../variable_cache')
var listenerSet = require('./../variable_listeners')

var schema = require('./../../shared/schema')
var _ = require('underscorem')

function orderByType(rel){
	return {type: 'list', members: rel.params[0].schemaType.members};
}
schema.addFunction('orderBy', {
	schemaType: orderByType,
	implementation: orderByMaker,
	minParams: 2,
	maxParams: 2,
	callSyntax: 'orderBy(collection,ordinal-macro)'
})


function orderByMaker(s, self, rel, typeBindings){
	var elementsGetter = self(rel.params[0], typeBindings)
	var ordinalGetter = self(rel.params[1], typeBindings)
	var cache = s.makeCache()//new Cache(s.analytics)
	_.errout('TODO finish implementing')
	return svgOrderBy.bind(undefined, s, cache, elementsGetter, ordinalGetter)
}

function svgOrderBy(s, cache, elementsGetter, ordinalGetter, bindings, editId){
	
	var elements = elementsGetter(bindings, editId)
	var concreteOrdinalGetter = ordinalGetter(bindings, editId)
	
	var key = elements.key+'+'+concreteOrdinalGetter.key
	if(cache.has(key)) return cache.get(key)
	
	var listeners = listenerSet()
	

	var value;	
	var all = []
	
	var handle = {
		name: 'order-by',
		attach: function(listener, editId){
			listeners.add(listener)
			_.assertInt(editId)
			if(value !== undefined){
				listener.set(value, undefined, editId)
			}
		},
		detach: function(listener, editId){
			listeners.remove(listener)
			if(value !== undefined){
				listener.set(undefined, value, editId)
			}
		},
		oldest: elements.oldest,
		key: key
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
		objectChange: listeners.emitObjectChange.bind(listeners)//Unfortunately, there's no easy way to optimize this

	}, editId)
	return cache.store(key, handle)
}

