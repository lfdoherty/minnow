"use strict";

var _ = require('underscorem')

var schema = require('./../../shared/schema')


function typeType(rel, computeType){
	_.assertString(rel.params[0].value)
	return {type: 'set', members: {type: 'object', object: rel.params[0].value}};
}

schema.addFunction('typeset', {
	schemaType: typeType,
	minParams: 1,
	maxParams: 1,
	callSyntax: 'typeset(typename)',
	computeAsync: function(z, cb, typeName){
		//console.log('typeName: ' + JSON.stringify(typeName))
		if(typeName === undefined){
			cb([])
			return
		}
		_.assertString(typeName)
		var typeCode = z.schema[typeName].code
		_.assertInt(z.editId)
		z.objectState.getAllIdsOfTypeAt(typeCode, z.editId, function(ids){
			cb(ids)
		})
	}
})

