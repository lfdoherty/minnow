
var _ = require('underscorem')

exports.type = function(paramTypes){
	return 'boolean'
}
exports.minParams = 2
exports.maxParams = -1
exports.syntax = 'or(boolean,boolean,...)'

//var log = require('quicklog').make('intersection')

exports.compute = function(paramValues){
	
	for(var i=0;i<paramValues.length;++i){
		if(paramValues[i]) return true
	}
}
