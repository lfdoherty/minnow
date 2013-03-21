"use strict";

var schema = require('./../../shared/schema')

var _ = require('underscorem')

var editFp = require('./../tcp_shared').editFp
var editCodes = editFp.codes
var editNames = editFp.names

function stub(){}

function type(rel, ch){
	return rel.params[0].schemaType
}
schema.addFunction('preforked', {
	schemaType: type,
	minParams: 2,
	maxParams: 2,
	callSyntax: 'preforked(obj,newPreforked)'
})

