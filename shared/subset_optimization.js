
var _ = require('underscorem')

exports.apply = function(view){
	_.each(view, function(v, viewName){
		if(v.schema){
			_.each(v.rels, function(rel, relName){
				var newRel = v.rels[relName] = applySubsetOptimizationToView(rel)
			})
		}
	})
}

function wrapInputExprInNot(inputExpr, p){
	var inputImplicit = 'inputop_'+Math.random()
	var inputParam = {
		type: 'param',
		name: inputImplicit,
		schemaType: inputExpr.schemaType.members
	}
	var bindingsUsed = {}
	bindingsUsed[inputImplicit] = true
	var res = {
		type: 'view',
		view: 'each',
		params: [
			inputExpr,
			{type: 'macro',
				implicits: [inputImplicit],
				schemaType: inputExpr.schemaType.members,
				bindingsUsed: bindingsUsed,
				expr: {	
					type: 'view',
					view: 'filter',
					schemaType: inputExpr.schemaType.members,
					params: [
						inputParam,
						{	type: 'view',
							view: 'not',
							schemaType: {type: 'primitive', primitive: 'boolean'},
							params: [
								{	type: 'view',
									view: 'property',
									schemaType: p.params[0].schemaType,
									params: [
										{	type: 'value',
											value: p.params[0].params[0].value
										},
										inputParam
									]
								}
							]
						}
					]
				}
			}
		],
		schemaType: inputExpr.schemaType
	}
	return res
}
function applySubsetOptimizationToView(r){
	if(r.type === 'view'){
		//console.log('here: ' + JSON.stringify(r))
		/*if(r.view === 'mutate'){
			//return r
			r.params[0] = applySubsetOptimizationToView(r.params[0])
			//TODO for now, at least, we cannot apply subset optimizations inside a mutate rest block
			return r
		}*/
		if(r.view === 'each' && r.params[1].expr.view === 'filter'){
			var expr = r.params[1].expr.params[1]
			var implicits = r.params[1].implicits

			//check that the input set is not param-dependent!
			//console.log(JSON.stringify(r.params[0]))
			if(r.params[0].view === 'typeset' || (r.params[0].was && r.params[0].was.view === 'typeset')){//TODO generalize this a bit
			
				function processEq(r, expr, cb){
					//console.log(JSON.stringify([expr.params[1].view === 'property', expr.params[1].params[1].name === implicits[0], expr.params[0].type === 'param']))
					//console.log(JSON.stringify(expr, null, 2))
					
					function isSimple(p){
						return p.type === 'param' || p.type === 'value' ||
							(p.type === 'view' && p.view === 'property' && isSimple(p.params[1]))
					}
					
					if(expr.params[0].view === 'property' && expr.params[0].params[1].name === implicits[0] && 
							//(expr.params[1].type === 'param' || expr.params[1].type === 'value')
							isSimple(expr.params[1])
							){
						return cb(expr.params[0], expr.params[1])
					}else if(expr.params[1].view === 'property' && expr.params[1].params[1].name === implicits[0] && 
							//(expr.params[0].type === 'param' || expr.params[0].type === 'value')
							isSimple(expr.params[0])
							){
						return cb(expr.params[1], expr.params[0])
					}else{
						return r
					}
				}
				
				function processNot(r, expr, cb){
					return cb(expr.params[0])
				}
				//console.log(JSON.stringify(expr))
				if(expr.view === 'eq'){
					return processEq(r, expr, function(propertyExpr, paramExpr){
						return applySingleSubsetOptimization(r, r.params[0], implicits[0], propertyExpr, paramExpr)//expr.params[1], expr.params[0])
					})
				}else if(expr.view === 'not' && expr.params[0].view === 'property' && expr.params[0].params[1].name === implicits[0]){
					return {
						type: 'view',
						view: 'mapValue',
						params: [
							makeMultimap(r, r.params[0], implicits[0], expr.params[0]),
							{type: 'value', value: false, schemaType: {type: 'primitive', primitive: 'boolean'}}
						],
						schemaType: r.schemaType,
						code: r.code
					}
				}else if(expr.view === 'and'){
					var failed = false
					var inputExpr = r.params[0]
					for(var i=0;i<expr.params.length;++i){
						var p = expr.params[i]
						if(p.view === 'eq'){
						}else if(p.view === 'not'){
						}else if(p.view === 'property'){
						}else{
							failed = true
							break
						}
					}
					if(!failed){
						var macroPropertyExprs = []
						var externalParamExprs = []
						
						for(var i=0;i<expr.params.length;++i){
							var p = expr.params[i]
							if(p.view === 'not'){

								if(p.params[0].view === 'isa'){
									macroPropertyExprs.push(p.params)
									externalParamExprs.push('not_isa')
								}else if(p.params[0].view !== 'property'){
									failed = true
									break
								}else{
									macroPropertyExprs.push(p.params[0])
									externalParamExprs.push('not')
								}
							}else if(p.view === 'property'){
								_.assertEqual(p.schemaType.primitive, 'boolean')
								macroPropertyExprs.push(p)
								externalParamExprs.push('bool')
							}else{
								var result = processEq(r, p, function(propertyExpr, paramExpr){
									macroPropertyExprs.push(propertyExpr)
									_.assertDefined(paramExpr)
									externalParamExprs.push(paramExpr)
								})
								if(result === r){
									console.log('failed to parse eq: ' + JSON.stringify(p))
									failed = true
								}
							}
						}
						if(!failed){
							//console.log(JSON.stringify(expr.params, null, 2))
							//console.log(JSON.stringify(externalParamExprs))
							//console.log(expr.params.length)
						
							return applyAndSubsetOptimization(r, inputExpr, implicits[0], macroPropertyExprs, externalParamExprs)
						}
					}
				}
			}
			//console.log('cannot optimize: ' + JSON.stringify(expr, null, 2) + '\n' + JSON.stringify(r.params[0]))
		}
		r.params.forEach(function(p,i){
			r.params[i] = applySubsetOptimizationToView(p)
		})
	}else if(r.type === 'let'){
		r.expr = applySubsetOptimizationToView(r.expr)
		r.rest = applySubsetOptimizationToView(r.rest)
	}else if(r.type === 'macro'){
		r.expr = applySubsetOptimizationToView(r.expr)
	}else if(r.type === 'param' || r.type === 'value' || r.type === 'int' || r.type === 'nil'){
		//do nothing
	}
	return r
}

