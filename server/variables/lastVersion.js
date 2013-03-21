"use strict";

var _ = require('underscorem')

var schema = require('./../../shared/schema')

function stub(){}

function versionType(rel){
	if(rel.params[0].schemaType.type === 'object'){
		return {type: 'primitive', primitive: 'int'}
	}else{
		return {type: 'set', members: {type: 'primitive', primitive: 'int'}}
	}
}

schema.addFunction('lastVersion', {
	schemaType: versionType,
	minParams: 1,
	maxParams: 1,
	callSyntax: 'lastVersion(object/s)',
	computeAsync: function(z, cb, input){//TODO move this internal so that we can accurately getLastVersion given editId
		if(input === undefined){
			cb(undefined)
			return
		}
		
		if(_.isArray(input)){
			var versions = []
			//console.log('getting input versions')
			var cdl = _.latch(input.length, function(){
				cb(versions)
			})
			input.forEach(function(id){
				z.objectState.getLastVersion(id, function(v){
					if(versions.indexOf(v) === -1){
						versions.push(v)
					}
					cdl()
				})
			})
		}else{
			cb(z.objectState.getLastVersion(input))
		}
	}
})

