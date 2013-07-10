
var _ = require('underscorem')

exports.type = function(paramTypes){
	_.assertDefined(paramTypes)
	if(!paramTypes[0].members){
		_.errout('invalid intersection call given param types: ' + JSON.stringify(paramTypes))
	}
	_.assertString(paramTypes[0].members.primitive)
	return 'set:'+paramTypes[0].members.primitive;
}
exports.minParams = 2
exports.maxParams = -1
exports.syntax = 'intersection(set,set)'

var log = require('quicklog').make('intersection')

/*
var intersections = 0
setInterval(function(){
	console.log('intersections: ' + intersections)
},1000)*/

exports.compute2 = function(a,b){
	if(!a || !b) return []
	if(a.length > b.length){
		var t = b
		b = a
		a = t
	}
	
	var ma = {}
	for(var j=0;j<a.length;++j){
		ma[a[j]] = true
	}
	
	var result = []
	for(var j=0;j<b.length;++j){
		var v = b[j]
		if(ma[v]){
			result.push(v)
		}
	}
	//console.log('intersection ' + JSON.stringify([a,b,result]))
	//console.log('intersection of ' + JSON.stringify(_.map([a,b], function(p){return p.length})) + ' -> ' + result.length + ' (' + typeof(a[0]||b[0]) + ')')
	return result
}

exports.compute3 = function(a,b,c){
	return compute([a,b,c])
}

exports.computeSync = function(z){

	var params = Array.prototype.slice.call(arguments, 1)
	return compute(params)
}

function compute(params){
	//++intersections

	for(var i=0;i<params.length;++i){
		if(params[i] == undefined){
			return []
		}
	}
	
	params.sort(function(a,b){return a.length - b.length})

	var ma = {}
	var cur = params[0]
	for(var j=0;j<cur.length;++j){
		ma[cur[j]] = 1
	}
	for(var i=1;i<params.length;++i){
		var next = params[i]
		for(var j=0;j<next.length;++j){
			var v = next[j]
			if(ma[v] === i) ++ma[v]
		}
	}
	cur = params[0]
	var res = []
	var many = params.length
	for(var j=0;j<cur.length;++j){
		var v = cur[j]
		if(ma[v] === many){
			res.push(v)
		}
	}
	//console.log(JSON.stringify([params,res]))
	//console.log('intersection of ' + JSON.stringify(_.map(params, function(p){return p.length})) + ' -> ' + res.length + ' (' + typeof(params[0][0]||params[0][1]||params[0][2]) + ')')
	return res
}

