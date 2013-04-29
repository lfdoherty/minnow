
var _ = require('underscorem')
var analytics = require('./analytics')

function shallowCopy(b){
	var keys = Object.keys(b)
	var nb = {}
	for(var i=0;i<keys.length;++i){
		var k = keys[i]
		nb[k] = b[k]
	}
	return nb
}

function make(s, rel, recurse, recurseSync, staticBindings){
	_.assertLength(arguments, 5)

	if(!s.mutators) s.mutators = {}
	
	var mutatorTypeCode = rel.params[0].value
	
	if(staticBindings.isMutated){
		return {
			name: 'mutate-never',
			analytics: analytics.make('mutator-never', []),
			getStateAt: function(bindings, editId, cb){		
				_.errout('logic error?')
			},
			getChangesBetween: function(bindings, startEditId, endEditId, cb){
				_.errout('logic error?')
			},
			getHistoricalChangesBetween: function(bindings, startEditId, endEditId, cb){
				_.errout('logic error?')
			}
		}
	}
	
	var preforkExpr = rel.params[1]
	var restExpr = rel.params[2]
	
	
	var implicit = preforkExpr.implicits[0]
	var mutatorStaticBindings = {}
	var a = analytics.make('mutator', [])
	mutatorStaticBindings.mutatorImplicit = implicit
	mutatorStaticBindings[implicit] = {
		name: 'mutator-binding',
		analytics: a,
		getAt: function(bindings, editId){
			if(editId === -1){
				return undefined
			}else{
				return bindings[implicit]
			}
		},
		getBetween: function(){
			_.errout('tODO')
		},
		getHistoricalBetween: function(bindings, startEditId, endEditId){
			//_.errout('tODO')
			if(startEditId <= 0){
				return [{type: 'set', value: bindings[implicit], editId: 0}]
			}else{
				return []
			}
		}
	}
	
	var mut = recurseSync(preforkExpr.expr, mutatorStaticBindings)
	
	var restStaticBindings = {
		getPropertyValueAt: function(){
			_.errout('tODO')
		},
		getPropertyChangesBetween: function(){
			_.errout('tODO')
		},
		getHistoricalPropertyChangesBetween: function(){
			_.errout('tODO')
		},
		isMutated: true,
		makeGetPropertyAt: function(typeCode, propertyCode){
			var getter = staticBindings.makeGetPropertyAt(typeCode, propertyCode)
			getter.propertyCode = propertyCode
			return function(bindings, id, editId, cb){
				_.assertLength(arguments, 4)
				if(!bindings.getMutatorPropertyAt){
					_.errout('binding has been lost: ' + JSON.stringify(bindings))
				}
				bindings.getMutatorPropertyAt(getter, id, editId, cb)
			}
		},
		getLastVersion: function(id, cb){
			_.errout('TODO')
		}
	}
	
	restStaticBindings.makePropertyIndex = mut.newStaticBindings.makePropertyIndex
	restStaticBindings.makeReversePropertyIndex = mut.newStaticBindings.makeReversePropertyIndex

	var bindingsUsed = Object.keys(preforkExpr.bindingsUsed)
	preforkExpr.implicits.forEach(function(imp){
		if(bindingsUsed.indexOf(imp) !== -1){
			bindingsUsed.splice(bindingsUsed.indexOf(imp), 1)
		}
	})
	
	s.mutators[mutatorTypeCode] = {
		createBindings: function(mutatorParams){
			var localBindings = {}
			bindingsUsed.forEach(function(b, index){
				localBindings[b] = mutatorParams[index]
			})
			var created = mutateBindings(localBindings)
			//console.log('created bindings: ' + JSON.stringify([mutatorParams, localBindings, created, Object.keys(created)]))
			return created
		},
		staticBindings: restStaticBindings
	}
	
	var rest = recurse(restExpr.expr, restStaticBindings)

	
	function getMutatorPropertyAt(bindings, getter, id, editId, cb){
		var newBindings = shallowCopy(bindings)
		newBindings[implicit] = id
		//console.log('getting mutator property with: ' + JSON.stringify([newBindings, Object.keys(newBindings)]))

		var done = false
		mut.getStateAt(newBindings, editId, function(mutatorToken){
			if(!mut.getPropertyValueAt) _.errout('TODO: ' + mut.name )
			
			//console.log('*** getting mutator property with: ' + JSON.stringify([newBindings, Object.keys(newBindings)]))
			mut.getPropertyValueAt(newBindings, mutatorToken, getter, id, editId, function(pv){
				//console.log('got property value: ' + pv)
				done = true
				cb(pv)
			})
		})
		if(!done) _.errout('problem: ' + mut.getStateAt)//TODO REMOVEME
	}
	
	function mutateBindings(bindings){
		var newBindings = shallowCopy(bindings)
		newBindings.__mutatorKey = (bindings.__mutatorKey||'')+';'+mutatorTypeCode+'{'
		bindingsUsed.forEach(function(b,index){
			if(index > 0) newBindings.__mutatorKey += ','
			newBindings.__mutatorKey += JSON.stringify(bindings[b])
		})
		newBindings.__mutatorKey += '}'
		//console.log('mutated bindings: ' + JSON.stringify([bindings, bindingsUsed, newBindings.__mutatorKey]))
		newBindings.getMutatorPropertyAt = getMutatorPropertyAt.bind(undefined, bindings)
		return newBindings
	}
	var a = analytics.make('mutate', [mut, rest])
	var handle = {
		name: 'mutate',
		analytics: a,
		getStateAt: function(bindings, editId, cb){		
			rest.getStateAt(mutateBindings(bindings), editId, cb)
		},
		getChangesBetween: function(bindings, startEditId, endEditId, cb){
			if(rest.getBetween){
				cb(rest.getBetween(mutateBindings(bindings), startEditId, endEditId))
			}else{
				rest.getChangesBetween(mutateBindings(bindings), startEditId, endEditId, cb)
			}
		},
		getHistoricalChangesBetween: function(bindings, startEditId, endEditId, cb){
			if(rest.getHistoricalBetween){
				cb(rest.getHistoricalBetween(mutateBindings(bindings), startEditId, endEditId))
			}else{
				rest.getHistoricalChangesBetween(mutateBindings(bindings), startEditId, endEditId, cb)
			}
		}
	}
	
	if(rel.sync){
		_.errout('TODO')
	}
	return handle
}

exports.make = make
