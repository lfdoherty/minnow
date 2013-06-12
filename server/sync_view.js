
var _ = require('underscorem')

var schemaModule = require('./../shared/schema')

var syncProperty = require('./sync_property')
var syncSwitch = require('./sync_switch')
var syncPreforked = require('./sync_preforked')

var syncMultimapOptimization = require('./sync_multimap_optimization')
var mapValueOptimization = require('./sync_map_value_optimization')

var syncCompute = require('./sync_compute')
var syncIsa = require('./sync_isa')
var syncMutate = require('./sync_mutate')
var syncType = require('./sync_type')

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
		}else if(rel.view === 'object'){
			var expr = recurse(rel.params[0])
			return expr
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
			return syncType.make(s, staticBindings, rel, recurse)
		}else if(rel.view === 'preforked'){
			//_.errout('TODO')
			return syncPreforked.make(s, staticBindings, rel, recurse)
			
		}else if(rel.view === 'mutate'){
			//_.errout('TODO')

			return syncMutate.make(s, staticBindings, rel, recurse)
			
		}else if(rel.view === 'isa'){
			
			return syncIsa.make(s, staticBindings, rel, recurse)
		}else if(rel.view === 'multimap' && rel.isSubsetOptimizationMultimap){

			return syncMultimapOptimization.make(s, rel, recurse, staticBindings)
			//_.errout('TODO')
		}else if(rel.view === 'mapValue'){
			return mapValueOptimization.make(s, rel, recurse, staticBindings)
		}else{
		
			return syncCompute.make(s, staticBindings, rel, recurse)
		}
	}else if(rel.type === 'value'){
		function valueFunc(){return rel.value}
		valueFunc.isStatic = true
		return valueFunc
	}else if(rel.type === 'int'){
		function intFunc(){return rel.value}
		intFunc.isStatic = true
		return intFunc
	}else if(rel.type === 'param'){

		var bindingKey = rel.name
		function paramFunc(bindings){
			var v = bindings[bindingKey]
			//console.log('got param ' + rel.name + ': ' + v)
			return v
			//_.errout('TODO: ' + JSON.stringify([bindings, rel]))
		}
		paramFunc.specializeByType = function(typeBindings){
			function nf(bindings){
				var v = bindings[bindingKey]
				//console.log('got param ' + rel.name + ': ' + v)
				//console.log('found type bindings for param: ' + v + ' ' + bindingKey + ' ' + JSON.stringify(typeBindings[bindingKey]))
				return v
			}
			if(typeBindings[bindingKey]){
				//console.log('found type bindings for param: ' + bindingKey + ' ' + JSON.stringify(typeBindings[bindingKey]))
				nf.resultType = typeBindings[bindingKey]
				return nf
			}//else{
			//	console.log('wrong type bindings for param')
			//}
			return paramFunc
		}
		paramFunc.resultType = rel.schemaType
		return paramFunc
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
			/*var newBindings = shallowCopy(bindings)
			newBindings[rel.name] = expr(bindings)
			return rest(newBindings)*/
			bindings[rel.name] = expr(bindings)
			return rest(bindings)
		}
		//return rest
	}else if(rel.type === 'nil'){
		function nilFunc(){}
		nilFunc.isStatic = true
		nilFunc.isNil = true
		return nilFunc
	}
	
	_.errout('TODO: ' + JSON.stringify(rel))
}
