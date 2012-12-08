
var _ = require('underscorem')

var u = require('./../util')

exports.type = function(paramTypes){
	//console.log(JSON.stringify(paramTypes))
	var v = paramTypes[0].value
	return v.type === 'primitive' ? v.primitive : v.object
}
exports.minParams = 2
exports.maxParams = 2
exports.syntax = 'mapValue(map,key)'

exports.descender = function(paramTypes){
	var keyOp = u.selectKeyOp(paramTypes[0])
	return function(paramValues){
		//console.log('paramTypes: ' + JSON.stringify(paramTypes))
		//console.log('paramValues: ' + JSON.stringify(paramValues))
		//console.log('descenders: ' + JSON.stringify(descenders))
		if(paramTypes[0].value.type === 'object'){
			return {prefix: [], index: 0}
		}else{
			return {prefix: [{op: keyOp, key: paramValues[1]}], index: 0}
		}
	}
}

var log = require('quicklog').make('mapValue')

exports.compute = function(paramValues){
	var a = paramValues[0]
	var b = paramValues[1]
	
	//log('mapValue('+JSON.stringify(a)+','+b+') -> ' + a[b])
	return a[b]
}
