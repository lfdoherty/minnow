
var _ = require('underscorem')

exports.type = function(paramTypes){
	return 'boolean'
}
exports.minParams = 2
exports.maxParams = 2
exports.syntax = 'eq(*,*)'
exports.nullsOk = true

var log = require('quicklog').make('eq')

exports.computeSync = function(z, a, b){
	//console.log('eq: ' + a + ','+b+': ' + (a===b))
	return a === b
}
