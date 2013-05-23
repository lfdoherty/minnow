"use strict";

var _ = require('underscorem')

var wrap = require('./wrap')
var analytics = require('./analytics')

var snapshotSerialization = require('./snapshot_serialization')
var pathmerger = require('./pathmerger')

var editFp = require('./tcp_shared').editFp
var editCodes = editFp.codes
var editNames = editFp.names

var innerify = require('./innerId').innerify

var bw = require("buffered-writer");

exports.viewIdStr = viewIdStr

var vcModule = require('./viewfacade')

var pollFunctions = []
var pollHandle = setInterval(function(){
	for(var i=0;i<pollFunctions.length;++i){
		var f = pollFunctions[i]
		f()
	}
}, 100)

function addPollFunction(f){
	pollFunctions.push(f)
}
function removePollFunction(f){
	var index = pollFunctions.indexOf(f)
	if(index !== -1){
		pollFunctions.splice(index, 1)
	}
}

function remainer(initial, cb){
	_.assertFunction(cb)
	
	var remaining = initial
	if(initial === 0){
		cb()
		return
	}
	return {
		increase: function(v){
			_.assert(v >= 0)
			if(remaining === 0) _.errout('already done')
			remaining += v
		},
		decrease: function(v){
			_.assert(v >= 0)
			if(remaining === 0) _.errout('already done')
			if(v > remaining) _.errout('decreased by too much: ' + remaining + ' - ' + v)
			remaining -= v
			if(remaining === 0){
				cb()
			}
		}
	}
}

var analyticsLog = require('quicklog').make('analytics')

