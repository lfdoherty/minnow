"use strict";

var _ = require('underscorem')

var u = require('./../server/variables/optimization_util')



function replaceMacroPropertyExpressions(e, implicits, cb){
	if(e.type === 'view'){
		if(e.view === 'property' || e.view === 'preforked'){
			if(e.view === 'property' && e.params[0].value === 'id'){
				//this is a sync op
			}else{
				if(u.fromMacro(e, implicits)){
					return cb(e)
				}else{
					if(!e.canBeSync){
						throw new Error('each_optimization not possible, not sync: ' + JSON.stringify(e))
					}
				}
			}
		}else{
			if(e.view === 'switch' || e.view === 'map'){
				throw new Error('each_optimization not possible, not sync: ' + JSON.stringify(e))
			}
			e.params.forEach(function(p,i){
				e.params[i] = replaceMacroPropertyExpressions(p, implicits, cb)
			})
		}
	}else if(e.type === 'param' || e.type === 'value' || e.type === 'int'){
	}else{
		throw new Error('each_optimization not possible: ' + JSON.stringify(e))
	}
	return e
}

function replaceImplicit(oldName, newName, expr){
	if(expr.type === 'param'){
		if(expr.name === oldName) expr.name = newName
	}else if(expr.type === 'view'){
		
	}
}

exports.apply = function(view){
	_.each(view, function(v, viewName){
		if(v.schema){
			_.each(v.rels, function(rel, relName){
				var newRel = v.rels[relName] = applyEachOptimizationToView(rel)
			})
		}
	})
}


function applyEachOptimizationToView(r){
	if(r.type === 'view'){
		if(r.view === 'each'){
			return applyEachOptimization(r)
		}else{
			r.params.forEach(function(p,i){
				r.params[i] = applyEachOptimizationToView(p)
			})
		}
	}else if(r.type === 'let'){
		r.expr = applyEachOptimizationToView(r.expr)
		r.rest = applyEachOptimizationToView(r.rest)
	}else if(r.type === 'macro'){
		r.expr = applyEachOptimizationToView(r.expr)
	}else if(r.type === 'param' || r.type === 'value' || r.type === 'int' || r.type === 'nil'){
		//do nothing
	}
	return r
}

//takes the rel for the each
function applyEachOptimization(rel){

	var originalRel = rel
	rel = JSON.parse(JSON.stringify(rel))	
	
	//console.log('rel: ' + JSON.stringify(rel))
	try{
		var newImplicits = [rel.params[1].implicits[0]]
		var bindingsUsed = _.extend({}, rel.params[1].bindingsUsed)
		//1. extract macro params to one or more ~:property maps
		var maps = []
		var failed = false
		var newMacroExpr = replaceMacroPropertyExpressions(rel.params[1].expr, rel.params[1].implicits, function(macroPropertyExpr){
			if(macroPropertyExpr.schemaType.type === 'map'){
				failed = true
				return
			}
			var uid = 'extproperty_'+Math.random()
			var bu = {}
			bu[uid] = true
			var m = {
				type: 'view', 
				view: 'map', 
				params: [
					rel.params[0],
					{	
						type: 'macro', 
						manyImplicits: 1, 
						expr: {type: 'param', name: uid, schemaType: rel.params[0].schemaType.members}, 
						bindingsUsed: bu, 
						implicits: [uid], 
						schemaType: rel.params[0].schemaType.members,
						implicitTypes: [rel.params[0].schemaType.members]
					},{
						type: 'macro', 
						manyImplicits: 1, 
						expr: JSON.parse(JSON.stringify(macroPropertyExpr)), 
						bindingsUsed: bu, 
						implicits: [rel.params[1].implicits[0]], 
						schemaType: macroPropertyExpr.schemaType,
						implicitTypes: [rel.params[1].implicitTypes[0]]
					}
				], 
				uid: uid
			}
			m.schemaType = {type: 'map', key: m.params[1].schemaType, value: m.params[2].schemaType}
			maps.push(applyEachOptimizationToView(m))
			newImplicits.push(uid)
			bindingsUsed[uid] = true
			_.assertDefined(macroPropertyExpr.schemaType)
			return {type: 'param', name: uid, schemaType: macroPropertyExpr.schemaType}
		})
		if(failed) return originalRel
		var newMacro = {
			type: 'macro',
			expr: newMacroExpr,
			manyImplicits: newImplicits.length,
			implicits: newImplicits,
			implicitTypes: [rel.params[0].schemaType.members],
			bindingsUsed: bindingsUsed,//newImplicits
			schemaType: newMacroExpr.schemaType
		}
		//console.log('created m: ' + JSON.stringify(newMacro, null, 2))
		return {
			type: 'view',
			view: 'each-optimization',
			params: [rel.params[0], newMacro].concat(maps),
			schemaType: rel.schemaType,
			code: rel.code
		}
	}catch(e){
		//console.log('could not optimize each + e.stack)
		return originalRel
	}
}
	
