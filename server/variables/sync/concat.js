"use strict";

var _ = require('underscorem')

exports.type = function(paramTypes){
	return 'string';
}
exports.minParams = 2
exports.maxParams = -1
exports.syntax = 'concat(string,string,...)'

exports.compute = function(paramValues){
	
	var str = ''
	for(var i=0;i<paramValues.length;++i){
		str += paramValues[i]
	}
	return str
}