function makeQueryHandle(/*getObjectEditsBetween, getObjectInclusionsDuring, */syncId, viewCache){
	var qhEditId=-1//this will always get a moveTo current call before the first add call happens anyway
	var alreadyGot = {}
	var gotIds = []
	
	/*
		Possible Optimizations:
			- monitoring changes that happen to anything in the gotIds set in-between moveTo calls, making that a simple reply
			- monitoring inclusions in-between moveTo calls
		
	*/
	
	var gotObjectIds = []
	var gotViewObjectIds = []
	
	var addedViewObjects = []
	var addedObjects = []
	
	var lastCache = {}
	
	return {
		got: alreadyGot,
		moveTo: function(editId, changesCb, inclusionsCb, doneCb){
			
			//viewCache.update(
			if(gotIds.length === 0 && addedViewObjects.length === 0 && editId === qhEditId){
				//console.log(syncId + ' none: ' +  editId + ' ' + qhEditId)
				doneCb()
			}else{
			
				/*if(addedObjects.length === 0 && addedViewObjects.length === 0 && editId === qhEditId){
					doneCb()
					return
				}*/
				
				
				//console.log(syncId+' adding(' + qhEditId+'->'+editId + '): ' + JSON.stringify([addedObjects, addedViewObjects]))
				//console.log(syncId+' updating: ' + JSON.stringify([gotObjectIds, gotViewObjectIds]))
				//console.log(syncId+' got: ' + JSON.stringify(alreadyGot))
				
				//TODO make added-but-already-got a error condition?
				for(var i=0;i<addedObjects.length;++i){
					var addedId = addedObjects[i]
					if(alreadyGot[addedId]){
						gotObjectIds.push(addedId)
						addedObjects.splice(i, 1)
					}
				}
				for(var i=0;i<addedViewObjects.length;++i){
					var addedId = addedViewObjects[i]
					if(alreadyGot[addedId]){
						gotViewObjectIds.push(addedId)
						addedViewObjects.splice(i, 1)
					}
				}

				//_.errout(JSON.stringify(gotIds))
				var newCache = {}
				
				var diff = viewCache.update(addedObjects, addedViewObjects, gotObjectIds, gotViewObjectIds, qhEditId, alreadyGot, lastCache, newCache)
				
				lastCache = newCache

				console.log('diff: ' + qhEditId + ' -> ' + editId + ' for ' + syncId)
				
				/*
				
				diff.edits.forEach(function(e){
					console.log(editNames[e.op] + ' ' + JSON.stringify(e))
				})
				*/
				
				//console.log(JSON.stringify(diff))
				//console.log(JSON.stringify(diff.addedViewObjects))
				
				
				//gotViewObjectIds = gotViewObjectIds
				diff.addedViewObjects.forEach(function(v){
					_.assertString(v.id)
					gotViewObjectIds.push(v.id)
				})//.concat(diff.addedViewObjects)
				diff.addedObjects.forEach(function(v){
					_.assertInt(v.id)
					gotObjectIds.push(v.id)
				})
				//gotObjectIds = gotObjectIds.concat(diff.addedObjects)
				
				if(diff.edits.length > 0 || diff.addedObjects.length > 0 || diff.addedViewObjects.length > 0){
					changesCb(diff.edits)
					diff.addedObjects.forEach(function(v){
						_.assertInt(v.id)
						_.assertArray(v.edits)
						inclusionsCb(v.id, v.edits)//TODO use snap directly
					})
					diff.addedViewObjects.forEach(function(v){
						_.assertString(v.id)
						_.assertArray(v.edits)
						inclusionsCb(v.id, v.edits)//TODO use snap directly
					})					
				}
				
				addedViewObjects.forEach(function(avo){
					avo.cb()
				})
				addedViewObjects = []
				addedObjects = []
				
				qhEditId = editId
				
				doneCb()
			}
			
			/*var inclusionsDuring = []
			//console.log(syncId + ' moving to: ' + editId + ' from ' + qhEditId)
			var rem = remainer(1, finish)
			//console.log('checking for changes to all: ' + JSON.stringify(gotIds))
			gotIds.forEach(function(id){
				rem.increase(1)
				getObjectEditsBetween(id, qhEditId, editId, function(changes){
					
					changes.forEach(function(e){
						if(e.type) _.errout('wrong type of edit: ' + JSON.stringify(e))
						//console.log('e: ' + JSON.stringify(e))
						//_.assertInt(e.syncId)
						e.id = id
					})
					
					//if(changes.length > 0){
					//	console.log('for move ' + qhEditId + ' ' + editId + ' ' + id + ' changes: ' + JSON.stringify(changes))
					//}

					recursivelyInclude(id, qhEditId, editId)
					
					//console.log('calling with changes: ' + changesCb)
					changesCb(id, changes)
					
					function recursivelyInclude(id, startEditId, endEditId){
						
						getObjectInclusionsDuring(id, startEditId, endEditId, function(ids){//TODO recurse
							//if(_.isString(id)){
								//console.log('inclusions ' + id + ' ' + qhEditId + ',' + editId + ' ' + JSON.stringify(ids))
								//console.log(new Error().stack)
							//}
							rem.increase(ids.length)
							ids.forEach(function(includedId){
								if(!alreadyGot[includedId]){
									alreadyGot[includedId] = true
									recursivelyInclude(includedId, -1, endEditId)
									//console.log(syncId+' ^^^^^^^^^^^^^^^^^6 new inclusion: ' + includedId)
									inclusionsDuring.push(includedId)
									inclusionsCb(includedId)
								}else{
									//console.log(syncId+' old inclusion: ' + includedId)
									rem.decrease(1)
								}
							})
							rem.decrease(1)
						})
					}
				})
			})
			rem.decrease(1)
			
			function finish(){
				//console.log(syncId+' done moving to: ' + editId + ' from ' + qhEditId)// + JSON.stringify(gotIds))
				qhEditId = editId
				gotIds = gotIds.concat(inclusionsDuring)
				doneCb()
			}*/
		},
		addObject: function(id){//, cb){
			//_.errout('TODO DO NOT DO THIS')
			//_.errout('TODO: ' + id)
			
			_.assertInt(id)
			if(alreadyGot[id]){
				
				//cb()
				return
			}else{
				//console.log('adding object: ' + id)
				alreadyGot[id] = true
				//gotIds.push(id)
				_.assertInt(id)
				addedObjects.push(id)
				//cb()
			}
			//TODO include foreign ids?  might not be checked for later... edits maybe too?
		},
		add: function(id, lastEditId, changesCb, inclusionsCb, doneCb){
		
			//console.log('adding: ' + id + ' at ' + lastEditId)
			
			if(alreadyGot[id]){
				doneCb();
				return;
			}else{
				addedViewObjects.push({id: id, lastEditId: lastEditId, cb: doneCb})
				//doneCb()
			}
			
			
			
			//var diff = viewCache.addViewObject(id, lastEditId, gotObjectIds, gotViewObjectIds, alreadyGot)
			
			//viewIdsToAdd.push(id)
			
			///console.log(syncId + ' adding view to queryhandle: ' + id)
			
			/*var rem = remainer(1, doneCb)
			
			getObjectInclusionsDuring(id, -1, lastEditId, function(ids){
				//console.log(lastEditId + ' *got object inclusions at: ' + id + ': ' + JSON.stringify(ids))
				_.assert(ids.indexOf(id) !== -1)
				
				function recurseInclusions(id){
					if(alreadyGot[id]) return
					gotIds.push(id)
					//console.log('adding to alreadygot: ' + id)
					alreadyGot[id] = true
					rem.increase(2)
					if(lastEditId === qhEditId){
						rem.decrease(1)
					}else{
						getObjectInclusionsDuring(id, lastEditId, qhEditId, function(ids){
							//console.log('got recursed object inclusions since ' + id + ' ' + JSON.stringify(ids))
							ids.forEach(function(id){
								if(!alreadyGot[id]){
									alreadyGot[id] = true
									gotIds.push(id)
									inclusionsCb(id)
								}
							})
							//rem.decrease(1)
							getObjectEditsBetween(id, lastEditId, qhEditId, function(changes){
								//console.log('for view add(' + lastEditId+','+qhEditId+'): ' + JSON.stringify(changes))
								changesCb(id, changes)
								rem.decrease(1)
							})
						})
					}
					getObjectInclusionsDuring(id, -1, lastEditId, function(ids){
						//console.log('got recursed object inclusions ' + id + ' ' + JSON.stringify(ids))
						ids.forEach(recurseInclusions)
						rem.decrease(1)
					})
				}
				ids.forEach(recurseInclusions)
				rem.decrease(1)
			})*/
			
			
		}
	}
}

