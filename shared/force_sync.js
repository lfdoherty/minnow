
var _ = require('underscorem')

var schemaModule = require('./schema')

/*

Wrap property lookups and any purely dependent functions in a cache.

*/

exports.apply = function(view, schema){
	_.each(view, function(v, viewName){
		if(v.schema){
			_.each(v.rels, function(rel, relName){
				var newRel = v.rels[relName] = applySyncForce(rel, undefined, undefined, schema)
			})
		}
	})
}

function syncable(schema, rel){
	if(rel.view === 'property'){
		/*var propertyName = rel.params[0].value
		if(propertyName === 'id' || propertyName === 'uuid'){
			return false
		}
		if(propertyName === 'values') return false//TODO enable this?*/
		return true
	}else if(rel.type === 'view'){
		//return wrappableAsProperty(rel.params[0])
		var paramsAreNotSyncable = false
		rel.params.forEach(function(p){
			if(!syncable(schema, p)){
				paramsAreNotSyncable = true
			}
		})
		if(paramsAreNotSyncable) return false
		
		if(rel.view === 'property-cache' || rel.view === 'case' || rel.view === 'default' || rel.view === 'switch' || rel.view === 'typeset') return true
		
		try{
			var impl = schemaModule.getImplementation(rel.view)
		}catch(e){}
		if(!impl){
			return true
		}else{
			//_.errout(impl.callSyntax)
			if(!impl.computeSync) console.log('checking: ' + impl.callSyntax)
			return !!impl.computeSync
		}
	}else if(rel.type === 'macro'){
		return syncable(schema, rel.expr)
	}else if(rel.type === 'let'){
		return syncable(schema, rel.expr) && syncable(schema, rel.rest)
	}else if(rel.type === 'param' || rel.type === 'value' || rel.type === 'int' || rel.type === 'nil'){
		return true
	}else{
		_.errout('TODO: ' + JSON.stringify(rel))
		return false
	}
}

function applySyncForce(r, parent, superParent, schema){
	if(syncable(schema, r)){
		r.sync = true
	}
	if(r.type === 'view'){
		r.params.forEach(function(p,i){
			applySyncForce(p, r, parent, schema)
		})
	}else if(r.type === 'let'){
		applySyncForce(r.expr, r, parent, schema)
		applySyncForce(r.rest, r, parent, schema)
	}else if(r.type === 'macro'){
		r.expr = applySyncForce(r.expr, r, parent, schema)
		//_.assertDefined(r.bindingsUsed)
		if(!r.bindingsUsed) _.errout('missing bindingsUsed: ' + JSON.stringify(r))
	}else if(r.type === 'param' || r.type === 'value' || r.type === 'int' || r.type === 'nil'){
		//do nothing
	}
	return r
}
