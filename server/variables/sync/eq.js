
var _ = require('underscorem')

exports.type = function(paramTypes){
	return 'boolean'
}
exports.minParams = 2
exports.maxParams = 2
exports.syntax = 'eq(*,*)'
exports.nullsOk = true

var log = require('quicklog').make('eq')

exports.compute = function(paramValues){

	/*if(paramValues[0] !== paramValues[1]){
		console.log(new Error().stack)
	}*/
	log('eq: ' + JSON.stringify(paramValues) + ' ' + (paramValues[0] === paramValues[1]))
	return paramValues[0] === paramValues[1]
}