function makeMultimap(r, inputExpr, implicit, macroPropertyExpr){
	var reduceImplicits = ['reduce_'+Math.random(), 'reduce_'+Math.random()]
	var bindingsUsedA = {}
	bindingsUsedA[implicit] = true
	var bindingsUsedB = {}
	bindingsUsedB[implicit] = true
	var bindingsUsedC = {}
	bindingsUsedC[reduceImplicits[0]] = true
	bindingsUsedC[reduceImplicits[1]] = true
	var map = {
		type: 'view', 
		view: 'multimap', 
		isSubsetOptimizationMultimap: true,
		params: [
			inputExpr,
			{type: 'macro', expr: macroPropertyExpr, 
				implicits: [implicit], 
				manyImplicits: 1, 
				implicitTypes: [inputExpr.schemaType.members],
				schemaType: macroPropertyExpr.schemaType,
				bindingsUsed: bindingsUsedA
			},
			{type: 'macro', 
				expr: {
					type: 'param', 
					name: implicit, 
					schemaType: r.schemaType.members
				}, 
				implicits: [implicit],
				implicitTypes: [r.schemaType.members],
				manyImplicits: 1, 
				schemaType: r.schemaType.members,
				bindingsUsed: bindingsUsedB
			},
			{type: 'macro', expr: 
				{type: 'view', view: 'union', 
					params: [
						{type: 'param', name: reduceImplicits[0], schemaType: r.schemaType},
						{type: 'param', name: reduceImplicits[1], schemaType: r.schemaType}
					],
					schemaType: r.schemaType
				},
				implicits: reduceImplicits, 
				implicitTypes: [r.schemaType,r.schemaType],
				manyImplicits: 2,
				schemaType: r.schemaType,
				bindingsUsed: bindingsUsedC
			}
		],
		schemaType: {
			type: 'map',
			key: macroPropertyExpr.schemaType,
			value: inputExpr.schemaType
		} 
	}
	return map
}
function applySingleSubsetOptimization(r, inputExpr, implicit, macroPropertyExpr, externalParamExpr){

	_.assertEqual(macroPropertyExpr.view, 'property')
	
	return {
		type: 'view',
		view: 'mapValue',
		params: [
			makeMultimap(r, inputExpr, implicit, macroPropertyExpr),
			externalParamExpr
		],
		schemaType: r.schemaType,
		code: r.code
	}
}

