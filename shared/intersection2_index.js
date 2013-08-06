
var _ = require('underscorem')

exports.apply = function(view, schema){
	_.each(view, function(v, viewName){
		if(v.schema){
			_.each(v.rels, function(rel, relName){
				var newRel = v.rels[relName] = apply(rel, schema)
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
		var can = true
		r.params.forEach(function(p,i){
			can = can && canIndex(p, schema, ownParam)
		})
		return can
		
	}else if(r.type === 'let'){
		return canIndex(r.expr, schema, ownParam) && canIndex(r.rest, schema, ownParam)
	}else if(r.type === 'macro'){

		return canIndex(r.expr, schema, ownParam)
	}else if(r.type === 'param'){

	}
	return true
}

function getIndexes(r, param){
	if(r.type === 'view'){

		if(r.view === 'generic-index-chain') return [r]

		if(r.view === 'property'){
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

function apply(r, schema, parent){
	if(r.type === 'view'){

		if(r.view === 'intersection' && r.params.length === 2 && r.params[0].params && r.params[0].params[0] && r.params[1].params && r.params[1].params[0]){
			
			var paramOne
			var paramTwo

			var indexOne
			var indexTwo
			
			if(r.params[0].params[0].view === 'reducing-index' || r.params[0].params[0].isSubsetOptimizationMultimap){
				paramOne = r.params[0].params[1]
				indexOne = r.params[0].params[0]
			}else if(r.params[0].view === 'generic-operator-index'){
				paramOne = r.params[0].params[0]
				indexOne = r.params[0]
			}
			
			if(r.params[1].params[0].view === 'reducing-index' || r.params[1].params[0].isSubsetOptimizationMultimap){
				paramTwo = r.params[1].params[1]
				indexTwo = r.params[1].params[0]
			}else if(r.params[1].view === 'generic-operator-index'){
				paramTwo = r.params[1].params[0]
				indexTwo = r.params[1]
			}
			
			
			/*if((r.params[0].params[0].view === 'reducing-index' || r.params[0].params[0].isSubsetOptimizationMultimap || r.param) &&
				(r.params[1].params[0].view === 'reducing-index' || r.params[1].params[0].isSubsetOptimizationMultimap || )
				){*/
			if(paramOne && paramTwo){

				return {
					type: 'view',
					view: 'intersection2-index',
					params: r.params.concat([
						paramOne, paramTwo,//r.params[0].params[1], r.params[1].params[1],
						indexOne, indexTwo
						//r.params[0].params[0],
						//r.params[1].params[0]
						]),
					schemaType: r.schemaType,
					code: r.code
				}

			}

		}

		r.params.forEach(function(p,i){
			r.params[i] = apply(p, schema, r)
		})
	}else if(r.type === 'let'){
		r.expr = apply(r.expr, schema)
		r.rest = apply(r.rest, schema)
	}else if(r.type === 'macro'){
		r.expr = apply(r.expr, schema)
	}else if(r.type === 'param' || r.type === 'value' || r.type === 'int' || r.type === 'nil'){
		//do nothing
	}
	return r
}

