
var _ = require('underscorem')

exports.type = function(paramTypes){
	return 'int'
}
exports.minParams = 1
exports.maxParams = 1
exports.syntax = 'parseInt(string)'
exports.nullsOk = true

//var log = require('quicklog').make('minnow/not')

exports.computeSync = function(z, v){
	//console.log('parseInt ' + v + ' -> ' + !v)
	return parseInt(v)
}
