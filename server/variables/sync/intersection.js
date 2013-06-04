
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

exports.computeSync = function(z){
	var params = Array.prototype.slice.call(arguments, 1)
	//++intersections

	for(var i=0;i<params.length;++i){
		if(params[i] == undefined){
			return []
		}
	}
	
	//var original = [].concat(params)
	
	params.sort(function(a,b){return a.length - b.length})

	var ma = {}
	var cur = params[0]
	for(var j=0;j<cur.length;++j){
		ma[cur[j]] = 1
	}
	for(var i=1;i<params.length;++i){
		var next = params[i]
		//var res = []
		for(var j=0;j<next.length;++j){
			var v = next[j]
			if(ma[v] === i) ++ma[v]//res.push(v)
		}
		//cur = next
	}
	cur = params[0]
	var res = []
	var many = params.length
	for(var j=0;j<cur.length;++j){
		var v = cur[j]
		if(ma[v] === many){
			res.push(v)
		}
	}/*
	for(var i=1;i<params.length;++i){
		ma = {}
		for(var j=0;j<cur.length;++j){
			ma[cur[j]] = true
		}
		var next = params[i]
		var res = []
		for(var j=0;j<next.length;++j){
			var v = next[j]
			if(ma[v]) res.push(v)
		}
		cur = res
	}*/

	//console.log(JSON.stringify(params))
	//console.log('intersection of ' + JSON.stringify(_.map(original, function(p){return p.length})) + ' -> ' + res.length)
	return res
}

