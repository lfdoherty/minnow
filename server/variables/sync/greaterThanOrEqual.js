
var _ = require('underscorem')

exports.type = function(paramTypes){
	return 'boolean'
}
exports.minParams = 2
exports.maxParams = 2
exports.syntax = 'greaterThanOrEqual(number,number)'

var log = require('quicklog').make('greaterThanOrEqual')

exports.compute = function(paramValues){
	_.assertNumber(paramValues[0])
	_.assertNumber(paramValues[1])
	
	//log(paramValues[0] + ' > ' + paramValues[1])
	return paramValues[0] >= paramValues[1]
}


exports.computeSync = function(z, a, b){
	_.assertNumber(a)
	_.assertNumber(b)
	
	return a >= b
}
