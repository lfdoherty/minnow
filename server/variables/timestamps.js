"use strict";

var _ = require('underscorem')

var schema = require('./../../shared/schema')

function stub(){}

function timestampsType(rel){
	return {type: 'map', key: {type: 'primitive', primitive: 'int'}, value: {type: 'primitive', primitive: 'long'}}
}

schema.addFunction('timestamps', {
	schemaType: timestampsType,
	minParams: 1,
	maxParams: 1,
	callSyntax: 'timestamps(versions)',
	computeSync: function(z, versions){
		var result = {}
		if(versions === undefined){
			return result
		}
		versions.forEach(function(v){
			var ts = z.objectState.getVersionTimestamp(v)
			result[v] = ts
		})
		return result
	}
})

