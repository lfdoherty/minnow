
var _ = require('underscorem')

function shallowCopy(b){
	var keys = Object.keys(b)
	var nb = {}
	for(var i=0;i<keys.length;++i){
		var k = keys[i]
		nb[k] = b[k]
	}
	return nb
}

exports.make = make
function make(s, staticBindings, rel, recurse){
	if(!s.mutators) s.mutators = {}

	var mutatorTypeCode = rel.params[0].value
	var mutateExpr = rel.params[1]
	var restExpr = rel.params[2]
	
	var implicit = mutateExpr.implicits[0]
	var mutatorStaticBindings = {}
	mutatorStaticBindings.mutatorImplicit = implicit
	mutatorStaticBindings[implicit] = function(bindings){
		return bindings[implicit]
	}
	
	var mut = recurse(mutateExpr.expr, mutatorStaticBindings)

	var restStaticBindings = {
		isMutated: true,
		makePropertyIndex: mut.newStaticBindings.makePropertyIndex,
		makeReversePropertyIndex: mut.newStaticBindings.makeReversePropertyIndex
	}
	
	var rest = recurse(restExpr.expr, restStaticBindings)
	
	s.mutators[mutatorTypeCode] = {
		createBindings: function(mutatorParams){
			var localBindings = {}
			bindingsUsed.forEach(function(b, index){
				localBindings[b] = mutatorParams[index]
			})
			var created = mutateBindings(localBindings)
			//console.log('created bindings: ' + JSON.stringify([mutatorParams, localBindings, created, Object.keys(created)]))
			return created
		},
		staticBindings: restStaticBindings
	}

	var bindingsUsed = Object.keys(mutateExpr.bindingsUsed)
	mutateExpr.implicits.forEach(function(imp){
		if(bindingsUsed.indexOf(imp) !== -1){
			bindingsUsed.splice(bindingsUsed.indexOf(imp), 1)
		}
	})
	
	/*function mutateBindings(bindings){
		var newBindings = shallowCopy(bindings)
		newBindings.__mutatorKey = (bindings.__mutatorKey||'')+';'+mutatorTypeCode+'{'
		bindingsUsed.forEach(function(b,index){
			if(index > 0) newBindings.__mutatorKey += ','
			newBindings.__mutatorKey += JSON.stringify(bindings[b])
		})
		newBindings.__mutatorKey += '}'
		//console.log('mutated bindings: ' + JSON.stringify([bindings, bindingsUsed, newBindings.__mutatorKey]))
		//newBindings.getMutatorPropertyAt = getMutatorPropertyAt.bind(undefined, bindings)
		return newBindings
	}*/
	
	return function(bindings){
		return rest(bindings)//mutateBindings(bindings))
	}
}
