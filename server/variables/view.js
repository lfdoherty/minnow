"use strict";

//var Cache = require('./../variable_cache')
var _ = require('underscorem')

var listenerSet = require('./../variable_listeners')

var log = require('quicklog').make('minnow/view-variable')

var util = require('./util')

var variables = require('./../variables')

var editFp = require('./../tcp_shared').editFp
var editCodes = editFp.codes
var editNames = editFp.names

//TODO in principle, the call site of a view shouldn't affect its caching - they should all share
//right now, we have a different cache for each call site (including the top-level call site.)
//Note however that if the parameters are different variables, the view variable will end up as
//separate anyway, so duplication only happens if the same *type* of params with the same *values* occurs in different
//call sites.
//Also keep in mind that if we merge across call sites we have to start differentiating the caches by view type.
exports.make = function(s, self, callExpr, typeBindings){
	_.assertFunction(s.log)
	
	var cache = s.makeCache()//new Cache(s.analytics)

	var localTypeBindings = {}

	var viewName = callExpr.view
	var viewSchema = s.schema[viewName]
	//log('callExpr.view: ' + viewName)
	//console.log(JSON.stringify(callExpr))
	_.assertDefined(viewSchema)
	viewSchema = viewSchema.viewSchema

	//1. one set for each parameter
	var paramSets = []
	callExpr.params.forEach(function(param, index){
		var v = self(param, typeBindings)
		paramSets.push(v)
		localTypeBindings[viewSchema.params[index].name] = v
	})

	var paramNames = []
	callExpr.params.forEach(function(param, index){
		paramNames.push(viewSchema.params[index].name);
	})
	
	//2. one set for each view property
	var relSets = {}
	var attachRelFuncs = {}

	//console.log('changing bindings from ' + JSON.stringify(typeBindings) + '\n to ' + JSON.stringify(localTypeBindings))
	Object.keys(viewSchema.rels).forEach(function(relName){
		var rel = viewSchema.rels[relName];
		_.assertDefined(rel)
		//console.log('rel: ' + JSON.stringify(rel))
		if(rel.type === 'macro') _.errout('view rel cannot be macro')
		var relFunc = relSets[rel.code] = self(rel, localTypeBindings)
		attachRelFuncs[rel.code] = makeAttachFunction(s, viewSchema.code, relFunc, rel.schemaType, rel.code);
	})
	var f = function(callBindings, editId){
		
		return svgGeneralView(s, cache, paramSets, relSets, paramNames, viewSchema.code, attachRelFuncs, callBindings, editId)
	}
	f.wrapAsSet = function(v){
		_.assert(cache.has(v))
		//_.errout('TODO: ' + v)
		return cache.get(v)
	}
	f.wrappers = {}
	Object.keys(viewSchema.rels).forEach(function(relName){
		var rel = viewSchema.rels[relName];
		var relFunc = relSets[rel.code]
		f.wrappers[rel.code] = relFunc.wrapAsSet
		//_.assertFunction(relFunc.wrapAsSet)
	})
	f.isView = true
	
	f.getDescender = function(){
		_.errout('TODO?')
	}
	return f
}
exports.makeTopLevel = function(s, variableGetter, callExpr){
	//_.assertFunction(s.log)
	
	var ns = _.extend({}, s)
	ns.analytics = variables.makeAnalytics(callExpr,s.analytics)
	s = ns
	
	var cache = s.makeCache()//new Cache(s.analytics)

	var viewObjectSchema = s.schema[callExpr.view];
	_.assertDefined(viewObjectSchema)
	var viewSchema = viewObjectSchema.viewSchema
	
	//1. one set for each view property
	var relSets = {}
	var attachRelFuncs = {}
	
	var paramBindings = {}
	viewSchema.params.forEach(function(p){
		paramBindings[p.name] = p.type
	})
	
	Object.keys(viewSchema.rels).forEach(function(relName){
		var rel = viewSchema.rels[relName];
		//log('making for rel: ' + relName + ' ' + rel.code)

		var ns = _.extend({}, s)
		ns.analytics = variables.makeAnalytics(rel,s.analytics, relName)

		var relFunc = relSets[rel.code] = variableGetter(ns, rel, paramBindings)
		var relSchema = viewObjectSchema.properties[relName]
		
		if(relSchema.type.type !== rel.schemaType.type){
			_.errout('param and rel type do not match ' + JSON.stringify(relSchema) + ' !== ' + JSON.stringify(rel.schemaType))
		}
		attachRelFuncs[rel.code] = makeAttachFunction(ns, viewSchema.code, relFunc, relSchema.type, rel.code);
	})
	
	var f = internalView.bind(undefined, s, cache, relSets, viewSchema.code, attachRelFuncs)
	f.wrappers = {}
	Object.keys(viewSchema.rels).forEach(function(relName){
		var rel = viewSchema.rels[relName];
		var relFunc = relSets[rel.code]
		f.wrappers[rel.code] = relFunc.wrapAsSet
	})	
	f.isView = true
	
	f.getDescender = function(){
		_.errout('TODO')
	}
	
	f.analytics = s.analytics
	
	return f
}

