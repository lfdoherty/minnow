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
	computeSync: function(z, version){
		if(version === undefined){
			return undefined
		}else{
			return z.objectState.getVersionTimestamp(version)
		}
	}
})

