"use strict";

var schema = require('./../../shared/schema')
var _ = require('underscorem')

function longType(rel, computeType){return {type: 'primitive', primitive: 'long'};}

function stub(){}

schema.addFunction('count', {
	schemaType: longType,
	minParams: 1,
	maxParams: 1,
	callSyntax: 'count(collection)',
	computeAsync: function(z, cb, collection){
		//console.log('counting ' + JSON.stringify(collection))
		if(_.isObject(collection)){
			cb(Object.keys(collection).length)
		}else{
			cb(collection.length)
		}
	},
	computeSync: function(z, collection){
		//console.log('counting ' + JSON.stringify(collection))
		if(_.isObject(collection)){
			return Object.keys(collection).length
		}else{
			return collection.length
		}
	}
})


