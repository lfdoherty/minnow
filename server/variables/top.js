"use strict";

var _ = require('underscorem')

//var Cache = require('./../variable_cache')
//var listenerSet = require('./../variable_listeners')

var buckets = require('./../../deps/buckets')

var schema = require('./../../shared/schema')
var _ = require('underscorem')

function topByValuesType(rel){
	if(rel.params[1].schemaType.type !== 'map') throw new Error('topByValues parameter 2 must be a map: ' + JSON.stringify(rel.params[1].type))
	if(rel.params[1].schemaType.value.type !== 'primitive') throw new Error('topByValues parameter 2 must be a map with primitive values: ' + JSON.stringify(rel.params[1].schemaType))
	return rel.params[1].schemaType
}
schema.addFunction('topByValues', {
	schemaType: topByValuesType,
	minParams: 2,
	maxParams: 2,
	callSyntax: 'topByValues(many, map)',
	description: "Takes a map and produces a map with a most 'many' values, based on selecting the highest-valued key-value pairs.  The map's values must be primitive for comparison purposes.",
	computeSync: function(z, many, map){
		var pairs = []
		Object.keys(map).forEach(function(key){
			pairs.push([key, map[key]])
		})
		pairs.sort(function(a,b){
			return b[1] - a[1]
		})
		if(pairs.length > many){
			pairs = pairs.slice(0, many)
		}
		var result = {}
		pairs.forEach(function(p){
			result[p[0]] = p[1]
		})
		//console.log('topByValues(' + many + ','+JSON.stringify(map)+') -> ' + JSON.stringify(result))
		return result
	}
})

