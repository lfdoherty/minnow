"use strict";

var _ = require('underscorem')

//var Cache = require('./../variable_cache')
//var listenerSet = require('./../variable_listeners')
//var fixedObject = require('./../fixed/object')
var schema = require('./../../shared/schema')

function oneType(rel){
	return rel.params[0].schemaType.members;
}
schema.addFunction('one', {
	schemaType: oneType,
	//implementation: oneMaker,
	minParams: 1,
	maxParams: 1,
	callSyntax: 'one(collection)',
	computeSync: function(z, set){
		//console.log('computed one ' + set[0] + ' from ' + JSON.stringify(set))
		//console.log(new Error().stack)
		return set[0]
	}
})

