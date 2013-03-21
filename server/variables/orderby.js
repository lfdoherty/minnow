"use strict";

var _ = require('underscorem')

var schema = require('./../../shared/schema')
var _ = require('underscorem')

function orderByType(rel){
	return {type: 'list', members: rel.params[0].schemaType.members};
}
schema.addFunction('orderBy', {
	schemaType: orderByType,
	minParams: 2,
	maxParams: 2,
	callSyntax: 'orderBy(collection,ordinal-macro)'
})


