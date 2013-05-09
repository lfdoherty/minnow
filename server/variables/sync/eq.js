
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
	//if(a !== 45 && b !== 45) console.log('eq: ' + a + ','+b+': ' + (a===b) + ' ' + typeof(a) + ' ' + typeof(b))
	if(a === b) return true
	if(a && b && a.inner && b.inner) return ''+a === ''+b
	return false
}
