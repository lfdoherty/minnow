"use strict";

//var Cache = require('./../variable_cache')

var schema = require('./../../shared/schema')
//var listenerSet = require('./../variable_listeners')

var _ = require('underscorem')

function makeKeyParser(kt){
	var keyParser;
	if(kt.type === 'object'){
		keyParser = function(key){
			console.log('parsing key: ' + key)
			var ci = key.indexOf(':')
			if(ci === -1){
				return parseInt(key);
			}else{
				return {top: parseInt(key.substr(0,ci)), inner: parseInt(key.substr(ci+1))}
			}
		}
	}else if(kt.type === 'primitive'){
		if(kt.primitive === 'int'){
			keyParser = function(key){
				console.log('int')
				return parseInt(key);
			}
		}else if(kt.primitive === 'string'){
			keyParser = function(key){
				console.log('string')
				return key;
			}
		}else if(kt.primitive === 'long'){
			keyParser = function(key){return Number(key);}
		}else{
			_.errout('TODO: ' + JSON.stringify(kt))
		}
	}else{
		_.errout('TODO: ' + JSON.stringify(kt))
	}
	return keyParser
}
exports.makeKeyParser = makeKeyParser

//var mapSyncOptimization = require('./map_sync_optimization')

function mapType(rel, ch){
	var inputType = rel.params[0].schemaType//ch.computeType(rel.params[0], ch.bindingTypes)
	var singleInputType = inputType.members
	//console.log('singleInputType: ' + JSON.stringify(singleInputType))
	//console.log('inputType: ' + JSON.stringify(inputType))
	_.assertDefined(singleInputType)
	
	var implicits1 = rel.params[1].implicits
	var implicits2 = rel.params[2].implicits
	
	var binding1 = {}
	binding1[implicits1[0]] = singleInputType
	var binding2 = {}
	binding2[implicits2[0]] = singleInputType
	
	//s.log('map bound key ' + implicits1[1])
	//s.log('map bound value ' + implicits1[1])
	
	var keyType = ch.computeMacroType(rel.params[1], ch.bindingTypes, binding1)
	var valueType = ch.computeMacroType(rel.params[2], ch.bindingTypes, binding2)
	if(rel.params.length === 4){
		var implicits3 = rel.params[3].implicits
		var moreBinding = {}
		moreBinding[implicits3[0]] = valueType
		moreBinding[implicits3[1]] = valueType
		ch.computeMacroType(rel.params[3], ch.bindingTypes, moreBinding)
	}

	//console.log('map: ' + JSON.stringify([keyType,valueType]))
	
	_.assert(keyType.type !== 'set')
	_.assert(keyType.type !== 'list')
	_.assert(valueType.type !== 'set')
	_.assert(valueType.type !== 'list')
	

	return {type: 'map', key: keyType, value: valueType}
}

exports.mapType = mapType

schema.addFunction('map', {
	schemaType: mapType,
	//implementation: mapMaker,
	minParams: 3,
	maxParams: 4,
	callSyntax: 'map(collection,key-macro,value-macro[,reduce-macro])',
	computeAsync: function(z, cb, input, keyMacro, valueMacro, reduceMacro){
		if(reduceMacro){
			reduceComputeAsync(z, cb, input, keyMacro, valueMacro, reduceMacro)
		}else{
			noReduceComputeAsync(z, cb, input, keyMacro, valueMacro)
		}
	},
	computeSync: function(z, input, keyMacro, valueMacro, reduceMacro){
		if(reduceMacro){
			return reduceCompute(z, input, keyMacro, valueMacro, reduceMacro)
		}else{
			return noReduceCompute(z, input, keyMacro, valueMacro)
		}
	}
})

