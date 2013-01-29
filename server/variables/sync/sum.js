
var _ = require('underscorem')

var util = require('./../util')

exports.type = function(paramTypes, params, schema){
	_.assertDefined(paramTypes)
	//console.log(JSON.stringify(paramTypes))
	paramTypes.forEach(function(pt){
		if(!pt.members) _.errout('invalid input to sum(set) operator: ' + JSON.stringify(paramTypes))
	})
	
	if(paramTypes[0].members.type === 'primitive'){
		var prim = paramTypes[0].members.primitive
		if(prim !== 'real' && prim !== 'int' && prim !== 'int') _.errout('invalid input to sum(set) operator - values must be numbers: ' + JSON.stringify(paramTypes))
		return paramTypes[0].members.primitive;
	}else{
		_.errout('TODO?')
	}
}
exports.minParams = 1
exports.maxParams = 1
exports.syntax = 'sum(set)'

var log = require('quicklog').make('minnow/sum')

exports.compute = function(paramValues){
	//++unions
	var a = paramValues[0]
	
	var sum = 0
	a.forEach(function(v){
		sum += v
	})
	log('sum ' + JSON.stringify(a) + ' ' + sum)
	return sum
}
