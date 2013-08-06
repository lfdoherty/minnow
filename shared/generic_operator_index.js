
var _ = require('underscorem')

exports.apply = function(view, schema){
	_.each(view, function(v, viewName){
		if(v.schema){
			_.each(v.rels, function(rel, relName){
				var newRel = v.rels[relName] = applyGenericOperatorIndex(rel, schema)
			})
		}
	})
}

function replaceExpr(r, expr){
	if(r === expr) return expr
	else if(r.type === 'view'){
		for(var i=0;i<r.params.length;++i){
			r.params[i] = replaceExpr(r.params[i], expr)
		}
	}else if(r.type === 'let'){
		r.expr = replaceExpr(r.expr, expr)
		r.rest = replaceExpr(r.rest, expr)
	}else if(r.type === 'macro'){
		r.expr = replaceExpr(r.expr, expr)
	}
	return r
}

function combineParams(a,b){
	var has = {}
	a.forEach(function(v){
		has[v.name] = true
	})
	var res = [].concat(a)
	b.forEach(function(v){
		if(has[v.name]) return
		res.push(v)
	})
	return res
}

function shallowCopy(b){
	var keys = Object.keys(b)
	var nb = {}
	for(var i=0;i<keys.length;++i){
		var k = keys[i]
		nb[k] = b[k]
	}
	return nb
}

function getParams(r, schema, ignorable){
	var ig = shallowCopy(ignorable||{})//JSON.parse(JSON.stringify(ignorable||{}))
	if(r.type === 'view'){
		if(r.view === 'generic-index-chain'){
			return [r.params[0]]
		}
		//if(r.view === 'computeCounts') _.errout(JSON.stringify(r))
		if(r.view === 'typeset' || (r.schemaType && r.schemaType.type === 'view') || r.view === 'traverse'){
			return ['bad', 'bad']
		}
		var params = []
		r.params.forEach(function(p,i){
			params = combineParams(params, getParams(p, schema, ig))
		})
		//console.log(JSON.stringify([r.view, params]))
		return params
	}else if(r.type === 'let'){
		return combineParams(getParams(r.expr, schema, ig), getParams(r.rest, schema, ig))
	}else if(r.type === 'macro'){
		r.implicits.forEach(function(m){
			ig[m] = true
		})
		return getParams(r.expr, schema, ig)
	}else if(r.type === 'param'){
		//console.log('found param')
		//console.log(new Error().stack)
		if(ig[r.name]){
			//console.log('ignoring local param: ' + r.name)
		}else{
			return [r]
		}
	}else if(r.type === 'value' || r.type === 'int' || r.type === 'nil'){
	}else{
		_.errout('TODO')
	}
	return []
}

function isDirectlyParam(r, p){
	if(r.name === p.name) return true
	else if(r.view === 'cast') return isDirectlyParam(r.params[1], p)
	return false
}

function canIndex(r, schema, ownParam){
	if(r.type === 'view'){
	
		if(r.view === 'generic-index-chain' && ownParam.name === r.params[0].name) return true
	
		if(r.view === 'property'){
			if(!isDirectlyParam(r.params[1], ownParam)) return false
			return true
		}
		
		/*if(r.isReductionIndex){
			return canIndex(r.params[0], schema, ownParam)
		}*/
		
		var can = true
		r.params.forEach(function(p,i){
			//params = combineParams(params, getParams(p, schema, ig))
			can = can && canIndex(p, schema, ownParam)
		})
		return can
		
	}else if(r.type === 'let'){
		return canIndex(r.expr, schema, ownParam) && canIndex(r.rest, schema, ownParam)//getParams(r.expr, schema, ig), getParams(r.rest, schema, ig))
	}else if(r.type === 'macro'){
		/*r.implicits.forEach(function(m){
			ig[m] = true
		})
		return getParams(r.expr, schema, ig)*/
		return canIndex(r.expr, schema, ownParam)
	}else if(r.type === 'param'){
		//console.log('found param')
		//console.log(new Error().stack)
		/*if(ig[r.name]){
			//console.log('ignoring local param: ' + r.name)
		}else{
			return [r]
		}*/
	}
	return true
}
/*
function getAnyIndex(r){
	if(r.type === 'view'){
		if(r.view === 'property'){// && r.params[1].name === param.name){
			return [r]
		}else{
			//console.log(JSON.stringify(r))
			var indexes = []
			r.params.forEach(function(p,i){
				indexes = indexes.concat(getAnyIndex(p))
			})
			return indexes
		}
	}else if(r.type === 'param'){
		return []
	}else if(r.type === 'value' || r.type === 'int' || r.type === 'nil'){
		return []
	}else{
		_.errout('TODO')
	}
}
*/
function getIndexes(r, param){
	if(r.type === 'view'){
		//console.log(JSON.stringify([param, r]))

		if(r.view === 'generic-index-chain' || r.isIndex) return [r]
		
		/*if(r.isReductionIndex){
			return getAnyIndex(r.params[1].expr).concat(getIndexes(r.params[0], param))
		}*/

		if(r.view === 'property'){// && r.params[1].name === param.name){
			//console.log('found index: ' + r.params[0].value)
			return [r]
		}else{
			//console.log(JSON.stringify(r))
			var indexes = []
			r.params.forEach(function(p,i){
				indexes = indexes.concat(getIndexes(p, param))
			})
			return indexes
		}
	}else if(r.type === 'let'){
		return getIndexes(r.expr, param).concat(getIndexes(r.rest, param))
	}else if(r.type === 'macro'){
		return getIndexes(r.expr, param)
	}else if(r.type === 'param'){
		//if(r.name !== param.name) throw new Error('found different param: ' + r.name)
		return []
	}else if(r.type === 'value' || r.type === 'int' || r.type === 'nil'){
		return []
	}else{
		_.errout('TODO')
	}
}
/*
function shouldIndex(r){//TODO set up with .heavy = true config of impls, then start using
	if(r.type === 'view'){
		if(r.view === 'typeset'){
			return false
		}else if(r.view === 'each' || r.view === 'map' || r.view === 'eachReduce'){
			return true
		}
		var should = false
		r.params.forEach(function(p){
			should = should || shouldIndex(p)
		})
	}else if(r.type === 'let'){
		return shouldIndex(r.expr, param) || shouldIndex(r.rest)
	}else if(r.type === 'macro'){
		return shouldIndex(r.expr, param)
	}else if(r.type === 'param'){
		return false
	}else if(r.type === 'value' || r.type === 'int' || r.type === 'nil'){
		return false
	}else{
		_.errout('TODO')
	}
}*/