function reduceCompute(z, input, keyMacro, valueMacro, reduceMacro){
	
	var state = {}
	_.assertArray(input)
	
	//console.log('reducing map')

	input.forEach(function(v){
		var key = keyMacro.get(v)
		var value = valueMacro.get(v)
		_.assertDefined(key)			
		_.assertDefined(value)	
		if(!state[key]) state[key] = []		
		state[key].push(value)
	})
	
	Object.keys(state).forEach(function(key){
		var values = state[key]

		while(values.length > 1){
			var combinedValue = reduceMacro.get(values[0], values[1])
			//console.log('reduced ' + values[0] + ',' + values[1] + ': ' + combinedValue)
			values.shift()
			values[0] = combinedValue
		}
	})

	var ss = {}
	var keys = Object.keys(state)
	for(var i=0;i<keys.length;++i){
		var key = keys[i]
		//console.log('kkkk: ' + key)
		ss[key] = state[key][0]
	}
	
	console.log('reduced: ' + JSON.stringify(ss))
	
	return ss
}


function reduceComputeAsync(z, cb, input, keyMacro, valueMacro, reduceMacro){
	var state = {}
	_.assertArray(input)
	
	//console.log('reducing map')
	
	var combinationsToDo = 0
	var cdl = _.latch(input.length*2, function(){

		var nc = _.latch(combinationsToDo, function(){
			var ss = {}
			var keys = Object.keys(state)//.forEach(function(key){
			for(var i=0;i<keys.length;++i){
				var key = keys[i]
				//console.log('kkkk: ' + key)
				ss[key] = state[key][0]
			}
			//console.log('lkjeoirueroeu***: ' + JSON.stringify(ss))
			var ncb = cb
			cb = undefined
			ncb(ss)
		})
		
		//console.log('combinations: ' + combinationsToDo)
		
		Object.keys(state).forEach(function(key){
			var values = state[key]
			
			//console.log('##lkjeoirueroeu: ' + JSON.stringify(state))
			//_.assertDefined(cb)
			function doReduce(){
				reduceMacro.get(values[0], values[1], function(combinedValue){
					//console.log('reduced ' + values[0] + ',' + values[1] + ': ' + combinedValue)
					values.shift()
					values[0] = combinedValue
					nc()
					if(values.length > 1){
						setImmediate(doReduce)
					}					
				})
			}
			if(values.length > 1){
				doReduce()
			}
		})
	})
	input.forEach(function(v){
		var gotKey = false
		var gotValue = false
		var theKey
		var theValue
		keyMacro.get(v, function(key){	
			_.assertDefined(key)			
			if(state[key] === undefined){
				state[key] = []
			}
			if(gotValue){
				if(state[key].length > 0) ++combinationsToDo
				state[key].push(theValue)
			}else{
				theKey = key
				gotKey = true
			}
			cdl()
		})
		valueMacro.get(v, function(value){
			_.assertDefined(value)			
			if(gotKey){
				if(state[theKey] === undefined){
					state[theKey] = []
				}
				if(state[theKey].length > 0) ++combinationsToDo
				state[theKey].push(value)
			}else{
				theValue = value
				gotValue = true
			}
			cdl()
		})
	})
}

function noReduceCompute(z, input, keyMacro, valueMacro){
	var state = {}
	_.assertArray(input)
	
	input.forEach(function(v){
		var key = keyMacro.get(v)
		var value = valueMacro.get(v)
		//console.log('key: ' + key + ', value: ' + value)
		if(value !== undefined){
			state[key] = value
		}
	})
	//console.log('state: ' + JSON.stringify(state) + ' from ' + JSON.stringify(input))
	return state
}



function noReduceComputeAsync(z, cb, input, keyMacro, valueMacro){
	var state = {}
	_.assertArray(input)
	//console.log('++')
	var cdl = _.latch(input.length, function(){
		//console.log('computed map state: ' + JSON.stringify([input, state]))
		cb(state)
	})
	input.forEach(function(v){
		var gotKey = false
		var gotValue = false
		var theKey
		var theValue
		keyMacro.get(v, function(key){
			if(gotValue){
				if(key !== undefined && theValue !== undefined) state[key] = theValue
				cdl()
			}else{
				theKey = key
				gotKey = true
			}
		})
		valueMacro.get(v, function(value){
			
			if(gotKey){
				if(theKey !== undefined && value !== undefined) state[theKey] = value
				cdl()
			}else{
				theValue = value
				gotValue = true
			}
		})
	})
}


