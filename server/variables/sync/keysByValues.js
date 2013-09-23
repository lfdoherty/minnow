
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

function compute(m){
	var keys = Object.keys(m)
	var kvs = []
	keys.forEach(function(key){
		kvs.push([key, m[key]])
	})
	
	kvs.sort(function(a,b){return a[1]-b[1];})
	
	var resultKeys = []
	kvs.forEach(function(kv){
		resultKeys.push(kv[0])
	})
	
	//console.log('keysByValues('+/*JSON.stringify(m)*/Object.keys(m).length+') -> ' + JSON.stringify(resultKeys))
	//console.log(new Error().stack)
	
	return resultKeys
}

exports.computeSync = function(z, map){
	return compute(map)
}
