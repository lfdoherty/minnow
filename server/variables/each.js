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
	macros: {1: 1},
	computeAsync: function(z, cb, input, macro){
		_.assertFunction(cb)
		
		var results = []
		var cdl = _.latch(input.length, function(){
			//console.log('each done: ' + JSON.stringify(results))
			cb(macro.mergeResults(results))
		})
		var n = 0
		var t = 0
		input.forEach(function(v){
			//console.log('getting macro value: ' + v)
			++n
			macro.get(v, function(vs){
				++t
				if(vs !== undefined){
					results.push(vs)
				}
				cdl()
			})
		})
	}
})

