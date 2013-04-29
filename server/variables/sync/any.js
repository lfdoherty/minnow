
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

exports.computeSync = function(z, input){
	var res = false	
	_.assertArray(input)
	input.forEach(function(av){
		res = res || av
	})
	return res
}
