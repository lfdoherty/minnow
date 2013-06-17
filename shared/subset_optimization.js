
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
					
					if(expr.params[0].view === 'property' && expr.params[0].params[1].name === implicits[0] && 
							(expr.params[1].type === 'param' || expr.params[1].type === 'value')){
						return cb(expr.params[0], expr.params[1])
					}else if(expr.params[1].view === 'property' && expr.params[1].params[1].name === implicits[0] && 
							(expr.params[0].type === 'param' || expr.params[0].type === 'value')){
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
					//_.errout('TODO')
					/*return processNot(r, expr, function(propertyExpr, paramExpr){
						return applySingleSubsetOptimization(r, r.params[0], implicits[0], propertyExpr, paramExpr)//expr.params[1], expr.params[0])
					})*/
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

								if(p.params[0].view !== 'property'){
									failed = true
									break
								}
								macroPropertyExprs.push(p.params[0])
								externalParamExprs.push('not')
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
function applyAndSubsetOptimization(r, inputExpr, implicit, macroPropertyExprs, externalParamExprs){
	var comboParams = []
	externalParamExprs.forEach(function(epe, index){
		var mpe = macroPropertyExprs[index]
		
		_.assertEqual(mpe.view, 'property')
		//_.errout('TODO: ' + JSON.stringify(mpe))
		if(epe === 'not'){
			comboParams.push(
				{type: 'view', view: 'mapValue', 
					params: [
						makeMultimap(r, inputExpr, implicit, mpe),
						{type: 'value', value: false, schemaType: {type: 'primitive', primitive: 'boolean'}}
					],
					schemaType: r.params[0].schemaType
				}
			)
		}else if(epe === 'bool'){
			comboParams.push(
				{type: 'view', view: 'mapValue', 
					params: [
						makeMultimap(r, inputExpr, implicit, mpe),
						{type: 'value', value: true, schemaType: {type: 'primitive', primitive: 'boolean'}}
					],
					schemaType: r.params[0].schemaType
				}
			)
		}else{
			comboParams.push(
				{type: 'view', view: 'mapValue', 
					params: [
						makeMultimap(r, inputExpr, implicit, mpe),
						epe
					],
					schemaType: r.params[0].schemaType
				}
			)
		}
	})
	if(comboParams.length < 2){
		console.log(JSON.stringify(r))
		_.errout('cannot and less than 2 values')
	}
	var combination = {
		type: 'view', view: 'intersection', 
		params: comboParams,
		schemaType: r.schemaType,
		code: r.code
	}
	return combination
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

