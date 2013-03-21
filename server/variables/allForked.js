
var _ = require('underscorem')

var schema = require('./../../shared/schema')

var editFp = require('./../tcp_shared').editFp
var editCodes = editFp.codes
var editNames = editFp.names

function stub(){}

function type(rel){
	return rel.params[0].schemaType
}

schema.addFunction('allForked', {
	schemaType: type,
	minParams: 1,
	maxParams: 1,
	callSyntax: 'allForked(object/s)',
	computeAsync: function(z, cb, set){
		var result = []
		var has = {}
		set.forEach(function(id){
			var forkedIds = z.objectState.getAllForked(id)//TODO take editId into account, perhaps also moving this to a wrap impl
			forkedIds.forEach(function(fid){
				if(has[fid]) return
				has[fid] = true
				result.push(fid)
			})
		})
		cb(result)
	}
})

