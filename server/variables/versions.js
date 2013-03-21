"use strict";

var _ = require('underscorem')

var schema = require('./../../shared/schema')

function versionsType(rel){
	if(rel.params[0].schemaType.type === 'object'){
		return {type: 'list', members: {type: 'primitive', primitive: 'int'}}
	}else{
		return {type: 'set', members: {type: 'primitive', primitive: 'int'}}
	}
}

schema.addFunction('versions', {
	schemaType: versionsType,
	minParams: 1,
	maxParams: 1,
	callSyntax: 'versions(object/s)',
	computeAsync: function(z, cb, input){
		if(input === undefined){
			cb([])
			return
		}
		
		if(_.isArray(input)){
	
			var results = []
			var has = {}
			var cdl = _.latch(input.length, function(){
				cb(results)
			})
			input.forEach(function(id){
				z.objectState.getVersions(id, function(vs){
					vs.forEach(function(v){
						if(has[v]) return
						has[v] = true
						results.push(v)
					})
					cdl()
				})
			})
		}else{
			z.objectState.getVersions(input, function(vs){
				cb(vs)
			})
		}
	}
})

