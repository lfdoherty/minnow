
var _ = require('underscorem')

var schema = require('./../shared/schema')

var analytics = require('./analytics')

var editFp = require('./tcp_shared').editFp
var editCodes = editFp.codes
var editNames = editFp.names

var makeSyncOperatorRel = require('./wrap_sync_operator').make

var wu = require('./wraputil')
var opu = require('./oputil')


function makeOperatorRel(s, rel, paramRels, impl, viewName, ws, recurse, recurseSync, staticBindings){
	_.assertLength(arguments, 9)

	if(impl.computeSync){
		//_.errout('TODO')
		return makeSyncOperatorRel(s, rel, paramRels, impl, viewName, ws, recurse, recurseSync, staticBindings)
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
			
			var mergeResults = opu.makeMerger(pr.schemaType)
			if(rel.params[index].expr.type === 'param'){
				//_.errout(JSON.stringify(pr))
				paramFuncs[index] = makeSimpleParamMacroFunction(mergeResults)
			}else{
				//var macroWrapper
				if(pr.manyImplicits === 1){
				
					paramFuncs[index] = opu.makeMacroWrapper1(pr, mergeResults, rel.params[index], staticBindings)
				}else if(pr.manyImplicits === 2){
				
					paramFuncs[index] = opu.makeMacroWrapper2(pr, mergeResults, rel.params[index], staticBindings)
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
				if(pr.getAt){
					states[index] = pr.getAt(bindings, editId)
					--rem
					//console.log('got state ' + state + ' for ' + pr.name)
					if(rem === 0){
						cb(states)
					}
				}else{
					pr.getStateAt(bindings, editId, function(state){
						--rem
						//console.log('got state ' + state + ' for ' + pr.name)
						states[index] = state
						if(rem === 0){
							cb(states)
						}
					})
				}
				//++rem
			}else{
				states[index] = new pf(bindings, editId)
				--rem
				if(rem === 0){
					//rem = undefined
					//console.log('finished getting params: ' + impl.callSyntax)
					//	clearTimeout(th)
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
				//alreadyDone = true
				a.computeAsync(operatorName)
				//if(Math.random() < .1) console.log(new Error().stack)
				//if(timeoutHandle !== undefined) clearTimeout(timeoutHandle)
				//console.log('computed async ' + JSON.stringify([result, nameStr]))
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
	
	handle.getHistoricalChangesBetween = opu.makeGeneralOperatorHistoricalChangesBetween(paramRels, handle, ws)
	
	if(rel.schemaType.type === 'primitive' || rel.schemaType.type === 'object' || rel.schemaType.type === 'view'){
		handle.getChangesBetween = opu.makeSetChangesBetween(handle, ws)
	}else{
		handle.getChangesBetween = wu.makeGenericGetChangesBetween(handle, ws, rel)
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
				/*handle.getStateAt(bindings, editId, function(state){//TODO optimize
					//cb(state[key]||defaultValue)
					if(JSON.stringify(state[key]||defaultValue) !== JSON.stringify(result)){
						_.errout('different: ' + JSON.stringify([state[key]||defaultValue,result]))
					}
				})*/
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

exports.make = makeOperatorRel
