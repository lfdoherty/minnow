
var _ = require('underscorem')

exports.type = function(paramTypes){
	_.assertDefined(paramTypes)
	var keyStr
	var valueStr
	if(paramTypes[0].key.type === 'primitive'){
		keyStr = paramTypes[0].key.primitive;
	}else if(paramTypes[0].key.type === 'object'){
		keyStr = paramTypes[0].key.object;
	}else{
		_.errout('TODO?')
	}
	
	if(paramTypes[0].value.type === 'primitive'){
		valueStr = paramTypes[0].value.primitive;
	}else if(paramTypes[0].value.type === 'object'){
		valueStr = paramTypes[0].value.object;
	}else{
		_.errout('TODO?')
	}
	//console.log(keyStr+':'+valueStr)
	return keyStr + ':' + valueStr
}
exports.minParams = 2
exports.maxParams = -1
exports.syntax = 'mapMerge(map,map,...)'

var log = require('quicklog').make('map-merge')

exports.compute = function(paramValues){

	var results = {}
	for(var i=paramValues.length-1;i>=0;--i){//we go backwards so that the first map overrides later maps
		var a = paramValues[i]
		var keys = Object.keys(a)
		for(var j=0;j<keys.length;++j){
			var k = keys[j]
			results[k] = a[k]
		}
	}

	log('mapMerge ' + JSON.stringify(results))
	return results
}

exports.computeSync = function(z){
	var args = Array.prototype.slice.call(arguments, 1)
	return exports.compute(args)
}
