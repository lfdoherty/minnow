
var _ = require('underscorem')

function makeSwitchFunction(valueExpr, caseValues, caseExprs, defaultExpr){

	//return 

	if(valueExpr.isStatic){
		var value = valueExpr()
		var caseExpr = defaultExpr
		
		for(var i=0;i<caseValues.length;++i){
			var cv = caseValues[i]
			if(cv === value){
				caseExpr = caseExprs[i]
			}
		}
		
		//_.errout('collapsed switch by value: ' + value)
		_.assertDefined(caseExpr)
		
		return caseExpr
	}
	
	function f(bindings){
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

	f.specializeByType = function(typeBindings){

		var newValueExpr = valueExpr
		if(valueExpr.specializeByType){
			newValueExpr = valueExpr.specializeByType(typeBindings)
		}
	
		var newCaseExprs = []
		caseExprs.forEach(function(ce, index){
			if(ce.specializeByType){
				var nce = ce.specializeByType(typeBindings)
				newCaseExprs[index] = nce
			}else{
				newCaseExprs[index] = ce
			}
		})
	
		var newDefaultExpr = defaultExpr
		if(defaultExpr && defaultExpr.specializeByType){
			newDefaultExpr = defaultExpr.specializeByType(typeBindings)
		}
	
		return makeSwitchFunction(newValueExpr, caseValues, newCaseExprs, newDefaultExpr)
	}
	return f
}
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
	
	var f = makeSwitchFunction(valueExpr, caseValues, caseExprs, defaultExpr)
	
	return f
}
