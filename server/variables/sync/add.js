
var _ = require('underscorem')

exports.type = function(paramTypes){
	_.assertDefined(paramTypes)
	_.assert(paramTypes[0].primitive)//TODO use real if some are real, etc.
	return paramTypes[0].primitive//'set:'+paramTypes[0].members.primitive;
}
exports.minParams = 2
exports.maxParams = -1
exports.syntax = 'add(number,number,...)'

//var log = require('quicklog').make('intersection')

exports.compute = function(paramValues){
	
	var v = 0
	for(var i=0;i<paramValues.length;++i){
		v += paramValues[i]
	}
	return v
}
