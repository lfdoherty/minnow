
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

	log('and ' + JSON.stringify(paramValues) + ' -> ' + (!failed))
	return !failed
}
