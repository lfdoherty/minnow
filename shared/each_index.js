
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

function getParams(r, schema, ignorable){
	var ig = JSON.parse(JSON.stringify(ignorable||{}))
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

function getIndexes(r, param){
	if(r.type === 'view'){
		//console.log(JSON.stringify([param, r]))

		if(r.view === 'generic-index-chain') return [r]
		if(r.view === 'generic-operator-index') return [r]

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


function apply(r, schema, parent){
	if(r.type === 'view'){
		if(r.view === 'each'){
			inputParams = getParams(r.params[0], schema)
			if(inputParams.length === 1){
				var inputParam = inputParams[0]
				if(r.params[0].view === 'property' && isDirectlyParam(r.params[0].params[1], inputParam)){
					if(r.params[1].expr.view === 'generic-operator-index' && r.params[1].expr.params[0].name === r.params[1].implicits[0]){
						
						var res = {
							type: 'view',
							view: 'generic-index-chain',
							params: [
								inputParam,
								r,
								r.params[1].expr,
								r.params[0]
							],
							schemaType: r.schemaType,
							code: r.code
						}
						//console.log('res: ' + JSON.stringify(res, null, 2))
						return res
						
						//_.errout('TODO: ' + r.view + ' ' + r.params[1].expr.view + ' ' + JSON.stringify([inputParams]))//, macroParams]))//, indexes.length]))
					}
				}
			}
			
		}
		
		r.params.forEach(function(p,i){
			if(!p){
				console.log(JSON.stringify(r, null, 2))
				_.errout('null param')
			}
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

