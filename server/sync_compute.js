
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
	
	
	
	if(impl.isIndexFunction){
		var nameStr = 'compute'+impl.minParams
		impl[nameStr] = impl.func
	}else{
		//console.log(impl)
		if(!_.isFunction(impl.computeSync)) _.errout('missing computeSync: ' + impl.callSyntax)
	}
	
	var func = makeFunc(s, rel, impl, paramRels)
	if(impl.isIndexFunction){
		var listeners = []
		func.index = impl.func.index
		//console.log('setting func.index to ' + impl.func.index)
		/*
		func.index = {
			listen: function(cb){
				if(listeners.length === 0){
					startListening()
				}
				listeners.push(cb)
			},
			reverse: function(){
				//_.errout('TODO?')
				//if(!reversed) makeReversed()
				//return reversed
				_.errout('TODO?')
			}
		}
		*/
	}
	return func
}

function makeFunc(s, rel, impl, paramRels){

	var z
	
	function setupZ(){
		z = {//TODO deprecate & remove
			schemaType: rel.schemaType,
			objectState: s.objectState,
			schema: s.schema
		}
	}
	s.after(setupZ)

	if(paramRels.length === 0){
		var compute = impl.computeSync
		if(impl.compute0){
			compute = impl.compute0
			return compute
		}else{
			function compute0(bindings){
				return compute(z)
			}
			compute0.resultType = rel.schemaType
			return compute0
		}
	}if(paramRels.length === 1){
		var paramRel = paramRels[0]
		var compute = impl.computeSync
		if(impl.compute1){
			compute = impl.compute1
			function compute1Fixed(bindings){
				return compute(paramRel(bindings))
			}
			return compute1Fixed
		}else{
			function compute1(bindings){
				//console.log('calling operator ' + rel.view + ' ' + JSON.stringify(cp))
				return compute(z, paramRel(bindings))
				//console.log('called operator ' + rel.view + ' ' + JSON.stringify(cp) + ' -> ' + JSON.stringify(result))
			}
			compute1.resultType = rel.schemaType
			return compute1
		}
	}else if(paramRels.length === 2){
		var pa = paramRels[0]
		var pb = paramRels[1]
		var compute = impl.computeSync
		if(impl.compute2){
			compute = impl.compute2
			function compute2Fixed(bindings){
				//console.log('calling operator ' + rel.view + ' ' + JSON.stringify(cp))
				return compute(pa(bindings), pb(bindings))
				//console.log('called operator ' + rel.view + ' ' + JSON.stringify(cp) + ' -> ' + JSON.stringify(result))
				//return result
			}
			compute2Fixed.operator = rel.view
			compute2Fixed.resultType = rel.schemaType
			return compute2Fixed
		}else{
			function compute2(bindings){
				//console.log('calling operator ' + rel.view + ' ' + JSON.stringify(cp))
				return compute(z, pa(bindings), pb(bindings))
				//console.log('called operator ' + rel.view + ' ' + JSON.stringify(cp) + ' -> ' + JSON.stringify(result))
				//return result
			}
			compute2.operator = rel.view
			compute2.resultType = rel.schemaType
			return compute2
		}
	}else if(paramRels.length === 3){
		var pa = paramRels[0]
		var pb = paramRels[1]
		var pc = paramRels[2]
		var compute = impl.computeSync
		if(impl.compute3){
			compute = impl.compute3
			function compute3Fixed(bindings){
				//console.log('calling operator ' + rel.view + ' ' + JSON.stringify(cp))

				return compute(pa(bindings), pb(bindings), pc(bindings))
			}
			compute3Fixed.operator = rel.view
			compute3Fixed.resultType = rel.schemaType
			return compute3Fixed
		}else{
			function compute3(bindings){
				//console.log('calling operator ' + rel.view + ' ' + JSON.stringify(cp))
				return compute(z, pa(bindings), pb(bindings), pc(bindings))
				//console.log('called operator ' + rel.view + ' ' + JSON.stringify(cp) + ' -> ' + JSON.stringify(result))
			}
			compute3.operator = rel.view
			compute3.resultType = rel.schemaType
			return compute3
		}
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
