"use strict";

var _ = require('underscorem')

var Cache = require('./../variable_cache')

exports.make = function(s, self, rel, typeBindings){
	var mGetter = self(rel.expr, typeBindings)
	//console.log('used: ' + JSON.stringify(rel.bindingsUsed))
	//console.log(JSON.stringify(rel))
	//process.exit(0)
	_.assertObject(rel.bindingsUsed)
	function computeKey(bindings){
		var fullKey = '';
		_.each(bindings, function(v, key){
			if(rel.bindingsUsed[key]){
				fullKey += v.key+';'
			}
		})
		console.log('macro key: ' + fullKey + ' ' + JSON.stringify(rel.bindingsUsed))
		console.log('bindings: ' + JSON.stringify(bindings))
		return fullKey
	}
	var f = svgMacroCall.bind(undefined, s, computeKey, mGetter)
	//_.assertFunction(mGetter.wrapAsSet)
	f.wrapAsSet = mGetter.wrapAsSet
	f.wrappers = mGetter.wrappers
	return f;
}

function svgMacroCall(s, computeKey, mGetter, bindings, editId){

	var f = function(newBindings, editId){//note that the only new bindings possible are those injected via '&' and '$'

		var allBindings = _.extend({}, bindings, newBindings)
		var internal = mGetter(allBindings, editId)
		//console.log('from original bindings: ' + JSON.stringify(bindings))
		//console.log('extending macro with more bindings: ' + JSON.stringify(newBindings))
		_.assertDefined(internal)
		return internal;
	}
	
	//TODO use only the keys of bindings that are referred to within the macro
	f.key = computeKey(bindings)
	/*''
	_.each(bindings, function(v, key){
		f.key += v.key+';'
	})*/
	return f
}
