
var _ = require('underscorem')

var schema = require('./../shared/schema')

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

function makeIdRel(s, context){
	return {
		name: 'property-id',
		getStateAt: function(bindings, editId, cb){
			context.getStateAt(bindings, editId, function(id){
				cb([''+id])
			})
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
		}
	}
}

function makeUuidRel(s, context){
	return {
		name: 'property-id',
		getStateAt: function(bindings, editId, cb){
			context.getStateAt(bindings, editId, function(id){
				cb([''+id])
			})
		},
		getChangesBetween: function(bindings, startEditId, endEditId, cb){
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
	var handle = {
		name: 'property-map-values',
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
	
	function makeParams(bindings, editId, cb){
		
		var rem = paramRels.length
		var states = []
		paramRels.forEach(function(pr, index){
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
	if(rel.schemaType.type === 'primitive' || rel.schemaType.type === 'object' || rel.schemaType.type === 'view'){
		defaultValue = undefined
	}else if(rel.schemaType.type === 'set' || rel.schemaType.type === 'list'){
		defaultValue = []
	}else if(rel.schemaType.type === 'map'){
		defaultValue = {}
	}else{
		_.errout('TODO: ' + JSON.stringify(rel.schemaType))
	}

	var handle = {
		name: 'general-operator-sync(' + impl.callSyntax + ')',
		getStateAt: function(bindings, editId, cb){
			_.assertFunction(cb)
			_.assertInt(editId)
			_.assertObject(bindings)
			
			if(editId === -1){
				cb(defaultValue)
				return
			}
			
			function computeResult(){
				var zl = {schema: z.schema, objectState: z.objectState}//_.extend({}, z)
				_.assertInt(editId)
				zl.editId = editId
				
				var cp = [zl].concat(paramStates)
				
				var result = impl.computeSync.apply(undefined, cp)
				//console.log('computed sync ' + impl.callSyntax + ': ' + JSON.stringify(result) +' at ' + editId)
				cb(result)
			}
			
			var paramStates = []
			
			//console.log('making params')
			makeParams(bindings, editId, function(states){
				//console.log('got states: ' + JSON.stringify(states))
				paramStates = states
				computeResult()
			})
		},
		
	}
	
	if(rel.schemaType.type === 'primitive' || rel.schemaType.type === 'object' || rel.schemaType.type === 'view'){
		//_.errout('TODO')
		handle.getChangesBetween = makeSetChangesBetween(handle, ws)
	}else{
		handle.getChangesBetween = makeSyncGenericGetChangesBetween(handle, ws, rel, recurse)
	}
	
	//handle.getChangesBetween = makeGenericGetChangesBetween(handle, ws, rel, recurse)
	
	return handle
}

function makeSetChangesBetween(handle, ws){
	function setChangesBetween(bindings, startEditId, endEditId, cb){
		//console.log('here: ' + handle.name)
		handle.getStateAt(bindings, startEditId, function(startState){
			handle.getStateAt(bindings, endEditId, function(state){
				if(startState !== state){
					cb([{type: 'set', value: state, editId: endEditId, syncId: -1}])
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
							e.editId = endEditId//editId+1
							changes.push(e)
						})
						cb(changes)
					}
				})
			})
			
			/*editIds.sort(function(a,b){return a-b;})
			console.log('here: ' + JSON.stringify(editIds))
			var snaps = []*/
			
			
			/*var ndl = _.latch(editIds.length+1, function(){
				var changes = []
				editIds.forEach(function(editId, i){
					var nextEditId = editIds[i+1] || editId+1
					console.log('comparing ' +editId + ' ' + nextEditId + ' ' + JSON.stringify([snaps[i],snaps[i+1]]))
					var es = ws.diffFinder(snaps[i], snaps[i+1])
					es.forEach(function(e){
						e.editId = nextEditId//editId+1
						changes.push(e)
					})
				})
				console.log('cbing: ' + JSON.stringify(changes))
				cb(changes)
			})
			
			editIds.forEach(function(editId, i){
				
				handle.getStateAt(bindings, editId, _.assureOnce(function(state){
					snaps[i] = ws.validateState(state)
					ndl()
				}))
			})
			
			handle.getStateAt(bindings, editIds[editIds.length-1]+1, _.assureOnce(function(state){
				snaps[snaps.length] = ws.validateState(state)
				ndl()
			}))*/
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
				
				//console.log('changes: ' + JSON.stringify(changes))
				
				//temporary debugging check
				/*if(changes.length === 0){
					paramFuncs[i].getStateAt(bindings, startEditId, function(startState){
						paramFuncs[i].getStateAt(bindings, endEditId, function(state){
							console.log(startEditId + ' ' + endEditId + ' ' + paramFuncs[i].name)
							_.assertEqual(JSON.stringify(startState), JSON.stringify(state))
							cdl()
						})
					})
					return
				}*/
				
				cdl()
			})
		}
	}
	return syncGenericGetChangesBetween
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

	setInterval(function(){
		cache = {}
	}, 15*1000)
				//	console.log(new Error().stack)
	
	function makeWrapper(value){
		//_.assertDefined(value)
		return {
			name: 'value',
			getStateAt: function(bindings, editId, cb){
				//console.log('getting state of value at ' + editId + ' ' + rel.value)
				if(editId === -1){
					cb(undefined)
					return
				}
				cb(value)
			},
			getChangesBetween: function(bindings, startEditId, endEditId, cb){
				if(startEditId === -1 && endEditId >= 0 && value !== undefined){
					cb([{type: 'set', value: value, editId: 0}])
				}else{
					cb([])
				}
			}
		}
	}
	
	var paramFuncs = []
	paramRels.forEach(function(pr, index){
		if(pr.isMacro){
			var macroWrapper
			var mergeResults = makeMerger(pr.schemaType)
			if(pr.manyImplicits === 1){
				function MacroWrapper1(bindings, editId){
					this.bindings = bindings
					this.editId = editId
				}
				MacroWrapper1.prototype.get = function(av, cb){
					var newBindings = shallowCopy(this.bindings)
					//var w = 
					newBindings[pr.implicits[0]] = makeWrapper(av)
					newBindings.__key = this.bindings.__key+'_'+av
					pr.getStateAt(newBindings, this.editId, cb)
				}
				MacroWrapper1.prototype.mergeResults = mergeResults
				MacroWrapper1.prototype.getArray = function(arr, cb){
					_.assertLength(arr, 1)
					var newBindings = shallowCopy(this.bindings)
					newBindings[pr.implicits[0]] = makeWrapper(arr[0])
					newBindings.__key = this.bindings.__key+'_'+arr[0]
					pr.getStateAt(newBindings, this.editId, cb)
				}
				paramFuncs[index] = MacroWrapper1
			}else if(pr.manyImplicits === 2){
				function MacroWrapper2(bindings, editId){
					this.bindings = bindings
					this.editId = editId
				}
				MacroWrapper2.prototype.get = function(av, bv, cb){
					var newBindings = shallowCopy(this.bindings)
					newBindings[pr.implicits[0]] = makeWrapper(av)
					newBindings[pr.implicits[1]] = makeWrapper(bv)
					newBindings.__key = this.bindings.__key+'_'+av+':'+bv
					pr.getStateAt(newBindings, this.editId, cb)
				}
				MacroWrapper2.prototype.mergeResults = mergeResults
				MacroWrapper2.prototype.getArray = function(arr, cb){
					_.assertLength(arr, 2)
					var newBindings = shallowCopy(this.bindings)
					newBindings[pr.implicits[0]] = makeWrapper(arr[0])
					newBindings[pr.implicits[1]] = makeWrapper(arr[1])
					newBindings.__key = this.bindings.__key+'_'+arr[0]+':'+arr[1]
					pr.getStateAt(newBindings, this.editId, cb)
				}
				paramFuncs[index] = MacroWrapper2
			}else{
				_.errout('TODO')
			}
		}else{
			//do nothing
		}
	})	
	
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
	
	var handle = {
		name: 'general-operator(' + impl.callSyntax + ')',
		getStateAt: function(bindings, editId, cb){
			_.assertFunction(cb)
			_.assertInt(editId)
			_.assertObject(bindings)
			
			var key = bindings.__key+':'+editId//JSON.stringify(bindings)+':'+editId
			if(cache[key]){
				console.log('already cached: ' + key + ' ' + JSON.stringify(cache[key]))
				cb(cache[key])
				return
			}
			
			function callback(result){
				//clearTimeout(ttt)
				/*if(cache[key]){
					if(JSON.stringify(cache[key]) !== JSON.stringify(result)){
						_.errout('different(' + editId+'): \n' + JSON.stringify(cache[key]) +'\n' + JSON.stringify(result) + '\n'+key +'\n'+impl.callSyntax)
					}
				}*/
				cache[key] = result
				//console.log('cached ' + key + ' ' + JSON.stringify(cache[key]) + ' ' + impl.callSyntax)
				cb(result)
			}
			//var ttt
			function computeResult(paramStates){
				//console.log('DOOOOO: '+viewName + ' ' + paramStates.length)
				_.assertEqual(paramStates.length, paramRels.length)
				
				/*ttt = setTimeout(function(){
					console.log('view did not complete: ' + viewName + ' ' + JSON.stringify(paramStates))
				},3000)*/
				
				/*var zl = {schema: z.schema, objectState: z.objectState}//_.extend({}, z)
				_.assertInt(editId)
				zl.editId = editId*/
				
				
				
				var cp = [z, _.assureOnce(callback)].concat(paramStates)
				//cp = cp.concat(paramStates)
				if(!impl.computeAsync) _.errout('needs computeAsync: ' + viewName + ', got: ' + JSON.stringify(Object.keys(impl)))
				
				impl.computeAsync.apply(undefined, cp)
			}
			
			makeParams(bindings, editId, computeResult)
		},
		
	}
	
	if(rel.schemaType.type === 'primitive' || rel.schemaType.type === 'object' || rel.schemaType.type === 'view'){
		handle.getChangesBetween = makeSetChangesBetween(handle, ws)
	}else{
		handle.getChangesBetween = makeGenericGetChangesBetween(handle, ws, rel)
	}

	return handle
}
function makeGenericGetChangesBetween(handle, ws, rel){
	function genericGetChangesBetween(bindings, startEditId, endEditId, cb){
	
		handle.getStateAt(bindings, startEditId, function(startState){
			//if(rel.schemaType.type === 'map') _.assertObject(startState)
			handle.getStateAt(bindings, endEditId, function(state){
				var changes = []
				var es = ws.diffFinder(startState, state)
				for(var i=0;i<es.length;++i){
					var e = es[i]
					e.editId = endEditId
					changes.push(e)
				}
				cb(changes)
			})
		})
	
		//var snaps = []

				
		//console.log('doing generic for: ' + handle.name)

		/*var cdl = _.latch(1+endEditId-startEditId, 900, function(){
			//_.errout('TODO('+startEditId+','+endEditId+'): ' + JSON.stringify(snaps))
			//console.log('HERE: ' + (1+endEditId-startEditId) + ' ' + '1+'+endEditId+'-'+startEditId)
			var changes = []
			wu.range(startEditId, endEditId, function(editId, index){
				//console.log('finding diff: '+ JSON.stringify([snaps[index], snaps[index+1]]))
				var es = ws.diffFinder(snaps[index], snaps[index+1])
				for(var i=0;i<es.length;++i){
					var e = es[i]
					e.editId = editId+1
					changes.push(e)
				}
			})
		
			//console.log('all changes for ' + handle.name + ' between ' + startEditId + ',' + endEditId + ': ' + JSON.stringify(changes))
			cb(changes)
		})
		console.log('getting states between ' + startEditId + ' ' + (endEditId+1) + ' for ' + handle.name)
		wu.range(startEditId, endEditId+1, function(editId, index){
			//console.log('getting state at: ' + editId)
			if(editId === -1){
				snaps[index] = ws.defaultState
				cdl()
			}else{
				handle.getStateAt(bindings, editId, _.assureOnce(function(state){
					snaps[index] = ws.validateState(state)
					cdl()
				}))
			}
		})*/
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
	var handle = {
		name: 'switch',
		getStateAt: function(bindings, editId, cb){
			
			getCurrentCase(bindings, editId, function(currentCase,cv,currentState){
				//console.log('currentCase: ' + JSON.stringify(currentCase) + ' ' + JSON.stringify(cv) + ' ' + JSON.stringify(currentState))
				currentCase.getStateAt(bindings, editId, cb)
			})
		}
	}
	handle.getInclusionsDuring = wu.makeGenericGetInclusionsDuring(handle, ws)
	handle.getChangesBetween = makeGenericGetChangesBetween(handle, ws, rel)
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
		//console.log('getting via preforked ' + id + '.' + propertyCode + ' ' + editId)
		s.objectState.getPropertyValueAt(id.top, propertyCode, editId, function(pv){
			if(pv && (!_.isArray(pv)) && (!_.isObject(pv) || pv instanceof InnerId)){
				//console.log('got pv: ' + JSON.stringify(pv))
				//console.log('pv overrides')
				
				cb(pv)
			}else{
				_.assertInt(editId)
				preforkedObj.getStateAt(bindings, editId, function(preforkedId){
					if(!preforkedId){
						//console.log('null preforked id')
						cb(pv)
						return
					}
					s.objectState.getPropertyValueAt(preforkedId, propertyCode, editId, function(pfPv){
						if(pv){
							if(_.isArray(pv)){
								if(pv.length === 0){
									//console.log('pv ' + id + '.' + propertyCode + ' is length 0 at ' + editId)
									//console.log('returning pf: ' + JSON.stringify(pfPv))
									//_.errout('TODO: convert pf inner ids to have fork top id')
									
									cb(convertIds(pfPv))
									return
								}else{
									var result = [].concat(pv)
									convertIds(pfPv).forEach(function(v){
										if(result.indexOf(v) === -1){
											result.push(v)
										}
									})
									cb(result)
									return
								}
							}
							_.errout('TODO merge ' + JSON.stringify([pv,pfPv]))	
							
						}else{
							//console.log('no pv')
							//_.errout('TODO: convert pf inner ids to have fork top id')
							if(_.isArray(pfPv)){
								cb(convertIds(pfPv))
							}else{
								if(pfPv instanceof InnerId){
									pfPv = innerify(id, pfPv.inner)
								}
								cb(pfPv)
							}
						}
					})
				})
			}
		})
	}
	
	return {
		name: 'preforked',
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
		}else if(rel.view === 'typeset'){
			//just a performance optimization really (might allow removal of z.editId)
			
			var typeName = rel.params[0].value
			_.assertString(typeName)
			var typeCode = s.schema[typeName].code
			_.assertInt(typeCode)
			
			var lastValue
			var lastEditId
			
			handle = {
				name: 'typeset-impl',
				getStateAt: function(bindings, editId, cb){
					if(lastEditId === editId){
						cb([].concat(lastValue))
						return
					}
					s.objectState.getAllIdsOfTypeAt(typeCode, editId, function(ids){
						//console.log('got typeset: ' + typeCode + ' ' + editId + ' ' + ids.length)
						//console.log(new Error().stack)
						lastValue = ids
						lastEditId = editId
						
						cb([].concat(ids))
					})
				},
				getChangesBetween: function(bindings, startEditId, endEditId, cb){
					s.objectState.getCreationsOfTypeBetween(typeCode, startEditId, endEditId, function(creations){
						var changes = []
						for(var i=0;i<creations.length;++i){
							var c = creations[i]
							changes.push({type: 'add', value: c.id, editId: c.editId, syncId: -1})
						}
						//console.log(startEditId + ' ' + endEditId + ' changes: ' + JSON.stringify(changes))
						cb(changes)
					})
					/*if(startEditId === -1){
						cb([{type: 'set', value: rel.value, editId: 0}])
					}else{
						cb([])
					}*/
				}
			}
		}else{
			 
			if(s.schema[rel.view]){
				return getViewHandle(rel.view, rel)
			}
			var impl = schema.getImplementation(rel.view)
			_.assertDefined(impl)
			var paramRels = []
			for(var i=0;i<rel.params.length;++i){
				var p = rel.params[i]
				var pr = recurse(p)
				//console.log(JSON.stringify(p))
				_.assertObject(p.schemaType)
				pr.schemaType = p.schemaType
				paramRels.push(pr)
			}
			handle = makeOperatorRel(s, rel, paramRels, impl, rel.view, ws, recurse)
			
			/*if(rel.view === 'each' && rel.params[1].expr.view === 'filter'){
			 	handle = subsetOptimization.make(s, rel, paramRels, impl, rel.view, ws, handle, recurse)
			}*/
		}
	}else if(rel.type === 'value' || rel.type === 'int'){
		handle = {
			name: 'value',
			getStateAt: function(bindings, editId, cb){
				//console.log('getting state of value at ' + editId + ' ' + rel.value)
				if(editId === -1){
					cb(undefined)
					return
				}
				_.assertDefined(rel.value)
				cb(rel.value)
			},
			getChangesBetween: function(bindings, startEditId, endEditId, cb){
				if(startEditId === -1 && endEditId >= 0){
					cb([{type: 'set', value: rel.value, editId: 0}])
				}else{
					cb([])
				}
			}
		}
	}else if(rel.type === 'macro'){
		_.assertInt(rel.manyImplicits)
		var inner = recurse(rel.expr)
		if(!inner.getStateAt) _.errout('missing getStateAt: ' + inner.name + ' ' + inner.getChangesBetween)
		//TODO REMOVEME?
		handle = {
			name: 'macro',
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
		handle = {
			name: 'param',
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
			}
		}
		
	}else if(rel.type === 'nil'){
		handle = {
			name: 'nil',
			getStateAt: function(bindings, editId, cb){
				cb(undefined);
			},
			getChangesBetween: function(bindings, startEditId, endEditId, cb){cb([]);}
		}
	}else if(rel.type === 'let'){
		var subHandle = recurse(rel.rest)
		handle = {
			name: 'let(' + subHandle.name + ')',
			getStateAt: function(bindings, editId, cb){
				var newBindings = _.extend({}, bindings)
				newBindings[rel.name] = recurse(rel.expr)
				console.log('in let')
				subHandle.getStateAt(newBindings, editId, cb)
			},
			getChangesBetween: function(bindings, startEditId, endEditId, cb){
				//_.errout('TODO')
				var newBindings = _.extend({}, bindings)
				newBindings[rel.name] = recurse(rel.expr)
				console.log('in let')
				subHandle.getChangesBetween(newBindings, startEditId, endEditId, cb)
			}
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
