
var _ = require('underscorem')

var util = require('./../util')

exports.type = function(paramTypes, params, schema){
	_.assertDefined(paramTypes)
	//console.log(JSON.stringify(paramTypes))
	/*paramTypes.forEach(function(pt){
		if(!pt.members) _.errout('invalid input to sum(set) operator: ' + JSON.stringify(paramTypes))
	})*/
	
	/*if(paramTypes[0].members.type === 'primitive'){
		return paramTypes[0].members.primitive;
	}else{
		_.errout('TODO?')
	}*/
	return 'set:int'
}
exports.minParams = 2
exports.maxParams = 2
exports.syntax = 'range(int, int)'

var log = require('quicklog').make('minnow/range')

exports.compute = function(paramValues){
	//++unions
	var a = paramValues[0]
	var b = paramValues[1]
	
	var arr = []
	for(var i=a;i<b;++i){
		arr.push(i)
	}
	
	log(a + ' ' + b + ' ' + JSON.stringify(arr))
	
	return arr
}

exports.computeSync = function(z, a, b){
	var arr = []
	for(var i=a;i<b;++i){
		arr.push(i)
	}
	
	return arr
}
