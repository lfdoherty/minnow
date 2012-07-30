"use strict";

var _ = require('underscorem')

var Cache = require('./../variable_cache')
var listenerSet = require('./../variable_listeners')

var schema = require('./../../shared/schema')
var _ = require('underscorem')

function maker(s, self, rel, typeBindings){
	/*var primGetter = self(rel.params[0], typeBindings)
	var cases = []
	for(var i=1;i<rel.params.length;++i){
		var param = rel.params[i]
		_.assertEqual(param.params[0].type, 'primitive')
		var caseValue = param.params[0].primitive;
		var caseGetter = self(param.params[1], typeBindings)
		cases.push({value: caseValue, getter: caseGetter})
	}
	var cache = new Cache()
	var f = svgSpecialization.bind(undefined, s, cache, primGetter, cases)
	//f.getDescender = elementsGetter.getDescender
	return f*/
	
	var cases = []
	for(var i=1;i<rel.cases.length;++i){
		var c = rel.cases[i]
		//var caseValue = param.params[0].primitive;
		//var caseGetter = self(param.params[1], typeBindings)
		cases.push(self(c, typeBindings))//{value: caseValue, getter: caseGetter})
	}
	
	var cache = new Cache()
	var f = svgSpecialization.bind(undefined, s, cache, rel.cases, cases)
	return f
}

function svgSpecialization(s, cache, primGetter, cases, caseGetters, bindings, editId){

	_.errout('TODO?')
	
	var key = elements.key
	if(cache.has(key)) return cache.get(key)

	for(var i=0;i<cases.length;++i){
		var c = cases[i]
		
	}
	/*
	var primVariable = primGetter(bindings, editId)
	
	var listeners = listenerSet()
	

	var value;	
	var all = []
	
	var handle = {
		name: 'switch',
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
		key: key,
		descend: elements.descend
	}
	
*/
	return cache.store(key, handle)
}

