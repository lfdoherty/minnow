
var _ = require('underscorem')

/*

Wrap property lookups and any purely dependent functions in a cache.

*/

exports.apply = function(view, computeBindingsUsed){
	_.each(view, function(v, viewName){
		if(v.schema){
			_.each(v.rels, function(rel, relName){
				var newRel = v.rels[relName] = applyPropertyCaching(rel, undefined, undefined, computeBindingsUsed)
			})
		}
	})
}

function wrappableAsProperty(rel){
	if(rel.view === 'property'){
		var propertyName = rel.params[0].value
		if(propertyName === 'id' || propertyName === 'uuid'){
			return false
		}
		if(propertyName === 'values') return false//TODO enable this?
		
		//if(rel.sync){
		//	if(rel.params[1].view === 'proper
		//}else{
			return true
		//}
	}else if(rel.type === 'view' && rel.params.length === 1 && rel.view !== 'case' && rel.view !== 'default'){
		return wrappableAsProperty(rel.params[0])
	}else{
		return false
	}
}

function getPropertyInput(rel){
	if(rel.view === 'property'){
		return rel.params[1]
	}else if(rel.type === 'view' && rel.params.length === 1){
		return getPropertyInput(rel.params[0])
	}else{
		_.errout('error')
	}
}

function replacePropertyInput(rel, param){
	if(rel.view === 'property'){
		rel.params[1] = param
	}else if(rel.type === 'view' && rel.params.length === 1){
		replacePropertyInput(rel.params[0], param)
	}else{
		_.errout('error')
	}
}

function applyPropertyCaching(r, parent, superParent, computeBindingsUsed){
	if(wrappableAsProperty(r) && (!r.sync || r.view !== 'property')){
		//if(r.view !== 'property') console.log('TODO: ' + JSON.stringify(r))
		if(parent && superParent && (superParent.isSubsetOptimizationMultimap)){// === 'multimap-optimization'){
			return r
		}
		
		//console.log('optimized: ' + JSON.stringify(parent))
		var uid = 'cache_ext_'+Math.random()
		var implicitType =  getPropertyInput(r).schemaType
		if(implicitType.type === 'set'){
			//console.log('not caching, input is set: ' + JSON.stringify(r))
			return r
		}
		var replaced = JSON.parse(JSON.stringify(r))
		//_.errout(JSON.stringify(getPropertyInput(r)))
		//console.log('macro param type: ' + JSON.stringify(implicitType))
		replacePropertyInput(replaced, {type: 'param', name: uid, schemaType:implicitType})
		var bindingsUsed = computeBindingsUsed(replaced)
		_.assertDefined(bindingsUsed)
		
		var res = {
			type: 'view',
			view: 'property-cache',
			params: [//[getPropertyInput(r), r],
				getPropertyInput(r),
				{
					type: 'macro',
					expr: replaced,
					schemaType: r.schemaType,
					implicits: [uid],
					manyImplicits: 1,
					implicitTypes: [implicitType],
					bindingsUsed: bindingsUsed
				}
			],
			//uid: uid,
			fallback: r,//JSON.parse(JSON.stringify(r)),
			schemaType: r.schemaType,
			code: r.code
		}
		//console.log(JSON.stringify(res, null, 2))
		//_.errout(JSON.stringify(r, null, 2))
		return res
	}else if(r.type === 'view'){
		if(r.view === 'map' && r.willBeOptimized){//do not cache, map-optimization will already be caching
			return r
		}
		if(r.view === 'mutate'){//TODO REMOVEME
			r.params[2] = applyPropertyCaching(r.params[2], r, parent, computeBindingsUsed)
			return r
		}
		//console.log('view: ' + r.view)
		r.params.forEach(function(p,i){
			r.params[i] = applyPropertyCaching(p, r, parent, computeBindingsUsed)
		})
	}else if(r.type === 'let'){
		
		applyPropertyCaching(r.expr, r, parent, computeBindingsUsed)
		applyPropertyCaching(r.rest, r, parent, computeBindingsUsed)
	}else if(r.type === 'macro'){
		r.expr = applyPropertyCaching(r.expr, r, parent, computeBindingsUsed)
		//_.assertDefined(r.bindingsUsed)
		if(!r.bindingsUsed) _.errout('missing bindingsUsed: ' + JSON.stringify(r))
	}else if(r.type === 'param' || r.type === 'value' || r.type === 'int' || r.type === 'nil'){
		//do nothing
	}
	return r
}
