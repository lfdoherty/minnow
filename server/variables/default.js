"use strict";

var _ = require('underscorem')

//var Cache = require('./../variable_cache')
var listenerSet = require('./../variable_listeners')

var schema = require('./../../shared/schema')
var _ = require('underscorem')

function caseType(rel){
	_.errout('this should never happen')
}
schema.addFunction('default', {
	schemaType: caseType,
	implementation: maker,
	minParams: 1,
	maxParams: 1,
	callSyntax: 'NA',
	computeAsync: function(){
		_.errout('this should never happen')
	}
})


function maker(s, self, rel, typeBindings){
	_.errout('this should never happen')
}

