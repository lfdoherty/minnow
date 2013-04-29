"use strict";

var _ = require('underscorem')

var schema = require('./../../shared/schema')

function typeType(rel){
	return {type: 'primitive', primitive: 'boolean'}
}
schema.addFunction('isOfType', {
	schemaType: typeType,
	minParams: 2,
	maxParams: 2,
	callSyntax: 'isOfType(object,string)',
	computeSync: function(z, id, name){
		if(id === undefined){			
			return
		}
		var objSchema = z.schema._byCode[z.objectState.getObjectType(id)]

		var result = objSchema.name === name || (objSchema.superTypes && objSchema.superTypes[name])
		result = !!result
		//console.log('isOfType ' + id + ','+name + ' ' + result + ' (' + objSchema.name + ')')
		return result
	}
})

