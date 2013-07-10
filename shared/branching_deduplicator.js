
var _ = require('underscorem')

exports.apply = function(view, schema){
	//console.log('started branching deduplicator...')
	_.each(view, function(v, viewName){
		if(v.schema){
			_.each(v.rels, function(rel, relName){
				var newRel = v.rels[relName] = apply(rel, schema)
			})
		}
	})
	//console.log('...done branching deduplicator')
}

var makeExprKey = require('./deduplicate_lets').makeExprKey

function isSimple(p){
	return p.type === 'param' || p.type === 'value' ||
		(p.type === 'view' && p.view === 'property' && isSimple(p.params[1]))
}

function getCandidates(r, schema){
	if(r.type === 'view'
		&& r.view !== 'default'
		&& r.view !== 'case'
		&& r.view !== 'cast'
		&& r.view !== 'typeset'
		&& !isSimple(r)//TODO should this be here?
	){
		var candidates = []
		candidates.push(r)
		r.params.forEach(function(p,i){
			candidates = candidates.concat(getCandidates(p, schema))
		})	
		return candidates
	}
	return []
}

function replaceExpr(r, exprs, replacingExpr){
	//if(r === expr) return replacingExpr
	for(var i=0;i<exprs.length;++i){
		var expr = exprs[i]
		if(expr === r){
			var rep = JSON.parse(JSON.stringify(replacingExpr))
			rep.code = r.code
			return rep
		}
	}
	if(r.type === 'view'){

		r.params.forEach(function(p,i){
			r.params[i] = replaceExpr(p, exprs, replacingExpr)
		})
		
	}else if(r.type === 'let'){
		r.expr = replaceExpr(r.expr, exprs, replacingExpr)
		r.rest = replaceExpr(r.rest, exprs, replacingExpr)
	}else if(r.type === 'macro'){
		r.expr = replaceExpr(r.expr, exprs, replacingExpr)
	}
	return r
}

function findCandidates(r, schema){
	if(r.type === 'view'){
		var candidates = []
		for(var i=0;i<r.params.length;++i){
			var p = r.params[i]
			candidates[i] = getCandidates(p, schema)
		}
	
		var found
	
		for(var ia=0;ia<candidates.length;++ia){
			var ca = candidates[ia]
			for(var ib=0;ib<candidates.length;++ib){
				var cb = candidates[ib]
				if(ia === ib) continue

				for(var i=0;i<ca.length;++i){
					var va = ca[i]
					for(var j=0;j<cb.length;++j){
						var vb = cb[j]
						//	console.log('TODO: dedup: ' + JSON.stringify(ca))
						if(found) break
			
						var ka = makeExprKey(va)
						var kb = makeExprKey(vb)
			
						if(ka === kb){
							//console.log('TODO: dedup: ' + JSON.stringify(va))
							found = [va,vb]
						}
					}
				}
			}
		}
	
		if(found) return found
		
		for(var i=0;i<r.params.length;++i){
			var p = r.params[i]
			found = findCandidates(p, schema)
			if(found) break
		}
		return found
	}else if(r.type === 'let'){
		return findCandidates(r.expr, schema) || findCandidates(r.rest, schema)
	}
}

function deduplicate(r, schema){

	var found = findCandidates(r, schema)
	if(found){

		var name = 'dedup_'+Math.random()
		var param = {type: 'param', name: name, schemaType: found[0].schemaType}
		
		//console.log('replacing: ' + JSON.stringify(found[0]))

		r = replaceExpr(r, found, param)

		//create let with expr
		var letExpr = {
			type: 'let',
			expr: found[0],
			rest: r,
			name: name,
			schemaType: r.schemaType,
			code: r.code
		}

		return letExpr
	}
	
	/*if(r.type === 'view'){		
		r.params.forEach(function(p,i){
			r.params[i] = apply(p, schema)
		})
	}else if(r.type === 'let'){
		r.expr = apply(r.expr, schema)
		r.rest = apply(r.rest, schema)
	}else if(r.type === 'macro'){
		r.expr = apply(r.expr, schema)
	}else if(r.type === 'param' || r.type === 'value' || r.type === 'int' || r.type === 'nil'){
		//do nothing
	}*/
}
function apply(r, schema){
	if(r.type === 'view'){

		var res = deduplicate(r,schema)
		if(res){
			return apply(res, schema)
		}

		r.params.forEach(function(p,i){
			r.params[i] = apply(p, schema)
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

