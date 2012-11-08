"use strict";

var _ = require('underscorem')

function type(paramTypes, params){

	_.assertDefined(params[0])
	//console.log(JSON.stringify(params[0]))
	_.assertString(params[0].value)
	return params[0].value
}
exports.type = type
exports.minParams = 2
exports.maxParams = 2
exports.syntax = 'cast(typename,object)'
exports.compute = function(paramValues){
	return paramValues[1]
}

exports.descender = function(paramTypes){
	return function(paramValues){
		return {prefix: [], index: 1}
	}
}