var log = require('quicklog').make('minnow/new_view_sequencer')
/*
function createRelHandle(objSchema, relMakers){
	var viewSchema = objSchema.viewSchema
	
	function makeBindings(params, viewId){
		//_.assertInt(paramTime)
		_.assertString(viewId)
		//_.assert(paramTime >= 0)
		var bindings = {}
		if(params.__extra){
			//console.log(viewSchema.name + ' set extra: ' + JSON.stringify(params.__extra))
			//bindings = _.extend(bindings, params.__extra)
			Object.keys(params.__extra).forEach(function(pk){
				bindings[pk] = params.__extra[pk]
			})
		}
		for(var i=0;i<params.length;++i){
			//var pw = paramWrappers[i]
			//_.assert(pw.bindingName.length > 0)
			var p = viewSchema.params[i]
			//console.log(viewSchema.name + ' set param: ' + p.name + ' := ' + params[i])
			bindings[p.name] = params[i]
		}
		bindings.__key = viewId
		return bindings
	}

	var a = analytics.make('view', [])
	
	var handle = {
		name: 'view',
		analytics: a,
		getInclusionsDuring: function(params, lastEditId, endEditId, cb){
			if(lastEditId === endEditId){
				_.errout('wasting time')
			}
			
			var viewId = viewIdStr(objSchema.code,params,params.__mutatorKey)
			//console.log(viewId + ' view getting inclusions during: ' + lastEditId + ' ' + endEditId)
			//console.log(new Error().stack)
			
			var has = {}
			var list = []
			if(lastEditId === -1){
				list.push(viewId)
				has[viewId] = true
			}
			var cdl = _.latch(relMakers.length, function(){
				//console.log('*returning view inclusions between ' + lastEditId + ',' + endEditId+' ' + viewId + ': ' + JSON.stringify(list))
				cb(list)
			})
			var bindings = makeBindings(params, viewId)
			relMakers.forEach(function(rm){
				if(!rm.extractInclusions){
					_.errout('missing extractInclusions: ' + rm.name)
				}
				
				if(rm.getBetween){
					var changes = rm.getBetween(bindings, lastEditId, endEditId)
					if(!changes) _.errout('invalid changes: ' + rm.name)
					if(changes.length === 0){
						//console.log(lastEditId + ' ' + endEditId + ' no changes for ' + viewId+'.'+rm.propertyCode + ' ' + JSON.stringify(bindings))
						cdl()
					}else{
						var ids = rm.extractInclusions(changes)
						//console.log(lastEditId + ' ' + endEditId + ' extracted inclusions ' + JSON.stringify(ids) + ' from ' + JSON.stringify(changes))
						//console.log(new Error().stack)
						for(var i=0;i<ids.length;++i){
							var id = ids[i]
							if(has[id]) continue
							has[id] = true
							if(_.isString(id) && id.indexOf(':') === -1){
								_.errout('not a valid id string: ' + id + ' ' + JSON.stringify(changes))
							}
							//console.log('not already has: ' + id)
							list.push(id)
						}
						cdl()
					}
				}else{
					if(!rm.getChangesBetween){
						_.errout('missing getChangesBetween: ' + rm.name)
					}
				
					rm.getChangesBetween(bindings, lastEditId, endEditId, function(changes){
						if(changes.length === 0){
							//console.log(lastEditId + ' ' + endEditId + ' no changes for ' + viewId+'.'+rm.propertyCode + ' ' + JSON.stringify(bindings))
							cdl()
						}else{
							var ids = rm.extractInclusions(changes)
							//console.log(lastEditId + ' ' + endEditId + ' extracted inclusions ' + JSON.stringify(ids) + ' from ' + JSON.stringify(changes))
							//console.log(new Error().stack)
							for(var i=0;i<ids.length;++i){
								var id = ids[i]
								if(has[id]) continue
								has[id] = true
								if(_.isString(id) && id.indexOf(':') === -1){
									_.errout('not a valid id string: ' + id + ' ' + JSON.stringify(changes))
								}
								list.push(id)
							}
							cdl()
						}
					})
				}
			})
		},
		getHistoricalInclusionsDuring: function(params, lastEditId, endEditId, cb){
			if(lastEditId === endEditId){
				_.errout('wasting time')
			}
			
			var viewId = viewIdStr(objSchema.code,params,params.__mutatorKey)
			//console.log(viewId + ' view getting inclusions during: ' + lastEditId + ' ' + endEditId)
			//console.log(new Error().stack)
			
			var has = {}
			var list = []
			if(lastEditId === -1){
				list.push(viewId)
				has[viewId] = true
			}
			var cdl = _.latch(relMakers.length, 5000, function(){
				//console.log('*returning view inclusions between ' + lastEditId + ',' + endEditId+' ' + viewId + ': ' + JSON.stringify(list))
				cb(list)
			})
			var bindings = makeBindings(params, viewId)
			relMakers.forEach(function(rm){
				if(!rm.extractInclusions){
					_.errout('missing extractInclusions: ' + rm.name)
				}
				
				if(rm.getHistoricalBetween){

					var edits = rm.getHistoricalBetween(bindings, lastEditId, endEditId)
					if(edits.length === 0){
						cdl()
					}else{
						var ids = rm.extractInclusions(edits)
						//console.log('extracted inclusions ' + JSON.stringify(ids) + ' from ' + JSON.stringify(edits) + ' ' + rm.name + ' ' + rm.extractInclusions)
						for(var i=0;i<ids.length;++i){
							var id = ids[i]
							_.assertDefined(id)
							if(has[id]) continue
							has[id] = true
							if(_.isString(id) && id.indexOf(':') === -1){
								_.errout('not a valid id string: ' + id + ' ' + JSON.stringify(edits))
							}
							list.push(id)
						}
						cdl()
					}
				}else{
					if(!rm.getHistoricalChangesBetween){
						_.errout('missing getHistoricalChangesBetween: ' + rm.name)
					}

					rm.getHistoricalChangesBetween(bindings, lastEditId, endEditId, function(edits){
						if(edits.length === 0){
							cdl()
						}else{
							var ids = rm.extractInclusions(edits)
							//console.log('extracted inclusions ' + JSON.stringify(ids) + ' from ' + JSON.stringify(edits))
							for(var i=0;i<ids.length;++i){
								var id = ids[i]
								_.assertDefined(id)
								if(has[id]) continue
								has[id] = true
								if(_.isString(id) && id.indexOf(':') === -1){
									_.errout('not a valid id string: ' + id + ' ' + JSON.stringify(edits))
								}
								list.push(id)
							}
							cdl()
						}
					})
				}
			})
		},
		getStateAt: function(params, editId, cb){
			var viewId = viewIdStr(objSchema.code,params,params.__mutatorKey)//objSchema.code+':'+JSON.stringify(params)
			_.errout('TODO?')
			cb(viewId)
		},
		changeToEdit: function(){
			_.errout('no')
		},
		getEditsBetween: function(params, lastEditId, endEditId, cb){
			if(lastEditId === endEditId) _.errout('wasting time')
			
			//var mutatorKey = 
			//_.assertUndefined(params.__extra)
			
			//TODO use correct mutator key
			var viewId = viewIdStr(objSchema.code,params,params.__mutatorKey||'')
			var edits = []
			//console.log('computing state of ' + viewId)
			if(lastEditId === -1){
				var viewId = viewIdStr(objSchema.code, params,params.__mutatorKey)//objSchema.code+':'+JSON.stringify(params)
				edits.push({op: editCodes.madeViewObject, edit: {id: viewId, typeCode: objSchema.code}, state: {top: viewId}, editId: -1000, syncId: -1})
			}
			var bindings = makeBindings(params,viewId)
			//console.log('getting changes between: ' + lastEditId + ', '+ endEditId)
			var cdl = _.latch(relMakers.length, function(){
				//console.log('returning view snapshot: ' + JSON.stringify(edits))
				edits.sort(function(a,b){return a.editId - b.editId;})
				cb(edits)
			})
			relMakers.forEach(function(rm){
				if(rm.getBetween){
					var relChanges = rm.getBetween(bindings, lastEditId, endEditId)
					//console.log('got rel changes: ' + JSON.stringify(relChanges) + ' ' + viewId + '.'+ rm.propertyCode + ' ' + rm.propertyName + ' ' + rm.original + ' ' + lastEditId + ' ' + endEditId + ' ' + JSON.stringify(bindings) + ' ' + rm.name)
					relChanges.forEach(function(c){
						var e = rm.changeToEdit(c)
						if(e.type) _.errout('wrong type of edit: ' + JSON.stringify(e))
						//_.assertInt(e.syncId)
						//e = JSON.parse(JSON.stringify(e))
						if(!e.state) e.state = {}
						_.assertInt(rm.propertyCode)
						e.state.property = rm.propertyCode
						
						e.state.top = viewId
						edits.push(e)
					})
					//edits = edits.concat(relEdits)
					//console.log('got some snapshot edits: ' + JSON.stringify(relEdits))
					cdl()
				}else{
					//_.errout('not sync: ' + rm.name)
					rm.getChangesBetween(bindings, lastEditId, endEditId, function(relChanges){
						//console.log('got rel changes: ' + JSON.stringify(relChanges) + ' ' + viewId + '.'+ rm.propertyCode + ' ' + lastEditId + ' ' + endEditId + ' ' + JSON.stringify(bindings))
						relChanges.forEach(function(c){
							var e = rm.changeToEdit(c)
							if(e.type) _.errout('wrong type of edit: ' + JSON.stringify(e))
							//_.assertInt(e.syncId)
							//e = JSON.parse(JSON.stringify(e))
							if(!e.state) e.state = {}
							_.assertInt(rm.propertyCode)
							e.state.property = rm.propertyCode
							e.state.top = viewId
							edits.push(e)
						})
						//edits = edits.concat(relEdits)
						//console.log('got some snapshot edits: ' + JSON.stringify(relEdits))
						cdl()
					})
				}
			})
		},
		getHistoricalEditsBetween: function(params, lastEditId, endEditId, cb){
			if(lastEditId === endEditId) _.errout('wasting time')
			
			var viewId = viewIdStr(objSchema.code,params,params.__mutatorKey)
			var edits = []
			//console.log('computing state of ' + viewId)
			if(lastEditId === -1){
				//var viewId = viewIdStr(objSchema.code, params)//objSchema.code+':'+JSON.stringify(params)
				edits.push({op: editCodes.madeViewObject, edit: {id: viewId, typeCode: objSchema.code}, state: {top: viewId}, editId: -1000, syncId: -1})
			}
			var bindings = makeBindings(params,viewId)
			//console.log('getting changes between: ' + lastEditId + ', '+ endEditId)
			var cdl = _.latch(relMakers.length, function(){
				//console.log('returning view snapshot: ' + JSON.stringify(edits))
				edits.sort(function(a,b){return a.editId - b.editId;})
				cb(edits)
			})
			relMakers.forEach(function(rm){
			
				if(rm.getHistoricalBetween){
					var relChanges = rm.getHistoricalBetween(bindings, lastEditId, endEditId)
					//console.log('got historical rel changes: ' + JSON.stringify(relChanges))
					relChanges.forEach(function(c){
						var e = rm.changeToEdit(c)
						if(e.type) _.errout('wrong type of edit: ' + JSON.stringify(e))
						//_.assertInt(e.syncId)
						//e = JSON.parse(JSON.stringify(e))
						if(!e.state) e.state = {}
						_.assertInt(rm.propertyCode)
						e.state.property = rm.propertyCode
						e.state.top = viewId
						edits.push(e)
					})
					//console.log('got some snapshot edits: ' + JSON.stringify(relEdits))
					cdl()
				}else{
					if(!rm.getHistoricalChangesBetween) _.errout('missing getHistoricalChangesBetween: ' + rm.name)
				
					rm.getHistoricalChangesBetween(bindings, lastEditId, endEditId, function(relChanges){
						//console.log('got historical rel changes: ' + JSON.stringify(relChanges))
						relChanges.forEach(function(c){
							var e = rm.changeToEdit(c)
							if(e.type) _.errout('wrong type of edit: ' + JSON.stringify(e))
							//_.assertInt(e.syncId)
							//e = JSON.parse(JSON.stringify(e))
							if(!e.state) e.state = {}
							_.assertInt(rm.propertyCode)
							e.state.property = rm.propertyCode
							e.state.top = viewId
							edits.push(e)
						})
						//console.log('got some snapshot edits: ' + JSON.stringify(relEdits))
						cdl()
					})
				}
			})
		}
	}
	return handle
}

function makeObjectCallHandle(getParams, getParamsSync){
	var a = analytics.make('object-call', [])
	var handle = {
		name: 'object-call',
		analytics: a,
		getStateAt: function(bindings, editId, cb){
			getParams(bindings, editId, function(params){
				cb(params[0])
			})
		},
		changeToEdit: function(c){
			//_.errout('no?')
			if(c.type === 'clear'){
				return {op: editCodes.clearProperty, edit: {}, syncId: -1, editId: c.editId}
			}else if(c.type === 'set'){
				return {op: editCodes.setObject, edit: {id: c.value}, editId: c.editId, syncId: -1}
			}else{
				_.errout('TODO: ' + JSON.stringify(c))
			}
		},
		extractInclusions: function(changes){
			//_.errout('TODO: ' + JSON.stringify(changes))
			var incl = []
			changes.forEach(function(c){
				if(c.type === 'clear'){
				}else if(c.type === 'set'){
					incl = [c.value]
				}else{
					_.errout('TODO: ' + JSON.stringify(c))
				}
			})
			return incl
		},
		getChangesBetween: function(bindings, startEditId, endEditId, cb){
			getParams(bindings, startEditId, function(params){
				getParams(bindings, endEditId, function(endParams){
					if(params[0] !== endParams[0]){
						if(endParams[0] === undefined){
							//cb([{op: editCodes.clearProperty, edit: {}, syncId: -1, editId: startEditId}])
							cb([{type: 'clear', editId: startEditId, syncId: -1}])
						}else{
							//cb([{op: editCodes.setObject, edit: {id: endParams[0]}, syncId: -1, editId: startEditId}])
							cb([{type: 'set', value: endParams[0], editId: startEditId, syncId: -1}])
						}
					}else{
						cb([])
					}
				})
			})
		}
	}
	
	if(getParamsSync){
		handle.getBetween = function(bindings, startEditId, endEditId){
			var params = getParamsSync(bindings, startEditId)
			var endParams = getParamsSync(bindings, endEditId)
			params = params.params
			endParams = endParams.params
			if(params[0] !== endParams[0]){
				if(endParams[0] === undefined){
					//console.log('return clear')
					return [{type: 'clear', editId: startEditId, syncId: -1}]
				}else{
				//	console.log('return set')
					return [{type: 'set', value: endParams[0], editId: startEditId, syncId: -1}]
				}
			}else{
				//console.log(startEditId + ', ' + endEditId + ' return none: ' + JSON.stringify(params))
				return []
			}
		}
		handle.getAt = function(bindings, editId){
			var p = getParamsSync(bindings, editId)
			if(p.failed) return undefined
			return p.params[0]
		}
	}
	return handle
}
*/
function safeSplit(str, delim){
	var depth = 0
	var parts = []
	var cur = ''
	var inQuotes = false
	for(var i=0;i<str.length;++i){
		var c = str[i]
		if(c === '[') ++depth
		else if(c === ']') --depth
		else if(c === '"') inQuotes = !inQuotes
		else if(c === delim && depth === 0 && !inQuotes){
			parts.push(cur)
			cur = ''
			continue
		}
		cur += c			
	}
	if(cur.length > 0){
		parts.push(cur)
	}
	return parts
}

