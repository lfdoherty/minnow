
var _ = require('underscorem')

exports.type = function(paramTypes){
	return 'boolean'
}
exports.minParams = 2
exports.maxParams = 2
exports.syntax = 'in(set,value)'
exports.nullsOk = true

var log = require('quicklog').make('in')

exports.computeSync = function(z, set, value){
	var found = false
	set.forEach(function(av){
		found = found || (av === value)
	})
	return found
}
