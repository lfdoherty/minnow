"use strict";

var _ = require('underscorem')

var schema = require('./../shared/schema')

var analytics = require('./analytics')

var editFp = require('./tcp_shared').editFp
var editCodes = editFp.codes
var editNames = editFp.names

function shallowCopy(b){
	var keys = Object.keys(b)
	var nb = {}
	for(var i=0;i<keys.length;++i){
		var k = keys[i]
		nb[k] = b[k]
	}
	return nb
}
exports.shallowCopy = shallowCopy


var wu = require('./wraputil')
var innerify = require('./innerId').innerify
var InnerId = require('./innerId').InnerId
var wrapProperty = require('./wrap_property').wrapProperty

var subsetOptimization = require('./variables/subset_optimization')
var eachOptimization = require('./variables/each_optimization')
var mapOptimization = require('./variables/map_optimization')
var multimapOptimization = require('./variables/multimap_optimization')

function makeIdRel(s, context){
	var a = analytics.make('property-id('+context.name+')', [context])
	return {
		name: 'property-id('+context.name+')',
		analytics: a,
		getStateAt: function(bindings, editId, cb){
			context.getStateAt(bindings, editId, function(id){
				cb([''+id])
			})
		},
		isFullySync: context.isFullySync,
		getStateSync: function(bindings){
			return context.getStateSync(bindings)
		},
		getChangesBetween: function(bindings, startEditId, endEditId, cb){
			context.getChangesBetween(bindings, startEditId, endEditId, function(changes){
				if(changes.length > 0){
					_.assertLength(changes, 1)
					var c = changes[0]
					if(c.editId < 0) _.errout('editId too early: ' + JSON.stringify(c.editId))
					_.assert(c.editId >= 0)
					cb([{type: 'set', value: ''+c.value, editId: c.editId, syncId: -1}])
				}else{
					cb([])
				}
			})
		},
		getHistoricalChangesBetween: function(bindings, startEditId, endEditId, cb){
			context.getChangesBetween(bindings, startEditId, endEditId, function(changes){
				if(changes.length > 0){
					_.assertLength(changes, 1)
					var c = changes[0]
					if(c.editId < 0) _.errout('editId too early: ' + JSON.stringify(c.editId))
					_.assert(c.editId >= 0)
					cb([{type: 'set', value: ''+c.value, editId: c.editId, syncId: -1}])
				}else{
					cb([])
				}
			})
		}
	}
}

function makeUuidRel(s, context){
	var a = analytics.make('property-uuid', [context])
	return {
		name: 'property-uuid',
		analytics: a,
		getStateAt: function(bindings, editId, cb){
			context.getStateAt(bindings, editId, function(id){
				if(id === undefined){
					cb()
				}else{
					var uuid = s.objectState.getUuid(id)
					//console.log('got uuid: ' + uuid)
					cb(uuid)
				}
			})
		},
		getChangesBetween: function(bindings, startEditId, endEditId, cb){
			//console.log('getting uuid changes')
			context.getChangesBetween(bindings, startEditId, endEditId, function(changes){
				if(changes.length > 0){
					_.assertLength(changes, 1)
					var c = changes[0]
					if(c.editId < 0) _.errout('editId too early: ' + JSON.stringify(c.editId))
					_.assert(c.editId >= 0)
					var id = c.value
					var uuid = s.objectState.getUuid(id)
					_.assertString(uuid)
					cb([{type: 'set', value: uuid, editId: c.editId, syncId: -1}])
				}else{
					cb([])
				}
			})
		}
	}
}
function makeValuesRel(s, context, propertyType, contextType){
	var a = analytics.make('property-map-values', [context])
	var handle = {
		name: 'property-map-values',
		analytics: a,
		getStateAt: function(bindings, editId, cb){
			context.getStateAt(bindings, editId, function(map){
				if(map === undefined){
					cb([])
					return
				}
				
				var values = []
				var has = {}
				//console.log('map: ' + JSON.stringify(map))
				Object.keys(map).forEach(function(key){
					var v = map[key]
					if(has[v]) return
					has[v] = true
					values.push(v)
				})
				cb(values)
			})
		},
		getChangesBetween: function(bindings, startEditId, endEditId, cb){
			_.errout('TODO')
		}
	}
		
	return handle
}



function makeMerger(type){
	if(type.type === 'set' || type.type === 'list'){
		return function(res){
			//console.log('merging: ' + JSON.stringify(res))
			if(res.length === 0) return []
			var total = res[0]
			for(var i=1;i<res.length;++i){
				total = wu.mergeSets(total, res[i])
			}
			//console.log(JSON.stringify(res) + ' -> ' + JSON.stringify(total))
			return total
		}
	}else if(type.type === 'primitive' || type.type==='object'||type.type==='view'){
		return function(res){
			var arr = []
			var has = {}
			for(var i=0;i<res.length;++i){
				var v = res[i]
				if(has[v]) continue
				has[v] = true
				arr.push(v)
			}
			//console.log(JSON.stringify(res) + ' -> ' + JSON.stringify(arr))
			return arr
		}
	}else if(type.type === 'map'){
		return function(res){
			_.errout('TODO')
		}
	}else{
		_.errout('TODO: ' + JSON.stringify(type))
	}
}