function values(obj, f){
	Object.keys(obj).forEach(function(key){f(obj[key])})
}

function makeAttachFunction(s, viewTypeCode, relFunc, relSchema, relCode){

	_.assertObject(relSchema)
	if(relSchema.type === 'object'){
		return function(listener, rel, viewId, editId){
			_.assertFunction(listener.objectChange)
			s.analytics.cachePut()
			var h = {
				set: function(value, oldValue, editId){
					if(value === undefined){
						//[{op: editCodes.selectProperty, edit: {typeCode: relCode}}]
						listener.objectChange(viewTypeCode, viewId, {property: relCode}, editCodes.clearObject, {}, -1, editId)
					}else{
						//_.assertInt(value)
						if(!_.isInt(value)){
							_.assertEqual(value.top, value.inner)
							value = value.top
						}
						var edit = {id: value}
						//log('view translating set id to setObject')
						//[{op: editCodes.selectProperty, edit: {typeCode: relCode}}]
						listener.objectChange(viewTypeCode, viewId, {property: relCode}, editCodes.setObject, edit, -1, editId)
					}
				},
				objectChange: listener.objectChange.bind(listener),
				includeView: listener.includeView.bind(listener),
				removeView: listener.removeView.bind(listener)
			}
			rel.attach(h, editId)
			return function objectValueDetacher(editId){
				s.analytics.cacheEvict()
				rel.detach(h, editId);
			}
		}
	}else if(relSchema.type === 'primitive'){
		var checkType
		if(relSchema.primitive === 'string') checkType = function(v){_.assertString(v);}
		else if(relSchema.primitive === 'int') checkType = function(v){_.assertInt(v);}
		else if(relSchema.primitive === 'real') checkType = function(v){_.assertNumber(v);}
		else checkType = function(v){}
		
		return function(listener, rel, viewId, editId){
			_.assertFunction(listener.objectChange)
			var opName = util.setOp(relSchema)
			s.analytics.cachePut()
			var h = {
				set: function(value, oldValue, editId){
					_.assertInt(editId)
					if(value !== undefined){
						checkType(value)
						var edit = {value: value}
						if(opName === editCodes.setReal) edit.value = value+''
						_.assertPrimitive(value)
						//console.log('here: ' + JSON.stringify([viewTypeCode, viewId, [relCode], 'set', edit, -1, editId]))
						//console.log(new Error().stack)
						//[{op: editCodes.selectProperty, edit: {typeCode: relCode}}]
						listener.objectChange(viewTypeCode, viewId, {property: relCode}, opName, edit, -1, editId)
					}else{
						var edit = {}
						_.assertPrimitive(value)
						//[{op: editCodes.selectProperty, edit: {typeCode: relCode}}]
						listener.objectChange(viewTypeCode, viewId, {property: relCode}, editCodes.clearProperty, edit, -1, editId)
					}
				},
				objectChange: listener.objectChange.bind(listener),
				includeView: listener.includeView.bind(listener),
				removeView: listener.removeView.bind(listener)
			}
			rel.attach(h, editId)
			return function primitiveValueDetacher(editId){
				s.analytics.cacheEvict()
				rel.detach(h, editId);
			}
		}
	}else if(relSchema.type === 'map'){
		//console.log(JSON.stringify(relSchema.type))
		var selectOpName = util.selectKeyOp(relSchema)
		//console.log('s: ' + selectOpName)
		//_.assertInt(editCodes[selectOpName])
		
		if(relSchema.value.type === 'object'){
			return function(listener, rel, viewId, editId){
				_.assertFunction(listener.objectChange)
				s.analytics.cachePut()
				var h = {
					put: function(key, value, oldValue, editId){
						_.assertInt(editId)
						_.assertInt(value)
						_.assertDefined(key)
						var edit = {id: value}
						console.log('got put')
						_.assertDefined(key)
						if(selectOpName === 'selectObjectKey') _.assertInt(key)
						
						//[{op: editCodes.selectProperty, edit: {typeCode: relCode}}, {op: selectOpName, edit: {key: key}}]
						listener.objectChange(viewTypeCode, viewId, 
							{property: relCode, key: key, keyOp: selectOpName}, 
							editCodes.putExisting, edit, -1, editId)
					},
					remove: function(key, editId){
						//[{op: editCodes.selectProperty, edit: {typeCode: relCode}}, {op: selectOpName, edit: {key: key}}]
						listener.objectChange(viewTypeCode, viewId, 
							{property: relCode, key: key, keyOp: selectOpName}, 
							editCodes.delKey, {}, -1, editId)
					},
					objectChange: listener.objectChange.bind(listener),
					includeView: listener.includeView.bind(listener),
					removeView: listener.removeView.bind(listener)
				}
				//console.log('view attaching to: ' + viewTypeCode + ' ' + relSchema.name)
				rel.attach(h, editId)
				return function objectMapDetacher(editId){
				s.analytics.cacheEvict()
					rel.detach(h, editId);
				}
			}
		}else if(relSchema.value.type === 'set'){
			var selectOpName = util.selectKeyOp(relSchema)
			_.assertInt(selectOpName)
			return function(listener, rel, viewId, editId){
				_.assertFunction(listener.objectChange)
				s.analytics.cachePut()
				if(relSchema.value.members.type === 'object'){
					var h = {
						putAdd: function(key, value, editId){
							_.assertInt(editId)
							_.assertPrimitive(value)
							var edit = {id: value}
							_.assertInt(value)
							if(relSchema.key.type === 'object'){
								_.assertInt(key)
								_.assert(s.objectState.isTopLevelObject(key))
							}
							//console.log('got put-add: ' + key + ' ' + value + ' ' + selectOpName)
							_.assertInt(value)
							_.assert(s.objectState.isTopLevelObject(value))
							//[{op: editCodes.selectProperty, edit: {typeCode: relCode}}, {op: selectOpName, edit: {key: key}}]
							listener.objectChange(viewTypeCode, viewId, 
								{property: relCode, key: key, keyOp: selectOpName}, 
								editCodes.putAddExisting, edit, -1, editId)
						},
						putRemove: function(key, value, editId){
							_.assertInt(editId)
							_.assertPrimitive(value)
							var edit = {id: value}
							//console.log('got put-remove: ' + key + ' ' + value)
							//[{op: editCodes.selectProperty, edit: {typeCode: relCode}}, {op: selectOpName, edit: {key: key}}]
							listener.objectChange(viewTypeCode, viewId,
								{property: relCode, key: key, keyOp: selectOpName},
								editCodes.putRemoveExisting, edit, -1, editId)
						},
						objectChange: listener.objectChange.bind(listener),
						includeView: listener.includeView.bind(listener),
						removeView: listener.removeView.bind(listener)
					}
				}else{
					var putAddOpName = util.putAddOp(relSchema)
					var putRemoveOpName = util.putRemoveOp(relSchema)
					var h = {
						putAdd: function(key, value, editId){
							_.assertInt(editId)
							_.assertPrimitive(value)
							var edit = {value: value}
							//console.log('got put-add: ' + key + ' ' + value)
							//[{op: editCodes.selectProperty, edit: {typeCode: relCode}}, {op: selectOpName, edit: {key: key}}]
							//console.log('selectOpName: ' + selectOpName)
							_.assertInt(selectOpName)
							listener.objectChange(viewTypeCode, viewId, 
								{property: relCode, key: key, keyOp: selectOpName}, 
								putAddOpName, edit, -1, editId)
						},
						putRemove: function(key, value, editId){
							_.assertInt(editId)
							_.assertPrimitive(value)
							var edit = {value: value}
							//console.log('got put-remove: ' + key + ' ' + value)
							//[{op: editCodes.selectProperty, edit: {typeCode: relCode}}, {op: selectOpName, edit: {key: key}}]
							listener.objectChange(viewTypeCode, viewId, 
								{property: relCode, key: key, keyOp: selectOpName},
								putRemoveOpName, edit, -1, editId)
						},
						includeView: listener.includeView.bind(listener),
						removeView: listener.removeView.bind(listener)
					}
					
				}
				//console.log('view attaching to: ' + viewTypeCode + ' ' + relSchema.name)
				rel.attach(h, editId)
				return function objectSetDetacher(editId){
					s.analytics.cacheEvict()
					rel.detach(h, editId);
				}
			}
		}else{
			var putOpName = util.putOp(relSchema)
			var keyOpName = util.selectKeyOp(relSchema)

			return function(listener, rel, viewId, editId){
				_.assertInt(editId)
				
				_.assertFunction(listener.objectChange)
				//_.assertFunction(listener.shouldHaveObject)
				s.analytics.cachePut()
				var h = {
					put: function(key, value, oldValue, editId){
						_.assertInt(editId)
						_.assertPrimitive(value)
						_.assertDefined(key)
						var edit
						if(putOpName === editCodes.putViewObject){
							edit = {id: value}
							_.assertString(edit.id)
						}else{
							edit = {value: value}
						}
						
						if(keyOpName === 'selectObjectKey') _.assertInt(key)
						
						if(relSchema.key.type === 'object' && listener.includeObject) listener.includeObject(key, editId)
						//[{op: editCodes.selectProperty, edit: {typeCode: relCode}}, {op: keyOpName, edit: {key: key}}]
						listener.objectChange(viewTypeCode, viewId, 
							{property: relCode, key: key, keyOp: keyOpName}, 
							putOpName, edit, -1, editId)
					},
					remove: function(key, editId){
						var edit = {}
						_.assertDefined(key)
						//console.log('emitting del key: ' + key)
						//[{op: editCodes.selectProperty, edit: {typeCode: relCode}}, {op: keyOpName, edit: {key: key}}]
						listener.objectChange(viewTypeCode, viewId, 
							{property: relCode, key: key, keyOp: keyOpName}, 
							editCodes.delKey, edit, -1, editId)
					},
					//just forward property changes if our rels are themselves views or sets of views
					objectChange: listener.objectChange.bind(listener),
					includeView: listener.includeView.bind(listener),
					removeView: listener.removeView.bind(listener)
				}
				rel.attach(h, editId)
				return function primitiveMapDetacher(editId){
					s.analytics.cacheEvict()
					rel.detach(h, editId);
				}
			}
		}
	}else if(relSchema.type === 'view'){
		return function(listener, rel, viewId, editId){
			_.assertFunction(listener.objectChange)
			//_.assertFunction(listener.shouldHaveObject)
			s.analytics.cachePut()
			var h = {
				set: function(value, oldValue, editId){
					_.assertString(value)
					var edit = {id: value}
					//console.log('view translating set id to setObject')
					//[{op: editCodes.selectProperty, edit: {typeCode: relCode}}]
					console.log('view set to: ' + value)
					console.log(new Error().stack)
					listener.objectChange(viewTypeCode, viewId, {property: relCode}, editCodes.setViewObject, edit, -1, editId)
				},
				//just forward property changes if our rels are themselves views or sets of views
				objectChange: listener.objectChange.bind(listener),
				includeView: listener.includeView.bind(listener),
				removeView: listener.removeView.bind(listener)
			}
			rel.attach(h, editId)
			return function(editId){
				s.analytics.cacheEvict()
				rel.detach(h, editId);
			}
		}
	}else{
		//console.log(JSON.stringify(relSchema))
		if(relSchema.members.type === 'object'){
			return function(listener, rel, viewId, editId){
				_.assertFunction(listener.objectChange)
				//_.assertFunction(listener.shouldHaveObject)
				s.analytics.cachePut()
				var h = {
					add: function(value, editId){
						//console.log('got object add: ' + JSON.stringify([viewTypeCode, viewId, relCode, value, editId]))
						//if(viewId === 0) process.exit(0)
						//_.assert(_.isString(value) || _.isInt(value))
						//_.assert(_.isInt(value) || value.indexOf(':') !== -1)//must be id
						//if(_.isInt(value)) _.assert(value >= 0)
						if(value.top){
							_.assertEqual(value.top, value.inner)
							value = value.top
						}
						var edit = {id: value}
						//[{op: editCodes.selectProperty, edit: {typeCode: relCode}}]
						listener.objectChange(viewTypeCode, viewId, {property: relCode}, editCodes.addExisting, edit, -1, editId)
					},
					remove: function(value, editId){
						//console.log('got object remove: ' + JSON.stringify([viewTypeCode, viewId, relCode, value, editId]))
						_.assert(_.isString(value) || _.isInt(value))
						if(editId){
							//console.log('object change')
							//var edit = {id: value}
							//var removePath = [{op: editCodes.selectProperty, edit: {typeCode: relCode}}, {op: editCodes.selectObject, edit: {id: value}}]
							listener.objectChange(viewTypeCode, viewId, {property: relCode, sub: value}, editCodes.remove, {}, -1, editId)
						}
					},
					//just forward property changes if our rels are themselves views or sets of views
					objectChange: listener.objectChange.bind(listener),
					includeView: listener.includeView.bind(listener),
					removeView: listener.removeView.bind(listener)
				}
				//console.log('view attaching to: ' + viewTypeCode + ' ' + relSchema.name)
				rel.attach(h, editId)
				var alreadyDid = false
				return function objectCollectionDetacher(editId){
					//console.log('detaching ---')
					s.analytics.cacheEvict()
					if(alreadyDid) throw new Error('detached more than once')
					alreadyDid = true
					rel.detach(h, editId);
				}
			}
		}else if(relSchema.members.type === 'view'){
			return function(listener, rel, viewId, editId){
				_.assertFunction(listener.objectChange)
				s.analytics.cachePut()
				var h = {
					add: function(value, editId){
						_.assertInt(editId)
						//console.log(relCode + ' got object add: ' + JSON.stringify([viewTypeCode, viewId, relCode, value, editId]))
						//console.log(new Error().stack)
						_.assert(_.isString(value) || _.isInt(value))
						_.assert(_.isInt(value) || value.indexOf(':') !== -1)//must be id
						var edit = {id: value}
						//console.log('did add')
						//[{op: editCodes.selectProperty, edit: {typeCode: relCode}}]
						listener.objectChange(viewTypeCode, viewId, {property: relCode}, editCodes.addExistingViewObject, edit, -1, editId)
					},
					remove: function(value, editId){
						_.assert(_.isString(value) || _.isInt(value))
						var edit = {}
						//console.log('remove -- ')
						//[{op: editCodes.selectProperty, edit: {typeCode: relCode}}]
						listener.objectChange(viewTypeCode, viewId, {property: relCode, sub: value}, editCodes.removeViewObject, edit, -1, editId)
					},
					//just forward property changes if our rels are themselves views or sets of views
					objectChange: listener.objectChange.bind(listener),
					includeView: listener.includeView.bind(listener),
					removeView: listener.removeView.bind(listener)
				}
				//console.log('view attaching to: ' + viewTypeCode + ' ' + relSchema.name)
				rel.attach(h, editId)
				return function viewCollectionDetacher(editId){
					//console.log('detaching ***')
					s.analytics.cacheEvict()
					rel.detach(h, editId);
				}
			}
		}else{

			return function(listener, rel, viewId, editId){
				_.assertInt(editId)
				_.assertFunction(listener.objectChange)

				var addOpName = util.addOp(relSchema)
				var removeOpName = util.removeOp(relSchema)

				s.analytics.cachePut()
				
				var h = {
					add: function(value, editId){
						_.assertInt(editId)
						var edit = {value: value}
						if(addOpName === 80){
							_.assertString(value)
						}
						//console.log('got primitive add: ' + value)
						//[{op: editCodes.selectProperty, edit: {typeCode: relCode}}]
						listener.objectChange(viewTypeCode, viewId, {property: relCode}, addOpName, edit, -1, editId)
					},
					remove: function(value, editId){
						var edit = {value: value}
						//[{op: editCodes.selectProperty, edit: {typeCode: relCode}}]
						listener.objectChange(viewTypeCode, viewId, {property: relCode}, removeOpName, edit, -1, editId)					
					},
					//just forward property changes if our rels are themselves views or sets of views
					objectChange: listener.objectChange.bind(listener),
					includeView: listener.includeView.bind(listener),
					removeView: listener.removeView.bind(listener)
				}
				rel.attach(h, editId)
				return function primitiveCollectionDetacher(editId){
					s.analytics.cacheEvict()
					rel.detach(h, editId);
				}
			}
		}
	}
}
exports.makeAttachFunction = makeAttachFunction//for reuse by object variables


