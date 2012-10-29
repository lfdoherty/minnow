"use strict";

var Cache = require('./../variable_cache')
var _ = require('underscorem')

var listenerSet = require('./../variable_listeners')

var log = require('quicklog').make('minnow/view-variable')

var util = require('./util')

var variables = require('./../variables')

//TODO in principle, the call site of a view shouldn't affect its caching - they should all share
//right now, we have a different cache for each call site (including the top-level call site.)
//Note however that if the parameters are different variables, the view variable will end up as
//separate anyway, so duplication only happens if the same *type* of params with the same *values* occurs in different
//call sites.
//Also keep in mind that if we merge across call sites we have to start differentiating the caches by view type.
exports.make = function(s, self, callExpr, typeBindings){
	_.assertFunction(s.log)
	
	var cache = new Cache(s.analytics)

	var localTypeBindings = {}

	var viewName = callExpr.view
	var viewSchema = s.schema[viewName]
	log('callExpr.view: ' + viewName)
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
	var f = svgGeneralView.bind(undefined, s, cache, paramSets, relSets, paramNames, viewSchema.code, attachRelFuncs)
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
	ns.analytics = variables.makeAnalytics(callExpr,s.analytics)//{children: [], counts: {hit:0,put:0,evict:0}}
	s = ns
	
	var cache = new Cache(s.analytics)

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
		log('making for rel: ' + relName + ' ' + rel.code)

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
						listener.objectChange(viewTypeCode, viewId, [{op: 'selectProperty', edit: {typeCode: relCode}}], 'clearObject', {}, -1, editId)
					}else{
						_.assertInt(value)
						var edit = {id: value}
						log('view translating set id to setObject')
						listener.objectChange(viewTypeCode, viewId, [{op: 'selectProperty', edit: {typeCode: relCode}}], 'setObject', edit, -1, editId)
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
						if(opName === 'setReal') edit.value = value+''
						_.assertPrimitive(value)
						//console.log('here: ' + JSON.stringify([viewTypeCode, viewId, [relCode], 'set', edit, -1, editId]))
						//console.log(new Error().stack)
						listener.objectChange(viewTypeCode, viewId, [{op: 'selectProperty', edit: {typeCode: relCode}}], opName, edit, -1, editId)
					}else{
						var edit = {}
						_.assertPrimitive(value)
						listener.objectChange(viewTypeCode, viewId, [{op: 'selectProperty', edit: {typeCode: relCode}}], 'clearProperty', edit, -1, editId)
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
		if(relSchema.value.type === 'object'){
			return function(listener, rel, viewId, editId){
				_.assertFunction(listener.objectChange)
				s.analytics.cachePut()
				var h = {
					put: function(key, value, oldValue, editId){
						_.assertInt(editId)
						_.assertInt(value)
						var edit = {id: value}
						//console.log('got put')
						_.assertDefined(key)
						listener.objectChange(viewTypeCode, viewId, 
							[{op: 'selectProperty', edit: {typeCode: relCode}}, {op: selectOpName, edit: {key: key}}], 
							'putExisting', edit, -1, editId)
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
			return function(listener, rel, viewId, editId){
				_.assertFunction(listener.objectChange)
				s.analytics.cachePut()
				if(relSchema.value.members.type === 'object'){
					var h = {
						putAdd: function(key, value, editId){
							_.assertInt(editId)
							_.assertPrimitive(value)
							var edit = {id: value}
							//console.log('got put-add: ' + key + ' ' + value)
							_.assertInt(value)
							listener.objectChange(viewTypeCode, viewId, 
								[{op: 'selectProperty', edit: {typeCode: relCode}}, {op: selectOpName, edit: {key: key}}], 
								'putAddExisting', edit, -1, editId)
						},
						objectChange: listener.objectChange.bind(listener),
						includeView: listener.includeView.bind(listener),
						removeView: listener.removeView.bind(listener)
					}
				}else{
					var putAddOpName = util.putAddOp(relSchema)
					var putRemoveOpName = util.putRemoveOp(relSchema)
					var selectOpName = util.selectKeyOp(relSchema)
					var h = {
						putAdd: function(key, value, editId){
							_.assertInt(editId)
							_.assertPrimitive(value)
							var edit = {value: value}
							//console.log('got put-add: ' + key + ' ' + value)
							listener.objectChange(viewTypeCode, viewId, 
								[{op: 'selectProperty', edit: {typeCode: relCode}}, {op: selectOpName, edit: {key: key}}], 
								putAddOpName, edit, -1, editId)
						},
						putRemove: function(key, value, editId){
							_.assertInt(editId)
							_.assertPrimitive(value)
							var edit = {value: value}
							//console.log('got put-remove: ' + key + ' ' + value)
							listener.objectChange(viewTypeCode, viewId, 
								[{op: 'selectProperty', edit: {typeCode: relCode}}, {op: selectOpName, edit: {key: key}}], 
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
						var edit
						if(putOpName === 'putViewObject'){
							edit = {id: value}
							_.assertString(edit.id)
						}else{
							edit = {value: value}
						}
						if(relSchema.key.type === 'object' && listener.includeObject) listener.includeObject(key, editId)
						listener.objectChange(viewTypeCode, viewId, 
							[{op: 'selectProperty', edit: {typeCode: relCode}}, {op: keyOpName, edit: {key: key}}], 
							putOpName, edit, -1, editId)
					},
					del: function(key, editId){
						var edit = {}
						//console.log('emitting del key: ' + key)
						listener.objectChange(viewTypeCode, viewId, 
							[{op: 'selectProperty', edit: {typeCode: relCode}}, {op: keyOpName, edit: {key: key}}], 
							'delKey', edit, -1, editId)
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
					listener.objectChange(viewTypeCode, viewId, [{op: 'selectProperty', edit: {typeCode: relCode}}], 'setViewObject', edit, -1, editId)
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
						//log('got object add: ' + JSON.stringify([viewTypeCode, viewId, relCode, value, editId]))
						//if(viewId === 0) process.exit(0)
						_.assert(_.isString(value) || _.isInt(value))
						_.assert(_.isInt(value) || value.indexOf(':') !== -1)//must be id
						if(_.isInt(value)) _.assert(value >= 0)
						var edit = {id: value}
						listener.objectChange(viewTypeCode, viewId, [{op: 'selectProperty', edit: {typeCode: relCode}}], 'addExisting', edit, -1, editId)
					},
					remove: function(value, editId){
						//console.log('remove ---')
						_.assert(_.isString(value) || _.isInt(value))
						if(editId){
							var edit = {id: value}
							listener.objectChange(viewTypeCode, viewId, [{op: 'selectProperty', edit: {typeCode: relCode}}], 'remove', edit, -1, editId)
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
				//_.assertFunction(listener.shouldHaveObject)
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
						listener.objectChange(viewTypeCode, viewId, [{op: 'selectProperty', edit: {typeCode: relCode}}], 'addExistingViewObject', edit, -1, editId)
					},
					remove: function(value, editId){
						_.assert(_.isString(value) || _.isInt(value))
						var edit = {id: value}
						//console.log('remove -- ')
						listener.objectChange(viewTypeCode, viewId, [{op: 'selectProperty', edit: {typeCode: relCode}}], 'removeViewObject', edit, -1, editId)
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
				//_.assertFunction(listener.shouldHaveObject)

				//var ts = typeSuffix[relSchema.members.primitive]
				//if(ts === undefined) _.errout('TODO: ' + relSchema.members.primitive)
				var addOpName = util.addOp(relSchema)//'add'+ts
				var removeOpName = util.removeOp(relSchema)//'remove'+ts

				s.analytics.cachePut()
				
				var h = {
					add: function(value, editId){
						_.assertInt(editId)
						//_.assert(_.isString(value) || _.isInt(value))
						var edit = {value: value}
						//console.log('LISTENER: ' + require('util').inspect(listener))
						//console.log('GENERIC ADD HERE: ' + relCode)
						//console.log(JSON.stringify(relSchema))
						listener.objectChange(viewTypeCode, viewId, [{op: 'selectProperty', edit: {typeCode: relCode}}], addOpName, edit, -1, editId)
					},
					remove: function(value, editId){
						var edit = {value: value}
						listener.objectChange(viewTypeCode, viewId, [{op: 'selectProperty', edit: {typeCode: relCode}}], removeOpName, edit, -1, editId)					
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
	var paramKeysStr = ''
	paramSetGetters.forEach(function(psg, index){
		var ps = localBindings[paramNames[index]] = psg(callBindings, editId)
		paramKeysStr += ','+ps.key
	})
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
	log('*************VIEW KEY: ' + key + ' ' + editId)
	if(cache.has(key)) return cache.get(key)

	var listeners = listenerSet()
	
	var rels = {}
	Object.keys(relSetGetters).forEach(function(relCode){
		//console.log('view getting rel: '+relCode)
		rels[relCode] = relSetGetters[relCode](localBindings, editId)
		//console.log('res: ' + rels[relCode])
		_.assertFunction(rels[relCode].attach)
	})
	
	var ourDetachKey = Math.random()+''
	
	var cachedViewIncludes = {}
	var viewCounts = {}
	
	var handle = {
		name: 'view',
		attach: function(listener, editId){
			//listeners.add(listener)
			/*if(typeCode === 122){
				console.log('attaching to: ' + key)
				console.log(JSON.stringify(Object.keys(cachedViewIncludes)))
				console.log(new Error().stack)
			}*/
			_.assertInt(editId)
			Object.keys(cachedViewIncludes).forEach(function(key){
				listener.includeView(key, cachedViewIncludes[key], editId)
			})
			listener.includeView(key, handle, editId)
			listener.set(key, undefined, editId)
			
		},
		include: function(listener, editId){			
			var detachers = []
			
			//console.log('including: ' + key)
			
			var wrapper = _.extend({}, listener)
			wrapper.includeView = function(viewId, handle, editId){
				//console.log('including view?: ' + viewId)
				if(viewCounts[viewId] === undefined){
				//	console.log('caching view id: ' + viewId)
					cachedViewIncludes[viewId] = handle
					viewCounts[viewId] = 0
					listener.includeView(viewId, handle, editId)
				}
				++viewCounts[viewId]
			}
			wrapper.removeView = function(viewId, handle, editId){
				--viewCounts[viewId]
				if(viewCounts[viewId] === 0){
					listener.removeView(viewId, handle, editId)
					delete cachedViewIncludes[viewId]
					delete viewCounts[viewId]
				}
			}
			
			//console.log('attached to view')
			Object.keys(rels).forEach(function(relCode){
				var rel = rels[relCode]
				//console.log('view attaching to rel ' + relCode)
				var d = attachRelFuncs[relCode](wrapper, rel, key, editId)
				detachers.push(d)
			})
			var alreadyDid = false
			return listener[ourDetachKey] = function(editId){
				if(alreadyDid) _.errout('detached more than once: ' + key)
				alreadyDid = true
				/*if(typeCode === 122){
					console.log('detaching: ' + key + ' ' + detachers.length)
					//console.log(new Error().stack)
				}*/
				detachers.forEach(function(d){
					//console.log('d: ' + d)
					d(editId);
				})
			}
		},
		detach: function(listener, editId){
			//_.assertInt(editId)
			if(editId){
				listener.set(undefined, key, editId)
			}
			listener.removeView(key, handle, editId)
		},
		oldest: function(){
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
		}
	}
	
	return cache.store(key, handle)
}