function hasObjectsInType(type){
	var has = false
	if(type.type === 'set'||type.type === 'list'){
		has = has || type.members.type === 'object'
		has = has || type.members.type === 'view'
	}
	has = has || type.type === 'object'
	has = has || type.type === 'view'
	//console.log(JSON.stringify(type))
	if(type.type === 'map'){
		has = has || type.key.type === 'object'
		has = has ||type.value.type === 'object'
		if(!has && type.value.type === 'set' || type.value.type === 'list'){
			has = has || type.value.members.type === 'object'
			has = has || type.value.members.type === 'view'
		}
	}
	return has
}


function makeSyncOperatorRel(s, rel, paramRels, impl, viewName, ws, recurse){

	var z = {
		schema: s.schema,
		objectState: s.objectState
	}

	var isFullySync = true
	var nameStr = 'general-operator-sync['+rel.view+']('
	paramRels.forEach(function(pr, index){
		if(!pr.isFullySync){
			//console.log('not sync: ' + pr.name)
			isFullySync = false
		}
		if(index>0) nameStr+=','
		nameStr += pr.name
	})
	nameStr += ')'
		
	function makeParams(bindings, editId, cb){
		
		var rem = paramRels.length
		var states = []
		paramRels.forEach(function(pr, index){
			//if(pr.getStateSync) _.errout('TODO')
			//console.log('state: ' + pr.name + ' ' + viewName)
			pr.getStateAt(bindings, editId, function(state){
				--rem
				states[index] = state
				if(rem === 0){
					rem = undefined
					cb(states)
				}
			})
		})
		if(rem === 0){
			cb(states)
		}
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
			
			function computeResult(paramStates){
				//var zl = {schema: z.schema, objectState: z.objectState}//_.extend({}, z)
				//_.assertInt(editId)
				///zl.editId = editId
				
				var cp = [z].concat(paramStates)
				
				var result = impl.computeSync.apply(undefined, cp)
				//console.log(editId+' computed sync ' + impl.callSyntax + ': ' + JSON.stringify(result) +' at ' + editId)
				//console.log(new Error().stack)
				cb(result)
			}
			
			//console.log('making params')
			makeParams(bindings, editId, computeResult)
		},
	}

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
			paramRels.forEach(function(pr){console.log('pr: ' + pr.name + ' ' + (!!pr.getStateSync))})
			_.errout('sync operator has non-sync params: ' + JSON.stringify(rel))			
		}
	}
	handle.isFullySync = isFullySync
	
	if(rel.schemaType.type === 'primitive' || rel.schemaType.type === 'object' || rel.schemaType.type === 'view'){
		//_.errout('TODO')
		handle.getChangesBetween = makeSetChangesBetween(handle, ws)
		//handle.getHistoricalChangesBetween = makeSetHistoricalChangesBetween(handle, ws)
	}else{
		handle.getChangesBetween = makeSyncGenericGetChangesBetween(handle, ws, rel, recurse)//TODO
		
	}
	
	handle.getHistoricalChangesBetween = makeGeneralOperatorHistoricalChangesBetween(paramRels, handle, ws)

	
	//makeSyncGenericGetHistoricalChangesBetween(handle, ws, rel, recurse)//TODO
	
	//handle.getChangesBetween = makeGenericGetChangesBetween(handle, ws, rel, recurse)
	
	return handle
}

function makeSetChangesBetween(handle, ws){
	function setChangesBetween(bindings, startEditId, endEditId, cb){
		//console.log('here: ' + handle.name)
		handle.getStateAt(bindings, startEditId, function(startState){
			handle.getStateAt(bindings, endEditId, function(state){
				//console.log('and here')
				if(startState !== state){
					if(state === undefined){
						cb([{type: 'clear', editId: endEditId, syncId: -1}])
					}else{
						cb([{type: 'set', value: state, editId: endEditId, syncId: -1}])
					}
				}else{
					cb([])
				}
			})
		})
	}
	
	return	setChangesBetween
}

//find the union of the changed versions for the input parameters, use that to reduce the number of comparisons necessary
function makeSyncGenericGetChangesBetween(handle, ws, rel, recurse){

	var paramFuncs = []
	rel.params.forEach(function(p,i){
		paramFuncs[i] = recurse(p)
	})
	
	function syncGenericGetChangesBetween(bindings, startEditId, endEditId, cb){
		if(startEditId === endEditId) _.errout('wasting time')
		
		var snaps = []
		
		var editIds = []
		var has = {}
		
		//console.log('getting ' + JSON.stringify(rel))
		
		var cdl = _.latch(paramFuncs.length, function(){
			if(editIds.length === 0){
				//console.log('no changes ' + startEditId + ' ' + endEditId)
				cb([])
				return
			}
			
			handle.getStateAt(bindings, startEditId, function(startState){
				handle.getStateAt(bindings, endEditId, function(state){
					if(startState === state){
						cb([])
					}else{
						var es = ws.diffFinder(startState, state)
						var changes = []
						es.forEach(function(e){
							e.editId = endEditId
							changes.push(e)
						})
						cb(changes)
					}
				})
			})
		})
		//console.log('here2')
		for(var i=0;i<paramFuncs.length;++i){
			paramFuncs[i].getChangesBetween(bindings, startEditId, endEditId, function(changes){
				changes.forEach(function(c){
					var editId = c.editId
					if(has[editId]) return
					has[editId] = true
					editIds.push(editId)
				})
						
				cdl()
			})
		}
	}
	return syncGenericGetChangesBetween
}

