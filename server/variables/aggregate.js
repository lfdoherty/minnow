"use strict";

var buckets = require('./../../deps/buckets')

var schema = require('./../../shared/schema')
var _ = require('underscorem')

function longType(rel, computeType){return {type: 'primitive', primitive: 'long'};}

schema.addFunction('max', {
	schemaType: longType,
	minParams: 1,
	maxParams: -1,
	callSyntax: 'max(number|collection:number,...)',
	computeAsync: function(z, cb){
		var rest = Array.prototype.slice.call(arguments, 2)
		
		var max
		rest.forEach(function(ns){
			if(_.isArray(ns)){
				ns.forEach(function(v){
					if(max === undefined || max < v) max = v
				})
			}else{
				if(max === undefined || max < ns) max = ns
			}
		})
		//console.log('max: ' + max + ' ' + JSON.stringify(rest))
		cb(max)
	}
})

schema.addFunction('min', {
	schemaType: longType,
	minParams: 1,
	maxParams: -1,
	callSyntax: 'min(number|collection:number,...)',
	computeAsync: function(z, cb){
		var rest = Array.prototype.slice.call(arguments, 2)
		
		var min
		rest.forEach(function(ns){
			if(_.isArray(ns)){
				ns.forEach(function(v){
					if(min === undefined || min > v) min = v
				})
			}else{
				if(min === undefined || min > ns) min = ns
			}
		})
		cb(min)
	}
})

