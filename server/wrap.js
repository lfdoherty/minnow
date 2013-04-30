//"use strict";

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
var wrapPropertySync = require('./wrap_property_sync').wrapPropertySync
var wrapPropertyCache = require('./wrap_property_cache').wrap
var wrapPropertyCacheSync = require('./wrap_property_cache_sync').wrap

var makeOperatorRel = require('./wrap_operator').make
var makeOperatorRelSync = require('./wrap_operator_sync').makeSync

var makeSwitchRel = require('./wrap_switch').make
var makeSwitchRelSync = require('./wrap_switch').makeSync

//var subsetOptimization = require('./variables/subset_optimization')
var eachOptimization = require('./variables/each_optimization')
var mapOptimization = require('./variables/map_optimization')
var multimapOptimization = require('./variables/multimap_optimization')
var mapValueOptimization = require('./variables/map_value_optimization')

var makePreforkedRel = require('./wrap_preforked').makePreforkedRel

var makeMutate = require('./wrap_mutate').make

var makeMacroBinding = require('./wrap_macro').makeMacroBinding
var makeMacroBindingSync = require('./wrap_macro').makeMacroBindingSync

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

function makeIdRelSync(s, context){
	var a = analytics.make('property-id-sync('+context.name+')', [context])
	return {
		name: 'property-id-sync('+context.name+')',
		analytics: a,
		getAt: function(bindings, editId){
			var id = context.getAt(bindings, editId)
			if(id){
				return ''+id
			}else{
				return
			}
		},
		getBetween: function(bindings, startEditId, endEditId){
			var changes = context.getBetween(bindings, startEditId, endEditId)
		
			if(changes.length > 0){
				_.assertLength(changes, 1)
				var c = changes[0]
				if(c.editId < 0) _.errout('editId too early: ' + JSON.stringify(c.editId))
				_.assert(c.editId >= 0)
				return [{type: 'set', value: ''+c.value, editId: c.editId, syncId: -1}]
			}else{
				return []
			}
		},
		getHistoricalBetween: function(bindings, startEditId, endEditId){
			var changes = context.getHistoricalBetween(bindings, startEditId, endEditId)
			if(changes.length > 0){
				_.assertLength(changes, 1)
				var c = changes[0]
				if(c.editId < 0) _.errout('editId too early: ' + JSON.stringify(c.editId))
				_.assert(c.editId >= 0)
				return [{type: 'set', value: ''+c.value, editId: c.editId, syncId: -1}]
			}else{
				return []
			}
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
function makeUuidRelSync(s, context){
	var a = analytics.make('property-uuid', [context])
	return {
		name: 'property-uuid',
		analytics: a,
		getAt: function(bindings, editId){
			var id = context.getAt(bindings, editId)
			if(id === undefined){
				return
			}else{
				var uuid = s.objectState.getUuid(id)
				//console.log('got uuid: ' + uuid)
				return uuid
			}
		},
		getBetween: function(bindings, startEditId, endEditId){
			//console.log('getting uuid changes')
			var changes = context.getChangesBetween(bindings, startEditId, endEditId)
			if(changes.length > 0){
				_.assertLength(changes, 1)
				var c = changes[0]
				if(c.editId < 0) _.errout('editId too early: ' + JSON.stringify(c.editId))
				_.assert(c.editId >= 0)
				var id = c.value
				var uuid = s.objectState.getUuid(id)
				_.assertString(uuid)
				return [{type: 'set', value: uuid, editId: c.editId, syncId: -1}]
			}else{
				return []
			}
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

function makeValuesRelSync(s, context, propertyType, contextType){
	var a = analytics.make('property-map-values', [context])
	var handle = {
		name: 'property-map-values',
		analytics: a,
		getAt: function(bindings, editId){
			var map = context.getAt(bindings, editId)
			if(map === undefined){
				return []
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
			return values
		},
		getBetween: function(bindings, startEditId, endEditId){
			_.errout('TODO')
		}
	}
		
	return handle
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




/*
function makeContextWrappedWithCache(exprHandle){
	function contextWrappedWithCache(){
		var cachedState
		var cachedEditId
		
		var cacheChanges
		var cachedChangesRange
		
		var cachedHistoricalChanges
		var cachedHistoricalRange
		var handle = {
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
		handle.getMayHaveChangedAndInAtStart = exprHandle.getMayHaveChangedAndInAtStart
		return handle
	}
	return contextWrappedWithCache
}*/

function stub(){}



exports.makeSync = function(s, rel, recurseSync, getViewHandle, staticBindings){
	_.assertLength(arguments, 5)
	
	var handle
	
	var ws
	if(rel.schemaType){
		ws = wu.makeUtilities(rel.schemaType)
	}
	
	
	if(rel.type === 'view'){
		if(rel.view === 'property'){
			var propertyName = rel.params[0].value
			var context = recurseSync(rel.params[1])
			
			if(propertyName === 'id'){
				handle = makeIdRelSync(s, context)
			}else if(propertyName === 'uuid'){
				handle = makeUuidRelSync(s, context)
			}else{

				var contextType = rel.params[1].schemaType
				var resultType = rel.params[0].schemaType
			
				if(propertyName === 'values'){
					_.assert(contextType.type === 'map')
					handle = makeValuesRelSync(s, context, resultType, contextType)
				}else{
			
					var objName = contextType.object
					if(contextType.members) objName = contextType.members.object
					if(objName === undefined) _.errout('cannot construct property with context type: ' + JSON.stringify(contextType))
			
					var objSchema = s.schema[objName]
					//console.log(JSON.stringify([contextType, propertyName]))
					if(objSchema.properties[propertyName] === undefined) _.errout('cannot find property ' + objSchema.name + '.' + propertyName)
					var propertyType = objSchema.properties[propertyName].type
			
					handle = wrapPropertySync(s, propertyName, propertyType, contextType, resultType, context, ws, staticBindings)
				}
			}
		}else if(rel.view === 'property-cache'){
			//rel = JSON.parse(JSON.stringify(rel))
			var allHandle = recurseSync(rel.fallback)
			handle = allHandle
			
			//TODO re-enable these
			/*
			var exprHandle = recurseSync(rel.params[0])
			var newStaticBindings = {}
			var uid = rel.params[1].implicits[0]
			//console.log(JSON.stringify(rel, null, 2))
			//_.errout('T')
			newStaticBindings[uid] = makeMacroBinding(uid, rel.params[0].schemaType)
			
			//console.log(JSON.stringify(rel.params[1].expr))
			var macroExprHandle = recurseSync(rel.params[1].expr, newStaticBindings)
			
			var resultType = rel.params[1].schemaType
			handle = wrapPropertyCacheSync(s, resultType, rel, exprHandle, macroExprHandle, allHandle, ws, staticBindings)
			
			*/
			
			var exprHandle = recurseSync(rel.params[0])
			var newStaticBindings = {}
			var uid = rel.params[1].implicits[0]
			//console.log(JSON.stringify(rel, null, 2))
			//_.errout('T')
			newStaticBindings[uid] = makeMacroBinding(uid, rel.params[0].schemaType)
			
			//console.log(JSON.stringify(rel.params[1].expr))
			var macroExprHandle = recurseSync(rel.params[1].expr, newStaticBindings)
			
			var resultType = rel.params[1].schemaType
			handle = wrapPropertyCacheSync(s, resultType, rel, exprHandle, macroExprHandle, allHandle, ws, staticBindings)
			
			
			
			
		}else if(rel.view === 'switch'){
			var context = recurseSync(rel.params[0])
			var remainder = rel.params.slice(1)
			var cases = []
			var defaultCase
			remainder.forEach(function(rp){
				if(rp.view === 'default'){
					defaultCase = recurseSync(rp.params[0])
				}else{
					if(rp.view !== 'case'){
						//console.log(JSON.stringify())
						_.errout('invalid non-case case: ' + JSON.stringify(rp))
					}
					_.assertEqual(rp.view, 'case')
					var caseValue = rp.params[0]
					var caseExpr = rp.params[1]
					cases.push({value: recurseSync(caseValue), expr: recurseSync(caseExpr)})
				}
			})
			handle = makeSwitchRelSync(s, context, cases, defaultCase, ws, rel, staticBindings)
		}else if(rel.view === 'preforked'){
			//var obj = recurse(rel.params[0])
			//var preforkedObj = recurse(rel.params[0])
			return makePreforkedRel(s, rel, recurseSync, staticBindings)
			//_.errout('should be inside mutate block: ' + JSON.stringify(rel))
		}else if(rel.view === 'mutate'){
			//var obj = recurse(rel.params[0])
			//var preforkedObj = recurse(rel.params[1])
			handle = makeMutate(s, rel, recurse, staticBindings)
		}else if(rel.view === 'unchanged'){
			var a = analytics.make('unchanged', [])
			handle = {
				name: 'unchanged',
				analytics: a,
				getStateAt: function(bindings, editId, cb){		
					cb(undefined)
				},
				getChangesBetween: function(bindings, startEditId, endEditId, cb){
					cb([])
				},
				getHistoricalChangesBetween: function(bindings, startEditId, endEditId, cb){
					cb([])
				},
				getPropertyValueAt: function(bindings, mutatorToken, getter, id, editId, cb){
					_.assertLength(arguments, 6)
					//console.log('unchanged: ' + id)
					getter({}, id, editId, cb)
				}
			}
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
				
				getAt: function(bindings, editId){
					/*if(lastEditId === editId){
						return [].concat(lastValue)
						return
					}*/
					var ids = s.objectState.getAllIdsOfTypeAt(typeCode, editId)
					_.assertArray(ids)
					a.gotTypeIds(typeCode)
					//console.log('got typeset: ' + typeCode + ' ' + editId + ' ' + ids.length)
					//console.log(new Error().stack)
					lastValue = ids
					lastEditId = editId
					
					//console.log('got typeset at: ' + JSON.stringify(ids))

					return [].concat(ids)
				},
				getBetween: function(bindings, startEditId, endEditId){
					//console.log('here')
					var idsDestroyed = s.objectState.getIdsDestroyedOfTypeBetween(typeCode, startEditId, endEditId)
					var changes = []
					var destroyed = {}
					for(var i=0;i<idsDestroyed.length;++i){
						var id = idsDestroyed[i]
						destroyed[id] = true
						changes.push({type: 'remove', value: id, editId: endEditId})
					}
					var ids = s.objectState.getIdsCreatedOfTypeBetween(typeCode, startEditId, endEditId)
					for(var i=0;i<ids.length;++i){
						var id = ids[i]
						if(!destroyed[id]){
							changes.push({type: 'add', value: id, editId: endEditId})
							//str += id + ','
						}
					}
					//console.log('got typeset adds: ' + startEditId + ' ' + endEditId + ' - ' + str)
					return changes
				},
				getHistoricalBetween: function(bindings, startEditId, endEditId){
					var destructions = s.objectState.getDestructionsOfTypeBetween(typeCode, startEditId, endEditId)
					var changes = []
					for(var i=0;i<destructions.length;++i){
						var d = destructions[i]
						changes.push({type: 'remove', value: d.id, editId: d.editId})
					}
					//var str = ''
					var creations = s.objectState.getCreationsOfTypeBetween(typeCode, startEditId, endEditId)
					for(var i=0;i<creations.length;++i){
						var c = creations[i]
						changes.push({type: 'add', value: c.id, editId: c.editId})
						//str += c.id + ','
					}
					//console.log('got typeset changes: ' + startEditId + ' ' + endEditId + ' changes: ' + JSON.stringify(changes))
					//console.log('got typeset adds: ' + startEditId + ' ' + endEditId + ' - ' + str)
					changes.sort(function(a,b){return a.editId - b.editId})
					return changes
				},
				getMayHaveChanged: function(bindings, startEditId, endEditId, cb){
					s.objectState.getChangedDuringOfType(typeCode, startEditId, endEditId, cb)
				},
				getMayHaveChangedAndInAtStart: function(bindings, startEditId, endEditId, cb){
					s.objectState.getExistedAtAndMayHaveChangedDuring(typeCode, startEditId, endEditId, cb)
				}
			}
		}else{
			 
			if(s.schema[rel.view]){
				return getViewHandle(rel.view, rel)
			}
			
			//console.log(JSON.stringify(rel))
			if(rel.view === 'each-optimization'){//TODO implement a sync version of this optimization?
				handle = eachOptimization.makeSync(s, rel, recurseSync, handle, ws, staticBindings)
			}else if(rel.view === 'mapValue' && rel.params[0].schemaType.value.type === 'set'){// && rel.params[0].isSubsetOptimizationMultimap){
				
				handle = mapValueOptimization.makeSync(s, rel, recurseSync, handle, ws, staticBindings)
			}else if(rel.view === 'count' && rel.params[0].view === 'typeset'){
				//_.errout('TODO')
				var objName = rel.params[0].params[0].value
				var nameStr = 'count-typeset-optimization['+objName+']'
				var a = analytics.make(nameStr, [])
				//_.errout('TODO: ' + JSON.stringify(rel) + ' ' + objName)
				var typeCode = s.schema[objName].code
				handle = {
					name: nameStr,
					getAt: function(bindings, editId){
						var many = s.objectState.getManyOfTypeAt(typeCode,editId)
						console.log('many: ' + many)
						return many
						//console.log('getting state of value at ' + editId + ' ' + rel.value)

					},

					getBetween: function(bindings, startEditId, endEditId, cb){
						var startCount = s.objectState.getManyOfTypeAt(typeCode,startEditId)
						var endCount = s.objectState.getManyOfTypeAt(typeCode,endEditId)
						if(startCount !== endCount){
							return [{type: 'set', value: endCount, editId: endEditId}]
						}else{
							return []
						}
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
					var pr = recurseSync(p)
					//console.log(JSON.stringify(p))
					if(p.schemaType === undefined) _.errout('missing schemaType: ' + JSON.stringify(p))
					_.assertObject(p.schemaType)
					pr.schemaType = p.schemaType
					paramRels.push(pr)
				}
				handle = makeOperatorRelSync(s, rel, paramRels, impl, rel.view, ws, recurseSync, staticBindings)
		
				/*if(rel.view === 'each' && rel.params[1].expr.view === 'filter'){
				 	handle = subsetOptimization.make(s, rel, paramRels, impl, rel.view, ws, handle, recurse)
				}*/
				
				if(rel.isSubsetOptimizationMultimap){
					handle = multimapOptimization.makeSync(s, rel, recurseSync, handle, ws, staticBindings, handle)
				}else if(rel.view === 'map'){
					handle = mapOptimization.makeSync(s, rel, recurseSync, handle, ws, staticBindings)
				}
			}
		}
	}else if(rel.type === 'value' || rel.type === 'int'){
		var nameStr = 'value['+rel.value+']'
		var a = analytics.make(nameStr, [])
		handle = {
			name: nameStr,
			getStaticValue: function(){
				return rel.value
			},
			getAt: function(bindings, editId){
				//console.log('getting state of value at ' + editId + ' ' + rel.value)
				if(editId === -1){
					return
				}
				_.assertDefined(rel.value)
				return rel.value
			},
			getBetween: function(bindings, startEditId, endEditId){
				if(startEditId === -1 && endEditId >= 0){
					return [{type: 'set', value: rel.value, editId: 0}]
				}else{
					return []
				}
			},
			analytics: a
		}
		handle.getHistoricalBetween = handle.getBetween
	}else if(rel.type === 'macro'){
		_.assertInt(rel.manyImplicits)
		var newStaticBindings = _.extend({}, staticBindings)
		//rel.implicits = rel.implicits.slice(0, rel.manyImplicits)
		if(!rel.implicitTypes) _.errout('missing implicitTypes: ' + JSON.stringify(rel))
		//rel.implicits.forEach(function(implicit, index){
			//console.log('binding: ' + implicit)
		for(var i=0;i<rel.manyImplicits;++i){
			var implicit = rel.implicits[i]
			newStaticBindings[implicit] = makeMacroBindingSync(implicit, rel.implicitTypes[i])
		}
		//})
		var inner = recurseSync(rel.expr, newStaticBindings)
		if(!inner.getAt) _.errout('missing getAt: ' + inner.name)

		var a = analytics.make('macro', [inner])

		handle = {
			name: 'macro['+inner.name+']',
			analytics: a,
			isMacro: true,
			manyImplicits: rel.manyImplicits,
			implicits: rel.implicits,
			getAt: function(bindings, editId, cb){
				return inner.getAt(bindings, editId, cb)
			},
			getBetween: function(bindings, startEditId, endEditId, cb){
				_.errout('TODO?')
			},
			getHistoricalBetween: function(bindings, startEditId, endEditId, cb){
				_.errout('TODO?')
			}
		}
	}else if(rel.type === 'param'){
		var paramName = rel.name
		if(!rel.schemaType) _.errout('missing schemaType: ' + JSON.stringify(rel))
		var isObject = rel.schemaType.type === 'object'
		var nameStr = 'param['+(rel.schemaType.object||rel.schemaType.primitive||rel.schemaType.view)+':'+rel.name+']'
		var a = analytics.make(nameStr, [])
		
		var b = staticBindings[paramName]
		if(b === undefined){
			_.errout('cannot find static binding: ' + JSON.stringify([paramName, Object.keys(staticBindings)]))
		}
		//if(b.getHistoricalBetween === undefined) _.errout('missing getHistoricalBetween: ' + b.name + ' got getHistoricalChangesBetween: ' + !!b.getHistoricalChangesBetween)
		handle = b
		if(!b.name) _.errout('static bound param missing name: ' + JSON.stringify(rel))
	}else if(rel.type === 'nil'){
		var a = analytics.make('nil', [])
		handle = {
			name: 'nil',
			getAt: function(bindings, editId){
				return
			},
			getChangesBetween: function(bindings, startEditId, endEditId){return [];},
			getHistoricalBetween: function(bindings, startEditId, endEditId){return [];},
			analytics: a
		}
	}else if(rel.type === 'let'){
		var exprHandle = recurseSync(rel.expr)
		
		//var contextWrappedWithCache = makeContextWrappedWithCache(exprHandle)
		
		
		//handle = subHandle
		handle = {
			getAt: function(bindings, editId){
				var state = subHandle.getAt(bindings, editId)//, function(state){
				return state
			},
			getBetween: function(bindings, startEditId, endEditId){
				var changes = subHandle.getBetween(bindings, startEditId, endEditId)
				//console.log(JSON.stringify([startEditId, endEditId, changes]))
				return changes
			},
			getHistoricalBetween: function(bindings, startEditId, endEditId){
				return subHandle.getHistoricalBetween(bindings, startEditId, endEditId)
			}
		}
	
		var stateCache = {}
		var changesCache = {}
		var historicalChangesCache = {}	
	
		var newStaticBindings = {}
		var staticAnalytics = analytics.make('static-let-param:'+rel.name, [exprHandle])
		var paramName = rel.name
		
		//syncStaticLetExpr(rel, newStaticBindings, staticAnalytics, exprHandle)
		_.assert(rel.expr.sync)
		syncStaticLetExpr(rel, newStaticBindings, staticAnalytics, exprHandle, stateCache, historicalChangesCache)
		
		var subHandle = recurseSync(rel.rest, newStaticBindings)

		if(subHandle.getHistoricalBetween === undefined) _.errout('missing getHistoricalBetween: ' + subHandle.name)

		var a = analytics.make('let:'+rel.name+'('+exprHandle.name+','+subHandle.name+')', [exprHandle, subHandle])
		handle.analytics = a
		handle.name = 'let(' + subHandle.name + ')'
		//handle.getMayHaveChanged = subHandle.getMayHaveChanged
		
		if(subHandle.newStaticBindings) handle.newStaticBindings = subHandle.newStaticBindings

		//handle.getMayHaveChangedAndInAtStart = exprHandle.getMayHaveChangedAndInAtStart
	}

	if(!handle) _.errout(JSON.stringify(rel))
	
	if(!handle.name) _.errout('missing name: ' + JSON.stringify(rel))
	
	handle.changeToEdit = function(c){
		//console.log(JSON.stringify(rel.schemaType))
		return ws.convertToEdit(c)
	}
	
	handle.extractInclusions = function(changes){
		return ws.extractInclusions(changes)
	}
	
	return handle

}

function syncStaticLetExpr(rel, newStaticBindings, staticAnalytics, exprHandle){
	var stateCache = {}
	var historicalChangesCache = {}

	var staticHandle = newStaticBindings[rel.name] = {
		name: 'static-let-param:'+rel.name + ' --> ' + exprHandle.name,
		analytics: staticAnalytics,
		getAt: function(bindings, editId){
			var key = editId+bindings.__key
			if(stateCache[key]){
				return stateCache[key]
			}
			//console.log('expr: ' + exprHandle.name + ' ' + rel.name)
			var state = exprHandle.getAt(bindings, editId)
			stateCache[key] = state
			return state
		},
		getBetween: function(bindings, startEditId, endEditId){
			var key = startEditId+':'+endEditId+bindings.__key
			if(changesCache[key]){
				return changesCache[key]
			}
			var changes = exprHandle.getBetween(bindings, startEditId, endEditId)
			changesCache[key] = changes
			//console.log('between let: ' + JSON.stringify([startEditId, endEditId, changes]))
			return changes
		},
		getHistoricalBetween: function(bindings, startEditId, endEditId){
			var key = startEditId+':'+endEditId+bindings.__key
			if(historicalChangesCache[key]){
				return historicalChangesCache[key]
			}
			var changes = exprHandle.getHistoricalBetween(bindings, startEditId, endEditId)
			historicalChangesCache[key] = changes
			return changes
		},
	}
	//staticHandle.getMayHaveChangedAndInAtStart = exprHandle.getMayHaveChangedAndInAtStart

	staticHandle.getValueAt = exprHandle.getValueAt
}
function asyncStaticLetExpr(rel, newStaticBindings, staticAnalytics, exprHandle){
	var stateCache = {}
	var historicalChangesCache = {}
	var staticHandle = newStaticBindings[rel.name] = {
		name: 'static-let-param:'+rel.name,
		analytics: staticAnalytics,
		//getStateSync: exprHandle.getStateSync,
		//isFullySync: exprHandle.isFullySync,
		getStateAt: function(bindings, editId, cb){
			var key = editId+bindings.__key
			if(stateCache[key]){
				cb(stateCache[key])
				return
			}
			exprHandle.getStateAt(bindings, editId, function(state){
				stateCache[key] = state
				cb(state)
			})
		},
		getStateSync: function(bindingValues){
			var b = bindingValues[paramName]
			return b
		},
		isFullySync: true,
		getConfiguredIdAt: function(id, bindings, editId, cb){
			exprHandle.getStateAt(bindings, editId, function(realId){
				_.assert(realId === id || (realId.top === id.top && realId.inner === id.inner))
				cb(realId)
			})
		},
		getChangesBetween: function(bindings, startEditId, endEditId, cb){
			var key = startEditId+':'+endEditId+bindings.__key
			if(changesCache[key]){
				cb(changesCache[key])
				return
			}
			exprHandle.getChangesBetween(bindings, startEditId, endEditId, function(changes){
				changesCache[key] = changes
				cb(changes)
			})
		},
		getHistoricalChangesBetween: function(bindings, startEditId, endEditId, cb){
			var key = startEditId+':'+endEditId+bindings.__key
			if(historicalChangesCache[key]){
				cb(historicalChangesCache[key])
				return
			}
			exprHandle.getHistoricalChangesBetween(bindings, startEditId, endEditId, function(changes){
				historicalChangesCache[key] = changes
				cb(changes)
			})
		},
	}
	staticHandle.getMayHaveChangedAndInAtStart = exprHandle.getMayHaveChangedAndInAtStart

	staticHandle.getPropertyValueAt = exprHandle.getPropertyValueAt
	
	return staticHandle
}

exports.make = function(s, rel, recurse, recurseSync, getViewHandle, staticBindings){
	_.assertLength(arguments, 6)

	//rel = JSON.parse(JSON.stringify(rel))
	

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
			
					handle = wrapProperty(s, propertyName, propertyType, contextType, resultType, context, ws, staticBindings)
				}
			}	
		}else if(rel.view === 'property-cache'){
			//rel = JSON.parse(JSON.stringify(rel))
			var allHandle = recurse(rel.fallback)
			handle = allHandle
			
			
			var exprHandle = recurse(rel.params[0])
			var newStaticBindings = {}
			var uid = rel.params[1].implicits[0]
			//console.log(JSON.stringify(rel, null, 2))
			//_.errout('T')
			newStaticBindings[uid] = makeMacroBinding(uid, rel.params[0].schemaType)
			
			//console.log(JSON.stringify(rel.params[1].expr))
			var macroExprHandle = recurse(rel.params[1].expr, newStaticBindings)
			
			var resultType = rel.params[1].schemaType
			handle = wrapPropertyCache(s, resultType, rel, exprHandle, macroExprHandle, allHandle, ws, staticBindings)
			
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
			handle = makeSwitchRel(s, context, cases, defaultCase, ws, rel, staticBindings)
		}else if(rel.view === 'preforked'){
			//var obj = recurse(rel.params[0])
			//var preforkedObj = recurse(rel.params[0])
			return makePreforkedRel(s, rel, recurse, recurseSync)
			//_.errout('should be inside mutate block: ' + JSON.stringify(rel))
		}else if(rel.view === 'mutate'){
			//var obj = recurse(rel.params[0])
			//var preforkedObj = recurse(rel.params[1])
			handle = makeMutate(s, rel, recurse, recurseSync, staticBindings)
		}else if(rel.view === 'unchanged'){
			var a = analytics.make('unchanged', [])
			handle = {
				name: 'unchanged',
				analytics: a,
				getStateAt: function(bindings, editId, cb){		
					cb(undefined)
				},
				getChangesBetween: function(bindings, startEditId, endEditId, cb){
					cb([])
				},
				getHistoricalChangesBetween: function(bindings, startEditId, endEditId, cb){
					cb([])
				},
				getPropertyValueAt: function(bindings, mutatorToken, getter, id, editId, cb){
					_.assertLength(arguments, 6)
					//console.log('unchanged: ' + id)
					getter({}, id, editId, cb)
				}
			}
		}else if(rel.view === 'lastVersion'){
			var context = recurse(rel.params[0])
			var a = analytics.make('lastVersion', [context])
			handle = {
				name: 'lastVersion('+context.name+')',
				analytics: a,
				getStateAt: function(bindings, editId, cb){
					if(context.getAt){
						var state = context.getAt(bindings, editId)
						if(_.isArray(state)) _.errout('cannot get lastVersion of multiple objects')
				
						if(state){
							s.objectState.getLastVersionAt(state, editId, function(v){
								cb(v)
							})
						}else{
							cb(undefined)
						}
					}else{
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
			}
			handle.getChangesBetween = wu.makeGenericGetChangesBetween(handle, ws, rel)
			
		}else if(rel.view === 'versions'){
			//_.errout('TODO')
			if(rel.sync) _.errout('TODO')
			var context = recurse(rel.params[0])
			var a = analytics.make('versions', [context])
			
			function doRestOfGetStateAt(state, editId, cb){
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
			}
			handle = {
				name: 'versions('+context.name+')',
				analytics: a,
				getStateAt: function(bindings, editId, cb){
					if(context.getAt){
						var state = context.getAt(bindings, editId)
						//console.log('getting versions of: ' + JSON.stringify(state))
						doRestOfGetStateAt(state, editId, cb)
					}else{
						context.getStateAt(bindings, editId, function(state){
							doRestOfGetStateAt(state, editId, cb)
						})
					}
				}
			}
			handle.getChangesBetween = wu.makeGenericGetChangesBetween(handle, ws, rel)
		}else if(rel.view === 'typeset'){
			//just a performance optimization really (might allow removal of z.editId)

			if(rel.sync) _.errout('TODO')
			
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
						
						/*var str = ''
						ids.forEach(function(id, index){
							str += id+','
							if(index % 10000 === 0) str += '\n'
						})
						console.log('got typeset(' + typeCode + ') state at ' + editId + ': ' + str)
						*/
						cb([].concat(ids))
					})
				},
				getChangesBetween: function(bindings, startEditId, endEditId, cb){
					//console.log('here')
					s.objectState.getIdsDestroyedOfTypeBetween(typeCode, startEditId, endEditId, function(ids){
						var changes = []
						var destroyed = {}
						for(var i=0;i<ids.length;++i){
							var id = ids[i]
							destroyed[id] = true
							changes.push({type: 'remove', value: id, editId: endEditId})
						}
						s.objectState.getIdsCreatedOfTypeBetween(typeCode, startEditId, endEditId, function(ids){
							//var str = ''
							for(var i=0;i<ids.length;++i){
								var id = ids[i]
								if(!destroyed[id]){
									changes.push({type: 'add', value: id, editId: endEditId})
									//str += id + ','
								}
							}
							//console.log('got typeset adds: ' + startEditId + ' ' + endEditId + ' - ' + str)
							cb(changes)
						})
					})
				},
				getHistoricalChangesBetween: function(bindings, startEditId, endEditId, cb){
					s.objectState.getDestructionsOfTypeBetween(typeCode, startEditId, endEditId, function(destructions){
						var changes = []
						for(var i=0;i<destructions.length;++i){
							var d = destructions[i]
							changes.push({type: 'remove', value: d.id, editId: d.editId})
						}
						//var str = ''
						s.objectState.getCreationsOfTypeBetween(typeCode, startEditId, endEditId, function(creations){
							for(var i=0;i<creations.length;++i){
								var c = creations[i]
								changes.push({type: 'add', value: c.id, editId: c.editId})
								//str += c.id + ','
							}
							//console.log('got typeset changes: ' + startEditId + ' ' + endEditId + ' changes: ' + JSON.stringify(changes))
							//console.log('got typeset adds: ' + startEditId + ' ' + endEditId + ' - ' + str)
							changes.sort(function(a,b){return a.editId - b.editId})
							cb(changes)
						})
					})
				},
				getMayHaveChanged: function(bindings, startEditId, endEditId, cb){
					s.objectState.getChangedDuringOfType(typeCode, startEditId, endEditId, cb)
				},
				getMayHaveChangedAndInAtStart: function(bindings, startEditId, endEditId, cb){
					s.objectState.getExistedAtAndMayHaveChangedDuring(typeCode, startEditId, endEditId, cb)
				}
			}
		}else{

			 
			if(s.schema[rel.view]){
				return getViewHandle(rel.view, rel)
			}
			
			//console.log(JSON.stringify(rel))
			if(rel.view === 'each-optimization'){
				if(rel.sync) _.errout('TODO')
				handle = eachOptimization.make(s, rel, recurse, handle, ws, staticBindings)
			}else if(rel.view === 'mapValue' && rel.params[0].schemaType.value.type === 'set'){// && rel.params[0].isSubsetOptimizationMultimap){
				
				if(rel.sync) _.errout('TODO')
				handle = mapValueOptimization.make(s, rel, recurse, handle, ws, staticBindings)
			}else if(rel.view === 'count' && rel.params[0].view === 'typeset'){
				if(rel.sync) _.errout('TODO')
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
				//var syncParamRels = []
				
				if(rel.sync){
					//_.errout('TODO')
					for(var i=0;i<rel.params.length;++i){
						var p = rel.params[i]
					
						var pr = recurseSync(p)
						//console.log(JSON.stringify(p))
						if(p.schemaType === undefined) _.errout('missing schemaType: ' + JSON.stringify(p))
						_.assertObject(p.schemaType)
						pr.schemaType = p.schemaType
						paramRels.push(pr)
					}
					handle = makeOperatorRelSync(s, rel, paramRels, impl, rel.view, ws, recurseSync, staticBindings)

				}else{
				
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
					handle = makeOperatorRel(s, rel, paramRels, impl, rel.view, ws, recurse, recurseSync, staticBindings)
			
					/*if(rel.view === 'each' && rel.params[1].expr.view === 'filter'){
					 	handle = subsetOptimization.make(s, rel, paramRels, impl, rel.view, ws, handle, recurse)
					}*/
				
					if(rel.view === 'map'){// && recurse(rel.params[0]).getMayHaveChanged){
						handle = mapOptimization.make(s, rel, recurse, handle, ws, staticBindings)
					}else if(rel.isSubsetOptimizationMultimap){
						handle = multimapOptimization.make(s, rel, recurse, handle, ws, staticBindings, handle)
					}
				}
			}
		}
	}else if(rel.type === 'value' || rel.type === 'int'){
		var nameStr = 'value['+rel.value+']'
		var a = analytics.make(nameStr, [])
		handle = {
			name: nameStr,
			getStaticValue: function(){
				return rel.value
			},
			getStateAt: function(bindings, editId, cb){
				//console.log('getting state of value at ' + editId + ' ' + rel.value)
				if(editId === -1){
					cb(undefined)
					return
				}
				_.assertDefined(rel.value)
				cb(rel.value)
			},
			getAt: function(bindings, editId){
				if(editId === -1){
					return
				}
				return rel.value
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
			getBetween: function(bindings, startEditId, endEditId){
				if(startEditId === -1 && endEditId >= 0){
					return [{type: 'set', value: rel.value, editId: 0}]
				}else{
					return []
				}
			},
			analytics: a
		}
		handle.getHistoricalChangesBetween = handle.getChangesBetween
	}else if(rel.type === 'macro'){
		_.assertInt(rel.manyImplicits)
		var newStaticBindings = _.extend({}, staticBindings)
		if(!rel.implicitTypes) _.errout('missing implicitTypes: ' + JSON.stringify(rel))
		for(var i=0;i<rel.manyImplicits;++i){
			var implicit = rel.implicits[i]
			newStaticBindings[implicit] = makeMacroBinding(implicit, rel.implicitTypes[i])
		}
		if(rel.sync){
			var inner = recurseSync(rel.expr, newStaticBindings)
			if(!inner.getAt) _.errout('missing getAt: ' + inner.name)

			var a = analytics.make('macro', [inner])

			handle = {
				name: 'macro['+inner.name+']',
				analytics: a,
				isMacro: true,
				manyImplicits: rel.manyImplicits,
				implicits: rel.implicits,
				getAt: function(bindings, editId){
					return inner.getAt(bindings, editId)
				},
				getBetween: function(bindings, startEditId, endEditId){
					return inner.getBetween(bindings, startEditId, endEditId)
				}
			}
		}else{
			var inner = recurse(rel.expr, newStaticBindings)
			if(!inner.getStateAt) _.errout('missing getStateAt: ' + inner.name + ' ' + inner.getChangesBetween)

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
					inner.getChangesBetween(bindings, startEditId, endEditId, cb)
					//_.errout('TODO?')
				}
			}
		}
	}else if(rel.type === 'param'){
		var paramName = rel.name
		if(!rel.schemaType) _.errout('missing schemaType: ' + JSON.stringify(rel))
		var isObject = rel.schemaType.type === 'object'
		var nameStr = 'param['+(rel.schemaType.object||rel.schemaType.primitive||rel.schemaType.view)+':'+rel.name+']'
		var a = analytics.make(nameStr, [])
	
		var b = staticBindings[paramName]
		if(b === undefined){
			_.errout('cannot find static binding: ' + JSON.stringify([paramName, Object.keys(staticBindings)]))
		}
		//if(b.getHistoricalChangesBetween === undefined) _.errout('missing getHistoricalChangesBetween: ' + b.name)
		//if(b.getAt === undefined) _.errout('missing getAt: ' + b.name)
		handle = b
		if(!b.name) _.errout('static bound param missing name: ' + JSON.stringify(rel))
	}else if(rel.type === 'nil'){
		var a = analytics.make('nil', [])
		handle = {
			name: 'nil',
			getAt: function(bindings, editId){
				return undefined
			},
			getStateAt: function(bindings, editId, cb){
				cb(undefined);
			},
			getBetween: function(bindings, startEditId, endEditId){return [];},
			getHistoricalBetween: function(bindings, startEditId, endEditId){return [];},
			getChangesBetween: function(bindings, startEditId, endEditId, cb){cb([]);},
			getHistoricalChangesBetween: function(bindings, startEditId, endEditId, cb){cb([]);},
			analytics: a
		}
	}else if(rel.type === 'let'){
		if(rel.sync) _.errout('TODO')
		var exprHandle = recurse(rel.expr)
		
		//var contextWrappedWithCache = makeContextWrappedWithCache(exprHandle)
		
		
		//handle = subHandle
		handle = {
			getStateAt: function(bindings, editId, cb){
				//var newBindings = _.extend({}, bindings)
				//newBindings[rel.name] = contextWrappedWithCache()//exprHandle//TODO wrap this in localized caching?
				//console.log('in let')

				//begin caching
				subHandle.getStateAt(bindings, editId, function(state){
					//end caching
					cb(state)
				})
			},
			getChangesBetween: function(bindings, startEditId, endEditId, cb){
				subHandle.getChangesBetween(bindings, startEditId, endEditId, cb)
			},
			getHistoricalChangesBetween: function(bindings, startEditId, endEditId, cb){
				subHandle.getHistoricalChangesBetween(bindings, startEditId, endEditId, cb)
			}
		}
	
		var stateCache = {}
		var changesCache = {}
		var historicalChangesCache = {}	
	
		var newStaticBindings = {}
		var staticAnalytics = analytics.make('static-let-param:'+rel.name, [exprHandle])
		var paramName = rel.name
		_.assertNot(rel.sync)
		//_.assertNot(rel.expr.sync)
		if(rel.expr.sync){
			syncStaticLetExpr(rel, newStaticBindings, staticAnalytics, exprHandle, stateCache)
		}else{
			asyncStaticLetExpr(rel, newStaticBindings, staticAnalytics, exprHandle, stateCache)
		}
		
		
		var subHandle = recurse(rel.rest, newStaticBindings)

		if(subHandle.getHistoricalChangesBetween === undefined) _.errout('missing getHistoricalChangesBetween: ' + subHandle.name)

		var a = analytics.make('let:'+rel.name+'('+exprHandle.name+','+subHandle.name+')', [exprHandle, subHandle])
		handle.analytics = a
		handle.name = 'let(' + subHandle.name + ')'
		handle.getMayHaveChanged = subHandle.getMayHaveChanged

		//handle.getMayHaveChangedAndInAtStart = exprHandle.getMayHaveChangedAndInAtStart
	}

	if(!handle) _.errout(JSON.stringify(rel))
	
	if(!handle.name) _.errout('missing name: ' + JSON.stringify(rel))
	
	handle.changeToEdit = function(c){
		//console.log(JSON.stringify(rel.schemaType))
		return ws.convertToEdit(c)
	}
	
	handle.extractInclusions = function(changes){
		return ws.extractInclusions(changes)
	}
	
	return handle

	
}
