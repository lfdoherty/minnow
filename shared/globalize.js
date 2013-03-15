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

function globalizeView(v, view){
	var bindings = {}
	v.params.forEach(function(p){
		_.assertString(p.name)
		bindings[p.name] = {type: 'param', name: p.name}
	})
	_.each(v.rels, function(rel, relName){
		var newRel = v.rels[relName] = globalizeExpression(rel, bindings)
		//console.log('old: ' + JSON.stringify(rel) + '\n new: ' + JSON.stringify(newRel))
		//newRel.code = rel.code
	})
}

function globalizeExpression(rel, bindings, extractCb){
	if(rel.type === 'view'){
		var extractions = []
		if(extractCb === undefined){
			extractCb = function(expr, uid){
				extractions.push({expr: expr, uid: uid})
			}
		}
		rel.params.forEach(function(p, i){
			rel.params[i] = globalizeExpression(p, bindings, extractCb)
		})
		//var code = rel.code
		extractions.forEach(function(ex){
			//extractCb(ex)
			//if(cur.type === 'macro') _.errout('bug')
 			rel = {type: 'let', expr: ex.expr, name: ex.uid, rest: rel, code: rel.code, schemaType: rel.schemaType}

		})
	}else if(rel.type === 'value' || rel.type === 'param' || rel.type === 'int' || rel.type === 'nil'){
		//do nothing
	}else if(rel.type === 'macro'){
		rel.expr = globalizeExpression(rel.expr)

		
		rel.expr = extractGlobals(rel.expr, rel.implicits, function(expr){
			//_.errout('TODO: ' + JSON.stringify(expr))
			var uid = 'extracted_'+Math.random()
			extractCb(expr, uid)
			return {type: 'param', name: uid}
		})
		//var cur = rel
		
		//return cur
	}else{
		_.errout('TODO: ' + JSON.stringify(rel))
	}
	return rel
}

function extractGlobals(rel, implicits, cb){
	if(containsImplicits(rel, implicits)){
		//try to descend to a smaller branch which does not contain an implicit
		if(rel.type === 'view'){
			//console.log('view: ' + rel.view)
			rel.params.forEach(function(p,i){
				rel.params[i] = extractGlobals(p, implicits, cb)
			})
			return rel
		}else if(rel.type === 'let'){
			return rel
		}else if(rel.type === 'value' || rel.type === 'int' || rel.type === 'param'){
			//do nothing
			return rel
		}else{
			_.errout('TODO: ' + JSON.stringify(rel))
		}
	}else{
		if(rel.type === 'value' || rel.type === 'int' || rel.type === 'param'){
			//do nothing
			return rel
		}else if(rel.type === 'let'){
			//TODO further extract let exprs if possible
			return rel
		}else if(rel.type === 'macro'){
			//we cannot extract a macro independent of its parent view
			return rel
		}else if(rel.type === 'view' && ['case','default'].indexOf(rel.view) !== -1){
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
		for(var i=0;i<rel.params.length;++i){
			if(containsImplicits(rel.params[i], implicits)) return true
		}
	return false
	}else if(rel.type === 'macro'){
		return containsImplicits(rel.expr, implicits)
	}else if(rel.type === 'let'){
		return containsImplicits(rel.expr, implicits) || containsImplicits(rel.rest, implicits)
	}else if(rel.type === 'value' || rel.type === 'int'){
		return false
	}else{
		_.errout('TODO' + JSON.stringify(rel))
	}
}