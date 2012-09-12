
var _ = require('underscorem')

exports.type = function(paramTypes){
	_.assertDefined(paramTypes)
	if(paramTypes[0].members.type === 'primitive'){
		return 'set:'+paramTypes[0].members.primitive;
	}else if(paramTypes[0].members.type === 'object'){
		return 'set:'+paramTypes[0].members.object;
	}else{
		_.errout('TODO?')
	}
}
exports.minParams = 2
exports.maxParams = -1
exports.syntax = 'union(set,set,...)'

var log = require('quicklog').make('union')

/*var unions = 0
setInterval(function(){
	console.log('unions: ' + unions)
},1000)*/

exports.compute = function(paramValues){
	//++unions
	var a = paramValues[0]
	//var b = paramValues[1]
	
	var results = [].concat(a)
	var ma = {}
	a.forEach(function(av){
		ma[av] = true
	})
	paramValues.slice(1).forEach(function(b){
		b.forEach(function(bv){
			if(!ma[bv]){
				results.push(bv)
				ma[bv] = true
			}
		})
	})
	log('union ', paramValues, results)
	return results
}
