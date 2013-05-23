
var _ = require('underscorem')

exports.make = function(s, staticBindings, rel, recurse){
	_.assertLength(arguments, 4)

	var caseValues = []
	var caseExprs = []
	var defaultExpr
	
	var valueExpr = recurse(rel.params[0])
	
	rel.params.slice(1).forEach(function(caseParam, index){
		var cvp = caseParam.params[0]
		if(caseParam.view === 'case'){
			_.assertEqual(cvp.type, 'value')
			caseValues[index] = cvp.value
			caseExprs[index] = recurse(caseParam.params[1])
		}else{
			_.assertEqual(caseParam.view, 'default')
			defaultExpr = recurse(caseParam.params[0])
		}
	})
	
	return function(bindings){
		var value = valueExpr(bindings)
		//console.log('switch value: ' + value)
		for(var i=0;i<caseValues.length;++i){
			var cv = caseValues[i]
			if(cv === value){
				var res = caseExprs[i](bindings)
				//console.log('case result: ' + value + ' -> ' + JSON.stringify(res))
				return res
			}
		}
		if(defaultExpr){
			var res = defaultExpr(bindings)
			//console.log('default result: ' + value + ' -> ' + JSON.stringify(res))
			return res
		}else{
			console.log('WARNING: no case matched and no default case provided')
		}
	}
}
