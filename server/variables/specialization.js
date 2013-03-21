"use strict";

var _ = require('underscorem')

var schema = require('./../../shared/schema')
var _ = require('underscorem')

function maker(s, self, rel, typeBindings){

	
	var cases = []
	for(var i=1;i<rel.cases.length;++i){
		var c = rel.cases[i]
		cases.push(self(c, typeBindings))//{value: caseValue, getter: caseGetter})
	}
	
	var cache = s.makeCache()//new Cache()
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

	return cache.store(key, handle)
}

