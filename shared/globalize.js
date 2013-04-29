/*
Uses let(name,expr,macro) operators to move non-macro-dependent branches of the query to outside the macro.

This makes optimization easier (e.g. it may make the macro expression sync-executable.)
*/

var _ = require('underscorem')

exports.apply = function(view){
	_.each(view, function(v, viewName){
		if(v.schema){
			globalizeView(v, view)
		}
	})
}

var log = require('quicklog').make('minnow/globalize')

function globalizeView(v, view){
	_.each(v.rels, function(rel, relName){
		var newRel = v.rels[relName] = globalizeExpression(rel)
	})
}

function globalizeExpression(rel, extractCb){
	if(rel.type === 'view'){
		//if(rel.view === 'unchanged'){
		//	return rel
		//}
		
		var extractions = []
		if(extractCb === undefined){
			extractCb = function(expr, uid){
				//if(expr.view === 'unchanged') _.errout('TODO FIXME')
				extractions.push({expr: expr, uid: uid})
			}
		}

		if(rel.view === 'mutate'){
			rel.params[1].expr = globalizeExpression(rel.params[1].expr)//, extractCb)
			
			//rel.params[2] = globa
			/*extractCb = function(expr, uid){
				if(expr.view === 'unchanged') _.errout('TODO FIXME')
				extractions.push({expr: expr, uid: uid})
			}*/
			rel.params[2].expr = globalizeExpression(rel.params[2].expr)

			/*var newBindingsUsed = _.extend({},rel.params[2].bindingsUsed)
			rel.params[2].expr = extractGlobals(rel.params[2].expr, rel.params[2].implicits, function(expr, uid){
				//_.errout('TODO: ' + JSON.stringify(expr))
				uid = uid||'extracted_'+Math.random()
				extractCb(expr, uid)
				newBindingsUsed[uid] = true
				return {type: 'param', name: uid, schemaType: expr.schemaType, was: expr}
			})
			rel.params[2].bindingsUsed = newBindingsUsed*/
		}else{
			rel.params.forEach(function(p, i){
				rel.params[i] = globalizeExpression(p, extractCb)
			})
		}
		
		extractions.reverse().forEach(function(ex){//TODO dedup?
			
 			rel = {type: 'let', expr: ex.expr, name: ex.uid, rest: rel, code: rel.code, schemaType: rel.schemaType}
		})
	}else if(rel.type === 'value' || rel.type === 'param' || rel.type === 'int' || rel.type === 'nil'){
		//do nothing
	}else if(rel.type === 'macro'){
		//if(rel.expr.view === 'unchanged') return rel
		
		rel.expr = globalizeExpression(rel.expr)

		var newBindingsUsed = _.extend({},rel.bindingsUsed)
		rel.expr = extractGlobals(rel.expr, rel.implicits, function(expr, uid){
			//_.errout('TODO: ' + JSON.stringify(expr))
			uid = uid||'extracted_'+Math.random()
			extractCb(expr, uid)
			newBindingsUsed[uid] = true
			return {type: 'param', name: uid, schemaType: expr.schemaType, was: expr}
		})
		rel.bindingsUsed = newBindingsUsed
	}else if(rel.type === 'let'){
		//do nothing?
		rel.expr = globalizeExpression(rel.expr, extractCb)
		rel.rest = globalizeExpression(rel.rest, extractCb)
	}else{
		_.errout('TODO: ' + JSON.stringify(rel))
	}
	return rel
}

function extractGlobals(rel, implicits, cb){
	if(containsImplicits(rel, implicits)){
		//try to descend to a smaller branch which does not contain an implicit
		if(rel.type === 'view'){
			//if(rel.view === 'unchanged') return rel
			
			//console.log('view: ' + rel.view)
			rel.params.forEach(function(p,i){
				if(i === 0 && rel.view === 'property') return//don't process the property name!
				rel.params[i] = extractGlobals(p, implicits, cb)
			})
			return rel
		}else if(rel.type === 'let'){
			log('cannot further globalize let, contains implicits: ' + JSON.stringify([rel.expr, implicits],null,2))
			rel.rest = extractGlobals(rel.rest, implicits.concat([rel.name]), cb)
			return rel
		}else if(rel.type === 'value' || rel.type === 'int' || rel.type === 'param' || rel.type === 'macro'){
			//do nothing
			return rel
		}else{
			_.errout('TODO: ' + JSON.stringify(rel))
		}
	}else{
		if(rel.type === 'value' || rel.type === 'int' || rel.type === 'param'){
			//do nothing
			//return rel
			//return extractGlobals(rel, implicits, cb)
			//console.log('rel: ' + JSON.stringify(rel))
			
			//return cb(rel)
			return rel
		}/*else if(rel.type === 'mutate'){
			return rel
		}*/else if(rel.type === 'let'){
			log('further globalizing let: ' + JSON.stringify([rel.name,rel.expr], null, 2))
			cb(rel.expr, rel.name)
			return extractGlobals(rel.rest, implicits.concat(rel.name), cb)//TODO implicits.concat(rel.name) should be unnecessary?
		}else if(rel.type === 'macro'){
			//we cannot extract a macro independent of its parent view
			return rel
		}else if(rel.type === 'view' && ['case','default','unchanged'].indexOf(rel.view) !== -1){
			rel.params.forEach(function(p,i){
				rel.params[i] = extractGlobals(p, implicits, cb)
			})
			return rel
		}else{
			//chop it out (unless it's sync?)
			//_.errout('TODO: ' + JSON.stringify(rel))
			//console.log('chopping: ' + JSON.stringify(rel.view))
			var replacementExpr = cb(rel)
			return replacementExpr
		}
	}
	//_.errout('TODO: ' + JSON.stringify(rel))
}

function containsImplicits(rel, implicits){
	if(rel.type === 'param'){
		//_.errout('TODO: ' + JSON.stringify(rel))
		return implicits.indexOf(rel.name) !== -1
	}else if(rel.type === 'view'){
		//if(rel.view === 'mutate') return true
		for(var i=0;i<rel.params.length;++i){
			if(containsImplicits(rel.params[i], implicits)) return true
		}
		return false
	}else if(rel.type === 'macro'){
		return containsImplicits(rel.expr, implicits)
	}else if(rel.type === 'let'){
		return containsImplicits(rel.expr, implicits)// || containsImplicits(rel.rest, implicits)
	}else if(rel.type === 'value' || rel.type === 'int' || rel.type === 'nil'){
		return false
	}else{
		_.errout('TODO' + JSON.stringify(rel))
	}
}
