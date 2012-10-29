"use strict";

var _ = require('underscorem')

exports.type = function(paramTypes){
	if(paramTypes[1].type === 'primitive'){
		return paramTypes[1].primitive
	}else{
		_.errout('TODO')
	}
}
exports.minParams = 3
exports.maxParams = 3
exports.syntax = 'if(boolean,true-value,false-value)'
exports.nullsOk = true

var log = require('quicklog').make('if')
_.assertFunction(log.info)

exports.compute = function(paramValues){
	log.info('if(' + paramValues[0] + '){'+paramValues[1]+'}else{'+paramValues[2]+'}')
	if(paramValues[0]){
		return paramValues[1]
	}else{
		return paramValues[2]
	}
}
