"use strict";

var _ = require('underscorem')

var schema = require('./../../shared/schema')

function typeType(rel){
	return {type: 'primitive', primitive: 'boolean'}
}
schema.addFunction('isa', {
	schemaType: typeType,
	minParams: 2,
	maxParams: 2,
	callSyntax: 'isa(object,string)',
	computeSync: function(z, id, name){
		_.errout('SHOULD NEVER HAPPEN')
		/*if(id === undefined){
			console.log('isa undefined -> false')			
			return
		}
		var objSchema = z.schema._byCode[z.objectState.getObjectType(id)]

		var result = objSchema.name === name || (objSchema.superTypes && objSchema.superTypes[name])
		result = !!result
		//console.log('isa ' + id + ','+name + ' ' + result + ' (' + objSchema.name + ')')
		return result*/
	}
})

