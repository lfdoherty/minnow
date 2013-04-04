
var _ = require('underscorem')

exports.type = function(paramTypes){
	return 'real'
}
exports.minParams = 2
exports.maxParams = 2
exports.syntax = 'div(number,number)'

exports.computeSync = function(z, a, b){
	return a / b
}
