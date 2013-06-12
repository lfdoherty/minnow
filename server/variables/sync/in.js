
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
	if(!_.isArray(set)){
		console.log('WARNING: in param 0 not an array: '  + JSON.stringify(set))
		return
	}
	set.forEach(function(av){
		found = found || (av === value)
	})
	//console.log('in(' + JSON.stringify(set)+','+JSON.stringify(value)+'): ' + found)
	return found
}
