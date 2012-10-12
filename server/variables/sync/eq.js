
var _ = require('underscorem')

exports.type = function(paramTypes){
	return 'boolean'
}
exports.minParams = 2
exports.maxParams = 2
exports.syntax = 'eq(*,*)'
exports.nullsOk = true

//var log = require('quicklog').make('intersection')

exports.compute = function(paramValues){

	/*if(paramValues[0] !== paramValues[1]){
		console.log('eq: ' + JSON.stringify(paramValues))
		console.log(new Error().stack)
	}*/
	return paramValues[0] === paramValues[1]
}
