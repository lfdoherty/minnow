"use strict";

var _ = require('underscorem')

var schema = require('./../../shared/schema')
var _ = require('underscorem')

function caseType(rel){
	_.errout('this should never happen')
}
schema.addFunction('default', {
	schemaType: caseType,
	minParams: 1,
	maxParams: 1,
	callSyntax: 'NA',
	computeAsync: function(){
		_.errout('this should never happen')
	}
})

