
var _ = require('underscorem')

exports.type = function(paramTypes){
	if(paramTypes[0].type !== 'map'){
		_.errout('inKeys first parameter must a map, not: ' + JSON.stringify(paramTypes[0]))
	}
	return 'boolean'
}
exports.minParams = 2
exports.maxParams = 2
exports.syntax = 'inKeys(map,value)'

var log = require('quicklog').make('inKeys')

exports.computeSync = function(z, a, b){//paramValues){
	//var a = paramValues[0]
	//var b = paramValues[1]
	
	if(_.isArray(a)) _.errout('inKeys got non-map first parameter')
	
	var found = false
	Object.keys(a).forEach(function(key){
		found = found || (key === (''+b))
	})

	log('inKeys ' + JSON.stringify(a) + '\n             ' + JSON.stringify(b) + '\n -> ' + found)
	return found
}
