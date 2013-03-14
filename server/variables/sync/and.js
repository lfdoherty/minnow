
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

	//if(paramValues.length === 3) console.log('and ' + JSON.stringify(paramValues) + ' -> ' + (!failed))
	return !failed
}

exports.computeAsync = function(z, cb){
	var args = Array.prototype.slice.call(arguments, 2)
	
	cb(exports.compute(args))
}
exports.computeSync = function(z){
	var args = Array.prototype.slice.call(arguments, 1)
	return exports.compute(args)
}
