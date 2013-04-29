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

exports.computeSync = function(z, str){
	if(str === undefined) return -1
	return str.length
}
