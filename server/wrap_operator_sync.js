var _ = require('underscorem')

var makeSyncOperatorRelSync = require('./wrap_sync_operator_sync').make

var opu = require('./oputil')
/*
function makeOperatorRelSync(s, rel, paramRels, impl, viewName, ws, recurseSync, staticBindings){


	if(impl.computeSync){
		//
		return makeSyncOperatorRelSync(s, rel, paramRels, impl, viewName, ws, recurseSync)
	}else{
		//console.log('computing async: ' + viewName)
		_.errout('TODO?')
	}
}

exports.makeSync = makeOperatorRelSync
*/
/*
function makeOperatorRel(s, rel, paramRels, impl, viewName, ws, recurse, staticBindings){


	if(impl.computeSync){
		//_.errout('TODO')
		return makeSyncOperatorRel(s, rel, paramRels, impl, viewName, ws, recurse)
	}else{
		//console.log('computing async: ' + viewName)
	}

	var z
	function setupZ(){
		_.assertDefined(s.objectState)
		z = {
			schema: s.schema,
			objectState: s.objectState,
			schemaType: rel.schemaType
		}
	}
	s.after(setupZ)
	
	var cache = {}
	
	var paramFuncs = []
	var paramNamesStr = ''
	paramRels.forEach(function(pr, index){
		if(index>0) paramNamesStr += ','
		paramNamesStr += pr.name
		if(pr.isMacro){
			//_.errout(JSON.stringify(rel.params[index]))
			
			var mergeResults = makeMerger(pr.schemaType)
			if(rel.params[index].expr.type === 'param'){
				//_.errout(JSON.stringify(pr))
				paramFuncs[index] = makeSimpleParamMacroFunction(mergeResults)
			}else{
				//var macroWrapper
				if(pr.manyImplicits === 1){
				
					paramFuncs[index] = makeMacroWrapper1(pr, mergeResults, rel.params[index], staticBindings)
				}else if(pr.manyImplicits === 2){
				
					paramFuncs[index] = makeMacroWrapper2(pr, mergeResults, rel.params[index], staticBindings)
				}else{
					_.errout('TODO')
				}
			}
		}else{
			//do nothing
		}
	})	
	
	var nameStr = 'general-operator[' + impl.callSyntax.substr(0,impl.callSyntax.indexOf('(')) + '](' + paramNamesStr + ')'
	//console.log('made: ' + nameStr)
	
	function makeParams(bindings, editId, cb){
		
		var rem = paramRels.length
		var states = []
		paramRels.forEach(function(pr, index){
			var pf = paramFuncs[index]
			if(pf === undefined){
				pr.getStateAt(bindings, editId, function(state){
					--rem
					states[index] = state
					if(rem === 0){
						cb(states)
					}
				})
			}else{
				states[index] = new pf(bindings, editId)
				--rem
				if(rem === 0){
					cb(states)
				}
			}
		})
	}
	
	var operatorName = impl.callSyntax.substr(0,impl.callSyntax.indexOf('('))
	var a = analytics.make('general-operator[' + operatorName + ']', paramRels)
	
	var handle = {
		name: nameStr,
		analytics: a,
		getStateAt: function(bindings, editId, cb){
			_.assertFunction(cb)
			_.assertInt(editId)
			_.assertObject(bindings)
			
			var key = bindings.__key+':'+editId
			
			function callback(result){
				a.computeAsync(operatorName)
				cb(result)
			}
			function computeResult(paramStates){
				_.assertEqual(paramStates.length, paramRels.length)
				
				var cp = [z, callback].concat(paramStates)
				if(!impl.computeAsync) _.errout('needs computeAsync: ' + viewName + ', got: ' + JSON.stringify(Object.keys(impl)))
				
				impl.computeAsync.apply(undefined, cp)
			}
			
			makeParams(bindings, editId, computeResult)
			
		}
	}
	
	handle.getHistoricalChangesBetween = makeGeneralOperatorHistoricalChangesBetween(paramRels, handle, ws)
	
	if(rel.schemaType.type === 'primitive' || rel.schemaType.type === 'object' || rel.schemaType.type === 'view'){
		handle.getChangesBetween = makeSetChangesBetween(handle, ws)
	}else{
		handle.getChangesBetween = makeGenericGetChangesBetween(handle, ws, rel)
	}
	
	if(rel.schemaType.type === 'map'){
		handle.getPartialStateAt = function(bindings, editId, keySet, cb){
			handle.getStateAt(bindings, editId, function(state){
				var partialState = {}
				keySet.forEach(function(key){
					var v = state[key]
					if(v !== undefined){
						partialState[key] = v
					}
				})
				cb(partialState)
			})
		}
		var defaultValue = undefined
		if(rel.schemaType.value.type === 'set' || rel.schemaType.value.type === 'list'){
			defaultValue = []
		}else if(rel.schemaType.value.type === 'map'){
			defaultValue = {}
		}
		handle.getValueStateAt = function(key, bindings, editId, cb){

			function callback(result){
				a.computeAsync(operatorName)

				cb(result)
			}
			function computeResult(paramStates){
				_.assertEqual(paramStates.length, paramRels.length)
			
				var cp = [z, callback,key].concat(paramStates)
				//cp.push(key)
				if(!impl.computeAsync) _.errout('needs computeAsync: ' + viewName + ', got: ' + JSON.stringify(Object.keys(impl)))
			
				impl.computeValueAsync.apply(undefined, cp)
			}

			if(!impl.computeValueAsync){
				handle.getStateAt(bindings, editId, function(state){//TODO optimize
					cb(state[key]||defaultValue)
				})
			}else{
			
				makeParams(bindings, editId, computeResult)
			}
		}
	}

	return handle
}

*/

function makeOperatorRelSync(s, rel, paramRels, impl, viewName, ws, recurseSync, staticBindings){

	if(impl.computeSync){
		//_.errout('TODO')
		return makeSyncOperatorRelSync(s, rel, paramRels, impl, viewName, ws, recurseSync, staticBindings)
	}else{
		_.errout('cannot make async operator into sync operator: ' + viewName)
	}
}
//exports.make = makeOperatorRel
exports.makeSync = makeOperatorRelSync

