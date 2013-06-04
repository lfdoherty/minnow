"use strict";

var schema = require('./../../shared/schema')
//var viewInclude = require('./../viewinclude')


var _ = require('underscorem')

function stub(){}

function traverseType(rel, ch){

	var macroParam = rel.params[rel.params.length-2]
	var depthParam = rel.params[rel.params.length-1]
	var inputParams = rel.params.slice(0, rel.params.length-2)

	var newBindings = {}

	var inputType = inputParams[0].schemaType
	var implicits = macroParam.implicits
	//console.log(JSON.stringify(macroParam))
	_.assertArray(implicits)

	for(var i=0;i<inputParams.length;++i){
		newBindings[implicits[i]] = inputType
		_.assertEqual(JSON.stringify(inputParams[i].schemaType), JSON.stringify(inputType))
	}

	var valueType = ch.computeMacroType(macroParam, ch.bindingTypes, newBindings, implicits)
	//var valueType = realValueType

	if(valueType.type === 'set' || valueType.type === 'list'){
		valueType = valueType.members;
	}
	//console.log(JSON.stringify([inputType, valueType]))
	var realMacroParamType = this.mergeTypes([inputType, valueType])
	
	for(var i=0;i<inputParams.length;++i){
		newBindings[implicits[i]] = realMacroParamType
		_.assertEqual(JSON.stringify(inputParams[i].schemaType), JSON.stringify(inputType))
	}
	
	//console.log

	ch.computeMacroType(macroParam, ch.bindingTypes, newBindings, implicits)
	//var valueType = realValueType
	
	
	return {type: 'set', members: valueType}
}
schema.addFunction('traverse', {
	schemaType: traverseType,
	minParams: 3,
	maxParams: -1,
	callSyntax: 'traverse(params...,macro,maxDepth)',
	computeAsync: function(z, cb){
		var args = Array.prototype.slice.call(arguments, 2)
		var maxDepth = args[args.length-1]
		var macro = args[args.length-2]
		var rest = args.slice(0, args.length-2)
		
		if(!_.isInt(maxDepth)){
			cb([])
			return
		}
		
		//_.errout('why here?')
		
		//console.log('computing traverse: ' + JSON.stringify([rest, maxDepth]))
		
		var results = []
		var has = {}
		function addResult(result){
			if(result === undefined) return
			if(has[result]) return
			has[result] = true
			results.push(result)
		}
		
		descend(rest, 1, function(){
			//console.log('traverse result: ' + JSON.stringify([rest, maxDepth]) + ' ' + JSON.stringify(results))
			cb(results)
		})
		
		function descend(params, depth,cb){
			if(depth >= maxDepth){
				cb()
				return
			}
			//console.log('set immediate')
			setImmediate(function(){
				//console.log('back from immediate')
				//console.log(''+macro.getArray)
				macro.getArray(params, function(result){
					//console.log(JSON.stringify(params) + ' -*> '+JSON.stringify(result))
					if(_.isArray(result)){
						if(result.length === 0){
							cb()
							return
						}
						var cdl = _.latch(result.length, cb)
						result.forEach(function(r){
							addResult(r)
							var newParams = params.slice(1)
							newParams.push(r)
							descend(newParams, depth+1, cdl)
						})
					}else{
						addResult(result)
						var newParams = params.slice(1)
						newParams.push(result)
						descend(newParams, depth+1, cb)
					}
				})
			})
		}
	},
	computeSync: function(z){
		var args = Array.prototype.slice.call(arguments, 1)
		var maxDepth = args[args.length-1]
		var macro = args[args.length-2]
		var rest = args.slice(0, args.length-2)
		
		if(!_.isInt(maxDepth)){
			return []
		}
		
		for(var i=0;i<rest.length;++i){
			var pv = rest[i]
			if(pv === undefined) return []
		}
		
		
		var results = []
		var has = {}
		function addResult(result){
			if(result === undefined) return
			if(has[result]) return
			has[result] = true
			results.push(result)
		}
		
		var tasks = []
		tasks.push({params: rest, depth: 1})
		
		while(tasks.length > 0){
			var task = tasks.pop()
			var depth = task.depth
			var result = macro.getArray(task.params)
			//console.log('traversed ' + JSON.stringify(task.params) + ' -> ' + JSON.stringify(result))
			if(result === undefined) continue
			
			
			if(_.isArray(result)){
				if(result.length === 0){
					continue
				}
				result.forEach(function(r){
					addResult(r)
					if(depth+1 < maxDepth){
						var newParams = task.params.slice(1)
						_.assertDefined(r)
						newParams.push(r)
						//descend(newParams, depth+1, cdl)
						tasks.push({params: newParams, depth: depth+1})
					}
				})
			}else{
				addResult(result)
				if(depth+1 < maxDepth){
					var newParams = task.params.slice(1)
					_.assertDefined(result)
					newParams.push(result)
					tasks.push({params: newParams, depth: depth+1})
				}
			}
		}

		//console.log('computing traverse: ' + JSON.stringify([rest, maxDepth, results]))

		return results
	}
})

