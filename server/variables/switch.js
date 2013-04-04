"use strict";

var _ = require('underscorem')


var schema = require('./../../shared/schema')
var _ = require('underscorem')

require('./case')
require('./default')

function stub(){}

function switchType(rel, ch){

	var types = []

	//TODO specialize binding types depending on the original global-macro signature
	rel.params.forEach(function(c, index){
		if(index === 0) return
		_.assertDefined(c.schemaType)
		types.push(c.schemaType)
	})
	
	//console.log('merging types for: ' + JSON.stringify(rel))
	
	return this.mergeTypes(types)
}
schema.addFunction('switch', {
	schemaType: switchType,
	minParams: 3,
	maxParams: -1,
	callSyntax: 'switch(primitive, case, case, ..., [default])'
})


