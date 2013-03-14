
var _ = require('underscorem')

exports.type = function(paramTypes){
	return 'boolean'
}
exports.minParams = 2
exports.maxParams = 2
exports.syntax = 'in(set,value)'
exports.nullsOk = true

var log = require('quicklog').make('in')

exports.compute = function(paramValues){
	var a = paramValues[0]
	var b = paramValues[1]
	
	if(b != null){
	
		var found = false
		//var ma = {}
		a.forEach(function(av){
			//ma[av] = true
			found = found || (av === b)
		})
	}
	//var result = ma[b] !== undefined
	
	log('in ' + JSON.stringify(a) + ' ' + JSON.stringify(b) + ' -> ' + found)
	return found
}

exports.computeAsync = function(z, cb, set, value){
	var found = false
	set.forEach(function(av){
		found = found || (av === value)
	})
	cb(found)
}


exports.computeSync = function(z, set, value){
	var found = false
	set.forEach(function(av){
		found = found || (av === value)
	})
	return found
}