function applyGenericOperatorIndex(r, schema, parent){
	if(r.type === 'view'){

		if(r.view === 'reducing-index') return r

		if( r.view !== 'case' && r.view !== 'default' && //do not break switch statements
			r.view !== 'map' && r.view !== 'multimap'// do not break mapValue(map()) exprs
			&& r.view !== 'mapValue'
			&& r.view !== 'property' //no point wrapping a redundant index
			&& r.view !== 'cast' //no point TODO flip this to an explicit "heavy" tag that causes indexing
			&& r.view !== 'type' //not worth it
			&& r.view !== 'timestamp' //not worth it
			&& r.view !== 'list' //not worth it
			&& r.view !== 'isa' //not worth it
			&& r.view !== 'not' //not worth it
			&& r.view !== 'generic-operator-index' //obv
			&& (!parent || parent.view !== 'generic-operator-index') //obv
			&& !schema[r.view] //don't index object(id) lookups - they're a no-op anyway
			){

			var params = getParams(r, schema)
			//console.log(r.view + ' ' + JSON.stringify(params))
			//if(r.view !== 'property' || r.params[1] !== params[0]){
				if(params.length === 1){
				
					if(canIndex(r, schema, params[0])){
						//console.log('cannot index: ')
						//if(r.view === 'tokenizeAndStemText') _.errout('TODO: ' + JSON.stringify(r, null, 2))
						//return r
					
				
						var indexExprs = getIndexes(r, params[0])
						var res = {
							type: 'view',
							view: 'generic-operator-index',
							params: [
								params[0],
								r
							].concat(indexExprs),
							schemaType: r.schemaType,
							code: r.code
						}
						//console.log('res: ' + JSON.stringify(res, null, 2))
						return res
					}
				}else if(params.length > 1 && r.params.length === 1 && r.params[0].view === 'property'){//there are multiple params in use, but they can be reduced to a single param via a 'let' externalization
				
					var name = 'extracted_for_goi_'+Math.random()
					var expr = r.params[0].params[1]
					var newParam = {type: 'param', name: name, schemaType: expr.schemaType, was: expr}
					
					var newPropertyExpr = {
						type: 'view',
						view: 'property',
						params: [
							r.params[0].params[0],
							newParam
						],
						schemaType: r.schemaType
					}
					
					var res = {
						type: 'let',
						//view: 'let',
						expr: expr,
						rest: {
							type: 'view',
							view: 'generic-operator-index',
							params: [
								newParam,
								{
									type: 'view',
									view: r.view,
									params: [newPropertyExpr],
									schemaType: r.schemaType
								},
								newPropertyExpr
							]
						},
						name: name,
						schemaType: r.schemaType,
						code: r.code
					}
					
					//res.expr = applyGenericOperatorIndex(res.expr, schema)//?
					
					return res
				}
			//}
		}
		
		if(r.view === 'tokenizeAndStemText') _.errout('TODO: ' + JSON.stringify(r, null, 2))

		if(r.view === 'generic-operator-index') return r
		
		r.params.forEach(function(p,i){
			r.params[i] = applyGenericOperatorIndex(p, schema, r)
		})
	}else if(r.type === 'let'){
		r.expr = applyGenericOperatorIndex(r.expr, schema)
		r.rest = applyGenericOperatorIndex(r.rest, schema)
	}else if(r.type === 'macro'){
		r.expr = applyGenericOperatorIndex(r.expr, schema)
	}else if(r.type === 'param' || r.type === 'value' || r.type === 'int' || r.type === 'nil'){
		//do nothing

	}
	if(r.view === 'tokenizeAndStemText') _.errout('TODO: ' + JSON.stringify(r, null, 2))
	return r
}

