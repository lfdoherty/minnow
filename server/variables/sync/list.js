"use strict";

var _ = require('underscorem')

exports.type = function(paramTypes){
	if(paramTypes.length === 0){
		return 'list:empty'
	}
	
	if(paramTypes[0].primitive){
		return 'list:'+paramTypes[0].primitive;//TODO merge primitive types (int+real->real, etc.)
	}else if(paramTypes[0].type === 'object'){
		return 'list:'+paramTypes[0].object;//TODO merge primitive types (int+real->real, etc.)
	}else{
		_.errout('TODO: ' + JSON.stringify(paramTypes))
	}
}
exports.minParams = 0
exports.maxParams = -1
exports.syntax = 'list(value,value,...)'

exports.compute = function(paramValues){

	var arr = []//.concat(paramValues)
	paramValues.forEach(function(v){
		if(v !== undefined) arr.push(v)
	})
	return arr
}

exports.computeSync = function(z){
	var args = Array.prototype.slice.call(arguments, 1)
	return exports.compute(args)
}
