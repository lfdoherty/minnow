"use strict";

var schema = require('./../../shared/schema')

var _ = require('underscorem')

function stub(){}

function filterType(rel, ch){
	return rel.params[0].schemaType
}
schema.addFunction('filter', {
	schemaType: filterType,
	minParams: 2,
	maxParams: 2,
	callSyntax: 'filter(any,boolean)',
	computeSync: function(z, v, state){
		return state?v:undefined
	}
})

