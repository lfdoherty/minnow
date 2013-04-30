
var _ = require('underscorem')

exports.apply = function(view){
	_.each(view, function(v, viewName){
		if(v.schema){
			_.each(v.rels, function(rel, relName){
				var newRel = v.rels[relName] = applyOptimizationToView(rel)
			})
		}
	})
}

function isOneToOne(rel){
	if(rel.view !== 'property') return false
	//console.log(JSON.stringify(rel))
	if(rel.params[0].value === 'uuid'){
		//console.log('is one-to-one: uuid')
		return true
	}
	return false
}

function applyOptimizationToView(r){
	if(r.type === 'view'){
		
		if(r.view === 'mapValue' && r.params[0].view === 'multimap'){
			var mr = r.params[0]
			if(mr.view === 'multimap' && mr.params[1].expr.view === 'property' && isOneToOne(mr.params[1].expr)){
		
				var mapParam = {
					type: 'view',
					view: 'map',
					params: mr.params.slice(0,3),
					schemaType: {
						type: 'map',
						key: mr.params[1].expr.schemaType,
						value: mr.params[2].expr.schemaType
					}
				}
			
				var mapValue = {
					type: 'view',
					view: 'mapValue',
					params: [mapParam, r.params[1]],
					schemaType: mr.params[2].expr.schemaType
				}
			
				return {
					type: 'view',
					view: 'list',
					params: [mapValue],
					schemaType: r.schemaType,
					code: r.code
				}
			}
		}
		r.params.forEach(function(p,i){
			r.params[i] = applyOptimizationToView(p)
		})
	}else if(r.type === 'let'){
		r.expr = applyOptimizationToView(r.expr)
		r.rest = applyOptimizationToView(r.rest)
	}else if(r.type === 'macro'){
		r.expr = applyOptimizationToView(r.expr)
	}else if(r.type === 'param' || r.type === 'value' || r.type === 'int' || r.type === 'nil'){
		//do nothing
	}
	return r
}

