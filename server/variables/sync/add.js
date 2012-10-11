
var _ = require('underscorem')

exports.type = function(paramTypes){
	_.assertDefined(paramTypes)
	_.assert(paramTypes[0].primitive)
	var type = paramTypes[0].primitive
	for(var i=1;i<paramTypes.length;++i){
		if(type === 'int' && paramTypes[i].primitive === 'long'){
			type = 'long'
		}
		if(paramTypes[i].primitive === 'real'){
			type = 'real'
		}
	}
	return type
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
