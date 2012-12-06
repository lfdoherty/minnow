
var _ = require('underscorem')

exports.type = function(paramTypes){
	return 'boolean'
}
exports.minParams = 1
exports.maxParams = 1
exports.syntax = 'not(boolean)'
exports.nullsOk = true

var log = require('quicklog').make('minnow/not')

exports.compute = function(paramValues){
	
	log('not(' + paramValues[0]+')')
	
	return !paramValues[0]
}
