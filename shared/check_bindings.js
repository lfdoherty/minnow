
var _ = require('underscorem')

exports.apply = function(view, schema){
	_.each(view, function(v, viewName){
		if(v.schema){
			_.each(v.rels, function(rel, relName){
				
				var paramBindings = {}
				v.params.forEach(function(p){
					paramBindings[p.name] = true
				})
				//_.errout(JSON.stringify(v.params))
				try{
					apply(rel, paramBindings)
				}catch(e){
					//console.log('in ' + JSON.stringify(rel, null, 2))
					throw e
				}
			})
		}
	})
}

function apply(r, bindings){
	if(r.type === 'view'){
		if(r.view === 'generic-index-chain'){
			r.params.slice(0,2).forEach(function(p,i){
				apply(p, bindings)
			})
		}else if(r.view === 'generic-operator-index'){
			r.params.slice(0,2).forEach(function(p,i){
				apply(p, bindings)
			})
		}else if(r.view === 'reducing-index'){
			r.params.slice(0,2).forEach(function(p,i){
				apply(p, bindings)
			})
		}else{
			r.params.forEach(function(p,i){
				apply(p, bindings)
			})
		}
	}else if(r.type === 'let'){
		//r.expr = apply(r.expr, schema)
		apply(r.expr, bindings)
		var b = JSON.parse(JSON.stringify(bindings))
		b[r.name] = true
		apply(r.rest, b)
	}else if(r.type === 'macro'){
		var b = JSON.parse(JSON.stringify(bindings))
		//b[r.name] = true
		_.assertInt(r.manyImplicits)
		for(var i=0;i<r.manyImplicits;++i){
			b[r.implicits[i]] = true
		}
		apply(r.expr, b)
	}else if(r.type === 'param'){
		if(!bindings[r.name]) _.errout('found unbound param: ' + r.name)
	}else if(r.type === 'value' || r.type === 'int' || r.type === 'nil'){
	}else{
		_.errout('TODO: ' + r.type)
	}
}

