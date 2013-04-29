
var _ = require('underscorem')

var schema = require('./../shared/schema')

var analytics = require('./analytics')

var editFp = require('./tcp_shared').editFp
var editCodes = editFp.codes
var editNames = editFp.names

var wu = require('./wraputil')
var opu = require('./oputil')

function makeSyncOperatorRel(s, rel, paramRels, impl, viewName, ws, recurse, recurseSync, staticBindings){
	_.assertLength(arguments, 9)
	//console.log('here: ' + viewName)
	
	_.assertNot(rel.sync)
	
	//var isFullySync = true
	var nameStr = 'general-operator-sync['+rel.view+']('
	paramRels.forEach(function(pr, index){
		/*if(!pr.sync){
			//console.log('not sync: ' + pr.name)
			isFullySync = false
		}*/
		if(index>0) nameStr+=','
		nameStr += pr.name
	})
	nameStr += ')'
	if(impl.minParams > 0 && paramRels.length < impl.minParams){
		_.errout('not enough params, need ' + impl.minParams+', got: ' + JSON.stringify(paramRels))
	}
	
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
				paramFuncs[index] = opu.makeSimpleParamMacroFunctionSync(mergeResults)
			}else{
				var p = rel.params[index]
				
				//TODO deal with let bindings
				//if(pr.sync){
				var npr = recurseSync(p)
				_.assertDefined(npr.getAt)
				npr.schemaType = p.schemaType
				//var macroWrapper
				if(pr.manyImplicits === 1){
			
					paramFuncs[index] = opu.makeMacroWrapper1Sync(npr, mergeResults, rel.params[index], staticBindings)
				}else if(pr.manyImplicits === 2){
			
					paramFuncs[index] = opu.makeMacroWrapper2Sync(npr, mergeResults, rel.params[index], staticBindings)
				}else{
					_.errout('TODO')
				}
				//}else{
					/*var npr = recurse(p)
					npr.schemaType = p.schemaType
					//var macroWrapper
					if(pr.manyImplicits === 1){
				
						paramFuncs[index] = opu.makeMacroWrapper1(npr, mergeResults, rel.params[index], staticBindings)
					}else if(pr.manyImplicits === 2){
				
						paramFuncs[index] = opu.makeMacroWrapper2(npr, mergeResults, rel.params[index], staticBindings)
					}else{
						_.errout('TODO')
					}*/
				//}
			}
		}else{
			//do nothing
		}
	})	
		
	function makeParams(bindings, editId, cb){
		
		var rem = paramRels.length
		var states = []
		
		//var err = new Error().stack
		/*var th = setTimeout(function(){
			console.log('ERROR: out of time: ' + viewName + ' ' + err)
			paramRels.forEach(function(pr){
				console.log(pr.name)
			})
		}, 1000)*/
		if(paramRels.length === 0){
			cb(states)
		}
		paramRels.forEach(function(pr, index){
			//if(pr.getStateSync) _.errout('TODO')
			var pf = paramFuncs[index]
			if(pf === undefined){
				if(pr.getAt){
					var state = pr.getAt(bindings, editId)
					if(rel.params[index].schemaType.type === 'set'){
						_.assertArray(state)
					}
					/*if(rel.params[index].schemaType.type === 'object'){
						_.assert(state === undefined || _.isInt(state) || _.isInt(state.top))
					}*/
					//if(viewName === 'add') _.errout('wny?')
					//console.log(rem +' state: ' + pr.name + ' ' + viewName + ' = ' + JSON.stringify(state))
					--rem
			
					states[index] = state
					//_.assert(rem >= 0)
					if(rem === 0){
						//console.log('going: ' + cb)
						//clearTimeout(th)
						cb(states)
					}
				}else{
					pr.getStateAt(bindings, editId, function(state){
						if(rel.params[index].schemaType.type === 'set'){
							_.assertArray(state)
						}
						/*if(rel.params[index].schemaType.type === 'object'){
							_.assert(state === undefined || _.isInt(state) || _.isInt(state.top))
						}*/
						//if(viewName === 'add') _.errout('wny?')
						//console.log(rem +' state: ' + pr.name + ' ' + viewName + ' = ' + JSON.stringify(state))
						--rem
				
						states[index] = state
						//_.assert(rem >= 0)
						if(rem === 0){
							//console.log('going: ' + cb)
							//clearTimeout(th)
							cb(states)
						}
					})
				}
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
	
	var defaultValue
	if(rel.schemaType === undefined) _.errout('missing schemaType: ' + JSON.stringify(rel))
	if(rel.schemaType.type === 'primitive' || rel.schemaType.type === 'object' || rel.schemaType.type === 'view'){
		defaultValue = undefined
	}else if(rel.schemaType.type === 'set' || rel.schemaType.type === 'list'){
		defaultValue = []
	}else if(rel.schemaType.type === 'map'){
		defaultValue = {}
	}else{
		_.errout('TODO: ' + JSON.stringify(rel.schemaType))
	}

	var a = analytics.make(nameStr, paramRels)

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
	
	var cc = 0
	
	var handle = {
		name: nameStr,
		analytics: a,
		getStateAt: function(bindings, editId, cb){
			_.assertFunction(cb)
			_.assertInt(editId)
			_.assertObject(bindings)
			
			if(editId === -1){
				cb(defaultValue)
				return
			}

			++cc
			//console.log('+t: ' + cc + ' ' + viewName)
			
			function computeResult(paramStates){
				
				var cp = [z].concat(paramStates)
				var uid = Math.random()
				//console.log(uid)
				var result = impl.computeSync.apply(undefined, cp)
				if(result === undefined){
					result = defaultValue
				}
				//console.log(editId+' computed sync ' + impl.callSyntax + ': ' + JSON.stringify(result) +' at ' + editId + ' from ' + JSON.stringify(paramStates))
				//console.log(new Error().stack)
				//console.log(uid)
				a.computeSync(rel.view)
				--cc
				//console.log('-t: ' + cc + ' ' + impl.callSyntax)
				cb(result)
			}
			
			//console.log('making params')
			makeParams(bindings, editId, computeResult)
		},
	}
	
	//console.log(JSON.stringify(rel, null, 2))
	if(rel.schemaType.members && rel.schemaType.members.type === 'object'){
		handle.getMayHaveChanged = handle.getStateAt
	}
/*
	if(isFullySync){
		//TODO create custom getStateSync with hardcoded binding mappings and a direct call
		if(rel.params.length === 1){
			var getter = paramRels[0].getStateSync
			var computeSync = impl.computeSync
			handle.getStateSync = function(bindingValues){
				var res = computeSync(z, getter(bindingValues))
				//console.log('computed1 sync state ' + JSON.stringify(bindingValues) + ' -> ' + JSON.stringify(res) + ' ' + impl.callSyntax)
				return res
			}
		}else if(rel.params.length === 2){
			var getterA = paramRels[0].getStateSync
			var getterB = paramRels[1].getStateSync
			var computeSync = impl.computeSync
			handle.getStateSync = function(bindingValues){
				var a = getterA(bindingValues)
				var b = getterB(bindingValues)
				var res = computeSync(z, a, b)
				//console.log('computed2 sync state ' + JSON.stringify(bindingValues) + ' ' + a + ' ' + b +  ' -> ' + JSON.stringify(res) + ' ' + impl.callSyntax)
				return res
			}
		}else{
			handle.getStateSync = function(bindingValues){
				var paramStates = []
				for(var i=0;i<paramRels.length;++i){
					paramStates[i] = paramRels[i].getStateSync(bindingValues)
				}
				var cp = [z].concat(paramStates)
				var result = impl.computeSync.apply(undefined, cp)			
				//console.log('computed sync state ' + JSON.stringify(bindingValues) + ' -> ' + JSON.stringify(result) + ' ' + impl.callSyntax)
				return result
			}
		}
	}else{
		handle.getStateSync = function(bindingValues){
			paramRels.forEach(function(pr){console.log('pr: ' + pr.name + ' ' + (!!pr.getStateSync) + ' ' + (!!pr.isFullySync))})
			_.errout('sync operator has non-sync params: ' + JSON.stringify(rel))			
		}
	}
	handle.isFullySync = isFullySync*/
	
	if(rel.schemaType.type === 'primitive' || rel.schemaType.type === 'object' || rel.schemaType.type === 'view'){
		//_.errout('TODO')
		handle.getChangesBetween = opu.makeSetChangesBetween(handle, ws)
		//handle.getHistoricalChangesBetween = makeSetHistoricalChangesBetween(handle, ws)
	}else{
		handle.getChangesBetween = wu.makeSyncOpGenericGetChangesBetween(handle, ws, rel, recurse, paramRels)//TODO
		
	}
	
	handle.getHistoricalChangesBetween = opu.makeGeneralOperatorHistoricalChangesBetween(paramRels, handle, ws)

	
	//makeSyncGenericGetHistoricalChangesBetween(handle, ws, rel, recurse)//TODO
	
	//handle.getChangesBetween = makeGenericGetChangesBetween(handle, ws, rel, recurse)
	
	return handle
}

exports.make = makeSyncOperatorRel