function makeMacroWrapper1(pr, mergeResults){
	var implicit = pr.implicits[0]
	function MacroWrapper1(bindings, editId){
		this.bindings = bindings
		this.editId = editId
	}
	MacroWrapper1.prototype.get = function(av, cb){
		var newBindings = shallowCopy(this.bindings)
		//_.errout('TODO')
		//var w = 
		newBindings[implicit] = makeWrapper(av)
		newBindings.__key = this.bindings.__key+'_'+av
		pr.getStateAt(newBindings, this.editId, cb)
	}
	MacroWrapper1.prototype.mergeResults = mergeResults
	MacroWrapper1.prototype.getArray = function(arr, cb){
		_.assertLength(arr, 1)
		var newBindings = shallowCopy(this.bindings)
		newBindings[implicit] = makeWrapper(arr[0])
		newBindings.__key = this.bindings.__key+'_'+arr[0]
		pr.getStateAt(newBindings, this.editId, cb)
	}
	return MacroWrapper1
}

function makeWrapper(value){
	//_.assertDefined(value)
	var handle = {
		name: 'value*',
		getStateAt: function(bindings, editId, cb){
			//console.log('getting state of value at ' + editId + ' ' + rel.value)
			if(editId === -1){
				cb(undefined)
				return
			}
			cb(value)
		},
		getStateSync: function(bindingValues){
			return value
		},
		getChangesBetween: function(bindings, startEditId, endEditId, cb){
			if(startEditId === -1 && endEditId >= 0 && value !== undefined){
				cb([{type: 'set', value: value, editId: 0}])
			}else{
				cb([])
			}
		}
	}
	handle.getHistoricalChangesBetween = handle.getChangesBetween
	return handle
}
function makeMacroWrapper2(pr, mergeResults){

	var implicitA = pr.implicits[0]
	var implicitB = pr.implicits[1]
	
	function MacroWrapper2(bindings, editId){
		this.bindings = bindings
		this.editId = editId
	}
	MacroWrapper2.prototype.get = function(av, bv, cb){
		var newBindings = shallowCopy(this.bindings)
		newBindings[implicitA] = makeWrapper(av)
		newBindings[implicitB] = makeWrapper(bv)
		newBindings.__key = this.bindings.__key+'_'+av+':'+bv
		pr.getStateAt(newBindings, this.editId, cb)
	}
	MacroWrapper2.prototype.mergeResults = mergeResults
	MacroWrapper2.prototype.getArray = function(arr, cb){
		_.assertLength(arr, 2)
		var newBindings = shallowCopy(this.bindings)
		newBindings[implicitA] = makeWrapper(arr[0])
		newBindings[implicitB] = makeWrapper(arr[1])
		newBindings.__key = this.bindings.__key+'_'+arr[0]+':'+arr[1]
		pr.getStateAt(newBindings, this.editId, cb)
	}
	return MacroWrapper2
}
function makeOperatorRel(s, rel, paramRels, impl, viewName, ws, recurse){


	if(impl.computeSync){
		//_.errout('TODO')
		return makeSyncOperatorRel(s, rel, paramRels, impl, viewName, ws, recurse)
	}else{
		//console.log('computing async: ' + viewName)
	}

	var z = {
		schema: s.schema,
		objectState: s.objectState
	}
	
	var cache = {}

	/*setInterval(function(){
		cache = {}
	}, 15*1000)*/
				//	console.log(new Error().stack)
	
	
	
	var paramFuncs = []
	var paramNamesStr = ''
	paramRels.forEach(function(pr, index){
		if(index>0) paramNamesStr += ','
		paramNamesStr += pr.name
		if(pr.isMacro){
			var macroWrapper
			var mergeResults = makeMerger(pr.schemaType)
			if(pr.manyImplicits === 1){
				
				paramFuncs[index] = makeMacroWrapper1(pr, mergeResults)
			}else if(pr.manyImplicits === 2){
				
				paramFuncs[index] = makeMacroWrapper2(pr, mergeResults)
			}else{
				_.errout('TODO')
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
						rem = undefined
						cb(states)
					}
				})

				//++rem
			}else{
				states[index] = new pf(bindings, editId)
				--rem
				if(rem === 0){
					rem = undefined
					cb(states)
				}
			}
		})
		if(rem === 0){
			cb(states)
		}
	}
	
	var a = analytics.make('general-operator[' + impl.callSyntax.substr(0,impl.callSyntax.indexOf('(')) + ']', paramRels)
	
	var handle = {
		name: nameStr,
		analytics: a,
		getStateAt: function(bindings, editId, cb){
			_.assertFunction(cb)
			_.assertInt(editId)
			_.assertObject(bindings)
			
			var key = bindings.__key+':'+editId
			/*if(cache[key]){
				//console.log('already cached: ' + key + ' ' + JSON.stringify(cache[key]) + ' ' + nameStr)
				cb(cache[key])
				return
			}*/
			//var ttt
			
			function callback(result){
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
	}

	return handle
}

function makeGeneralOperatorHistoricalChangesBetween(paramRels, handle, ws){
	function getHistoricalChangesBetween(bindings, startEditId, endEditId, cb){
		
		var realEditIds = []

		var cdl = _.latch(paramRels.length, function(){
			if(!has[startEditId]) realEditIds.unshift(startEditId)
			if(!has[endEditId]) realEditIds.push(endEditId)
		
			var states = []
			
			var ncdl = _.latch(realEditIds.length, function(){
				var changes = []
				realEditIds.slice(0, realEditIds.length-1).forEach(function(editId, index){
					var es = ws.diffFinder(states[index], states[index+1])
					for(var i=0;i<es.length;++i){
						var e = es[i]
						e.editId = realEditIds[index+1]
						changes.push(e)
					}
				})
				cb(changes)
			})
			
			realEditIds.forEach(function(editId, index){
				handle.getStateAt(bindings, editId, function(v){
					states[index] = v
					ncdl()
				})
			})
			
			
		})

		var has = {}
		paramRels.forEach(function(pr, index){
			if(pr.isMacro){
				cdl()
			}else{
				if(pr.getHistoricalChangesBetween === undefined) _.errout('missing getHistoricalChangesBetween: ' + pr.name)
				
				pr.getHistoricalChangesBetween(bindings, startEditId, endEditId, function(changes){
					changes.forEach(function(c){
						if(has[c.editId]) return
						has[c.editId] = true
						realEditIds.push(c.editId)
					})
					cdl()
				})
			}
		})
	}
	return getHistoricalChangesBetween
}

function makeGenericGetChangesBetween(handle, ws, rel){
	function genericGetChangesBetween(bindings, startEditId, endEditId, cb){
	
		handle.getStateAt(bindings, startEditId, function(startState){
			//if(rel.schemaType.type === 'map') _.assertObject(startState)
			handle.getStateAt(bindings, endEditId, function(state){
				var changes = []
				//console.log('states('+startEditId+','+endEditId+'): ' + JSON.stringify(startState) + ' -> ' + JSON.stringify(state))
				var es = ws.diffFinder(startState, state)
				for(var i=0;i<es.length;++i){
					var e = es[i]
					e.editId = endEditId
					changes.push(e)
				}
				cb(changes)
			})
		})
	}
	return genericGetChangesBetween
}
function makeSwitchRel(s, context, cases, defaultCase, ws, rel){

	function getCurrentCase(bindings, editId, cb){
		var caseValues = []
		var contextState
		var cdl = _.latch(cases.length+1, function(){

			if(!_.isPrimitive(contextState)) _.errout('TODO: ' + JSON.stringify(state))
			
			for(var i=0;i<caseValues.length;++i){
				var cv = caseValues[i]
				if(!_.isPrimitive(cv)) _.errout('TODO: ' + JSON.stringify(cv))
				if(cv === contextState){
					cases[i].expr
					cb(cases[i].expr,cv)
					return
				}
			}
			if(!defaultCase) _.errout('ERROR: all cases ' + JSON.stringify(caseValues) + ' failed to match ' + JSON.stringify(contextState)+', need default case for value: ' + JSON.stringify(contextState))
			
			//console.log('default case')
			cb(defaultCase, 'default case', contextState)
		})
		cases.forEach(function(c, index){
			c.value.getStateAt(bindings, editId, function(state){
				caseValues[index] = state
				cdl()
			})
		})
		context.getStateAt(bindings, editId, function(state){
			contextState = state
			cdl()
		})
	}
	
	var aChildren = [context]
	cases.forEach(function(c){aChildren.push(c.expr);aChildren.push(c.value);})
	if(defaultCase) aChildren.push(defaultCase)
	var a = analytics.make('switch', aChildren)
	
	var handle = {
		name: 'switch',
		analytics: a,
		getStateAt: function(bindings, editId, cb){
			
			getCurrentCase(bindings, editId, function(currentCase,cv,currentState){
				//console.log('currentCase: ' + JSON.stringify(currentCase) + ' ' + JSON.stringify(cv) + ' ' + JSON.stringify(currentState))
				currentCase.getStateAt(bindings, editId, cb)
			})
		}
	}
	//handle.getInclusionsDuring = wu.makeGenericGetInclusionsDuring(handle, ws)
	handle.getChangesBetween = makeGenericGetChangesBetween(handle, ws, rel)
	
	handle.getHistoricalChangesBetween = function(bindings, startEditId, endEditId, cb){
		_.errout('TODO')
		/*context.getStateAt(bindings, editId, function(contextState){
			context.getChangesBetween(bindings, editId, function(contextChanges){
				if(contextChanges.length === 0){
					getCurrentCase(bindings, editId, function(currentCase,cv,currentState){
					
				}else{
					_.errout('TODO')
				}
			})
		})*/
	}
	
	return handle
}

function makePreforkedRel(s, obj, preforkedObj){

	function getPropertyValueAt(bindings, id, propertyCode, editId, cb){
		_.assertUndefined(id.inner)
		
		function convertIds(arr){
			var result = []
			arr.forEach(function(v){
				if(v instanceof InnerId){
					v = innerify(id.top||id,v.inner)
				}
				result.push(v)
			})
			return result
		}
		s.objectState.getPropertyValueAt(id.top, propertyCode, editId, function(pv){
			if(pv && (!_.isArray(pv)) && (!_.isObject(pv) || pv instanceof InnerId)){
				//console.log('got pv: ' + JSON.stringify(pv))
				//console.log('pv overrides')
				
				cb(pv, id)
			}else{
				_.assertInt(editId)
				preforkedObj.getStateAt(bindings, editId, function(preforkedId){
					if(!preforkedId){
						//console.log('null preforked id')
						cb(pv, id)
						return
					}
					s.objectState.getPropertyValueAt(preforkedId, propertyCode, editId, function(pfPv){
						if(pv){
							if(_.isArray(pv)){
								if(pv.length === 0){
									//console.log('pv ' + id + '.' + propertyCode + ' is length 0 at ' + editId)
									//console.log('returning pf: ' + JSON.stringify(pfPv))
									//_.errout('TODO: convert pf inner ids to have fork top id')
									
									//console.log('got via preforked ' + id + '.' + propertyCode + ' ' + editId + ' ' + JSON.stringify(convertIds(pfPv)))
									cb(convertIds(pfPv), id)
									return
								}else{
									var result = [].concat(pv)
									convertIds(pfPv).forEach(function(v){
										if(result.indexOf(v) === -1){
											result.push(v)
										}
									})
									//console.log('got via preforked ' + id + '.' + propertyCode + ' ' + editId + ' ' + JSON.stringify(result))
									cb(result, id)
									return
								}
							}
							_.errout('TODO merge ' + JSON.stringify([pv,pfPv]))	
							
						}else{
							//console.log('no pv')
							//_.errout('TODO: convert pf inner ids to have fork top id')
							if(_.isArray(pfPv)){
								//console.log('got via preforked ' + id + '.' + propertyCode + ' ' + editId + ' ' + JSON.stringify(pfPv))
								cb(convertIds(pfPv), id)
							}else{
								if(pfPv instanceof InnerId){
									pfPv = innerify(id, pfPv.inner)
								}
								//console.log('got via preforked ' + id + '.' + propertyCode + ' ' + editId + ' ' + JSON.stringify(pfPv))
								cb(pfPv, id)
							}
						}
					})
				})
			}
		})
	}
	
	var a = analytics.make('preforked', [obj])
	return {
		name: 'preforked('+obj.name+')',
		analytics: a,
		getConfiguredId: function(id, bindings, editId, cb){
			var boundGetPropertyValueAt = getPropertyValueAt.bind(undefined, bindings)
			if(_.isObject(id)){
				_.assertInt(id.top)
				var newIdObj = innerify(id.top, id.inner)
				newIdObj.getPropertyValueAt = boundGetPropertyValueAt
				cb(newIdObj)
			}else{
				var newIdObj = innerify(id, undefined)
				newIdObj.getPropertyValueAt = boundGetPropertyValueAt
				cb(newIdObj)
			}
		},
		getStateAt: function(bindings, editId, cb){
			
			var boundGetPropertyValueAt = getPropertyValueAt.bind(undefined, bindings)
			
			obj.getStateAt(bindings, editId, function(id){
				if(_.isObject(id)){
					_.assertInt(id.top)
					var newIdObj = innerify(id.top, id.inner)
					newIdObj.getPropertyValueAt = boundGetPropertyValueAt
					cb(newIdObj)
				}else{
					var newIdObj = innerify(id, undefined)
					newIdObj.getPropertyValueAt = boundGetPropertyValueAt
					cb(newIdObj)
				}
			})
		},
		getChangesBetween: function(bindings, startEditId, endEditId, cb){
			_.errout('TODO')
		}
	}
}

function makeContextWrappedWithCache(exprHandle){
	function contextWrappedWithCache(){
		var cachedState
		var cachedEditId
		
		var cacheChanges
		var cachedChangesRange
		
		var cachedHistoricalChanges
		var cachedHistoricalRange
		return {
			name: 'let-cache(' + exprHandle.name + ')',
			getStateAt: function(bindings, editId, cb){
				if(editId === cachedEditId){
					cb(cachedState)
					return
				}
				exprHandle.getStateAt(bindings, editId, function(state){
					//console.log('miss ' + editId)
					//console.log(new Error().stack)
					cachedEditId = editId
					cachedState = state
					cb(state)
				})
			},
			getChangesBetween: function(bindings, startEditId, endEditId, cb){
				//exprHandle.getChangesBetween(bindings, startEditId, endEditId, cb)
				var key = startEditId+':'+endEditId
				if(key === cachedChangesRange){
					cb(cachedState)
					return
				}
				exprHandle.getChangesBetween(bindings, startEditId, endEditId, function(changes){
					cachedChangesRange = key
					cacheChanges = changes
					cb(changes)
				})
			},
			getHistoricalChangesBetween: function(bindings, startEditId, endEditId, cb){
				//exprHandle.getHistoricalChangesBetween(bindings, startEditId, endEditId, cb)
				var key = startEditId+':'+endEditId
				if(key === cachedHistoricalRange){
					cb(cachedHistoricalChanges)
					return
				}
				exprHandle.getHistoricalChangesBetween(bindings, startEditId, endEditId, function(changes){
					cachedHistoricalRange = key
					cachedHistoricalChanges = changes
					cb(changes)
				})
			}
		}
	}
	return contextWrappedWithCache
}
function stub(){}

exports.make = function(s, rel, recurse, getViewHandle){

	var ws
	if(rel.schemaType){
		ws = wu.makeUtilities(rel.schemaType)
	}
	
	var handle
	
	if(rel.type === 'view'){
		if(rel.view === 'property'){
			var propertyName = rel.params[0].value
			var context = recurse(rel.params[1])
			
			if(propertyName === 'id'){
				handle = makeIdRel(s, context)
			}else if(propertyName === 'uuid'){
				handle = makeUuidRel(s, context)
			}else{

				var contextType = rel.params[1].schemaType
				var resultType = rel.params[0].schemaType
			
				if(propertyName === 'values'){
					_.assert(contextType.type === 'map')
					handle = makeValuesRel(s, context, resultType, contextType)
				}else{
			
					var objName = contextType.object
					if(contextType.members) objName = contextType.members.object
					if(objName === undefined) _.errout('cannot construct property with context type: ' + JSON.stringify(contextType))
			
					var objSchema = s.schema[objName]
					//console.log(JSON.stringify([contextType, propertyName]))
					if(objSchema.properties[propertyName] === undefined) _.errout('cannot find property ' + objSchema.name + '.' + propertyName)
					var propertyType = objSchema.properties[propertyName].type
			
					handle = wrapProperty(s, propertyName, propertyType, contextType, resultType, context, ws)
				}
			}	
		}else if(rel.view === 'switch'){
			var context = recurse(rel.params[0])
			var remainder = rel.params.slice(1)
			var cases = []
			var defaultCase
			remainder.forEach(function(rp){
				if(rp.view === 'default'){
					defaultCase = recurse(rp.params[0])
				}else{
					if(rp.view !== 'case'){
						//console.log(JSON.stringify())
						_.errout('invalid non-case case: ' + JSON.stringify(rp))
					}
					_.assertEqual(rp.view, 'case')
					var caseValue = rp.params[0]
					var caseExpr = rp.params[1]
					cases.push({value: recurse(caseValue), expr: recurse(caseExpr)})
				}
			})
			handle = makeSwitchRel(s, context, cases, defaultCase, ws, rel)
		}else if(rel.view === 'preforked'){
			var obj = recurse(rel.params[0])
			var preforkedObj = recurse(rel.params[1])
			handle = makePreforkedRel(s, obj, preforkedObj)
		}else if(rel.view === 'lastVersion'){
			var context = recurse(rel.params[0])
			var a = analytics.make('lastVersion', [context])
			handle = {
				name: 'lastVersion('+context.name+')',
				analytics: a,
				getStateAt: function(bindings, editId, cb){
					context.getStateAt(bindings, editId, function(state){
						if(_.isArray(state)) _.errout('cannot get lastVersion of multiple objects')
					
						if(state){
							s.objectState.getLastVersionAt(state, editId, function(v){
								cb(v)
							})
						}else{
							cb(undefined)
						}
						
					})
				}
			}
			handle.getChangesBetween = makeGenericGetChangesBetween(handle, ws, rel)
			
		}else if(rel.view === 'versions'){
			//_.errout('TODO')
			var context = recurse(rel.params[0])
			var a = analytics.make('versions', [context])
			handle = {
				name: 'versions('+context.name+')',
				analytics: a,
				getStateAt: function(bindings, editId, cb){
					context.getStateAt(bindings, editId, function(state){
						//console.log('getting versions of: ' + JSON.stringify(state))
						if(_.isArray(state)){
							var has = {}
							var results = []
							var cdl = _.latch(state.length, function(){
								//console.log(JSON.stringify(state) + ' -> ' +JSON.stringify(results) + ' at ' + editId)
								cb(results)
							})
							state.forEach(function(id){
								s.objectState.getVersionsAt(id, editId, function(vs){
									//console.log('got versions: ' + JSON.stringify(vs))
									vs.forEach(function(v){
										if(has[v]) return
										has[v] = true
										results.push(v)
									})
									cdl()
								})
							})
						}else{
							if(state){
								s.objectState.getVersionsAt(state, editId, function(vs){
									cb(vs)
								})
							}else{
								cb()
							}
						}
					})
				}
			}
			handle.getChangesBetween = makeGenericGetChangesBetween(handle, ws, rel)
		}else if(rel.view === 'typeset'){
			//just a performance optimization really (might allow removal of z.editId)
			
			var typeName = rel.params[0].value
			_.assertString(typeName)
			var typeCode = s.schema[typeName].code
			_.assertInt(typeCode)
			
			var lastValue
			var lastEditId

			var nameStr = 'typeset-impl['+typeName+']'
			var a = analytics.make(nameStr, [])
			
			handle = {
				name: nameStr,
				analytics: a,
				getConfiguredIdAt: function(id, bindings, editId, cb){
					cb(id)
				},
				getStateAt: function(bindings, editId, cb){
					if(lastEditId === editId){
						cb([].concat(lastValue))
						return
					}
					s.objectState.getAllIdsOfTypeAt(typeCode, editId, function(ids){
						a.gotTypeIds(typeCode)
						//console.log('got typeset: ' + typeCode + ' ' + editId + ' ' + ids.length)
						//console.log(new Error().stack)
						lastValue = ids
						lastEditId = editId
						
						cb([].concat(ids))
					})
				},
				getChangesBetween: function(bindings, startEditId, endEditId, cb){
					//console.log('here')
					s.objectState.getIdsCreatedOfTypeBetween(typeCode, startEditId, endEditId, function(ids){
						var changes = []
						for(var i=0;i<ids.length;++i){
							var id = ids[i]
							changes.push({type: 'add', value: id, editId: endEditId, syncId: -1})
						}
						//console.log('got typeset changes: ' + startEditId + ' ' + endEditId + ' changes: ' + JSON.stringify(changes))
						cb(changes)
					})
				},
				getHistoricalChangesBetween: function(bindings, startEditId, endEditId, cb){
					s.objectState.getCreationsOfTypeBetween(typeCode, startEditId, endEditId, function(creations){
						var changes = []
						for(var i=0;i<creations.length;++i){
							var c = creations[i]
							changes.push({type: 'add', value: c.id, editId: c.editId, syncId: -1})
						}
						//console.log('got typeset changes: ' + startEditId + ' ' + endEditId + ' changes: ' + JSON.stringify(changes))
						cb(changes)
					})
				},
				getMayHaveChanged: function(bindings, startEditId, endEditId, cb){
					s.objectState.getChangedDuringOfType(typeCode, startEditId, endEditId, cb)
				}
			}
		}else{
			 
			if(s.schema[rel.view]){
				return getViewHandle(rel.view, rel)
			}
			
			if(rel.view === 'each-optimization'){
				handle = eachOptimization.make(s, rel, recurse, handle, ws)
			}else if(rel.view === 'subset-optimization-with-params'){
				handle = subsetOptimization.make(s, rel, recurse, handle, ws)
			}else if(rel.isSubsetOptimizationMultimap){
				//_.errout('TODO')
				handle = multimapOptimization.make(s, rel, recurse, handle, ws)
			}else if(rel.view === 'count' && rel.params[0].view === 'typeset'){
				//_.errout('TODO')
				var objName = rel.params[0].params[0].value
				var nameStr = 'count-typeset-optimization['+objName+']'
				var a = analytics.make(nameStr, [])
				//_.errout('TODO: ' + JSON.stringify(rel) + ' ' + objName)
				var typeCode = s.schema[objName].code
				handle = {
					name: nameStr,
					getStateAt: function(bindings, editId, cb){
						s.objectState.getManyOfTypeAt(typeCode,editId,cb)
						//console.log('getting state of value at ' + editId + ' ' + rel.value)

					},

					getChangesBetween: function(bindings, startEditId, endEditId, cb){
						s.objectState.getManyOfTypeAt(typeCode,startEditId,function(startCount){
							s.objectState.getManyOfTypeAt(typeCode,endEditId,function(endCount){
								if(startCount !== endCount){
									cb([{type: 'set', value: endCount, editId: endEditId}])
								}else{
									cb([])
								}
							})
						})

					},
					analytics: a
				}
			}else{
				var impl = schema.getImplementation(rel.view)
				_.assertDefined(impl)
				var paramRels = []
				//console.log(JSON.stringify(rel, null, 2))
				for(var i=0;i<rel.params.length;++i){
					var p = rel.params[i]
					var pr = recurse(p)
					//console.log(JSON.stringify(p))
					if(p.schemaType === undefined) _.errout('missing schemaType: ' + JSON.stringify(p))
					_.assertObject(p.schemaType)
					pr.schemaType = p.schemaType
					paramRels.push(pr)
				}
				handle = makeOperatorRel(s, rel, paramRels, impl, rel.view, ws, recurse)
			
				/*if(rel.view === 'each' && rel.params[1].expr.view === 'filter'){
				 	handle = subsetOptimization.make(s, rel, paramRels, impl, rel.view, ws, handle, recurse)
				}*/
				if(rel.view === 'map'){
					handle = mapOptimization.make(s, rel, recurse, handle, ws)
					//console.log(JSON.stringify(rel))
					//_.errout('TODO')
				}
			}
		}
	}else if(rel.type === 'value' || rel.type === 'int'){
		var nameStr = 'value['+rel.value+']'
		var a = analytics.make(nameStr, [])
		handle = {
			name: nameStr,
			getStateAt: function(bindings, editId, cb){
				//console.log('getting state of value at ' + editId + ' ' + rel.value)
				if(editId === -1){
					cb(undefined)
					return
				}
				_.assertDefined(rel.value)
				cb(rel.value)
			},
			getStateSync: function(){
				return rel.value
			},
			isFullySync: true,
			getChangesBetween: function(bindings, startEditId, endEditId, cb){
				if(startEditId === -1 && endEditId >= 0){
					cb([{type: 'set', value: rel.value, editId: 0}])
				}else{
					cb([])
				}
			},
			analytics: a
		}
		handle.getHistoricalChangesBetween = handle.getChangesBetween
	}else if(rel.type === 'macro'){
		_.assertInt(rel.manyImplicits)
		var inner = recurse(rel.expr)
		if(!inner.getStateAt) _.errout('missing getStateAt: ' + inner.name + ' ' + inner.getChangesBetween)
		//TODO REMOVEME?

		var a = analytics.make('macro', [inner])

		handle = {
			name: 'macro['+inner.name+']',
			analytics: a,
			isMacro: true,
			manyImplicits: rel.manyImplicits,
			implicits: rel.implicits,
			getStateAt: function(bindings, editId, cb){
				inner.getStateAt(bindings, editId, cb)
			},
			getChangesBetween: function(bindings, startEditId, endEditId, cb){
				_.errout('TODO?')
			}
		}
	}else if(rel.type === 'param'){
		var paramName = rel.name
		if(!rel.schemaType) _.errout('missing schemaType: ' + JSON.stringify(rel))
		var isObject = rel.schemaType.type === 'object'
		var nameStr = 'param['+(rel.schemaType.object||rel.schemaType.primitive||rel.schemaType.view)+':'+rel.name+']'
		var a = analytics.make(nameStr, [])

		handle = {
			name: nameStr,
			getStateSync: function(bindingValues){
				var b = bindingValues[paramName]
				//if(isObject && b === undefined) _.errout('param missing: ' + JSON.stringify([paramName, bindingValues]))
				//console.log(paramName + ' -> ' + JSON.stringify(b))
				return b
			},
			isFullySync: true,
			getConfiguredIdAt: function(id, bindings, editId, cb){
				handle.getStateAt(bindings, editId, function(realId){
					_.assert(realId === id || (realId.top === id.top && realId.inner === id.inner))
					cb(realId)
				})
			},
			getStateAt: function(bindings, editId, cb){
				if(editId >= 0){
					var b = bindings[paramName]
					//cb(b)
					if(b === undefined) _.errout('missing binding: ' + paramName + ' got: ' + JSON.stringify(Object.keys(bindings)))
					b.getStateAt(bindings, editId, function(v){
						cb(v)
					})
				}else{
					cb(undefined)
				}
			},
			getChangesBetween: function(bindings, startEditId, endEditId, cb){
				if(startEditId > 0){
					//console.log('startEditId greater ' + startEditId + ',' + endEditId)
					cb([])
				}else if(endEditId >= 0){
					var b = bindings[paramName]
					b.getStateAt(bindings, endEditId, function(v){
						if(v===undefined){
							//console.log('no binding')
							cb([])
						}else{
							cb([{type: 'set', value: v, editId: endEditId}])//, editId: bindings.__bindingTimes[paramName]}])
						}
					})
				}else{
					//console.log('startEditId lesser ' + startEditId + ',' + endEditId)
					cb([])
				}
				//var b = bindings[paramName]
				//b.getChangesBetween(bindings, startEditId, endEditId, cb)
			},
			getHistoricalChangesBetween: function(bindings, startEditId, endEditId, cb){
				/*if(startEditId > 0){
					//console.log('startEditId greater ' + startEditId + ',' + endEditId)
					cb([])
				}else if(endEditId >= 0){*/
					var b = bindings[paramName]
					if(b.getHistoricalChangesBetween === undefined) _.errout('missing getHistoricalChangesBetween: ' + b.name)
					b.getHistoricalChangesBetween(bindings, startEditId, endEditId, function(changes){
						/*if(v===undefined){
							//console.log('no binding')
							cb([])
						}else{
							cb([{type: 'set', value: v, editId: endEditId}])//, editId: bindings.__bindingTimes[paramName]}])
						}*/
						if(changes.length > 0){
							//_.errout('TODO: ' + JSON.stringify(changes))
							cb(changes)
						}else{
							cb([])
						}
					})
				/*}else{
					//console.log('startEditId lesser ' + startEditId + ',' + endEditId)
					cb([])
				}*/
			},
			analytics: a
		}
		
	}else if(rel.type === 'nil'){
		var a = analytics.make('nil', [])
		handle = {
			name: 'nil',
			getStateAt: function(bindings, editId, cb){
				cb(undefined);
			},
			getChangesBetween: function(bindings, startEditId, endEditId, cb){cb([]);},
			analytics: a
		}
	}else if(rel.type === 'let'){
		var exprHandle = recurse(rel.expr)
		var subHandle = recurse(rel.rest)
		
		var contextWrappedWithCache = makeContextWrappedWithCache(exprHandle)
		
		if(subHandle.getHistoricalChangesBetween === undefined) _.errout('missing getHistoricalChangesBetween: ' + subHandle.name)
		
		var a = analytics.make('let:'+rel.name+'('+exprHandle.name+','+subHandle.name+')', [exprHandle, subHandle])
		handle = {
			name: 'let(' + subHandle.name + ')',
			getStateAt: function(bindings, editId, cb){
				var newBindings = _.extend({}, bindings)
				newBindings[rel.name] = contextWrappedWithCache()//exprHandle//TODO wrap this in localized caching?
				//console.log('in let')
				subHandle.getStateAt(newBindings, editId, cb)
			},
			getChangesBetween: function(bindings, startEditId, endEditId, cb){
				//_.errout('TODO')
				var newBindings = _.extend({}, bindings)
				newBindings[rel.name] = contextWrappedWithCache()//exprHandle
				//console.log('in let')
				subHandle.getChangesBetween(newBindings, startEditId, endEditId, cb)
			},
			getHistoricalChangesBetween: function(bindings, startEditId, endEditId, cb){
				//_.errout('TODO')
				var newBindings = _.extend({}, bindings)
				newBindings[rel.name] = contextWrappedWithCache()//exprHandle
				//console.log('in let')
				subHandle.getHistoricalChangesBetween(newBindings, startEditId, endEditId, cb)
			},
			analytics: a
		}
	}

	if(!handle) _.errout(JSON.stringify(rel))
	
	handle.changeToEdit = function(c){
		//console.log(JSON.stringify(rel.schemaType))
		return ws.convertToEdit(c)
	}
	
	handle.extractInclusions = function(changes){
		return ws.extractInclusions(changes)
	}
	
	return handle

	
}
