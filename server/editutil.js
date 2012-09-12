

var pathOps = ['setSyncId', 'selectObject', 'selectProperty', 'reselectObject', 'reselectProperty', 
	'selectStringKey', 'reselectStringKey', 'selectIntKey', 'reselectIntKey', 'selectLongKey', 'reselectLongKey','selectBooleanKey', 'reselectBooleanKey',
	'ascend', 'ascend1', 'ascend2', 'ascend3', 'ascend4', 'ascend5', 'reset', 
	]
var pathOpsLookup = {}
pathOps.forEach(function(op){
	pathOpsLookup[op] = true
})

exports.isPathOp = function(op){return pathOpsLookup[op];}
