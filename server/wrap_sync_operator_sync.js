
var _ = require('underscorem')

var schema = require('./../shared/schema')

var analytics = require('./analytics')

var editFp = require('./tcp_shared').editFp
var editCodes = editFp.codes
var editNames = editFp.names

var wu = require('./wraputil')

var opu = require('./oputil')

var stackCount = require('stack-count')

function makeSyncOperatorSyncRel(s, rel, paramRels, impl, viewName, ws, recurseSync, staticBindings){
	_.assertLength(arguments, 8)
	//console.log('here: ' + viewName)
	//var isFullySync = true
	var nameStr = 'general-sync-operator-sync['+rel.view+']('
	paramRels.forEach(function(pr, index){
		/*if(!pr.isFullySync){
			//console.log('not sync: ' + pr.name)
			isFullySync = false
		}*/
		if(!pr.getAt) _.errout('missing getAt: ' + pr.name)
		if(index>0) nameStr+=','
		nameStr += pr.name
	})
	nameStr += ')'
	if(impl.minParams > 0 && paramRels.length < impl.minParams){
		_.errout('not enough params, need ' + impl.minParams+', got: ' + JSON.stringify(paramRels))
	}
	
	var anyMacros = false
	var paramFuncs = []
	paramRels.forEach(function(pr, index){
		if(pr.isMacro){
			anyMacros = true
			var p = rel.params[index]
			
			//TODO deal with let bindings
			var syncPr = recurseSync(p)
			syncPr.schemaType = p.schemaType
			//var macroWrapper
			var mergeResults = opu.makeMerger(pr.schemaType)
			if(pr.manyImplicits === 1){
			
				paramFuncs[index] = opu.makeMacroWrapper1Sync(syncPr, mergeResults, rel.params[index], staticBindings)
			}else if(pr.manyImplicits === 2){
			
				paramFuncs[index] = opu.makeMacroWrapper2Sync(syncPr, mergeResults, rel.params[index], staticBindings)
			}else{
				_.errout('TODO')
			}
		}
	})
	
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
	
	var probeName = 'sync-sync '+rel.view
	
	function genericGetAt(bindings, editId){
		//_.assertFunction(cb)
		_.assertInt(editId)
		_.assertObject(bindings)
		
		if(editId === -1){
			return defaultValue
		}
		
		var cp = [z]
		
		//console.log('getting params for: ' + rel.view)
		for(var index=0;index<paramRels.length;++index){
			var pr = paramRels[index]
			if(!pr.isMacro){
				var state = pr.getAt(bindings, editId)
				//if(rel.params[index].schemaType.type === 'set'){
				//	_.assertArray(state)
				//}
				cp[index+1] = state
				//if(pr.name.indexOf('eq') !== -1) console.log('computed state: ' + pr.name + ' ' + pr.getAt + ' ' + editId + ' ' + state)
			}else{
				var pf = paramFuncs[index]
				cp[index+1] = new pf(bindings, editId)
			}
		}
		//console.log('got params')
		
		var result = impl.computeSync.apply(undefined, cp)
		if(result === undefined){
			result = defaultValue
		}
		//TODO validate results
		
		/*
		if(rel.view === 'map' || rel.view === 'multimap' || rel.view === 'each'){
			
			if(cp[1].length > 50){
				console.log(nameStr)
				console.log('WARNING: uncached ' + rel.view + ' iteration N='+cp[1].length + ' ' + new Error().stack)
			}
		}
		*/
		
		//console.log(editId+' computed sync ' + impl.callSyntax + ': ' + JSON.stringify(result) +' at ' + editId + ' from ' + JSON.stringify(cp.slice(1)))

		a.computeSync(rel.view)
		//stackCount.record(probeName, 1000)
		
		return result
	}
	var handle = {
		name: nameStr,
		analytics: a,
		getAt: genericGetAt
	}
	
	function fixedFunctionalGetAt(bindings, editId){
		_.assertInt(editId)
		_.assertObject(bindings)
		
		if(editId === -1){
			return defaultValue
		}

		var cp = [z]
		
		for(var index=0;index<paramRels.length;++index){
			var pr = paramRels[index]
			var state = pr.getAt(bindings, editId)
			cp[index+1] = state
		}
		
		var result = impl.computeSync.apply(undefined, cp)
		if(result === undefined){
			result = defaultValue
		}
		//TODO validate results
		
	
		
		
		//console.log(editId+' computed sync ' + impl.callSyntax + ': ' + JSON.stringify(result) +' at ' + editId + ' from ' + JSON.stringify(paramStates))
		//console.log(new Error().stack)
		a.computeSync(rel.view)
		//stackCount.record(probeName, 1000)
		return result
	}

	var pr1 = paramRels[0]
	var pr2 = paramRels[1]
	
	function fixedFunctionalGetAt1(bindings, editId){
		if(editId === -1){
			return defaultValue
		}

		var result = impl.computeSync(z, pr1.getAt(bindings, editId))
		if(result === undefined){
			result = defaultValue
		}
		//TODO validate results
		
		//console.log(editId+' computed sync ' + impl.callSyntax + ': ' + JSON.stringify(result) +' at ' + editId + ' from ' + JSON.stringify([pr1.getAt(bindings, editId)]))
		//console.log(new Error().stack)
		a.computeSync(rel.view)
		//stackCount.record(probeName, 1000)
		return result
	}
		
	function fixedFunctionalGetAt2(bindings, editId){
		if(editId === -1){
			return defaultValue
		}

		var result = impl.computeSync(z, pr1.getAt(bindings, editId), pr2.getAt(bindings, editId))
		if(result === undefined){
			result = defaultValue
		}
		//TODO validate results
		
		//console.log(editId+' computed sync ' + impl.callSyntax + ': ' + JSON.stringify(result) +' at ' + editId + ' from ' + JSON.stringify(paramStates))
		/*if(impl.callSyntax === 'mapValue(map,key)'){
			console.log(pr1.name)
		}*/
		//console.log(new Error().stack)
		a.computeSync(rel.view)
		//stackCount.record(probeName, 1000)
		return result
	}
	
	if(!anyMacros && impl.minParams >= 0 && impl.maxParams === impl.minParams){
		//_.errout('TODO: ' + impl.minParams)
		if(impl.minParams === 1){
			handle.getAt = fixedFunctionalGetAt1
		}else if(impl.minParams === 2){
			handle.getAt = fixedFunctionalGetAt2
		}else{
			handle.getAt = fixedFunctionalGetAt
		}
	}
	
	//console.log(JSON.stringify(rel, null, 2))
	if(rel.schemaType.members && rel.schemaType.members.type === 'object'){
		handle.getMayHaveChanged = handle.getStateAt
	}
	
	if(rel.schemaType.type === 'primitive' || rel.schemaType.type === 'object' || rel.schemaType.type === 'view'){
		//_.errout('TODO')
		handle.getBetween = opu.makeSetSyncBetween(handle, ws)
	}else{
		handle.getBetween = wu.makeSyncGenericGetChangesBetween(handle, ws, rel, recurseSync, paramRels)//TODO
		
	}
	
	handle.getHistoricalBetween = opu.makeSyncGeneralOperatorHistoricalChangesBetween(paramRels, handle, ws)
	
	return handle
}

exports.make = makeSyncOperatorSyncRel
