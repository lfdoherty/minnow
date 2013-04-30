
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

function applyOptimizationToView(r){
	if(r.type === 'view'){
		
		if(r.view === 'one' && r.params[0].view === 'list' && r.params[0].params.length === 1){
			var res = r.params[0].params[0]
			res.code = r.code
			return res
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


