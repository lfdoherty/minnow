
var _ = require('underscorem')

exports.type = function(paramTypes){
	return 'boolean'
}
exports.minParams = 2
exports.maxParams = -1
exports.syntax = 'and(boolean,boolean,...)'
exports.nullsOk = true

var log = require('quicklog').make('minnow/and')

exports.compute = function(paramValues){
	
	var failed = false
	for(var i=0;i<paramValues.length;++i){
		if(!paramValues[i]){
			failed = true
			break;
		}
	}

	//if(!failed) console.log('and ' + JSON.stringify(paramValues) + ' -> ' + (!failed))
	return !failed
}

exports.computeSync = function(z){
	var args = Array.prototype.slice.call(arguments, 1)
	//console.log(new Error().stack)
	return exports.compute(args)
}

exports.compute1 = function(v){
	return !!v
}

exports.compute2 = function(a, b){
	return a && b
}

exports.compute3 = function(a, b, c){
	return a && b && c
}
