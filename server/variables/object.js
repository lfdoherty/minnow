"use strict";

var _ = require('underscorem')
var schema = require('./../../shared/schema')

function oneType(rel){
	return {type: 'object', object: '*'}
}
schema.addFunction('object', {
	schemaType: oneType,
	minParams: 1,
	maxParams: 1,
	callSyntax: 'object(id)',
	computeSync: function(z, set){
		_.errout('should never be called')
	}
})

