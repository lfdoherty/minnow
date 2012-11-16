"use strict";

var _ = require('underscorem')

function type(paramTypes, params){
	_.assertEqual(paramTypes[0].type, 'object')
	return 'boolean'
}
exports.type = type
exports.minParams = 1
exports.maxParams = 1
exports.syntax = 'exists(object)'
exports.nullsOk = true
exports.compute = function(paramValues){
	//console.log('exists: ' + paramValues[0])
	return paramValues[0] !== undefined
}
