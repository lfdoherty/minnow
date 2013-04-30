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

function makeQueryHandle(getObjectEditsBetween, getObjectInclusionsDuring, syncId){
	var qhEditId=-1//this will always get a moveTo current call before the first add call happens anyway
	var alreadyGot = {}
	var gotIds = []
	
	/*
		Possible Optimizations:
			- monitoring changes that happen to anything in the gotIds set in-between moveTo calls, making that a simple reply
			- monitoring inclusions in-between moveTo calls
		
	*/
	
	return {
		moveTo: function(editId, changesCb, inclusionsCb, doneCb){
			var inclusionsDuring = []
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
			}
		},
		addObject: function(id, cb){
			_.assertInt(id)
			if(alreadyGot[id]){
				cb()
				return
			}else{
				//console.log('adding object: ' + id)
				alreadyGot[id] = true
				gotIds.push(id)
				cb()
			}
			//TODO include foreign ids?  might not be checked for later... edits maybe too?
		},
		add: function(id, lastEditId, changesCb, inclusionsCb, doneCb){
			if(alreadyGot[id]){
				doneCb();
				return;
			}
			
			//console.log(syncId + ' adding view to queryhandle: ' + id)
			
			var rem = remainer(1, doneCb)
			
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
			})
			
			/*if(lastEditId === qhEditId){
				rem.decrease(1)
			}else{
				getObjectInclusionsDuring(id, lastEditId, qhEditId, function(ids){
					ids.forEach(function(includedId){
						if(alreadyGot[includedId]) return
						alreadyGot[includedId] = true
						gotIds.push(includedId)
						//console.log('^^^^^^^^^^^^^^^^^7 new inclusions: ' + includedId)
						inclusionsCb(includedId)
					})
					rem.decrease(1)
				})
			}*/
		}
	}
}

var log = require('quicklog').make('minnow/new_view_sequencer')

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
					//console.log('got rel changes: ' + JSON.stringify(relChanges) + ' ' + viewId + '.'+ rm.propertyCode + ' ' + lastEditId + ' ' + endEditId + ' ' + JSON.stringify(bindings) + ' ' + rm.name)
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

function parsePart(ps){
	if(ps.indexOf('[') === 0){
		return JSON.parse(ps)
	}else if(ps === 'undefined'){
		return undefined
	}else if(parseInt(ps)+'' === ps){
		return parseInt(ps)
	}else if(ps.indexOf('_') !== -1 && ps.indexOf('"') === -1){
		var nci = ps.indexOf('_')
		var a = ps.substr(0,nci)
		var b = ps.substr(nci+1)
		var ia = parseInt(a)
		var ib = parseInt(b)
		if(isNaN(ia)) _.errout('failed to parse viewId: ' + id)
		if(isNaN(ib)) _.errout('failed to parse viewId: ' + id)
		return innerify(ia,ib)
	}else{
		//console.log('ps: ' + ps)
		if(ps.indexOf('"') !== 0) _.errout('invalid: ' + ps)
		_.assert(ps.indexOf('"') === 0)
		return ps.substring(1,ps.length-1)
	}
}
function parseViewId(id){
	//console.log('view id: ' + id)
	var ci = id.indexOf(':')
	var typeCodeStr = id.substr(0, ci)
	
	var restStr = id.substring(ci+2,id.indexOf(']'))//id.length-1)
	var mutateStr = id.substr(id.indexOf(']')+1)
	
	var parts = safeSplit(restStr, ',')
	var rest = []
	parts.forEach(function(part){
		rest.push(parsePart(part))
	})
	var res = {typeCode: parseInt(typeCodeStr), rest: rest}
	if(mutateStr && mutateStr.length > 0){
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
	}

	if(res.typeCode === 161 && res.mutators === undefined){//TODO REMOVEME
		_.errout('all childrenMap ids should have mutators: ' + id)
	}
	
	return res
}
function viewIdStr(viewCode,params,mutatorKey){//viewCode+':'+JSON.stringify(params)
	_.assertLength(arguments, 3)

	if(viewCode === 161 && !mutatorKey){//TODO REMOVEME
		_.errout('all childrenMap ids should have mutators: ' + JSON.stringify([viewCode, params, mutatorKey]))
	}
	
	var str = viewCode+':['
	for(var i=0;i<params.length;++i){
		if(i>0) str += ','
		var v = params[i]
		if(_.isString(v)){
			v = '"'+v+'"'
		}
		if(v+'' === '[object Object]') _.errout('cannot parameterize: ' + JSON.stringify(v))
		str += v
	}
	str += ']'
	if(mutatorKey !== undefined) str += mutatorKey
	return str
}

