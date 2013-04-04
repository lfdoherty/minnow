
var _ = require('underscorem')

exports.type = function(paramTypes){
	return 'boolean'
}
exports.minParams = 2
exports.maxParams = 2
exports.syntax = 'lessThan(number,number)'

//var log = require('quicklog').make('intersection')

exports.computeSync = function(z, a, b){
	
	return a < b
}
