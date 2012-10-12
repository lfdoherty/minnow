
var _ = require('underscorem')

exports.type = function(paramTypes){
	_.assertDefined(paramTypes)
	//console.log(JSON.stringify(paramTypes))
	_.assertDefined(paramTypes[0].members)
	_.assertDefined(paramTypes[1].members)
	if(paramTypes[0].members.type === 'object'){
		return 'set:'+paramTypes[0].members.object;
	}else{
		_.assertString(paramTypes[0].members.primitive)
		return 'set:'+paramTypes[0].members.primitive;
	}
}
exports.minParams = 2
exports.maxParams = 2
exports.syntax = 'relativeComplement(set,set)'

var log = require('quicklog').make('intersection')

exports.compute = function(paramValues){
	//++intersections
	
	var a = paramValues[0]
	var b = paramValues[1]
	
	var mb = {}
	b.forEach(function(bv){
		mb[bv] = true
	})
	var results = []
	a.forEach(function(av){
		if(!mb[av]) results.push(av)
	})
	log('relativeComplement ', a, '\n             ', b, '\n -> ', results)
	return results
}
