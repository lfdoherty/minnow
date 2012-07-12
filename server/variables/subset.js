"use strict";

var _ = require('underscorem')
/*

subset is syntactical sugar for expressions of this form:

each(<set>,{filter(~,<expr>)})

Which becomes:

subset(<set>,{<expr>})

i.e. somewhat more readable and requiring a bit less typing.

*/
require('./../../shared/schema').addSugar('subset', {
	transform: function(expr){
		_.assertLength(expr.params, 2)
		var newParams = []
		newParams[0] = expr.params[0]
		//_.assertDefined(expr.params[0])
		//console.log(JSON.stringify(expr))
		var oldMacro = expr.params[1]
		_.assertDefined(oldMacro.expr)
		var filterExpr = {type: 'view', view: 'filter', params: [{type: 'param', name: '~'}, oldMacro.expr]}
		newParams[1] = {type: 'macro', expr: filterExpr}
		return {type: 'view', view: 'each', params: newParams, context: expr.context}
	}
})
