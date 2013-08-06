
var _ = require('underscorem')

exports.apply = function(view, schema){
	_.each(view, function(v, viewName){
		if(v.schema){
			_.each(v.rels, function(rel, relName){
			
				var lets = []
				function wasCb(letName){
				//replaceLet(undefined, undefined, full, letName)
					//console.log('letName: ' + letName)
					lets.push(letName)
				}
				//console.log(JSON.stringify(full, null, 2))
				
				var newRel = v.rels[relName] = apply(rel, rel, wasCb)
				
				lets.forEach(function(letName){
					replaceLet(newRel, letName)
				})
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
/*
function isChainLink(r, key){
	if(r.view === 'property' || r.view === 'one') return true
	if(r.view === 'mapValue' && r.params[0].view === 'multimap'){
		return isChainLink(r.params[1])
	}
}
*/
function couldChain(r, manyIndexes){
	manyIndexes = manyIndexes || 0
	//return isChainLink(r) && isChainLink
	if(r.view === 'property'){
		if(r.schemaType.type === 'set' || r.schemaType.type === 'list' || r.schemaType.type === 'map'){
			//TODO support this case?
			return
		}else{
			return couldChain(r.params[1],manyIndexes+1)
		}
	}else if(r.view === 'one'){
		return couldChain(r.params[0], manyIndexes)
	}else if(r.view === 'mapValue' && r.params[0].view === 'reducing-index' || 
			r.view === 'mapValue' && r.params[0].view === 'multimap'){
		var valueExpr = r.params[1]
		if(valueExpr.type === 'param'){
			if(valueExpr.was && couldChain(valueExpr.was, manyIndexes+1)){
				//console.log('no was: ' + JSON.stringify(valueExpr))
				//return
				valueExpr = valueExpr.was
			}
		}
		return couldChain(valueExpr,manyIndexes+1)
	}else if(r.type === 'param'){
		if(manyIndexes < 2) return
		return r
	}/*else if(r.view === 'each'){
		var subParam = couldChain(r.params[1].expr, 2)
		if(subParam.name === r.params[1].implicits[0]){
			
		}
	}else if(r.type === 'view'){
		var allParams = []
		var has = {}
		r.params.forEach(function(p){
			var pm = couldChain(p, 2)
			if(!pm) allParams = undefined
			if(allParams && !has[pm.name]){
				allParams.push(pm)
				has[pm.name] = true
			}
		})
		if(allParams && allParams.length === 1){
			return allParams[0]
		}
	}*/
}

function getIndexes(r, wasCb){
	if(r.view === 'property'){
		return [r].concat(getIndexes(r.params[1], wasCb))
	}else if(r.view === 'one'){
		return getIndexes(r.params[0], wasCb)
	}else if((r.view === 'mapValue' && r.params[0].view === 'reducing-index') || (r.view === 'mapValue' && r.params[0].view === 'multimap')){
		//return [r.params[0]].concat(getIndexes(r.params[1]))
		var valueExpr = r.params[1]
		if(valueExpr.type === 'param'){
			if(valueExpr.was && couldChain(valueExpr.was, 2)){
				//console.log('no was: ' + JSON.stringify(valueExpr))
				//return
				wasCb(valueExpr.name)
				r.params[1] = valueExpr = valueExpr.was
			}
		}
		return [r.params[0]].concat(getIndexes(valueExpr, wasCb))
	}else if(r.type === 'param'){
		return []
	}
}

function replaceLet(r, letName){
	if(r.type === 'let'){
		//console.log('letName: ' + letName)// + ' ' + r.params[1])
		if(letName === r.name){
			//console.log('found' + new Error().stack)
			return r.rest
		}else{
			//console.log('let')
			r.expr = replaceLet(r.expr, letName)
			r.rest = replaceLet(r.rest, letName)
		}
	}else if(r.type === 'macro'){
		//console.log('macro: ')// + JSON.stringify(r.expr))
		r.expr = replaceLet(r.expr, letName)
	}else if(r.type === 'view'){
		r.params.forEach(function(p,i){
			//console.log('i: ' + i + ' ' + r.view + ' ' + p.type + ' ' + p.view)
			r.params[i] = replaceLet(p, letName)
		})
		//console.log(r.params.length)
	}
	//console.log(r.type + ' ' + r.view + ' ' + (!!r.expr))
	return r
}

function apply(r, full, wasCb){
	if(r.type === 'view'){
		if(r.view === 'generic-index-chain') return r

		if(r.view === 'reducing-index') return r
		
		if(couldChain(r)){//r.view === 'property' || (r.view === 'mapValue' && r.params[0].view === 'multimap')){
			var lets = []
			r = tryToChain(r, wasCb)
		}else{
			r.params.forEach(function(p,i){
				r.params[i] = apply(p, full, wasCb)
			})
		}
	}else if(r.type === 'let'){
		r.expr = apply(r.expr, full, wasCb)
		r.rest = apply(r.rest, full, wasCb)
	}else if(r.type === 'macro'){
		r.expr = apply(r.expr, full, wasCb)
	}else if(r.type === 'param' || r.type === 'value' || r.type === 'int' || r.type === 'nil'){
		//do nothing
	}
	return r
}

function tryToChain(r, wasCb){
	//console.log('could chain: ' + JSON.stringify(r, null, 2))
	var param = couldChain(r)
	var indexes = getIndexes(r, wasCb)
	return {
		type: 'view',
		view: 'generic-index-chain',
		params: [
			param,
			r].concat(indexes),
		schemaType: r.schemaType,
		code: r.code
	}
}

