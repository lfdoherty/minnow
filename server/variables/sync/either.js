
var _ = require('underscorem')

exports.type = function(paramTypes){
	//_.assertDefined(paramTypes)
	_.assert(paramTypes[0].primitive)//TODO work out common base if object, number...
	return paramTypes[0].primitive
}
exports.minParams = 2
exports.maxParams = 2
exports.syntax = 'either(*,*)'
exports.nullsOk = true

//var log = require('quicklog').make('intersection')

exports.compute = function(paramValues){
	return paramValues[0] ? paramValues[0] : paramValues[1]
}
