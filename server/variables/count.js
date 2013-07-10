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
	computeSync: function(z, collection){
		if(!collection) return 0
		//console.log('counting ' + collection.length)
		
		//console.log(new Error().stack)
		if(_.isObject(collection)){
			return Object.keys(collection).length
		}else{
			return collection.length
		}
	}
})


