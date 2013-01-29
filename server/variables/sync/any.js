
var _ = require('underscorem')

var util = require('./../util')

exports.type = function(paramTypes, params, schema){
	_.assertDefined(paramTypes)
	//console.log(JSON.stringify(paramTypes))
	return 'boolean'
}
exports.minParams = 1
exports.maxParams = 1
exports.syntax = 'any(set)'

var log = require('quicklog').make('any')

exports.compute = function(paramValues){

	var a = paramValues[0]

	var res = false	
	a.forEach(function(av){
		res = res || av
	})
	return res
}
