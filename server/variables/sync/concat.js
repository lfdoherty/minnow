"use strict";

var _ = require('underscorem')

exports.type = function(paramTypes){
	if(paramTypes[0].type === 'primitive'){
		
		if(paramTypes[0].primitive !== 'string') _.errout('invalid call to concat?: ' + JSON.stringify(paramTypes))
		
		return 'string';
	}else{

		if(paramTypes[0].type !== 'list') _.errout('invalid call to concat?: ' + JSON.stringify(paramTypes))

		var toMerge = []
		paramTypes.forEach(function(pt){
			toMerge.push(pt.members)
		})
		
		var type = this.mergeTypes(toMerge)
		
		//if(paramTypes[0].members.type !== 'primitive') _.errout('TODO: ' + JSON.stringify(paramTypes))
		return 'list:'+(type.primitive||type.object)//paramTypes[0].members.primitive
	}
}
exports.minParams = 2
exports.maxParams = -1
exports.syntax = 'concat(string,string,...)'

var log = require('quicklog').make('minnow/concat')

exports.compute = function(paramValues){

	//console.log('paramValues: ' + JSON.stringify(paramValues))
	
	if(_.isArray(paramValues[0])){
		var v = []
		for(var i=0;i<paramValues.length;++i){
			v = v.concat(paramValues[i])
		}
		//console.log('v: ' + JSON.stringify(v))
		//return v
		var str = ''
		for(var i=0;i<v.length;++i){
			str += v[i]
		}
		return str
	}else{
	
		var str = ''
		for(var i=0;i<paramValues.length;++i){
			str += paramValues[i]
		}
		return str
	}
}

exports.computeSync = function(z){
	var args = Array.prototype.slice.call(arguments, 1)
	return exports.compute(args)
	
}

