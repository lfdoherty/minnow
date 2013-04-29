"use strict";

var _ = require('underscorem')

var schema = require('./../../shared/schema')

function typeType(rel){
	return {type: 'primitive', primitive: 'string'}
}
schema.addFunction('type', {
	schemaType: typeType,
	minParams: 1,
	maxParams: 1,
	callSyntax: 'type(object)',
	/*computeAsync: function(z, cb, id){
		if(id === undefined){
			cb(undefined)
			return
		}
		var typeCode = z.objectState.getObjectType(id)
		//console.log('type of ' + id + ' is ' + z.schema._byCode[typeCode].name)
		cb(z.schema._byCode[typeCode].name)
	},*/
	computeSync: function(z, id){
		if(id === undefined){
			return
		}
		var typeCode = z.objectState.getObjectType(id)
		//console.log('type of ' + id + ' is ' + z.schema._byCode[typeCode].name)
		return z.schema._byCode[typeCode].name
	}
})

function stub(){}

