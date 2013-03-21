"use strict";

var _ = require('underscorem')

var schema = require('./../../shared/schema')

function timestampType(rel){
	return {type: 'primitive', primitive: 'long'}
}

schema.addFunction('timestamp', {
	schemaType: timestampType,
	minParams: 1,
	maxParams: 1,
	callSyntax: 'timestamp(version)',
	computeAsync: function(z, cb, version){
		if(version === undefined){
			cb(undefined)
		}else{
			cb(z.objectState.getVersionTimestamp(version))
		}
	}
})

