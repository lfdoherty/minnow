"use strict";

var editFp = require('./tcp_shared').editFp
var editCodes = editFp.codes

var _ = require('underscorem')

var pathOps = ['setSyncId', 'selectObject', 'selectProperty', 
	'selectStringKey', 'reselectStringKey', 'selectIntKey', 'selectLongKey', 'selectBooleanKey', 'reset', 
	]
var pathOpsLookup = {}
pathOps.forEach(function(op){
	pathOpsLookup[editCodes[op]] = true
})

exports.isPathOp = function(op){
	_.assertInt(op)
	return pathOpsLookup[op];
}
