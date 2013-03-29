
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

function applySubsetOptimizationToView(r){
	if(r.type === 'view'){
		//console.log('here: ' + JSON.stringify(r))
		if(r.view === 'each' && r.params[1].expr.view === 'filter'){
			var expr = r.params[1].expr.params[1]
			var implicits = r.params[1].implicits

			//check that the input set is not param-dependent!
			if(r.params[0].type === 'typeset'){//TODO generalize this a bit
			
				if(expr.view === 'eq'){
					if(expr.params[0].view === 'property' && expr.params[0].params[1].name === implicits[0] && expr.params[1].type === 'param'){
						return applySubsetOptimization(r, implicits[0], expr.params[0], expr.params[1])
					}else if(expr.params[1].view === 'property' && expr.params[1].params[1].name === implicits[0] && expr.params[0].type === 'param'){
						return applySubsetOptimization(r, implicits[0], expr.params[1], expr.params[0])
					}else{
						//console.log('cannot optimize: ' + JSON.stringify(expr))
					}
				}
			}
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

function applySubsetOptimization(r, implicit, macroPropertyExpr, externalParamExpr){
	//console.log(JSON.stringify(r, null, 2))
	
	var implicitA = 'combo_'+Math.random()
	var reduceImplicits = ['reduce_'+Math.random(), 'reduce_'+Math.random()]
	return {
		type: 'view',
		view: 'subset-optimization-with-params', 
		params: [
			{type: 'macro', 
				expr: {type: 'param', name: implicitA, schemaType: r.schemaType}, 
				implicits: [implicitA], 
				manyImplicits: 1, 
				schemaType: r.schemaType
			},//combination macro
			externalParamExpr,
			{type: 'view', view: 'multimap', 
				isSubsetOptimizationMultimap: true,
				params: [
					r.params[0],
					{type: 'macro', expr: macroPropertyExpr, implicits: [implicit], manyImplicits: 1, 
						schemaType: macroPropertyExpr.schemaType},
					{type: 'macro', 
						expr: {
							type: 'param', 
							name: implicit, 
							schemaType: r.schemaType.members
						}, 
						implicits: [implicit], 
						manyImplicits: 1, 
						schemaType: r.schemaType.members
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
						manyImplicits: 2,
						schemaType: r.schemaType
					}
				],
				schemaType: {
					type: 'map',
					key: macroPropertyExpr.schemaType,
					value: r.params[0].schemaType.members
				} 
			}
		],
		schemaType: r.schemaType,
		code: r.code
	}
	//_.errout('TODO')
}
