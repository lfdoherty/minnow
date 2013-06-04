
var _ = require('underscorem')


function makeTypeFunction(s, staticBindings, rel, recurse, paramFunc){
	//if(paramFunc.isStatic && paramFunc.resultType){
	if(!paramFunc.resultType) _.errout('missing resultType: ' + paramFunc)
	
	//console.log('resultType: ' + JSON.stringify(paramFunc.resultType))
	
	var resultObjSchema = s.schema[paramFunc.resultType.object]
	if(resultObjSchema && !resultObjSchema.subTypes){
		var staticTypeNameValue = resultObjSchema.name
		function staticTypeNameFunc(){return staticTypeNameValue;}
		staticTypeNameFunc.isStatic = true
		//console.log('DID IT: ' + staticTypeNameValue)
		return staticTypeNameFunc
		/*return function(bindings){
			var v = paramFunc(bindings)
			var res
			if(v !== undefined){
				var typeCode = s.objectState.getObjectType(v)
				res = s.schema._byCode[typeCode].name
			}
			if(staticTypeNameValue !== res){
				if(v.inner){
					console.log(v.top + ' top ' + s.schema._byCode[s.objectState.getObjectType(v.top)].name)
					console.log(v.inner + ' inner ' + s.schema._byCode[s.objectState.getObjectType(v.inner)].name)
				}
				_.errout('error: ' + v + ' ' + staticTypeNameValue + ' !== ' + res + ' ' + JSON.stringify(resultObjSchema))
			}
			return res
		}*/
		
	}/*else{
		if(resultObjSchema){
			console.log('could be: ' + JSON.stringify(resultObjSchema.subTypes))
		}else{
			console.log('any *: ' + JSON.stringify(paramFunc.resultType))
		}
	}*/

	function typeFunc(bindings){
		var v = paramFunc(bindings)
		if(v !== undefined){
			var typeCode = s.objectState.getObjectType(v)
			return s.schema._byCode[typeCode].name
		}
	}
	typeFunc.specializeByType = function(typeBindings){
		if(paramFunc.specializeByType){
			var newParamFunc = paramFunc.specializeByType(typeBindings)
			return makeTypeFunction(s, staticBindings, rel, recurse, newParamFunc)
		}
		return typeFunc
	}
	typeFunc.resultType = {type: 'primitive', primitive: 'string'}
	return typeFunc
}

exports.make = make

function make(s, staticBindings, rel, recurse){
	var paramFunc = recurse(rel.params[0])
	return makeTypeFunction(s, staticBindings, rel, recurse, paramFunc)
}