exports.make = function(schema, ol){

	//console.log('making new view sequencer...')
	var facade = require('./objectfacade').make(schema, ol)
	var objectState
	
	var afters = []
	var s = {
		//objectState: objectState,
		facade: facade,
		schema: schema,
		getEditsBetween: getObjectEditsBetween,
		getInclusionsDuring: getObjectInclusionsDuring,
		propertyIndex: ol.propertyIndex,
		//indexes: ol.propertyIndex.facade,
		after: function(cb){
			afters.push(cb)
		}
	}
	function getViewCallHandle(viewName, viewCall, staticBindings, isSync){
		_.assertObject(staticBindings)
		
		var viewCode = schema[viewName].code
		var handle = makers[viewCode]
		
		var viewSchema = schema[viewName].viewSchema
		
		//if(!isSync) _.errout('why?')

		//_.errout(JSON.stringify(viewCall))
		var paramMakers = []
		viewCall.params.forEach(function(expr){
			paramMakers.push(makeRelHandle(expr, staticBindings, isSync))//, handle.viewParamsStaticBindings))
		})
		function getParams(bindings, editId, cb){
			_.assertNot(isSync)
			
			var params = []
			var failed = false
			var cdl = _.latch(paramMakers.length, function(){
				cb(params, failed)
			})
			paramMakers.forEach(function(pm, index){
				pm.getStateAt(bindings, editId, function(state){
					if(state === undefined){
						//console.log('failed: ' + index + ' ' + editId + ' ' + JSON.stringify(bindings) + ' ' + pm.name)
						failed = true
					}else{
						params[index] = state
					}
					cdl()
				})
			})
		}
		function getParamsSync(bindings, editId, cb){
			var params = []
			var failed = false
			paramMakers.forEach(function(pm, index){
				var state = pm.getAt(bindings, editId)
				if(state === undefined){
					//console.log('failed: ' + index + ' ' + editId + ' ' + JSON.stringify(bindings) + ' ' + pm.name)
					failed = true
				}else{
					params[index] = state
				}
			})
			//console.log('returning: ' + JSON.stringify([params, failed]))
			return {params: params, failed: failed}
		}

		function getParamValues(bindingValues){
			//console.log('computing param values: ' + JSON.stringify([viewCall.params, bindingValues]))
			var params = []
			for(var i=0;i<viewCall.params.length;++i){
				var p = viewCall.params[i]
				if(bindingValues[p.name] === undefined) return undefined
				params[i] = bindingValues[p.name]
			}
			return params
		}
		
		if(!viewSchema){ 
			//_.errout('TODO?: ' + JSON.stringify(viewCall))
			return makeObjectCallHandle(getParams, isSync?getParamsSync:undefined)
		}
		
		var a = analytics.make('view-call', [])

		var handle = {
			name: 'view-call',
			analytics: a,
			getStateSync: function(bindingValues){
				var params = getParamValues(bindingValues)
				if(!params) return undefined
				var viewId = viewIdStr(viewCode,params,bindingValues.__mutatorKey)
				return viewId
			},
			getAt: function(bindings, editId){
				var res = getParamsSync(bindings, editId)//, function(params, failed){
				if(res.failed){
					return
				}else{
					var viewId = viewIdStr(viewCode,res.params,bindings.__mutatorKey)
					/*if(){
						//_.errout('tODO: ' + JSON.stringify(bindings))
					}*/
					return viewId
				}
			},

			getStateAt: function(bindings, editId, cb){
				getParams(bindings, editId, function(params, failed){
					if(failed){
						cb(undefined)
					}else{
						var viewId = viewIdStr(viewCode,params,bindings.__mutatorKey)
						/*if(){
							//_.errout('tODO: ' + JSON.stringify(bindings))
						}*/
						cb(viewId)
					}
				})
			},
			changeToEdit: function(c){
				//_.errout('no?')
				if(c.type === 'set'){
					return {op: editCodes.setViewObject, edit: {id: c.value}, editId: c.editId}
				}else if(c.type === 'clear'){
					return {op: editCodes.clearProperty, edit: {}, editId: c.editId}
				}else{
					_.errout('TODO: ' + JSON.stringify(c))
				}
			},
			extractInclusions: function(changes){
				if(changes.length === 1 && changes[0].type === 'set'){
					_.assertDefined(changes[0].value)
					return [changes[0].value]
				}else{
					//_.errout('TODO: ' + JSON.stringify(changes))
					var inclusions = []
					var has = {}
					for(var i=0;i<changes.length;++i){
						var c = changes[i]
						if(c.type === 'set'){
							var v = c.value
							_.assertDefined(v)
							if(has[v]) continue
							has[v] = true
							inclusions.push(v)
						}else if(c.type === 'clear'){
						}else{
							_.errout('TODO: ' + JSON.stringify(c))
						}
					}
					return inclusions
				}
			},
			getChangesBetween: function(bindings, startEditId, endEditId, cb){
				getParams(bindings, startEditId, function(params, failedA){
					getParams(bindings, endEditId, function(params, failedB){
						if(failedA && !failedB){
							var viewId = viewIdStr(viewCode,params,bindings.__mutatorKey)
							cb([{type: 'set', value: viewId, editId: endEditId, syncId: -1}])
						}else{
							cb([])
						}
					})
				})
			},
			getHistoricalChangesBetween: function(bindings, startEditId, endEditId, cb){

				var paramChanges = []
				var keyEditIds = {}
				var cdl = _.latch(paramMakers.length, function(){
					//_.errout('TODO: ' + JSON.stringify(paramChanges))
					var realEditIds = []
					Object.keys(keyEditIds).forEach(function(key){
						var editId = parseInt(key)
						realEditIds.push(editId)
					})
					realEditIds.sort(function(a,b){return a - b;})
					
					var states = []
					var cdl = _.latch(realEditIds.length, function(){
						//_.errout('TODO: ' + JSON.stringify(states) + ' ' + JSON.stringify(realEditIds))
						getParams(bindings, startEditId, function(params){
							var curViewId = viewIdStr(viewCode,params,bindings.__mutatorKey)
							var changes = []
							for(var i=0;i<states.length;++i){
								var state = states[i]
								if(state === undefined){
									if(curViewId){
										changes.push({type: 'clear', editId: realEditIds[i]})
										curViewId = undefined
									}
								}else{
									var viewId = viewIdStr(viewCode,state,bindings.__mutatorKey)
									if(viewId !== curViewId){
										changes.push({type: 'set', value: viewId, editId: realEditIds[i]})
										curViewId = viewId
									}
								}
							}
							cb(changes)
						})
					})
					//console.log('getting for all realEditIds: ' + JSON.stringify(realEditIds))
					realEditIds.forEach(function(editId, index){
						getParams(bindings, editId, function(params, failed){
							states[index] = failed?undefined:params
							cdl()
						})
					})
				})
				
				paramMakers.forEach(function(pm, index){
					if(pm.getHistoricalBetween){
						var changes = pm.getHistoricalBetween(bindings, startEditId, endEditId)
						//paramChanges[index] = changes
						//console.log(index + ' ' + JSON.stringify(changes))
						for(var i=0;i<changes.length;++i){
							keyEditIds[changes[i].editId] = true
						}
						cdl()
					}else{
						pm.getHistoricalChangesBetween(bindings, startEditId, endEditId, function(changes){
							//paramChanges[index] = changes
							//console.log(index + ' ' + JSON.stringify(changes))
							for(var i=0;i<changes.length;++i){
								keyEditIds[changes[i].editId] = true
							}
							cdl()
						})
					}
				})
				
				//_.errout('TODO')
				//look through all the versions of the params
			}
		}
		
		if(isSync){
			handle.getBetween = function(bindings, startEditId, endEditId){
				var pa = getParamsSync(bindings, startEditId)
				var pb = getParamsSync(bindings, endEditId)
				if(pa.failed && !pb.failed){
					var viewId = viewIdStr(viewCode,pb.params,bindings.__mutatorKey)
					return [{type: 'set', value: viewId, editId: endEditId, syncId: -1}]
				}else{
					return []
				}
			}
			handle.getHistoricalBetween = function(bindings, startEditId, endEditId){

				var paramChanges = []
				var keyEditIds = {}
				
				_.assert(isSync)
				
				paramMakers.forEach(function(pm, index){
					if(!pm.getHistoricalBetween) _.errout('missing getHistoricalBetween: ' + pm.name)
					_.assertFunction(pm.getHistoricalBetween)
					var changes = pm.getHistoricalBetween(bindings, startEditId, endEditId)
					//paramChanges[index] = changes
					//console.log(index + ' ' + JSON.stringify(changes))
					for(var i=0;i<changes.length;++i){
						keyEditIds[changes[i].editId] = true
					}
				})
				
				//_.errout('TODO: ' + JSON.stringify(paramChanges))
				var realEditIds = []
				Object.keys(keyEditIds).forEach(function(key){
					var editId = parseInt(key)
					realEditIds.push(editId)
				})
				realEditIds.sort(function(a,b){return a - b;})
				
				var states = []
				
				//console.log('getting for all realEditIds: ' + JSON.stringify(realEditIds))
				realEditIds.forEach(function(editId, index){
					var p = getParamsSync(bindings, editId)//, function(params, failed){
					states[index] = p.failed?undefined:p.params
				})
				
				//_.errout('TODO: ' + JSON.stringify(states) + ' ' + JSON.stringify(realEditIds))
				var p = getParamsSync(bindings, startEditId)
				var curViewId = viewIdStr(viewCode,p.params,bindings.__mutatorKey)
				var changes = []
				for(var i=0;i<states.length;++i){
					var state = states[i]
					if(state === undefined){
						if(curViewId){
							changes.push({type: 'clear', editId: realEditIds[i]})
							curViewId = undefined
						}
					}else{
						var viewId = viewIdStr(viewCode,state,bindings.__mutatorKey)
						if(viewId !== curViewId){
							changes.push({type: 'set', value: viewId, editId: realEditIds[i]})
							curViewId = viewId
						}
					}
				}
				
				return changes
				
				//_.errout('TODO')
				//look through all the versions of the params
			}
		}
		//handle.getHistoricalChangesBetween = handle.getChangesBetween
		return handle
	}
	
	var count = 0
	function makeRelHandle(rel, staticBindings, syncOnly){
		function recurse(rel, newStaticBindings){
			if(syncOnly){
				_.errout('must recurseSync within a sync handle')
			}
			++count
			if(count > 50000){
				_.errout('overcall')
			}		
			if(newStaticBindings){
				//console.log('recursing with new bindings: ' + JSON.stringify(Object.keys(newStaticBindings)))
				var newStaticBindings = _.extend({}, staticBindings, newStaticBindings)
				//Object.freeze(newStaticBindings)
				return makeRelHandle(rel, newStaticBindings, syncOnly)
			}else{
				//console.log('recursing with same bindings')//: ' + JSON.stringify(Object.keys(staticBindings)))
				var nsb = _.extend({}, staticBindings)
				//Object.freeze(nsb)
				return makeRelHandle(rel, nsb, syncOnly)
			}
		}
		function recurseSync(rel, newStaticBindings){
			++count
			if(count > 50000){
				_.errout('overcall')
			}		
			if(newStaticBindings){
				//console.log('recursing with new bindings: ' + JSON.stringify(Object.keys(newStaticBindings)))
				var newStaticBindings = _.extend({}, staticBindings, newStaticBindings)
				//Object.freeze(newStaticBindings)
				return makeRelHandle(rel, newStaticBindings, true)
			}else{
				//console.log('recursing with same bindings')//: ' + JSON.stringify(Object.keys(staticBindings)))
				var nsb = _.extend({}, staticBindings)
				//Object.freeze(nsb)
				return makeRelHandle(rel, nsb, true)
			}
		}
		
		if(syncOnly || rel.sync){
			var wrapped = wrap.makeSync(s, rel, recurseSync, function(viewName, viewCall){
				return getViewCallHandle(viewName, viewCall, staticBindings, true)
			}, staticBindings)
			return wrapped
		}else{
			//_.errout('rel: ' + JSON.stringify(rel))
			var wrapped = wrap.make(s, rel, recurse, recurseSync, function(viewName, viewCall){
				return getViewCallHandle(viewName, viewCall, staticBindings)
			}, staticBindings)
			return wrapped
		}
	}
	
	//TODO set up variable constructors for each view
	var makers = {}
	_.each(schema, function(objSchema){
		if(objSchema.isView){
			
			var relMakers = []

			var viewSchema = objSchema.viewSchema
			
			makers[objSchema.code] = createRelHandle(objSchema, relMakers)
			makers[objSchema.code].relMakers = relMakers
		}
	})
	
	var viewParamsStaticBindings = {
		getPropertyValueAt: function(){
			_.errout('tODO')
		},
		getPropertyChangesDuring: function(id, propertyCode, startEditId, endEditId, cb){
			//_.errout('tODO')
			return s.objectState.getPropertyChangesDuring(id, propertyCode, startEditId, endEditId, cb)
		},
		getHistoricalPropertyChangesDuring: function(id, propertyCode, startEditId, endEditId, cb){
			//_.errout('tODO')
			return s.objectState.getHistoricalPropertyChangesDuring(id, propertyCode, startEditId, endEditId, cb)
		},
		makeGetPropertyAt: function(typeCode, propertyCode){
			return facade.makeGetPropertyAt(typeCode, propertyCode)
		},
		getLastVersion: function(id, cb){
			s.objectState.getLastVersion(id, cb)			
		},
		makePropertyIndex: ol.propertyIndex.facade.makePropertyIndex,
		makeReversePropertyIndex: ol.propertyIndex.facade.makeReversePropertyIndex
	}
	
	_.each(schema, function(objSchema){
		if(objSchema.isView){

			var viewSchema = objSchema.viewSchema
			
			viewSchema.params.forEach(function(p){
				var paramName = p.name
				var f
				var nameStr = 'view-param:'+p.name
				var a = analytics.make(nameStr, [])				
				var vpHandle = {
					name: nameStr,
					analytics: a,
					getAt: function(bindings, editId){
						if(editId === -1){
							return undefined
						}else{
							//console.log('got binding value: ' + paramName + ' ' + JSON.stringify(bindings[paramName]))
							//console.log(JSON.stringify(bindings))
							_.assertDefined(bindings[paramName])
							return bindings[paramName]
						}
					},
					getStateAt: function(bindings, editId, cb){
						if(editId === -1){
							cb(undefined)
						}else{
							//console.log('got binding value: ' + paramName + ' ' + JSON.stringify(bindings[paramName]))
							cb(bindings[paramName])
						}
					},
					isFullySync: true,
					getStateSync: function(bindings, editId){
						if(editId === -1){
							//console.log('here')
							return
						}else{
							//console.log('computed getStateSync: ' + JSON.stringify([paramName, bindings[paramName], editId]))
							return bindings[paramName]
						}
					},
					getChangesBetween: function(bindings, startEditId, endEditId, cb){
						if(startEditId === -1 && endEditId >= 0){
							var value = bindings[paramName]
							//console.log('changes ' + startEditId + ' ' + endEditId + ' ' + value)
							cb([{type: 'set', value: value, editId: 0}])
						}else{
							cb([])
						}
					},
					getBetween: function(bindings, startEditId, endEditId){
						if(startEditId === -1 && endEditId >= 0){
							var value = bindings[paramName]
							//console.log('changes ' + startEditId + ' ' + endEditId + ' ' + value)
							return [{type: 'set', value: value, editId: 0}]
						}else{
							return []
						}
					}				
				}
				vpHandle.getHistoricalChangesBetween = vpHandle.getChangesBetween
				vpHandle.getHistoricalBetween = vpHandle.getBetween
				
				viewParamsStaticBindings[p.name] = vpHandle
			})
		}
	})

	Object.freeze(viewParamsStaticBindings)
			
	_.each(schema, function(objSchema){
		if(objSchema.isView){

			var viewSchema = objSchema.viewSchema
			
			Object.keys(viewSchema.rels).forEach(function(relName){
				var rel = viewSchema.rels[relName];
				var rm = makeRelHandle(rel, viewParamsStaticBindings)
				rm.rel = rel
				if(!rm.changeToEdit) _.errout('needs changeToEdit: ' + rm.name + ' ' + JSON.stringify(rel) + ' ' + rm.getChangesBetween)
				rm.propertyCode = viewSchema.rels[relName].code
				if(rm.propertyCode === undefined) _.errout('missing code: ' + JSON.stringify(viewSchema.rels[relName]))
				_.assertInt(rm.propertyCode)
				//relMakers.push(rm)
				makers[objSchema.code].relMakers.push(rm)
			})
			makers[objSchema.code].analytics = analytics.make('view['+viewSchema.name+']', makers[objSchema.code].relMakers)
			makers[objSchema.code].viewParamsStaticBindings = viewParamsStaticBindings
			
		}
	})

	var haveMade = false
	var mutatorAppliers = {}
	function makeMutatorAppliers(){
		haveMade = true
		if(!s.mutators) return
		Object.keys(s.mutators).forEach(function(codeStr){
			var code = parseInt(codeStr)
			var mut = s.mutators[code]
			var newStaticBindings = _.extend({}, viewParamsStaticBindings, mut.staticBindings)
			var mutatedMakers = {}
			Object.keys(makers).forEach(function(viewCodeStr){
				var m = makers[viewCodeStr]
				var relMakers = []
				m.relMakers.forEach(function(rm, index){
					//TODO wrap in any containing mutators as well
					var nrm = relMakers[index] = makeRelHandle(rm.rel,newStaticBindings)
					//_.assertInt(nrm.propertyCode)
					nrm.propertyCode = rm.propertyCode
				})
				mutatedMakers[viewCodeStr] = createRelHandle(schema._byCode[viewCodeStr], relMakers)
				
			})
			mutatorAppliers[code] = function(pv, mutatorParams, cb){
				var m = mutatedMakers[pv.typeCode]//viewCode]
				var npv = {typeCode: pv.typeCode, rest: [].concat(pv.rest)}
				var mutatorBindings = mut.createBindings(mutatorParams)
				npv.rest.__extra = mutatorBindings
				npv.rest.__mutatorKey = ';'+code+'{'//JSON.stringify(mutatorBindings)
				mutatorParams.forEach(function(p, index){
					if(index > 0) npv.rest.__mutatorKey += ','
					npv.rest.__mutatorKey += JSON.stringify(p)
				})
				npv.rest.__mutatorKey += '}'
				
				//console.log('applied mutator: ' + JSON.stringify(mutatorParams) + ' to ' + JSON.stringify(pv))
				cb(m, npv)
			}
		})
	}
	
	makeMutatorAppliers()
	
	function getMakerForViewId(id, cb){
		var pv = parseViewId(id)
		var m
		//console.log('pv: ' + JSON.stringify(pv))
		if(pv.mutators){
			//console.log('getting mutated maker for view id: ' + id)
			//console.log('TODO: ' + JSON.stringify(pv))
			if(!haveMade) makeMutatorAppliers()
			var lastMutator = pv.mutators[pv.mutators.length-1]
			mutatorAppliers[lastMutator.code](pv, lastMutator.params, cb)
			return
		}else{
			//console.log('getting normal maker for view id: ' + id)
			m = makers[pv.typeCode]
		}
		if(!m){ 
			_.errout('cannot find maker for: ' + id)
		}
		if(!m.getEditsBetween){
			_.errout('missing getEditsBetween: ' + m.name + ' ' + m.getSnapshotAt)
		}
		if(!m.getHistoricalEditsBetween){
			_.errout('missing getHistoricalEditsBetween: ' + m.name)// + ' ' + makers[pv.typeCode].getSnapshotAt)
		}
		if(!m.getInclusionsDuring){
			_.errout('missing getInclusionsDuring: ' + m.name + ' ' + m.getSnapshotAt)
		}
		//return m
		cb(m, pv)
	}
	function getObjectEditsBetween(id, lastEditId, endEditId, cb){	
		if(lastEditId === endEditId) _.errout('wasting time')
		
		if(_.isString(id)){
			//var m = getMakerForViewId(id)
			getMakerForViewId(id, function(m, pv){
				m.getEditsBetween(pv.rest, lastEditId, endEditId, function(edits){
					if(!m.analytics) _.errout('missing analytics: ' + m.name)
					var acc = m.analytics.accumulate()
					if(acc){
						analyticsLog(JSON.stringify(acc, null, 2))
					}else{
						analyticsLog('\n--no analytics--\n')
					}
					m.analytics.reset()
					cb(edits)
				})
			})
		}else{
			objectState.getEditsBetween(id, lastEditId, endEditId, function(edits){
				if(edits.length === 0){
					cb(edits)
					return
				}
				//_.errout('TODO: ' + JSON.stringify(edits))
				cb(edits)
			})
		}
	}
	function getHistoricalObjectEditsBetween(id, lastEditId, endEditId, cb){	
		if(lastEditId === endEditId) _.errout('wasting time')

		if(_.isString(id)){
			getMakerForViewId(id, function(m, pv){

				m.getHistoricalEditsBetween(pv.rest, lastEditId, endEditId, cb)
				var acc = m.analytics.accumulate()
				if(acc){
					analyticsLog(JSON.stringify(acc, null, 2))
				}else{
					analyticsLog('\n--no analytics--\n')
				}
				m.analytics.reset()
			})
		}else{
			objectState.getEditsBetween(id, lastEditId, endEditId, function(edits){
				if(edits.length === 0){
					cb(edits)
					return
				}
				//_.errout('TODO: ' + JSON.stringify(edits))
				cb(edits)
			})
		}
	}
	function getObjectInclusionsDuring(id, lastEditId, endEditId, cb){
		if(lastEditId === endEditId) _.errout('wasting time')
		
		if(_.isString(id)){
			getMakerForViewId(id, function(m, pv){
				m.getInclusionsDuring(pv.rest, lastEditId, endEditId, function(ids){
					_.assertArray(ids)
					//console.log('got inclusions ' + JSON.stringify(ids) + ' from ' + makers[pv.typeCode].name)//getInclusionsDuring)
					cb(ids)
				})
			})
		}else{
			//_.assertInt(id)
			objectState.getInclusionsDuring(id, lastEditId, endEditId, cb)
		}
	}
	function getHistoricalObjectInclusionsDuring(id, lastEditId, endEditId, cb){
		if(lastEditId === endEditId) _.errout('wasting time')
		_.assertDefined(id)
		
		if(_.isString(id)){
			/*var pv = parseViewId(id)
			if(makers[pv.typeCode] === undefined) _.errout('no view maker for code: ' + pv.typeCode + ' from id: ' + id)
			if(!makers[pv.typeCode].getHistoricalInclusionsDuring){
				_.errout('missing getHistoricalInclusionsDuring: ' + makers[pv.typeCode].name)// + ' ' + makers[pv.typeCode].getSnapshotAt)
			}
			makers[pv.typeCode]*/
			getMakerForViewId(id, function(m, pv){
				m.getHistoricalInclusionsDuring(pv.rest, lastEditId, endEditId, function(ids){
					_.assertArray(ids)
					//console.log('got inclusions ' + JSON.stringify(ids) + ' from ' + makers[pv.typeCode].getInclusionsDuring)
					cb(ids)
				})
			})
		}else{
			//_.assertInt(id)
			objectState.getInclusionsDuring(id, lastEditId, endEditId, cb)
		}
	}
	
	function getSnapshotInner(getObjectInclusionsDuring, getObjectEditsBetween, id, lastEditId, endEditId, readyCb){
	
		//console.log('getting snapshot inner ' + lastEditId + ', ' + endEditId)

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
		

	var handle = {
		initialize: function(objs){
			objectState = objs
			s.objectState = objs
			afters.forEach(function(cb){
				cb()
			})
		},
		makeStream: function(includeObjectCb, editCb, sendViewObjectCb, syncId){
		
			//console.log('making stream')
	
			var queryHandle = makeQueryHandle(getObjectEditsBetween, getObjectInclusionsDuring, syncId)

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
					
					var cdl = _.latch(copy.length, function(){
						//console.log('done adding ' + copy.length + ' objects')
						maintain(endEditId)
					})
					copy.forEach(function(task){
						queryHandle.addObject(task, cdl)
					})
				}else if(addViewTasks.length > 0){
					//console.log('processing view tasks: ' + addViewTasks.length)
					var copy = [].concat(addViewTasks)
					addViewTasks = []
					
					var cdl = _.latch(copy.length, function(){maintain(endEditId)})
					copy.forEach(function(task){
						addView(task.id, task.lastEditId, endEditId, function(){
							task.cb()
							cdl()
						})
					})
				}else{
					lastEditId = endEditId
					paused = false
				}
			}
			
			function poll(){
				if(paused){
					//console.log('already in polling')
					return
				}
				paused = true
				
				//console.log('polling...')
				
				var endEditId = objectState.getCurrentEditId()-1
				if(endEditId === lastEditId){
					//console.log('no need to move: ' + lastEditId + ' === ' + endEditId)
					//maintain(endEditId)
					finish()
					return
				}
				
				var rem = remainer(1, finish)
				
				var edits = []
				//console.log('moving to: ' + endEditId + ' from ' + lastEditId)
				queryHandle.moveTo(endEditId, function(id, changes){
					//console.log('moving')
					edits = edits.concat(changes)
					//console.log('moving changes: ' + id + ' ' + JSON.stringify(changes))
				},
				function(id){
					rem.increase(1)
					//console.log('moving adds: ' + id)
					if(_.isString(id)){
						getObjectEditsBetween(id, -1, endEditId, function(snap){
							//console.log('view object snap(' + id +'): ' + JSON.stringify(snap))
							
							var oldState = {top: id}
							var resultEdits = []
							snap.forEach(function(e){
								pathmerger.editToMatch(oldState, e.state, function(op, edit){
									resultEdits.push({op: op, edit: edit, editId: e.editId, syncId: -1})
								})
								resultEdits.push(e)
								oldState = e.state
							})
							
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
					}
				}, function(){
					//console.log(endEditId + ' (' + objectState.getCurrentEditId() + ') moving done: ' + JSON.stringify(edits))
					//console.log(''+editCb)

					edits.sort(function(a,b){return a.editId - b.editId;})
					
					edits.forEach(function(e){
						editCb(e)
					})
					rem.decrease(1)
				})

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
			var pollHandle = setInterval(poll, 100)
			
			function addView(id, lastEditId, endEditId, readyCb, isHistorical){

				if(isHistorical) _.errout('TODO')
				
				var rem = remainer(1, finish)

				var edits = []
				var snapshots = []
				
				queryHandle.add(id, lastEditId, function(changedId, changes){
					//console.log('appending edits: ' + JSON.stringify(changes))
					edits = edits.concat(changes)
				}, function inclusion(includedId){
					if(!_.isString(includedId)){
						//_.errout('TODO')
//						includeObjectCb(id,function(){})//TODO is this right?
						snapshots.push([includedId])
					}
					rem.increase(1)
					getObjectEditsBetween(includedId, -1, endEditId, function(snap){
						snapshots.push([includedId,snap])
						rem.decrease(1)
					})
				}, function(){
					rem.decrease(1)
					//console.log('finished qh add')
				})
				
				function finish(){
					//console.log('finishing add view: ' + id)
					
					edits.sort(function(a,b){
						return a.editId - b.editId
					})
					
					//send snapshots, then edits
					
					snapshots.forEach(function(snap){
						var id = snap[0]
						snap = snap[1]
						if(_.isString(id)){
							_.assertObject(snap)
							sendViewObjectCb(id, snap)
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
					clearInterval(pollHandle)
					
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
					//console.log('adding view task: ' + id + ' ' + lastEditId)
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
				getSnapshotInner(getHistoricalObjectInclusionsDuring, getHistoricalObjectEditsBetween, id, lastEditId, endEditId, readyCb)
			}else{
				getSnapshotInner(getObjectInclusionsDuring, getObjectEditsBetween, id, lastEditId, endEditId, readyCb)
			}
		}
	}
	
	return handle
}
