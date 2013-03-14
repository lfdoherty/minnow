"use strict";

var _ = require('underscorem')

exports.type = function(paramTypes){
	if(paramTypes[0].primitive !== 'string') _.errout('invalid call to length: ' + JSON.stringify(paramTypes))
	return 'int'
}
exports.minParams = 1
exports.maxParams = 1
exports.syntax = 'length(string)'

var log = require('quicklog').make('minnow/length')

exports.compute = function(paramValues){
	log(paramValues[0])
	return paramValues[0].length
}
exports.computeSync = function(z, str){
	return str.length
}
