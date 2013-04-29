
var _ = require('underscorem')

exports.type = function(paramTypes){
	return 'boolean'
}
exports.minParams = 2
exports.maxParams = 2
exports.syntax = 'greaterThanOrEqual(number,number)'

var log = require('quicklog').make('greaterThanOrEqual')

exports.computeSync = function(z, a, b){
	//_.assertNumber(a)
	//_.assertNumber(b)
	if(!_.isNumber(a) || !_.isNumber(b)) return false
	return a >= b
}
