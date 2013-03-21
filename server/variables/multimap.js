"use strict";

//var Cache = require('./../variable_cache')

var schema = require('./../../shared/schema')
//var listenerSet = require('./../variable_listeners')

var _ = require('underscorem')

var makeKeyParser = require('./map').makeKeyParser

function multimapType(rel, ch){
	var inputType = rel.params[0].schemaType//ch.computeType(rel.params[0], ch.bindingTypes)
	var singleInputType = inputType.members
	//s.log('singleInputType: ' + JSON.stringify(singleInputType))
	//s.log('inputType: ' + JSON.stringify(inputType))
	_.assertDefined(singleInputType)
	
	var implicits1 = rel.params[1].implicits
	var implicits2 = rel.params[2].implicits
	
	var binding1 = {}
	binding1[implicits1[0]] = singleInputType
	var binding2 = {}
	binding2[implicits2[0]] = singleInputType
	
	var keyType = ch.computeMacroType(rel.params[1], ch.bindingTypes, binding1)
	if(keyType.type === 'list' || keyType.type === 'set'){
		keyType = keyType.members
	}
	var valueType = ch.computeMacroType(rel.params[2], ch.bindingTypes, binding2)
	if(valueType.type !== 'list' && valueType.type !== 'set'){
		valueType = {type: 'set', members: valueType}
	}else{// if(valueType.type !== 'list'){
		valueType = {type: 'set', members: valueType.members}
	}
	return {type: 'map', key: keyType, value: valueType}
}
schema.addFunction('multimap', {
	schemaType: multimapType,
	//implementation: multimapMaker,
	minParams: 3,
	maxParams: 3,
	callSyntax: 'multimap(collection,key-macro,value-macro)',
	computeAsync: function(z, cb, set, keyMacro, valueMacro){
		var map = {}
		var cdl = _.latch(set.length, function(){
			//console.log('computed multimap ' + JSON.stringify(set) + ' ' + JSON.stringify(map))
			cb(map)
		})
		function putAdd(key, value){
			if(map[key] === undefined){
				map[key] = []
			}
			if(map[key].indexOf(value) === -1){
				map[key].push(value)
			}
		}
		set.forEach(function(v){
			keyMacro.get(v, function(key){
				//_.assertPrimitive(key)
				valueMacro.get(v, function(value){
					//console.log('multimap ' + JSON.stringify(key) + ' ' + JSON.stringify(value))
					if(_.isArray(value)){
						if(_.isArray(key)){
							key.forEach(function(k){
								value.forEach(function(v){
									putAdd(k, v)
								})
							})
						}else{
							value.forEach(function(v){
								putAdd(key, v)
							})
						}
					}else{
						if(_.isArray(key)){
							key.forEach(function(k){
								putAdd(k, value)
							})
						}else{
							putAdd(key, value)
						}
					}
					cdl()
				})
				
			})
		})
	}
})

