
var _ = require('underscorem')

exports.type = function(paramTypes){
	return 'boolean'
}
exports.minParams = 2
exports.maxParams = 2
exports.syntax = 'greaterThan(number,number)'

//var log = require('quicklog').make('intersection')

exports.compute = function(paramValues){
	
	return paramValues[0] > paramValues[1]
}
