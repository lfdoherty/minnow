"use strict";

var _ = require('underscorem')

//var buckets = require('./../../deps/buckets')

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
	description: "Takes a map and produces a map with at most 'many' values, based on selecting the highest-valued key-value pairs.  The map's values must be primitive for comparison purposes.",
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

function pageByValuesType(rel){
	var mapParam = rel.params[2]
	if(mapParam.schemaType.type !== 'map') throw new Error('topByValues parameter 3 must be a map: ' + JSON.stringify(mapParam.schemaType))
	if(mapParam.schemaType.value.type !== 'primitive') throw new Error('topByValues parameter 2 must be a map with primitive values: ' + JSON.stringify(mapParam.schemaType))
	return mapParam.schemaType
}
schema.addFunction('pageByValues', {
	schemaType: pageByValuesType,
	minParams: 3,
	maxParams: 3,
	callSyntax: 'pageByValues(page, many, map)',
	computeSync: function(z, page, many, map){
		var pairs = []
		Object.keys(map).forEach(function(key){
			pairs.push([key, map[key]])
		})
		pairs.sort(function(a,b){
			return b[1] - a[1]
		})

		if(page < 0) page = 0
		var maxIndex = (page+1)*many
		var minIndex = page*many
			
		pairs = pairs.slice(minIndex, maxIndex)

		var result = {}
		pairs.forEach(function(p){
			result[p[0]] = p[1]
		})
		//console.log('topByValues(' + many + ','+JSON.stringify(map)+') -> ' + JSON.stringify(result))
		return result
	}
})