function svgGeneralView(s, cache, paramSetGetters, relSetGetters, paramNames, typeCode, attachRelFuncs, callBindings, editId){
	_.assertInt(editId)
	
	var localBindings = {}
	var paramKeysStr = '['
	paramSetGetters.forEach(function(psg, index){
		var ps = localBindings[paramNames[index]] = psg(callBindings, editId)
		if(index > 0) paramKeysStr += ','
		//paramKeysStr += ps.name
		if(!ps.get){
			_.errout('missing .get: ' + ps.name)
		}
		var v = ps.get()
		if(v === undefined) _.errout('cannot create general view(' + typeCode + ') with undefined param (' + index + ')')
		paramKeysStr += JSON.stringify(v)
	})
	paramKeysStr+=']'
	return internalView(s, cache, relSetGetters, typeCode, attachRelFuncs, paramKeysStr, localBindings, editId)
}

function internalView(s, cache, relSetGetters, typeCode, attachRelFuncs, paramKeysStr, localBindings, editId){
	//console.log(JSON.stringify(arguments))
	_.assertLength(arguments, 8)
	_.assertObject(relSetGetters)
	_.assertObject(attachRelFuncs)
	_.assertObject(localBindings)
	_.assertInt(editId)
	//TODO key should be of the form typeCode:[params...] such that it can be constructed from those two values
	//without knowledge of the internals of the 'variables' implementation
	_.assertString(paramKeysStr)
	var key = typeCode+':'+paramKeysStr
	//log('*************VIEW KEY: ' + key + ' ' + editId)
	//if(cache.has(key)) return cache.get(key)

	//console.log('created view: ' + key)
	//console.log(new Error().stack)
	//console.log(JSON.stringify(localBindings))
	
	var listeners = listenerSet()
	
	var relDestroyed = false
	
	var rels = {}
	Object.keys(relSetGetters).forEach(function(relCode){
		//console.log('view getting rel: '+relCode)
		var rel = relSetGetters[relCode](localBindings, editId)
		var oldDestroy = rel.destroy
		rel.destroy = function(){
			//console.log(new Error().stack)
			relDestroyed = true
			oldDestroy()
		}
		rels[relCode] = rel
		//console.log('res: ' + rels[relCode])
		_.assertFunction(rels[relCode].attach)
	})
	
	var ourDetachKey = Math.random()+''
	
	var cachedViewIncludes = {}
	var viewCounts = {}
	
	var handle = {
		name: 'view',
		attach: function(listener, editId){

			_.assertInt(editId)
			/*Object.keys(cachedViewIncludes).forEach(function(key){
				listener.includeView(key, cachedViewIncludes[key], editId)
			})
			function f(editId){
				return internalView(s, cache, relSetGetters, typeCode, attachRelFuncs, paramKeysStr, localBindings, editId)
			}
			listener.includeView(key, f, editId)*/
			//_.errout('set: ' + key)
			listener.set(key, undefined, editId)
			
		},
		get: function(){
			return key
		},
		include: function(listener, editId){			
			var detachers = []
			
			//console.log('including: ' + key)
			
			/*var wrapper = _.extend({}, listener)
			wrapper.includeView = function(viewId, f, editId){
				//console.log('including view?: ' + viewId)
				if(viewCounts[viewId] === undefined){
				//	console.log('caching view id: ' + viewId)
					cachedViewIncludes[viewId] = f
					viewCounts[viewId] = 0
					listener.includeView(viewId, f, editId)
				}
				++viewCounts[viewId]
			}
			wrapper.removeView = function(viewId, f, editId){
				--viewCounts[viewId]
				if(viewCounts[viewId] === 0){
					listener.removeView(viewId, f, editId)
					delete cachedViewIncludes[viewId]
					delete viewCounts[viewId]
				}
			}*/
			
			//console.log('attached to view')
			Object.keys(rels).forEach(function(relCode){
				var rel = rels[relCode]
				console.log('view attaching to rel ' + relCode + ' ' + key + ' ' + editId)
				var d = attachRelFuncs[relCode](listener, rel, key, editId)
				detachers.push(d)
			})
			var alreadyDid = false
			return listener[ourDetachKey] = function(editId){
				if(alreadyDid) _.errout('detached more than once: ' + key)
				alreadyDid = true
				//console.log('detaching rels')
				detachers.forEach(function(d){
					d(editId);
				})
			}
		},
		detach: function(listener, editId){
			//_.assertInt(editId)
			if(editId){
				listener.set(undefined, key, editId)
			}
			/*Object.keys(cachedViewIncludes).forEach(function(key){
				listener.removeView(key, cachedViewIncludes[key], editId)
			})
			listener.removeView(key, handle, editId)*/
		},
		oldest: function(){
			if(relDestroyed){
				_.errout('rel has been destroyed')
			}
			var old = s.objectState.getCurrentEditId();
			function reduceOldest(v){
				var oldValue = v.oldest()
				//console.log('reducing oldest: ' + oldValue)
				if(oldValue < old) old = oldValue
			}
			values(localBindings, reduceOldest)
			values(rels, reduceOldest)
			//console.log(key +' view oldest: ' + old)
			return old
		},
		key: key,
		getProperty: function(propertyCode){
			var rel = rels[propertyCode]
			return rel;
		},
		getPropertyValue: function(elem, propertyCode, cb){//for primitives only
			var rel = rels[propertyCode]
			cb(rel.getValues())
		},
		destroy: function(){
		//	_.errout('TODO: destroy')
			handle.attach = handle.oldest = handle.detach = handle.include = handle.destroy = function(){_.errout('destroyed');}
		}
	}
	
	//TODO cannot cache this until we have a reasonable way to trigger eviction
	
	return handle//cache.store(key, handle)
}

