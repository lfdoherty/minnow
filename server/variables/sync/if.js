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

exports.computeSync = function(z, a, b, c){//paramValues){
	log.info('if(' + a + '){'+b+'}else{'+c+'}')
	if(a){
		return b
	}else{
		return c
	}
}
