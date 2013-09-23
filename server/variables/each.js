"use strict";

var schema = require('./../../shared/schema')
//var viewInclude = require('./../viewinclude')

var _ = require('underscorem')

function stub(){}

function eachType(rel, ch){

	var inputType = rel.params[0].schemaType

	var singleInputType = inputType.members

	if(singleInputType === undefined) _.errout('invalid input type for each: ' + JSON.stringify(inputType))
	
	_.assertDefined(singleInputType)
	var newBindings = {}
	var implicits = rel.params[1].implicits
	_.assertArray(implicits)

	newBindings[implicits[0]] = singleInputType

	var realValueType = ch.computeMacroType(rel.params[1], ch.bindingTypes, newBindings, implicits)
	var valueType = realValueType
	
	while(valueType.type === 'set' || valueType.type === 'list'){
		valueType = valueType.members;
	}
	if(valueType.type === 'map'){
		_.errout('internal error: values of result of each is a map')
	}
	if(inputType.type === 'set'){
		return {type: 'set', members: valueType}
	}else if(inputType.type === 'list'){
		if(realValueType.type === 'primitive' || realValueType.type === 'object'){
			return {type: 'list', members: valueType}
		}else{
			return {type: 'set', members: valueType}//if merging is part of the each result, it must lose its ordering
		}
	}else{
		_.errout('TODO?: ' + JSON.stringify(rel))
	}
}
exports.eachType = eachType

schema.addFunction('each', {
	schemaType: eachType,
	minParams: 2,
	maxParams: 2,
	callSyntax: 'each(collection,macro)',
	computeSync: function(z, input, macro){
		
		var results = []

		for(var i=0;i<input.length;++i){
			var v = input[i]
			//console.log('value: ' + v)
			//_.assertString(v)
			//_.assertDefined(v)
			//_.assert(v != NaN)
			//_.assert(v+'' !== 'NaN')
			var vs = macro.get(v)
			if(vs !== undefined){
				results.push(vs)
			}
		}
		var res = macro.mergeResults(results)
		//console.log('each ' + JSON.stringify(input) + '-> ' + JSON.stringify(res))
		return res
	}
})

