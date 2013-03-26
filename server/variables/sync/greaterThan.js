
var _ = require('underscorem')

exports.type = function(paramTypes){
	return 'boolean'
}
exports.minParams = 2
exports.maxParams = 2
exports.syntax = 'greaterThan(number,number)'

var log = require('quicklog').make('greaterThan')

exports.compute = function(paramValues){
	_.assertNumber(paramValues[0])
	_.assertNumber(paramValues[1])
	
	//log(paramValues[0] + ' > ' + paramValues[1])
	return paramValues[0] > paramValues[1]
}

exports.computeAsync = function(z, cb, a, b){
	//console.log('greaterThan ' + a + ' ' + b)
	if(!_.isNumber(a) || !_.isNumber(b)){
		//_.errout('needs numbers')
		cb(false)
	}else{
		cb(a > b)
	}
}


exports.computeSync = function(z, a, b){
	if(a === undefined || b === undefined){//!_.isNumber(a) || !_.isNumber(b)){
		return false
	}else{
		return a > b
	}
}
