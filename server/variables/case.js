"use strict";

var _ = require('underscorem')

var schema = require('./../../shared/schema')
var _ = require('underscorem')

function caseType(rel){
	_.errout('this should never happen')
}
schema.addFunction('case', {
	schemaType: caseType,
	minParams: 2,
	maxParams: 2,
	callSyntax: 'NA'
})

