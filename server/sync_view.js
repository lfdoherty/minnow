
var _ = require('underscorem')

var schemaModule = require('./../shared/schema')

var syncProperty = require('./sync_property')
var syncSwitch = require('./sync_switch')
var syncPreforked = require('./sync_preforked')

var syncMultimapOptimization = require('./sync_multimap_optimization')
var mapValueOptimization = require('./sync_map_value_optimization')

var opu = require('./oputil')

var nvs = require('./new_view_sequencer')

function shallowCopy(b){
	var keys = Object.keys(b)
	var nb = {}
	for(var i=0;i<keys.length;++i){
		var k = keys[i]
		nb[k] = b[k]
	}
	return nb
}


exports.makeRelFunction = function(s, staticBindings, rel){
	_.assertLength(arguments, 3)
	_.assertObject(s)
	_.assertObject(s.schema)

	function recurse(rel, newStaticBindings){
		var st = staticBindings
		if(newStaticBindings){
			st = _.extend({}, staticBindings, newStaticBindings)
		}
		return exports.makeRelFunction(s, st, rel)
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
	/*function setupZ(){
		_.assertDefined(s.objectState)
		z = {
			schema: s.schema,
			objectState: s.objectState,
		}
	}*/

	//var ns = _.extend({}, s)
	//ns.recurse = recurse
	
	if(rel.type === 'view'){
	
		if(s.schema[rel.view]){
			//_.errout('TODO: make view object: ' + JSON.stringify(rel))
			var paramFuncs = []
			var viewSchema = s.schema[rel.view]
			if(viewSchema.isView){
				rel.params.forEach(function(p, index){
					paramFuncs.push(recurse(p))
				})
				var typeCode = viewSchema.code
				return function(bindings){
					var paramValues = []
					for(var i=0;i<paramFuncs.length;++i){
						var pv = paramFuncs[i](bindings)
						paramValues.push(pv)//TODO test creating view with multiple params
					}
					//var mutatorKey = bindings.__mutatorKey
					var viewId = nvs.viewIdStr(typeCode, paramValues)//, mutatorKey)
					//_.errout('TODO: make view id: ' + JSON.stringify(paramValues))
					//console.log('made view id: ' + viewId + ' ' + rel.view)
					return viewId
				}
			}else{
				var expr = recurse(rel.params[0])
				return function(bindings){
					//console.log('selecting object')
					return expr(bindings)
				}
			}
		}else if(rel.view === 'typeset'){
			
			var typeName = rel.params[0].value
			_.assertString(typeName)
			var typeCode = s.schema[typeName].code
			
			return function(){
				var ids = s.objectState.getAllIdsOfType(typeCode)
				_.assertDefined(ids)
				return [].concat(ids)
			}
		}else if(rel.view === 'count' && rel.params[0].view === 'typeset'){
			var ts = rel.params[0]
			var typeName = ts.params[0].value
			_.assertString(typeName)
			var typeCode = s.schema[typeName].code
			
			return function(){
				var count = s.objectState.getManyOfType(typeCode)
				return count
			}
		}else if(rel.view === 'property'){
			if(rel.params[0].value === 'id'){
				var context = recurse(rel.params[1])
				var inputType = rel.params[1].schemaType
				if(inputType.type === 'set' || inputType.type === 'list'){
					return function(bindings){
						var ids = context(bindings)
						var res = []
						for(var i=0;i<ids.length;++i){
							res.push(ids[i]+'')
						}
						return res
					}
				}else{
					return function(bindings){
						var id = context(bindings)
						if(id) return ''+id
					}
				}
			}else if(rel.params[0].value === 'uuid'){
				var context = recurse(rel.params[1])
				var inputType = rel.params[1].schemaType
				if(inputType.type === 'set' || inputType.type === 'list'){
					return function(bindings){
						var ids = context(bindings)
						if(ids){
							var res = []
							for(var i=0;i<ids.length;++i){
								res.push(s.objectState.getUuid(ids[i]))
							}
							return res
						}else{
							return []
						}
					}
				}else{
					return function(bindings){
						var id = context(bindings)
						if(id){
							return s.objectState.getUuid(id)
						}
					}
				}
			}else{
				return syncProperty.make(s, staticBindings, rel, recurse)
			}
		}else if(rel.view === 'switch'){
			return syncSwitch.make(s, staticBindings, rel, recurse)
		}else if(rel.view === 'type'){
			//return syncSwitch.make(ns, staticBindings, rel)
			var paramFunc = recurse(rel.params[0])
			return function(bindings){
				var v = paramFunc(bindings)
				if(v !== undefined){
					var typeCode = s.objectState.getObjectType(v)
					return s.schema._byCode[typeCode].name
				}
			}
		}else if(rel.view === 'preforked'){
			//_.errout('TODO')
			return syncPreforked.make(s, staticBindings, rel, recurse)
			
		}else if(rel.view === 'mutate'){
			//_.errout('TODO')

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
			
			function mutateBindings(bindings){
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
			}
			
			return function(bindings){
				return rest(mutateBindings(bindings))
			}
			
		}else if(rel.view === 'isa'){
			
			var expr = recurse(rel.params[0])
			var nameExpr = recurse(rel.params[1])//TODO optimize case where nameExpr is static
			
			return function(bindings){
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
		}else if(rel.view === 'multimap' && rel.isSubsetOptimizationMultimap){

			return syncMultimapOptimization.make(s, rel, recurse, staticBindings)
			//_.errout('TODO')
		}else if(rel.view === 'mapValue'){
			return mapValueOptimization.make(s, rel, recurse, staticBindings)
		}else{
		
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
			
			if(!_.isFunction(impl.computeSync)) _.errout('missing computeSync: ' + impl.callSyntax)
			
			//handle = makeOperatorRelSync(s, rel, paramRels, impl, rel.view, ws, recurseSync, staticBindings)
			if(paramRels.length === 1){
				var paramRel = paramRels[0]
				var compute = impl.computeSync
				return function(bindings){
					//console.log('calling operator ' + rel.view + ' ' + JSON.stringify(cp))
					return compute(z, paramRel(bindings))
					//console.log('called operator ' + rel.view + ' ' + JSON.stringify(cp) + ' -> ' + JSON.stringify(result))
					//return result
				}
			}else if(paramRels.length === 2){
				var pa = paramRels[0]
				var pb = paramRels[1]
				var compute = impl.computeSync
				return function(bindings){
					//console.log('calling operator ' + rel.view + ' ' + JSON.stringify(cp))
					return compute(z, pa(bindings), pb(bindings))
					//console.log('called operator ' + rel.view + ' ' + JSON.stringify(cp) + ' -> ' + JSON.stringify(result))
					//return result
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
	}else if(rel.type === 'value'){
		return function(){return rel.value}
	}else if(rel.type === 'int'){
		return function(){return rel.value}
	}else if(rel.type === 'param'){
		var bindingKey = rel.name
		return function(bindings){
			var v = bindings[bindingKey]
			//console.log('got param ' + rel.name + ': ' + v)
			return v
			//_.errout('TODO: ' + JSON.stringify([bindings, rel]))
		}
	}else if(rel.type === 'macro'){
		var exprFunc = recurse(rel.expr)
		var merger = opu.makeMerger(rel.schemaType)
		if(rel.manyImplicits === 1){
			var implicit = rel.implicits[0]
			return function(bindings){
				var newBindings = shallowCopy(bindings)
				var handle = {
					get: function(v){
						//var newBindings = shallowCopy(bindings)
					
						newBindings[implicit] = v
						//newBindings.__key = bindings.__key+'_'+v
						//console.log('mutatorKey: ' + this.bindings.__mutatorKey)
		
						var result = exprFunc(newBindings)//, this.editId)
						//console.log('macro get ' + v + ' -> ' + JSON.stringify(result))
						return result
					},
					getArray: function(arr){
						return handle.get(arr[0])
					},
					mergeResults: merger
				}
				return handle
			}
		}else if(rel.manyImplicits === 2){
			var implicitA = rel.implicits[0]
			var implicitB = rel.implicits[1]
			return function(bindings){
				var newBindings = _.extend({}, bindings)
				var handle = {
					get: function(a, b){
					
						newBindings[implicitA] = a
						newBindings[implicitB] = b
						//newBindings.__key = bindings.__key+'_'+a+':'+b
						//console.log('mutatorKey: ' + this.bindings.__mutatorKey)
		
						var result = exprFunc(newBindings)//, this.editId)
						//console.log('macro get ' + a+','+b + ' -> ' + JSON.stringify(result))
						return result
					},
					getArray: function(arr){
						return handle.get(arr[0], arr[1])
					},
					mergeResults: merger
				}
				return handle
			}
		}else{
			_.errout('tODO: ' + rel.manyImplicits + ' ' + JSON.stringify(rel))
		}
	}else if(rel.type === 'let'){
		var expr = recurse(rel.expr)
		//var newStaticBindings = {}
		//newStaticBindings[rel.name] = expr
		var rest = recurse(rel.rest)//, newStaticBindings)
		
		return function(bindings){
			var newBindings = _.extend({}, bindings)
			newBindings[rel.name] = expr(bindings)
			return rest(newBindings)
		}
		//return rest
	}else if(rel.type === 'nil'){
		return function(){}
	}
	
	_.errout('TODO: ' + JSON.stringify(rel))
}
