"use strict";

var _ = require('underscorem')

var schema = require('./../../shared/schema')

function oneType(rel){
	return rel.params[0].schemaType.members;
}
schema.addFunction('one', {
	schemaType: oneType,
	minParams: 1,
	maxParams: 1,
	callSyntax: 'one(collection)',
	computeSync: function(z, set){
		if(!set){
			//console.log('computed one undefined from undefined')
			return
		}
		
		//console.log('computed one ' + set[0] + ' from ' + JSON.stringify(set))
		//console.log(new Error().stack)
		return set[0]
	}
})

