
var _ = require('underscorem')

exports.type = function(paramTypes){
	return 'boolean'
}
exports.minParams = 2
exports.maxParams = 2
exports.syntax = 'greaterThan(number,number)'

var log = require('quicklog').make('greaterThan')

exports.computeSync = function(z, a, b){
	if(a === undefined || b === undefined){//!_.isNumber(a) || !_.isNumber(b)){
		return false
	}else{
		return a > b
	}
}
