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

function makeQueryHandle(getObjectEditsBetween, getObjectInclusionsDuring){
	var qhEditId=-100//this will always get a moveTo current call before the first add call happens anyway
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
			
			var rem = remainer(1, finish)
			//console.log('checking for changes to all: ' + JSON.stringify(gotIds))
			gotIds.forEach(function(id){
				rem.increase(1)
				getObjectEditsBetween(id, qhEditId, editId, function(changes){
					
					changes.forEach(function(e){
						if(e.type) _.errout('wrong type of edit: ' + JSON.stringify(e))
						//console.log('e: ' + JSON.stringify(e))
						_.assertInt(e.syncId)
						e.id = id
					})
					
					//if(changes.length > 0){
					//	console.log('for move ' + qhEditId + ' ' + editId + ' ' + id + ' changes: ' + JSON.stringify(changes))
					//}

					recursivelyInclude(id, qhEditId, editId)
					
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
									//console.log('^^^^^^^^^^^^^^^^^6 new inclusion: ' + includedId)
									inclusionsDuring.push(includedId)
									inclusionsCb(includedId)
								}else{
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
				qhEditId = editId
				gotIds = gotIds.concat(inclusionsDuring)
				//console.log('done moving: ' + JSON.stringify(gotIds))
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
			
			//console.log('adding view to queryhandle: ' + id)
			
			var rem = remainer(2, doneCb)
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
						getObjectEditsBetween(id, lastEditId, qhEditId, function(changes){
							//console.log('for view add(' + lastEditId+','+qhEditId+'): ' + JSON.stringify(changes))
							changesCb(id, changes)
							rem.decrease(1)
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
			if(lastEditId === qhEditId){
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
			}
		}
	}
}

var log = require('quicklog').make('minnow/new_view_sequencer')

function createRelHandle(objSchema, relMakers){
	var viewSchema = objSchema.viewSchema
	
	//log('creating rel handle for: ' + JSON.stringify(viewSchema, null, 2))

	/*var paramWrappers = []
	viewSchema.params.forEach(function(p,i){
		var w = function(value){
				_.assertDefined(value)
				var handle = {
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
						if(startEditId === -1 && endEditId >= 0){
							cb([{type: 'set', value: value, editId: 0}])
						}else{
							cb([])
						}
					}
				}
				handle.getHistoricalChangesBetween = handle.getChangesBetween
				return handle
			}
		//}
		w.bindingName = p.name
		paramWrappers[i] = w
	})*/
	function makeBindings(params, viewId){
		//_.assertInt(paramTime)
		_.assertString(viewId)
		//_.assert(paramTime >= 0)
		var bindings = {}
		for(var i=0;i<params.length;++i){
			//var pw = paramWrappers[i]
			//_.assert(pw.bindingName.length > 0)
		//	console.log('set param: ' + pw.bindingName + ' := ' + params[i])
			var p = viewSchema.params[i]
			bindings[p.name] = params[i]
		}
		bindings.__key = viewId
		return bindings
	}

	
	var handle = {
		name: 'view',
		getInclusionsDuring: function(params, lastEditId, endEditId, cb){
			if(lastEditId === endEditId){
				_.errout('wasting time')
			}
			
			var viewId = viewIdStr(objSchema.code,params)
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
			})
		},
		getHistoricalInclusionsDuring: function(params, lastEditId, endEditId, cb){
			if(lastEditId === endEditId){
				_.errout('wasting time')
			}
			
			var viewId = viewIdStr(objSchema.code,params)
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
			})
		},
		getStateAt: function(params, editId, cb){
			var viewId = viewIdStr(objSchema.code,params)//objSchema.code+':'+JSON.stringify(params)
			_.errout('TODO?')
			cb(viewId)
		},
		changeToEdit: function(){
			_.errout('no')
		},
		getEditsBetween: function(params, lastEditId, endEditId, cb){
			if(lastEditId === endEditId) _.errout('wasting time')
			
			var viewId = viewIdStr(objSchema.code,params)
			var edits = []
			//console.log('computing state of ' + viewId)
			if(lastEditId === -1){
				var viewId = viewIdStr(objSchema.code, params)//objSchema.code+':'+JSON.stringify(params)
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
			})
		},
		getHistoricalEditsBetween: function(params, lastEditId, endEditId, cb){
			if(lastEditId === endEditId) _.errout('wasting time')
			
			var viewId = viewIdStr(objSchema.code,params)
			var edits = []
			//console.log('computing state of ' + viewId)
			if(lastEditId === -1){
				var viewId = viewIdStr(objSchema.code, params)//objSchema.code+':'+JSON.stringify(params)
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
				if(!rm.getHistoricalChangesBetween) _.errout('missing getHistoricalChangesBetween: ' + rm.name)
				
				rm.getHistoricalChangesBetween(bindings, lastEditId, endEditId, function(relChanges){
					console.log('got historical rel changes: ' + JSON.stringify(relChanges))
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
			})
		}
	}
	return handle
}