function parseComplexId(ps){
	var nci = ps.indexOf('_')
	var a = ps.substr(0,nci)
	var b = ps.substr(nci+1)
	var ia = parseInt(a)
	var ib = parseInt(b)
	if(isNaN(ia)) _.errout('failed to parse id: ' + a + ' ' + ps)
	if(isNaN(ib)) _.errout('failed to parse id: ' + b + ' ' + ps)
	return innerify(ia,ib)
}

exports.parseInnerId = parseComplexId

function parsePart(ps){
	if(ps.indexOf('[') === 0){
		return JSON.parse(ps)
	}else if(ps === 'undefined'){
		return undefined
	}else if(parseInt(ps)+'' === ps){
		return parseInt(ps)
	}else if(ps.indexOf('_') !== -1 && ps.indexOf('"') === -1){
		return parseComplexId(ps)
	}else{
		//console.log('ps: ' + ps)
		if(ps.indexOf('"') !== 0) _.errout('invalid: ' + ps)
		_.assert(ps.indexOf('"') === 0)
		return ps.substring(1,ps.length-1)
	}
}

function parseParams(paramsStr){
	_.assertEqual(paramsStr.substr(0,1), '[')
	paramsStr = paramsStr.substr(1, paramsStr.length-2)
	var parts = safeSplit(paramsStr, ',')
	var rest = []
	parts.forEach(function(part){
		rest.push(parsePart(part))
	})
	return rest
}
exports.parseParams = parseParams

