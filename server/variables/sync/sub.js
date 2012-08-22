
var _ = require('underscorem')

exports.type = function(paramTypes){
	_.assertDefined(paramTypes)
	_.assert(paramTypes[0].primitive)//TODO use real if some are real, etc.
	return paramTypes[0].primitive
}
exports.minParams = 2
exports.maxParams = 2
exports.syntax = 'sub(number,number)'

//var log = require('quicklog').make('intersection')

exports.compute = function(paramValues){
	
	return paramValues[0] - paramValues[1]
}