function getAnyIndexes(r){
	if(r.type === 'view'){
		if(r.view === 'property'){// && r.params[1].name === param.name){
			return [r]
		}else{
			//console.log(JSON.stringify(r))
			var indexes = []
			r.params.forEach(function(p,i){
				indexes = indexes.concat(getAnyIndexes(p))
			})
			return indexes
		}
	}else if(r.type === 'param'){
		return []
	}else if(r.type === 'value' || r.type === 'int' || r.type === 'nil'){
		return []
	}else{
		_.errout('TODO: ' + r.type )
	}
}
function applyAndSubsetOptimization(r, inputExpr, implicit, macroPropertyExprs, externalParamExprs){
	var comboParams = []
	var wrapParams = []
	
	var implicitName = 'reduction_'+Math.random()
	
	externalParamExprs.forEach(function(epe, index){
		var mpe = macroPropertyExprs[index]
		
		//_.assertEqual(mpe.view, 'property')
		//_.errout('TODO: ' + JSON.stringify(mpe))
		
		//in 'not' and 'bool' cases wrap in reduction operators instead of intersecting
		if(epe === 'not'){
			
			wrapParams.push({
				
					type: 'view',
					view: 'not',
					params: [{
						type: 'view',
						view: 'property',
						params: [
							mpe.params[0],
							{type: 'param', name: implicitName, schemaType: mpe.params[1].schemaType}
						],
						schemaType: mpe.schemaType	
					}],
					schemaType: {type: 'primitive', primitive: 'boolean'}
				//},
			})
			return
		}else if(epe === 'not_isa'){
			var wp = {
				
					type: 'view',
					view: 'not',
					params: JSON.parse(JSON.stringify(mpe)),/*[{
						type: 'view',
						view: 'property',
						params: [
							mpe.params[0],
							{type: 'param', name: implicitName, schemaType: mpe.params[1].schemaType}
						],
						schemaType: mpe.schemaType	
					}],*/
					schemaType: {type: 'primitive', primitive: 'boolean'}
				//},
			}
			console.log(JSON.stringify(wp, null, 2))
			wp.params[0].params[0] = {type: 'param', name: implicitName, schemaType: wp.params[0].params[0].schemaType}//mpe[1].schemaType}
			wrapParams.push(wp)
			return
		}else if(epe === 'bool'){
			
			wrapParams.push({
				type: 'view',
				view: 'property',
				params: [
					mpe.params[0],
					{type: 'param', name: implicitName, schemaType: mpe.params[1].schemaType}
				],
				schemaType: mpe.schemaType	
			})
			return
		}
	})
	
	var reducingExpr
	if(wrapParams.length > 0){
		if(wrapParams.length === 1){
			reducingExpr = wrapParams[0]
		}else if(wrapParams.length > 1){
			reducingExpr = {
				type: 'view', view: 'and',
				params: wrapParams,
				schemaType: {type: 'primitive', primitive: 'boolean'}
			}
		}
	}
	
	function applyReduction(expr){
		if(!reducingExpr) return expr
		
		return {
			type: 'view',
			view: 'reducing-index',
			params: [expr,
				{
					type: 'macro',
					expr: reducingExpr,
					name: implicitName,
					implicits: [implicitName],
					manyImplicits: 1,
					schemaType: {type: 'primitive', primitive: 'boolean'}
				}
			].concat(getAnyIndexes(reducingExpr)),
			schemaType: expr.schemaType
		}
	}

	externalParamExprs.forEach(function(epe, index){
		var mpe = macroPropertyExprs[index]
		if(epe === 'not' || epe === 'bool' || epe === 'not_isa') return
	
		comboParams.push(
			{type: 'view', view: 'mapValue', 
				params: [
					applyReduction(
						makeMultimap(r, inputExpr, implicit, mpe)
					),
					epe
				],
				schemaType: r.params[0].schemaType,
				code: r.code
			}
		)
	})
	var combination
	if(comboParams.length < 2){
		//console.log(JSON.stringify(r))
		//_.errout('cannot and less than 2 values: ' + comboParams.length)
		if(comboParams.length === 1){
			combination = comboParams[0] 
		}else{
			_.errout('cannot and less than 2 values: ' + comboParams.length)
		}
	}else{
		combination = {
			type: 'view', view: 'intersection', 
			params: comboParams,
			schemaType: r.schemaType,
			code: r.code
		}
	}
	
	//console.log(JSON.stringify(combination, null, 2))
	
	return combination
		
	/*if(comboParams.length > 1){
		var cur = combination
		wrapParams.forEach(function(wp){
			wp.params[0] = cur
			cur = wp
		})
		return cur
	}else{
	
		var acceptExpr
		if(wrapParams.length === 1){
			acceptExpr = wrapParams[0]
		}else if(wrapParams.length > 1){
			acceptExpr = {
				type: 'view', view: 'and',
				params: wrapParams,
				schemaType: {type: 'primitive', primitive: 'boolean'}
			}
		}
	
		return {
		}
	}*/
		
	//console.log(JSON.stringify(cur, null, 2))
	//return cur
}
/*
function makeSubsetOptimization(r, combinationMacro, externalParamExprs, mapExprs){
	var params = [combinationMacro]
	externalParamExprs.forEach(function(epe, index){
		params.push(epe)
		params.push(mapExprs[index])
	})
	return {
		type: 'view',
		view: 'subset-optimization-with-params', 
		params: params,
		schemaType: r.schemaType,
		code: r.code
	}
}*/

