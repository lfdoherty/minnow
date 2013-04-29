
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

var log = require('quicklog').make('mapValue')

exports.computeSync = function(z, map, key){
	//_.errout('TODO?')//currently, cannot correctly handle boolean keys?
	if(map === undefined){
		//console.log('map undefined')
		return undefined
	}else{
		//if(!map[key] && (key === true || key === false || !key)){
		//	console.log('map ' + key + ' -> ' + map[key])
		//	console.log('full map: ' + JSON.stringify(map))
		//}
		return map[key]
	}
}
