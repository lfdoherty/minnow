
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
			//console.log(JSON.stringify(paramTypes))
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

function compute(paramValues){
	//++unions
	console.log(JSON.stringify(_.map(paramValues, function(v){return v.length;})))
	
	var a = paramValues[0]
	
	while(!a){
		if(paramValues.length === 0) return []
		a = paramValues.shift()
	}
	
	if(!a) return []
	if(paramValues.length === 0) return a
	
	var results = [].concat(a)
	var ma = {}

	for(var i=0;i<a.length;++i){
		ma[a[i]] = true
	}

	for(var i=1;i<paramValues.length;++i){
		var b = paramValues[i]
		if(b === undefined) continue

		for(var j=0;j<b.length;++j){
			var bv = b[j]
			if(!ma[bv]){
				results.push(bv)
				ma[bv] = true
			}
		}
	}

	//console.log('union ', paramValues, results)
	//console.log('union of ' + JSON.stringify(_.map(paramValues, function(p){return p.length})) + ' -> ' + results.length)
	return results
}

exports.compute = compute

exports.computeSync = function(z){
	var args = Array.prototype.slice.call(arguments, 1)
	return exports.compute(args)
}

function compute2(a,b){
	if(!a || !b) return []
	
	if(a.length > b.length){//faster to check against lots than allocate a big temporary hashmap
		var t = a
		a = b
		b = t
	}
	
	/*if(b.length > 1000){
		throw new Error('big: ' + JSON.stringify(b.slice(20)))
	}*/
	
	var has = {}
	for(var i=0;i<a.length;++i){
		has[a[i]] = true
	}
	
	var res = [].concat(a)
	for(var i=0;i<b.length;++i){
		var v = b[i]
		if(has[v]){
			continue
		}
		res.push(v)
	}
	
	//console.log('union: ' + JSON.stringify([a.length,b.length,res.length]))
	
	return res
}
exports.compute2 = compute2

exports.compute3 = function(a,b,c){
	if(a.length === 0){
		return compute2(b,c)
	}else if(b.length === 0){
		return compute2(a,c)
	}else if(c.length === 0){
		return compute2(a,b)
	}
	return compute([a,b,c])
}
