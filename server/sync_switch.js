
var _ = require('underscorem')

function makeSwitchFunction(valueExpr, caseValues, caseExprs, defaultExpr, rel){

	//return 
	
	//_.errout(JSON.stringify(caseExprs))

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
	
	//if(valueExpr.isBoolean) _.errout('test: ' + valueExpr.isBoolean)

	function booleanF(bindings){
		var value = valueExpr(bindings)
		value = !!value
		//if(rel.params[1].params[0].value === true && rel.params[1].params[1].was && rel.params[1].params[1].was.view === 'list') console.log('switch value: ' + value)//+ ' ' + JSON.stringify(rel.params[2]))//.params[0].view)
		for(var i=0;i<caseValues.length;++i){
			var cv = caseValues[i]
			if(cv === value){
				var res = caseExprs[i](bindings)
				//if(rel.params[1].params[0].value === true && rel.params[1].params[1].was && rel.params[1].params[1].was.view === 'list') console.log('case result: ' + value + ' -> ' + JSON.stringify(res))
				return res
			}
		}
		if(defaultExpr){
			var res = defaultExpr(bindings)
			//if(rel.params[1].params[0].value === true && rel.params[1].params[1].was && rel.params[1].params[1].was.view === 'list') console.log('default result: ' + value + ' -> ' + JSON.stringify(res))
			return res
		}else{
			console.log('WARNING: no case matched and no default case provided')
		}
	}
	
	function f(bindings){
		var value = valueExpr(bindings)
		if(caseExprs[0].view === 'list') console.log('switch value: ' + value)
		for(var i=0;i<caseValues.length;++i){
			var cv = caseValues[i]
			if(cv === value){
				var res = caseExprs[i](bindings)
				//console.log(JSON.stringify(caseExprs[0]))
				//_.errout(caseExprs[0])//
				//if(caseExprs[0].view === 'list') console.log('case result: ' + value + ' -> ' + JSON.stringify(res))
				return res
			}
		}
		if(defaultExpr){
			var res = defaultExpr(bindings)
			if(caseExprs[0].view === 'list') console.log('default result: ' + value + ' -> ' + JSON.stringify(res))
			return res
		}else{
			console.log('WARNING: no case matched and no default case provided')
		}
	}
	
	booleanF.specializeByType = f.specializeByType = function(typeBindings){

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
	
	if(valueExpr.isBoolean){
		return booleanF
	}else{
		return f
	}
}
exports.make = function(s, staticBindings, rel, recurse){
	_.assertLength(arguments, 4)

	var caseValues = []
	var caseExprs = []
	var defaultExpr
	
	var valueExpr = recurse(rel.params[0])
	valueExpr.isBoolean = rel.params[0].schemaType.primitive === 'boolean'
	
	rel.params.slice(1).forEach(function(caseParam, index){
		var cvp = caseParam.params[0]
		if(caseParam.view === 'case'){
			_.assertEqual(cvp.type, 'value')
			caseValues[index] = cvp.value
			//_.errout('here: ' + JSON.stringify(caseParam))
			caseExprs[index] = recurse(caseParam.params[1])
		}else{
			_.assertEqual(caseParam.view, 'default')
			defaultExpr = recurse(caseParam.params[0])
		}
	})
	
	var f = makeSwitchFunction(valueExpr, caseValues, caseExprs, defaultExpr, rel)
	
	return f
}
