
var _ = require('underscorem')

var schemaModule = require('./../shared/schema')

exports.make = make

function make(s, staticBindings, rel, recurse){
	var impl = schemaModule.getImplementation(rel.view)
	_.assertDefined(impl)
	var paramRels = []
	//console.log(JSON.stringify(rel, null, 2))
	for(var i=0;i<rel.params.length;++i){
		var p = rel.params[i]
		var pr = recurse(p)//recurseSync(p)
		//console.log(JSON.stringify(p))
		if(p.schemaType === undefined) _.errout('missing schemaType: ' + JSON.stringify(p))
		_.assertObject(p.schemaType)
		pr.schemaType = p.schemaType
		paramRels.push(pr)
	}
	
	var z
	
	function setupZ(){
		z = {//TODO deprecate & remove
			schemaType: rel.schemaType,
			objectState: s.objectState,
			schema: s.schema
		}
	}
	s.after(setupZ)
	
	if(!_.isFunction(impl.computeSync)) _.errout('missing computeSync: ' + impl.callSyntax)
	
	//handle = makeOperatorRelSync(s, rel, paramRels, impl, rel.view, ws, recurseSync, staticBindings)
	if(paramRels.length === 1){
		var paramRel = paramRels[0]
		var compute = impl.computeSync
		function compute1(bindings){
			//console.log('calling operator ' + rel.view + ' ' + JSON.stringify(cp))
			return compute(z, paramRel(bindings))
			//console.log('called operator ' + rel.view + ' ' + JSON.stringify(cp) + ' -> ' + JSON.stringify(result))
			//return result
		}
		compute1.resultType = rel.schemaType
		return compute1
	}else if(paramRels.length === 2){
		var pa = paramRels[0]
		var pb = paramRels[1]
		var compute = impl.computeSync
		function compute2(bindings){
			//console.log('calling operator ' + rel.view + ' ' + JSON.stringify(cp))
			return compute(z, pa(bindings), pb(bindings))
			//console.log('called operator ' + rel.view + ' ' + JSON.stringify(cp) + ' -> ' + JSON.stringify(result))
			//return result
		}
		compute2.operator = rel.view
		return compute2
	}else{
		return function(bindings){
			//_.errout('TODO: ' + JSON.stringify(rel))
			var cp = [z]
			for(var index=0;index<paramRels.length;++index){
				var pr = paramRels[index]
				var f = pr(bindings)
				cp[index+1] = f
			}
		
			//console.log('calling operator ' + rel.view + ' ' + JSON.stringify(cp))
			var result = impl.computeSync.apply(undefined, cp)
			//console.log('called operator ' + rel.view + ' ' + JSON.stringify(cp) + ' -> ' + JSON.stringify(result))
			return result
		}
	}
}
