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
	
	var implicits2 = rel.params[2].implicits
	var moreBinding = {}
	moreBinding[implicits2[0]] = valueType
	moreBinding[implicits2[1]] = valueType
	var resultType = ch.computeMacroType(rel.params[2], ch.bindingTypes, moreBinding)
	
	return resultType
}
schema.addFunction('eachReduce', {
	schemaType: eachType,
	minParams: 3,
	maxParams: 3,
	callSyntax: 'eachReduce(collection,macro,macro)',
	computeAsync: function(z, cb, input, macro, reduceMacro){
		_.assertFunction(cb)
		//_.errout('TODO')
		
		var results = []
		var cdl = _.latch(input.length, function(){
			
			//console.log('each done')
			//cb(macro.mergeResults(results))
			function reduceMore(){
				if(results.length === 0){
					cb(undefined)
					return
				}else if(results.length === 1){
					cb(results[0])
					return
				}
				var first = results.shift()
				var second = results[0]
				reduceMacro.get(first,second, function(res){
					results[0] = res
					reduceMore()
				})
			}
			reduceMore()
		})
		input.forEach(function(v){
			macro.get(v, function(vs){
				if(vs !== undefined){
					results.push(vs)
				}
				cdl()
			})
		})
	},
	computeSync: function(z, input, macro, reduceMacro){
		
		var results = []
		input.forEach(function(v){
			var vs = macro.get(v)
			if(vs !== undefined){
				results.push(vs)
			}
		})

		while(results.length > 1){
			var first = results.shift()
			var second = results[0]
			results[0] = reduceMacro.get(first,second)
		}
		return results.length > 0 ? results[0] : undefined
	}
})

