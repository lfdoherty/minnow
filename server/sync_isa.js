
var _ = require('underscorem')

exports.make = make

function make(s, staticBindings, rel, recurse){
	var expr = recurse(rel.params[0])
	var nameExpr = recurse(rel.params[1])//TODO optimize case where nameExpr is static
	
	if(nameExpr.isStatic){
	
		var name = nameExpr()
		
		//var getObjectType = 
		var byCode =  s.schema._byCode
		
		function staticNameFunc(bindings){
			var id = expr(bindings)
		
			if(id === undefined){
				//console.log('isa undefined -> false')		
				return
			}
		
			var objSchema = byCode[s.objectState.getObjectType(id)]

			var result = objSchema.name === name || (objSchema.superTypes && objSchema.superTypes[name])
			result = !!result
			//console.log('isa ' + id + ','+name + ' ' + result + ' (' + objSchema.name + ')')
			return result
		}
		staticNameFunc.specializeByType = function(typeBindings){
			var newExpr = expr.specializeByType(typeBindings)
			//var newNameExpr = nameExpr.specializeByType(typeBindings)
			if(newExpr !== expr){
				if(newExpr.resultType && newExpr.resultType.object){
				
					_.errout('TODO')
				}
			}
		}
		return staticNameFunc
	}else{
	
		function variableNameFunc(bindings){
			var id = expr(bindings)
		
			if(id === undefined){
				//console.log('isa undefined -> false')		
				return
			}

			var name = nameExpr(bindings)
		
			var objSchema = s.schema._byCode[s.objectState.getObjectType(id)]

			var result = objSchema.name === name || (objSchema.superTypes && objSchema.superTypes[name])
			result = !!result
			//console.log('isa ' + id + ','+name + ' ' + result + ' (' + objSchema.name + ')')
			return result
		}
		variableNameFunc.specializeByType = function(typeBindings){
			var newExpr = expr.specializeByType(typeBindings)
			var newNameExpr = nameExpr.specializeByType(typeBindings)
			if(newExpr !== expr || newNameExpr !== nameExpr){
				if(newNameExpr.isStatic && newExpr.resultType && newExpr.resultType.object){
				
					_.errout('TODO')
				}
			}
		}
		return variableNameFunc
	}
}
