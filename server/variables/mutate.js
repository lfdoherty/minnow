"use strict";

var schema = require('./../../shared/schema')

var _ = require('underscorem')

var editFp = require('./../tcp_shared').editFp
var editCodes = editFp.codes
var editNames = editFp.names

function stub(){}

function type(rel, ch){
	_.assertLength(rel.params, 3)
	
	var preforkExpr = rel.params[1]
	var restExpr = rel.params[2]
	
	var newBindings = {}
	var implicits = preforkExpr.implicits
	newBindings[implicits[0]] = {type: 'object', object: '*'}

	ch.computeMacroType(preforkExpr, ch.bindingTypes, newBindings, implicits)
	ch.computeMacroType(restExpr, ch.bindingTypes, {}, [])
	return restExpr.schemaType
}
schema.addFunction('mutate', {
	schemaType: type,
	minParams: 2,
	maxParams: 2,
	callSyntax: 'mutate(mutator, rest)'
})

schema.addFunction('unchanged', {
	schemaType: function(){return {type: 'nil'}},
	minParams: 0,
	maxParams: 0,
	callSyntax: 'unchanged()',
	computeSync: function(){
		_.errout('this should never happen')
	}
})

