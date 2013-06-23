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
	
	if(keyType.type === 'set' || keyType.type === 'list'){
		keyType = keyType.members
	}
	
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
	if(!input) return state

	_.assertArray(input)
	
	//console.log('reducing map')

	input.forEach(function(v){
		var key = keyMacro.get(v)
		if(_.isArray(key)){
			key.forEach(function(key){
				var value = valueMacro.get(v)
				_.assertDefined(key)			
				_.assertDefined(value)	
				if(!state[key]) state[key] = []		
				state[key].push(value)
			})
		}else{
			var value = valueMacro.get(v)
			_.assertDefined(key)			
			_.assertDefined(value)	
			if(!state[key]) state[key] = []		
			state[key].push(value)
		}
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
	
	//console.log('reduced: ' + JSON.stringify(ss))
	
	return ss
}

function noReduceCompute(z, input, keyMacro, valueMacro){
	var state = {}
	if(!input) return state
	_.assertArray(input)
	
	//console.log(new Error().stack)
	
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


