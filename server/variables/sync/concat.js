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

exports.compute = function(paramValues){

	if(_.isArray(paramValues[0])){
		var v = []
		for(var i=0;i<paramValues.length;++i){
			v = v.concat(paramValues[i])
		}
		return v
	}else{
	
		var str = ''
		for(var i=0;i<paramValues.length;++i){
			str += paramValues[i]
		}
		return str
	}
}
