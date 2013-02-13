
var _ = require('underscorem')

exports.type = function(paramTypes){
	if(paramTypes[0].type !== 'map'){
		_.errout('keys first parameter must a map, not: ' + JSON.stringify(paramTypes[0]))
	}
	var vt = paramTypes[0].value
	if(vt.type !== 'primitive' || (vt.primitive !== 'int' && vt.primitive !== 'real' && vt.primitive !== 'long')){
		_.errout('values of map must be of a comparable type, not: ' + JSON.stringify(paramTypes))
	}
	return 'list:'+(paramTypes[0].key.primitive||paramTypes[0].key.object)
}
exports.minParams = 1
exports.maxParams = 1
exports.syntax = 'keysByValues(map)'

var log = require('quicklog').make('keysByValues')

exports.compute = function(paramValues){
	
	var m = paramValues[0]
	var keys = Object.keys(m)
	var kvs = []
	keys.forEach(function(key){
		kvs.push([parseInt(key), m[key]])
	})
	
	kvs.sort(function(a,b){return a[1]-b[1];})
	
	var resultKeys = []
	kvs.forEach(function(kv){
		resultKeys.push(kv[0])
	})
	
	//console.log('keysByValues('+JSON.stringify(m)+') -> ' + JSON.stringify(resultKeys))
	
	return resultKeys
}