function parseViewId(id){
	//console.log('view id: ' + id)
	var ci = id.indexOf('[')
	var typeCodeStr = id.substring(1, ci)
	
	var restStr = id.substring(ci+1,id.length-1)//id.indexOf(']'))//id.length-1)
	
	//var mutateStr = id.substr(id.indexOf(']')+1)
	
	var parts = safeSplit(restStr, ',')
	var rest = []
	parts.forEach(function(part){
		rest.push(parsePart(part))
	})
	var res = {typeCode: parseInt(typeCodeStr), rest: rest}

	//console.log(JSON.stringify([id, ci, typeCodeStr, restStr,res]))

	/*if(mutateStr && mutateStr.length > 0){
		var mutatorParts = mutateStr.split(';')
		mutatorParts = mutatorParts.slice(1)
		var mutators = []
		mutatorParts.forEach(function(mp){
			var code = parseInt(mp.substr(0,mp.indexOf('{')))
			var arr = mp.substring(mp.indexOf('{')+1, mp.indexOf('}'))
			var parts = safeSplit(arr, ',')
			var rest = []
			parts.forEach(function(part){
				rest.push(parsePart(part))
			})
			mutators.push({code: code, params: rest})			
		})
		//_.errout('TODO: ' + JSON.stringify(mutators))
		res.mutators = mutators
	}*/
	
	//console.log(id + ' -> ' + JSON.stringify(res))

	/*if(res.typeCode === 161 && res.mutators === undefined){//TODO REMOVEME
		_.errout('all childrenMap ids should have mutators: ' + id)
	}*/
	//if(res.typeCode === 164 && res.rest[3] === 54) _.errout('should be inner')
	
	return res
}

