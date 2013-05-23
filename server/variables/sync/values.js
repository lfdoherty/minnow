
var _ = require('underscorem')

var u = require('./../util')

exports.type = function(paramTypes){
	//console.log(JSON.stringify(paramTypes))
	var v = paramTypes[0].value
	return 'set:'+(v.type === 'primitive' ? v.primitive : v.object)
}
exports.minParams = 1
exports.maxParams = 1
exports.syntax = 'values(map)'

//var log = require('quicklog').make('values')

exports.computeSync = function(z, map){
	
	var res = []
	var keys = Object.keys(map)
	var has = {}
	for(var i=0;i<keys.length;++i){
		var v = map[keys[i]]
		if(has[v]) continue
		res.push(v)
	}
	//console.log('values('+JSON.stringify(map)+') -> ' + JSON.stringify(res))
	return res
}