function makeObjectCallHandle(getParams){
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
				return {op: editCodes.clearProperty, edit: {}, syncId: c.syncId, editId: c.editId}
			}else if(c.type === 'set'){
				return {op: editCodes.setObject, edit: {id: c.value}, editId: c.editId, syncId: c.syncId}
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
function parseViewId(id){
	//console.log('view id: ' + id)
	var ci = id.indexOf(':')
	var typeCodeStr = id.substr(0, ci)
	
	var restStr = id.substring(ci+2,id.length-1)
	var parts = safeSplit(restStr, ',')
	var rest = []
	parts.forEach(function(ps){
		//_.errout('TODO: ' + ps)
		if(ps.indexOf('[') === 0){
			rest.push(JSON.parse(ps))
		}else if(parseInt(ps)+'' === ps){
			//console.log('id: ' + ps)
			rest.push(parseInt(ps))
		}else if(ps.indexOf('_') !== -1 && ps.indexOf('"') === -1){
			var nci = ps.indexOf('_')
			var a = ps.substr(0,nci)
			var b = ps.substr(nci+1)
			var ia = parseInt(a)
			var ib = parseInt(b)
			if(isNaN(ia)) _.errout('failed to parse viewId: ' + id)
			if(isNaN(ib)) _.errout('failed to parse viewId: ' + id)
			rest.push(innerify(ia,ib))
		}else{
			//console.log('ps: ' + ps)
			if(ps.indexOf('"') !== 0) _.errout('invalid: ' + ps)
			_.assert(ps.indexOf('"') === 0)
			rest.push(ps.substring(1,ps.length-1))
		}/*else{
			_.errout('TODO: ' + ps)
		}*/
	})
	return {typeCode: parseInt(typeCodeStr), rest: rest}
}
function viewIdStr(viewCode,params){//viewCode+':'+JSON.stringify(params)
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
	return str
}

exports.make = function(schema, objectState, broadcaster){

	//console.log('making new view sequencer...')
	
	var s = {
		objectState: objectState,
		schema: schema,
		getEditsBetween: getObjectEditsBetween,
		getInclusionsDuring: getObjectInclusionsDuring
	}
	function getViewCallHandle(viewName, viewCall, staticBindings){
		_.assertObject(staticBindings)
		
		var viewCode = schema[viewName].code
		var handle = makers[viewCode]
		
		var viewSchema = schema[viewName].viewSchema

		//_.errout(JSON.stringify(viewCall))
		var paramMakers = []
		viewCall.params.forEach(function(expr){
			paramMakers.push(makeRelHandle(expr, staticBindings))//, handle.viewParamsStaticBindings))
		})
		function getParams(bindings, editId, cb){
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

		function getParamValues(bindingValues){
			console.log('computing param values: ' + JSON.stringify([viewCall.params, bindingValues]))
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
			return makeObjectCallHandle(getParams)
		}
		
		var a = analytics.make('view-call', [])

		var handle = {
			name: 'view-call',
			analytics: a,
			getStateSync: function(bindingValues){
				var params = getParamValues(bindingValues)
				if(!params) return undefined
				var viewId = viewIdStr(viewCode,params)
				return viewId
			},

			getStateAt: function(bindings, editId, cb){
				getParams(bindings, editId, function(params, failed){
					if(failed){
						cb(undefined)
					}else{
						var viewId = viewIdStr(viewCode,params)
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
					return [changes[0].value]
				}else{
					//_.errout('TODO: ' + JSON.stringify(changes))
					var inclusions = []
					var has = {}
					for(var i=0;i<changes.length;++i){
						var c = changes[i]
						if(c.type === 'set'){
							var v = c.value
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
							var viewId = viewIdStr(viewCode,params)
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
							var curViewId = viewIdStr(viewCode,params)
							var changes = []
							for(var i=0;i<states.length;++i){
								var state = states[i]
								if(state === undefined){
									if(curViewId){
										changes.push({type: 'clear', editId: realEditIds[i]})
										curViewId = undefined
									}
								}else{
									var viewId = viewIdStr(viewCode,state)
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
					pm.getHistoricalChangesBetween(bindings, startEditId, endEditId, function(changes){
						//paramChanges[index] = changes
						//console.log(index + ' ' + JSON.stringify(changes))
						for(var i=0;i<changes.length;++i){
							keyEditIds[changes[i].editId] = true
						}
						cdl()
					})
				})
				
				//_.errout('TODO')
				//look through all the versions of the params
			}
		}
		//handle.getHistoricalChangesBetween = handle.getChangesBetween
		return handle
	}
	function makeRelHandle(rel, staticBindings){
		var wrapped = wrap.make(s, rel, function(rel, newStaticBindings){
			if(newStaticBindings){
				//console.log('recursing with new bindings: ' + JSON.stringify(Object.keys(newStaticBindings)))
				var newStaticBindings = _.extend({}, staticBindings, newStaticBindings)
				return makeRelHandle(rel, newStaticBindings)
			}else{
				//console.log('recursing with same bindings')//: ' + JSON.stringify(Object.keys(staticBindings)))
				return makeRelHandle(rel, staticBindings)
			}
		}, function(viewName, viewCall){
			return getViewCallHandle(viewName, viewCall, staticBindings)
		}, staticBindings)
		return wrapped
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
	
	_.each(schema, function(objSchema){
		if(objSchema.isView){

			var viewSchema = objSchema.viewSchema
			var viewParamsStaticBindings = {}
			viewSchema.params.forEach(function(p){
				var paramName = p.name
				var f
				var nameStr = 'view-param:'+p.name
				var a = analytics.make(nameStr, [])				
				var vpHandle = {
					name: nameStr,
					analytics: a,
					getStateAt: function(bindings, editId, cb){
						if(editId === -1){
							cb(undefined)
						}else{
							//console.log('got binding value: ' + JSON.stringify(bindings[paramName]))
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
					}				
				}
				vpHandle.getHistoricalChangesBetween = vpHandle.getChangesBetween
				
				viewParamsStaticBindings[p.name] = vpHandle
			})
			Object.keys(viewSchema.rels).forEach(function(relName){
				var rel = viewSchema.rels[relName];
				var rm = makeRelHandle(rel, viewParamsStaticBindings)
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
	
	var analyticsLog = require('fs').createWriteStream('analytics.log')
	
	function getObjectEditsBetween(id, lastEditId, endEditId, cb){	
		if(lastEditId === endEditId) _.errout('wasting time')
		
		if(_.isString(id)){
			var pv = parseViewId(id)
			var m = makers[pv.typeCode]
			if(!m){ 
				_.errout('cannot find maker for: ' + id)
			}
			if(!m.getEditsBetween){
				_.errout('missing getEditsBetween: ' + makers[pv.typeCode].name + ' ' + makers[pv.typeCode].getSnapshotAt)
			}
			m.getEditsBetween(pv.rest, lastEditId, endEditId, cb)
			var acc = m.analytics.accumulate()
			if(acc){
				analyticsLog.write(JSON.stringify(acc, null, 2))
			}else{
				analyticsLog.write('\n--no analytics--\n')
			}
			m.analytics.reset()
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
			var pv = parseViewId(id)
			var m = makers[pv.typeCode]
			if(!m){ 
				_.errout('cannot find maker for: ' + id)
			}
			if(!m.getHistoricalEditsBetween){
				_.errout('missing getHistoricalEditsBetween: ' + makers[pv.typeCode].name)// + ' ' + makers[pv.typeCode].getSnapshotAt)
			}
			m.getHistoricalEditsBetween(pv.rest, lastEditId, endEditId, cb)
			var acc = m.analytics.accumulate()
			if(acc){
				analyticsLog.write(JSON.stringify(acc, null, 2))
			}else{
				analyticsLog.write('\n--no analytics--\n')
			}
			m.analytics.reset()
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
			var pv = parseViewId(id)
			if(makers[pv.typeCode] === undefined) _.errout('no view maker for code: ' + pv.typeCode + ' from id: ' + id)
			if(!makers[pv.typeCode].getInclusionsDuring){
				_.errout('missing getInclusionsDuring: ' + makers[pv.typeCode].name + ' ' + makers[pv.typeCode].getSnapshotAt)
			}
			makers[pv.typeCode].getInclusionsDuring(pv.rest, lastEditId, endEditId, function(ids){
				_.assertArray(ids)
				//console.log('got inclusions ' + JSON.stringify(ids) + ' from ' + makers[pv.typeCode].name)//getInclusionsDuring)
				cb(ids)
			})
		}else{
			//_.assertInt(id)
			objectState.getInclusionsDuring(id, lastEditId, endEditId, cb)
		}
	}
	function getHistoricalObjectInclusionsDuring(id, lastEditId, endEditId, cb){
		if(lastEditId === endEditId) _.errout('wasting time')
		
		if(_.isString(id)){
			var pv = parseViewId(id)
			if(makers[pv.typeCode] === undefined) _.errout('no view maker for code: ' + pv.typeCode + ' from id: ' + id)
			if(!makers[pv.typeCode].getHistoricalInclusionsDuring){
				_.errout('missing getHistoricalInclusionsDuring: ' + makers[pv.typeCode].name)// + ' ' + makers[pv.typeCode].getSnapshotAt)
			}
			makers[pv.typeCode].getHistoricalInclusionsDuring(pv.rest, lastEditId, endEditId, function(ids){
				_.assertArray(ids)
				//console.log('got inclusions ' + JSON.stringify(ids) + ' from ' + makers[pv.typeCode].getInclusionsDuring)
				cb(ids)
			})
		}else{
			//_.assertInt(id)
			objectState.getInclusionsDuring(id, lastEditId, endEditId, cb)
		}
	}
	
	function getSnapshotInner(getObjectInclusionsDuring, getObjectEditsBetween, id, lastEditId, endEditId, readyCb){

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
				ids.forEach(function(id){
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
		makeStream: function(includeObjectCb, editCb, sendViewObjectCb, syncId){
		
			//console.log('making stream')
	
			var queryHandle = makeQueryHandle(getObjectEditsBetween, getObjectInclusionsDuring)

			var lastEditId = -1
			var paused = false
			
			var addViewTasks = []
			var addObjectTasks = []
			
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
				if(paused) return
				paused = true
				
				//console.log('polling...')
				
				var endEditId = objectState.getCurrentEditId()-1
				if(endEditId === lastEditId){
					//console.log('no need to move: ' + lastEditId + ' === ' + endEditId)
					maintain(endEditId)
					return
				}
				
				var rem = remainer(1, finish)
				
				var edits = []
				//console.log('moving to: ' + endEditId + ' from ' + lastEditId)
				queryHandle.moveTo(endEditId, function(id, changes){
					
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
					//console.log('moving done: ' + JSON.stringify(edits))

					edits.sort(function(a,b){return a.editId - b.editId;})
					
					edits.forEach(function(e){
						editCb(e)
					})
					rem.decrease(1)
				})

				function finish(){
					//console.log('finishing poll')
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
					clearInterval(pollHandle)
					//analyticsLog.end()
					//_.errout('TODO')
				},
				subscribeToObject: function(id){
					//_.errout('TODO push subscribe task, etc')					
					addObjectTasks.push(id)
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
