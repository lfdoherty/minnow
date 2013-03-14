
var _ = require('underscorem')

var util = require('./../util')

exports.type = function(paramTypes, params, schema){
	_.assertDefined(paramTypes)
	//console.log(JSON.stringify(paramTypes))
	paramTypes.forEach(function(pt){
		if(!pt.members) _.errout('invalid input to union(set,set,...) operator: ' + JSON.stringify(paramTypes))
	})
	
	if(paramTypes[0].members.type === 'primitive'){
		return 'set:'+paramTypes[0].members.primitive;
	}else if(paramTypes[0].members.type === 'object'){
		//_.errout('TODO find common parent type of objects')
		var names = []
		paramTypes.forEach(function(v){
			names.push(v.members.object)
		})
		try{
			return 'set:'+util.computeSharedObjectType(schema, names)//paramTypes[0].members.object;
		}catch(e){
			console.log(JSON.stringify(paramTypes))
			throw e
		}
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
		if(b === undefined) return
		b.forEach(function(bv){
			if(!ma[bv]){
				results.push(bv)
				ma[bv] = true
			}
		})
	})
	//log('union ', paramValues, results)
	return results
}

exports.computeAsync = function(z, cb){
	var args = Array.prototype.slice.call(arguments, 2)
	cb(exports.compute(args))
}


exports.computeSync = function(z){
	var args = Array.prototype.slice.call(arguments, 1)
	return exports.compute(args)
}