exports.parseViewId = parseViewId

function paramsStr(params){
	var str = '['
	for(var i=0;i<params.length;++i){
		if(i>0) str += ','
		var v = params[i]
		if(_.isString(v)){
			v = '"'+v+'"'
		}
		if(_.isArray(v)) _.errout('invalid array type?: ' + viewCode + ' ' + JSON.stringify(params))
		if(v+'' === '[object Object]') _.errout('cannot parameterize: ' + JSON.stringify(v) + ' ' + v)
		if((v+'').indexOf('{') !== -1) _.errout('cannot parameterize: ' + JSON.stringify(v) + ' ' + v)
		str += v
	}
	str += ']'
	return str
}
exports.paramsStr = paramsStr

function viewIdStr(viewCode,params){//,mutatorKey){//viewCode+':'+JSON.stringify(params)
	_.assertLength(arguments, 2)

	//if(viewCode === 161 && !mutatorKey){//TODO REMOVEME
	//	_.errout('all childrenMap ids should have mutators: ' + JSON.stringify([viewCode, params, mutatorKey]))
	//}
	
	/*if(params.length === 4 && params[3] === 54){
		_.errout("should be inner")
	}*/
	
	var str = ':'+viewCode+/*+':' + */paramsStr(params)

	//if(mutatorKey !== undefined) str += mutatorKey
	
	//console.log(JSON.stringify([viewCode,params]) + ' -> ' + str)
	
	return str
}

var syncView = require('./sync_view')

