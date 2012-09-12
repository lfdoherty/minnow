
var _ = require('underscorem')

exports.type = function(paramTypes){
	return 'boolean'
}
exports.minParams = 2
exports.maxParams = 2
exports.syntax = 'in(set,value)'

var log = require('quicklog').make('in')

exports.compute = function(paramValues){
	var a = paramValues[0]
	var b = paramValues[1]
	
	var found = false
	//var ma = {}
	a.forEach(function(av){
		//ma[av] = true
		found = found || (av === b)
	})
	//var result = ma[b] !== undefined
	
	log('in ' + JSON.stringify(a) + ' ' + JSON.stringify(b) + ' -> ' + found)
	return found
}
