"use strict";

var _ = require('underscorem')

var Cache = require('./../variable_cache')
var listenerSet = require('./../variable_listeners')

var schema = require('./../../shared/schema')
var _ = require('underscorem')

function caseType(rel){
	_.errout('this should never happen')
}
schema.addFunction('case', {
	schemaType: caseType,
	implementation: maker,
	minParams: 2,
	maxParams: 2,
	callSyntax: 'NA'
})


function maker(s, self, rel, typeBindings){
	_.errout('this should never happen')
}

