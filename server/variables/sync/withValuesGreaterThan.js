
var _ = require('underscorem')

exports.type = function(paramTypes){
	if(paramTypes[1].type !== 'map'){
		_.errout('keys first parameter must a map, not: ' + JSON.stringify(paramTypes[0]))
	}
	var vt = paramTypes[1].value
	if(vt.type !== 'primitive' || (vt.primitive !== 'int' && vt.primitive !== 'real' && vt.primitive !== 'long')){
		_.errout('values of map must be of a comparable type, not: ' + JSON.stringify(paramTypes))
	}
	return paramTypes[1].key.primitive||paramTypes[1].key.object+':'+
			paramTypes[1].value.primitive||paramTypes[1].value.object
}
exports.minParams = 1
exports.maxParams = 1
exports.syntax = 'withValuesGreaterThan(0, map)'

//var log = require('quicklog').make('keysByValues')

function compute(value, m){
	if(!m) return {}
	
	var res = {}
	
	var keys = Object.keys(m)
	for(var i=0;i<keys.length;++i){
		var k = keys[i]
		var v = m[k]
		if(v > value){
			res[k] = v
		}
	}

	//console.log('withValuesGreaterThan('+value+','+JSON.stringify(m)+') -> ' + JSON.stringify(res))
	
	return res
	
	
	
	//console.log(new Error().stack)
	
	//return resultKeys
}

exports.computeSync = function(z, value, map){
	return compute(value, map)
}