exports.make = function(schema, ol){

	var baseStaticBindings = {
		makePropertyIndex: ol.propertyIndex.facade.makePropertyIndex,
		makeReversePropertyIndex: ol.propertyIndex.facade.makeReversePropertyIndex
	}
	
	function makeViewRelFunction(viewSchema, rel){
		//_.errout('TODO: ' + JSON.stringify(rel))
		return syncView.makeRelFunction(s, baseStaticBindings, rel)
	}
	
	function makeViewStateFunction(viewSchema){
		var relFuncs = []
		Object.keys(viewSchema.rels).forEach(function(relName){
			var rel = viewSchema.rels[relName]
			relFuncs.push({code: rel.code, func: makeViewRelFunction(viewSchema, rel)})
		})
		function makeViewBindings(parsedViewId){
			var bindings = {}
			_.assertObject(parsedViewId)

			//console.log(JSON.stringify([parsedViewId, viewSchema.params]))
			//_.assertEqual(parsedViewId.rest.length, viewSchema.params.length)
			
			for(var i=0;i<viewSchema.params.length;++i){
				var p = viewSchema.params[i]
				bindings[p.name] = parsedViewId.rest[i]
			}
			return bindings
		}
		return function(parsedViewId){
			var state = {}
			var bindings = makeViewBindings(parsedViewId)
			
			for(var i=0;i<relFuncs.length;++i){
				var rf = relFuncs[i]
				state[rf.code] = rf.func(bindings)
			}
			return state
		}
	}

	
	
	//console.log('making new view sequencer...')
	var facade = require('./objectfacade').make(schema, ol)
	var objectState
	
	var afters = []
	var s = {
		facade: facade,
		schema: schema,
		propertyIndex: ol.propertyIndex,
		//indexes: ol.propertyIndex.facade,
		after: function(cb){
			afters.push(cb)
		}
	}
	
	var viewStateFuncs = {}
	_.each(schema, function(objSchema){
		if(objSchema.isView){
			viewStateFuncs[objSchema.code] = makeViewStateFunction(objSchema.viewSchema)
		}
	})
	
	function getViewState(viewId){
		var id = parseViewId(viewId)
		return viewStateFuncs[id.typeCode](id)
		//_.errout('TODO: ' + JSON.stringify(id))
	}
	
	function getSnapshotInner(id, lastEditId, endEditId, readyCb){
	
		var result = viewCache.snap(id, {})

		var objectEditBuffers = []
		var viewObjectEditBuffers = []
		
		result.forEach(function(r){
			if(_.isString(r.id)){
				viewObjectEditBuffers.push(r)
			}else{
				objectEditBuffers.push(r)
			}
		})
		
		//console.log(id + ' ' + lastEditId + ' ' + endEditId + ' ' + JSON.stringify(result))
		
		var snap = snapshotSerialization.serializeSnapshot(lastEditId, endEditId, objectEditBuffers, viewObjectEditBuffers)
		readyCb(snap)

		return
		_.errout('tODO: ' + id + ' ' + lastEditId + ' ' + endEditId + ' ' + JSON.stringify(result))
		
	
		//console.log('getting snapshot inner ' + id + ' ' + lastEditId + ', ' + endEditId)

		if(lastEditId === endEditId){
			var snap = snapshotSerialization.serializeSnapshot(lastEditId, endEditId, [], [])
			readyCb(snap)
			return
		}
		
		var rem = remainer(2, finish)
		var objectEditBuffers = []
		var viewObjectEditBuffers = []

		_.assertString(id)
		
		function storeEdits(id, edits){
			if(_.isString(id)){
				var oldState = {top: id}
				var resultEdits = []
				edits.forEach(function(e){
					//console.log('& ' + JSON.stringify(e) + ' editing snapshot obj stream to match: ' + JSON.stringify([oldState, e.state]))
					pathmerger.editToMatch(oldState, e.state, function(op, edit){
						resultEdits.push({op: op, edit: edit, editId: e.editId, syncId: -1})
					})
					resultEdits.push(e)
					oldState = e.state
				})
				//console.log('storing ' + resultEdits.length + ' edits for ' + id + ' between ' + lastEditId + ', ' + endEditId)
				//console.log(JSON.stringify(resultEdits))
				viewObjectEditBuffers.push({id: id, edits: resultEdits})
			}else{
				objectEditBuffers.push({id: id, edits: edits})
			}
		}
		
		var has = {}
		var allInclusionsAt = []
		function recursivelyGetObjectInclusionsAt(id, editId, cb){
			if(editId === -1){
				cb()
				return
			}
			if(has[id]){
				cb()
				return
			}
			has[id] = true
			allInclusionsAt.push(id)
			getObjectInclusionsDuring(id, -1, editId, function(ids){
				var allIds = [].concat(ids)
				var cdl = _.latch(ids.length, function(){
					cb(allIds)
				})
				ids.forEach(function(id){
					if(has[id]){
						cdl()
						return
					}
					//console.log('including and recursing on: ' + id)
					_.assertDefined(id)
					recursivelyGetObjectInclusionsAt(id, editId, cdl)
				})
			})
		}
		
		recursivelyGetObjectInclusionsAt(id, lastEditId, function(){
			var ids = allInclusionsAt
			rem.increase(ids.length)
			rem.decrease(1)
			//console.log('AA: ' + JSON.stringify(ids))
			ids.forEach(function(includedId){
				getObjectEditsBetween(includedId, lastEditId, endEditId, function(changes){
					//console.log('storing: ' + includedId + ' ' + JSON.stringify(changes))
					storeEdits(includedId, changes)
					rem.decrease(1)
				})
			})
		})
		
		var hasDuring = {}
		var allInclusionsDuring = []
		function recursivelyGetObjectInclusionsDuring(id, lastEditId, endEditId, cb){
			if(hasDuring[id]){
				cb()
				return
			}
			hasDuring[id] = true
			allInclusionsDuring.push(id)
			getObjectInclusionsDuring(id, lastEditId, endEditId, function(ids){
				var allIds = [].concat(ids)
				var cdl = _.latch(ids.length, function(){
					cb(allIds)
				})
				//console.log('recursing on ids: ' + ids.length)
				ids.forEach(function(id){
					_.assertDefined(id)
					if(hasDuring[id]){
						cdl()
						return
					}
					//console.log('including during and recursing on: ' + id)
					recursivelyGetObjectInclusionsDuring(id, lastEditId, endEditId, cdl)
				})
			})
		}

		recursivelyGetObjectInclusionsDuring(id, lastEditId, endEditId, function(){
			var ids = allInclusionsDuring
			rem.increase(ids.length)
			rem.decrease(1)
			//console.log('BB ' + JSON.stringify(ids))
			ids.forEach(function(includedId){
				if(!_.isString(includedId)){
					//_.errout('TODO')
					objectState.ol.get(includedId, -1, endEditId, function(snap){
						storeEdits(includedId, snap)
						rem.decrease(1)
					})
				}else{
					getObjectEditsBetween(includedId, -1, endEditId, function(snap){
						//console.log('*storing: ' + includedId + ' ' + JSON.stringify(snap))
						storeEdits(includedId, snap)
						rem.decrease(1)
					})
				}
			})
		})
		
		function finish(){
			//console.log('made snap: ' + JSON.stringify([objectEditBuffers, viewObjectEditBuffers]))
			
			if(lastEditId <= 0 && viewObjectEditBuffers.length === 0){
				_.errout('(' + lastEditId+', '+endEditId + ') error, snapshot with zero start edit has no view objects, should have at least one')
			}
			//var snap = {edits: edits, snapshots: snapshots}
			var snap = snapshotSerialization.serializeSnapshot(lastEditId, endEditId, objectEditBuffers, viewObjectEditBuffers)
			readyCb(snap)
		}
	}
	
	var viewCache
		

	var handle = {
		initialize: function(objs){
			objectState = objs
			s.objectState = objs

			console.log('initialized new_view_sequencer')
			//_.errout('here')
			
			afters.forEach(function(cb){
				cb()
			})
			afters = undefined
			
			var queryHandle = {
				get: function(viewId){
					return getViewState(viewId)
				}
			}
			viewCache = vcModule.make(schema, objectState, queryHandle)
		},
		makeStream: function(includeObjectCb, editCb, sendViewObjectCb, syncId){
		
			//console.log('making stream')
	
			var queryHandle = makeQueryHandle(syncId, viewCache)

			var lastEditId = -1
			var paused = false
			
			var addViewTasks = []
			var addObjectTasks = []
			var addUpdateTasks = []
			
			function maintain(endEditId){
				_.assertInt(endEditId)
				
				if(addObjectTasks.length > 0){
					//console.log('processing add object tasks: ' + addObjectTasks.length)
					var copy = [].concat(addObjectTasks)
					addObjectTasks = []
					
					copy.forEach(function(task){
						queryHandle.addObject(task)
					})
					maintain(endEditId)
				}else if(addViewTasks.length > 0){
					//console.log('processing view tasks: ' + addViewTasks.length)
					var copy = [].concat(addViewTasks)
					addViewTasks = []
					
					copy.forEach(function(task){
						addView(task.id, task.lastEditId, endEditId, task.cb)
					})
					maintain(endEditId)
				}else{
					//console.log('done polling ' + endEditId)
					lastEditId = endEditId
					paused = false
				}
			}
			
			function poll(){
				if(paused){
					console.log('already in polling')//: ' + JSON.stringify(queryHandle.got))
					return
				}
				paused = true
				
				//console.log('polling...')
				
				var endEditId = objectState.getCurrentEditId()-1
				/*if(endEditId === lastEditId){
					//console.log('no need to move: ' + lastEditId + ' === ' + endEditId)
					//maintain(endEditId)
					finish()
					return
				}*/
				
				//var rem = remainer(1, finish)
				
				var edits = []
				//console.log('moving to: ' + endEditId + ' from ' + lastEditId)
				queryHandle.moveTo(endEditId, function(changes){
					//console.log('moving')
					edits = edits.concat(changes)
					//console.log('moving changes: ' + id + ' ' + JSON.stringify(changes))
				},
				function(id, snap){
					//rem.increase(1)
					//console.log('moving adds: ' + id)
					//console.log('edits: ' + JSON.stringify(snap))
					_.assertDefined(snap)
					if(_.isString(id)){
						sendViewObjectCb(id, snap)
					}else{
						includeObjectCb(id, snap)
					}
					/*if(_.isString(id)){
						getObjectEditsBetween(id, -1, endEditId, function(snap){
							//console.log('view object snap(' + id +'): ' + JSON.stringify(snap))
							

							var resultEdits = computeStateEditsForViewObject(id, snap)
							
							//console.log('result edits: ' + JSON.stringify(resultEdits))
							
							sendViewObjectCb(id, resultEdits)
							rem.decrease(1)
						})
					}else{
						if(_.isObject(id)){
							id = id.top
						}
						//getObjectEditsBetween(id, -1, endEditId, function(snap){
							//console.log('snap: ' + JSON.stringify(snap))
							//TODO also include foreign
							//getObjectInclusionsDuring(
							includeObjectCb(id, function(){
								//console.log('included?')
							})//, snap)
							rem.decrease(1)
						//})
					}*/
				}, function(){
					//console.log(endEditId + ' (' + objectState.getCurrentEditId() + ') moving done: ' + JSON.stringify(edits))
					//console.log(''+editCb)

					//edits.sort(function(a,b){return a.editId - b.editId;})
					
					
					//TODO does this matter?
					/*if(edits.length > 0){
						var curEditId = edits[0].editId
						edits.forEach(function(e){
							if(e.editId > curEditId) curEditId = e.editId
							if(curEditId > e.editId){
								console.log(JSON.stringify(edits))
								_.errout('ordering problem')
							}
						})
					}*/

					//console.log(endEditId + ' (' + objectState.getCurrentEditId() + ') moving done: ' + JSON.stringify(edits))
					
					edits.forEach(function(e){
						editCb(e)
					})
					//rem.decrease(1)
				})
				
				finish()

				function finish(){
					//console.log('finishing poll')

					if(addUpdateTasks.length > 0){
						//console.log('calling update: ' + endEditId)
						var temp = addUpdateTasks
						addUpdateTasks = []
						temp.forEach(function(cb){
							cb()
						})
					}

					maintain(endEditId)
					
				}
			}

			addPollFunction(poll)
			
			function addView(id, lastEditId, endEditId, readyCb, isHistorical){

				if(isHistorical) _.errout('TODO')
				
				var rem = remainer(1, finish)

				var edits = []
				var snapshots = []
				
				//console.log('adding view ' + id + ' ' + lastEditId + ' ' + endEditId)
				
				queryHandle.add(id, lastEditId, function(changedId, changes){
					//console.log('appending edits: ' + JSON.stringify(changes))
					edits = edits.concat(changes)
				}, function inclusion(includedId){
					//console.log('including: ' + includedId)
					if(!_.isString(includedId)){
						//_.errout('TODO')
//						includeObjectCb(id,function(){})//TODO is this right?
						snapshots.push([includedId])
					}
					rem.increase(1)
					getObjectEditsBetween(includedId, -1, endEditId, function(snap){
						//console.log('adding view included object: ' + JSON.stringify(snap))
						snapshots.push([includedId,snap])
						rem.decrease(1)
					})
				}, function(){
					rem.decrease(1)
					//console.log('finished qh add')
				})
				
				function finish(){
					//console.log('finishing add view: ' + id + ' ' + JSON.stringify(snapshots))
					
					edits.sort(function(a,b){
						return a.editId - b.editId
					})
					
					//send snapshots, then edits
					
					snapshots.forEach(function(snap){
						var id = snap[0]
						snap = snap[1]
						if(_.isString(id)){
							_.assertObject(snap)

							var resultEdits = computeStateEditsForViewObject(id, snap)

							sendViewObjectCb(id, resultEdits)
						}else{
							includeObjectCb(id,function(){})
						}
					})
					
					edits.forEach(function(e){
						editCb(e)
					})
					
					readyCb()	
				}
			}
			
			var handle = {
				end: function(){
					//console.log('ended new view sequencer')
					//clearInterval(analyticsLogIntervalHandle)
					//clearInterval(pollHandle)
					removePollFunction(poll)
					
					//analyticsLog.close()
					//_.errout('TODO')
				},
				subscribeToObject: function(id){
					//_.errout('TODO push subscribe task, etc')					
					addObjectTasks.push(id)
				},
				afterNextUpdate: function(cb){
					addUpdateTasks.push(cb)
				},
				//changes before lastEditId will already be known to the client
				addView: function(id, lastEditId, readyCb){
					//console.log('adding view task: ' + id + ' ' + lastEditId + ' ' + new Error().stack)
					addViewTasks.push({id: id, lastEditId: lastEditId, cb: readyCb})
				}
			}
			
			return handle
		},
		/*
			- entire state of up endEditId of objects added during the snapshot edit range
			- changes between lastEditId and endEditId for objects already present before lastEditId
		*/
		makeSnapshot: function(id, lastEditId, endEditId, isHistorical, readyCb){
			if(isHistorical){
				getSnapshotInner(/*getHistoricalObjectInclusionsDuring, getHistoricalObjectEditsBetween,*/ id, lastEditId, endEditId, readyCb)
			}else{
				getSnapshotInner(/*getObjectInclusionsDuring, getObjectEditsBetween, */id, lastEditId, endEditId, readyCb)
			}
		}
	}
	
	return handle
}

function computeStateEditsForViewObject(id, edits){
	var oldState = {top: id}
	var resultEdits = []
	edits.forEach(function(e){
		//if(e.op === editCodes.putLong) _.assertInt(e.state.property)
		pathmerger.editToMatch(oldState, e.state, function(op, edit){
			resultEdits.push({op: op, edit: edit, editId: e.editId, syncId: -1})
		})
		resultEdits.push(e)
		oldState = e.state
	})
	return resultEdits
}



