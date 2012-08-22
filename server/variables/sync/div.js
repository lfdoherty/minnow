
var _ = require('underscorem')

exports.type = function(paramTypes){
	return 'real'
}
exports.minParams = 2
exports.maxParams = 2
exports.syntax = 'div(number,number)'

exports.compute = function(paramValues){
	return paramValues[0] / paramValues[1]
}
