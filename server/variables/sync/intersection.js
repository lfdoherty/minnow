
var _ = require('underscorem')

exports.type = function(paramTypes){
	_.assertDefined(paramTypes)
	_.assertString(paramTypes[0].members.primitive)
	return 'set:'+paramTypes[0].members.primitive;
}
exports.minParams = 2
exports.maxParams = 2
exports.syntax = 'intersection(set,set)'

var log = require('quicklog').make('intersection')

/*
var intersections = 0
setInterval(function(){
	console.log('intersections: ' + intersections)
},1000)*/

exports.compute = function(paramValues){
	//++intersections
	
	var a = paramValues[0]
	var b = paramValues[1]
	
	var ma = {}
	a.forEach(function(av){
		ma[av] = true
	})
	var results = []
	b.forEach(function(bv){
		if(ma[bv]) results.push(bv)
	})
	log('intersection ', a, '\n             ', b, '\n -> ', results)
	return results
}
