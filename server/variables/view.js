"use strict";

var Cache = require('./../variable_cache')
var _ = require('underscorem')

var listenerSet = require('./../variable_listeners')


//TODO in principle, the call site of a view shouldn't affect its caching - they should all share
//right now, we have a different cache for each call site (including the top-level call site.)
//Note however that if the parameters are different variables, the view variable will end up as
//separate anyway, so duplication only happens if the same *type* of params with the same *values* occurs in different
//call sites.
//Also keep in mind that if we merge across call sites we have to start differentiating the caches by view type.
exports.make = function(s, self, callExpr, typeBindings){
	
	var cache = new Cache()

	var localTypeBindings = {}

	var viewName = callExpr.view
	var viewSchema = s.schema[viewName]
	//console.log('callExpr.view: ' + viewName)
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
	return f
}
exports.makeTopLevel = function(s, self, callExpr){
	var cache = new Cache()

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
		console.log('making for rel: ' + relName + ' ' + rel.code)
		var relFunc = relSets[rel.code] = self(rel, paramBindings)
		var relSchema = viewObjectSchema.properties[relName]
		
		if(relSchema.type.type !== rel.schemaType.type){
			_.errout('param and rel type do not match ' + JSON.stringify(relSchema) + ' !== ' + JSON.stringify(rel.schemaType))
		}
		attachRelFuncs[rel.code] = makeAttachFunction(s, viewSchema.code, relFunc, relSchema.type, rel.code);
	})
	
	var f = internalView.bind(undefined, s, cache, relSets, viewSchema.code, attachRelFuncs)
	f.wrappers = {}
	Object.keys(viewSchema.rels).forEach(function(relName){
		var rel = viewSchema.rels[relName];
		var relFunc = relSets[rel.code]
		f.wrappers[rel.code] = relFunc.wrapAsSet
	})	
	f.isView = true
	return f
}

function values(obj, f){
	Object.keys(obj).forEach(function(key){f(obj[key])})
}

var typeSuffix = {
	int: 'Int',
	long: 'Long',
	string: 'String',
	boolean: 'Boolean',
	real: 'Real',
	timestamp: 'Long'
}
function makeAttachFunction(s, viewTypeCode, relFunc, relSchema, relCode){

	_.assertObject(relSchema)
	if(relSchema.type === 'object'){
		return function(listener, rel, viewId, editId){
			_.assertFunction(listener.objectChange)
			_.assertFunction(listener.shouldHaveObject)
			var h = {
				set: function(value, oldValue, editId){
					_.assertInt(value)
					var edit = {id: value}
					console.log('view translating set id to setObject')
					listener.objectChange(viewTypeCode, viewId, viewTypeCode, viewId, [relCode], 'setObject', edit, -1, editId)
				},
				shouldHaveObject: listener.shouldHaveObject
				//just forward property changes if our rels are themselves views or sets of views
				//objectChange: listener.objectChange
				
			}
			rel.attach(h, editId)
			return function(editId){rel.detach(h, editId);}
		}
	}else if(relSchema.type === 'primitive'){//rel.type.type === 'set' || rel.type.type === 'list') && rel.type.members.type === 'object'){
		return function(listener, rel, viewId, editId){
			_.assertFunction(listener.objectChange)
			_.assertFunction(listener.shouldHaveObject)
			var ts = typeSuffix[relSchema.primitive]
			if(ts === undefined) _.errout('TODO: ' + relSchema.primitive)
			var opName = 'set'+ts
			var h = {
				set: function(value, oldValue, editId){
					_.assertInt(editId)
					var edit = {value: value}
					console.log('here: ' + JSON.stringify([viewTypeCode, viewId, viewTypeCode, viewId, [relCode], 'set', edit, -1, editId]))
					listener.objectChange(viewTypeCode, viewId, viewTypeCode, viewId, [relCode], opName, edit, -1, editId)
				},
				shouldHaveObject: listener.shouldHaveObject
				//just forward property changes if our rels are themselves views or sets of views
//				objectChange: listener.objectChange
			}
			rel.attach(h, editId)
			return function(editId){rel.detach(h, editId);}
		}
	}else if(relSchema.type === 'map'){
		//console.log(JSON.stringify(relSchema.type))
		if(relSchema.value.type === 'object'){
			return function(listener, rel, viewId, editId){
				_.assertFunction(listener.objectChange)
				_.assertFunction(listener.shouldHaveObject)
				var h = {
					put: function(key, value, editId){
						_.assertInt(editId)
						_.assertPrimitive(value)
						var edit = {id: value}
						//console.log('got put')
						listener.objectChange(viewTypeCode, viewId, viewTypeCode, viewId, [relCode, key], 'putExisting', edit, -1, editId)
					},
					shouldHaveObject: listener.shouldHaveObject
					//just forward property changes if our rels are themselves views or sets of views
//					objectChange: listener.objectChange
				}
				//console.log('view attaching to: ' + viewTypeCode + ' ' + relSchema.name)
				rel.attach(h, editId)
				return function(editId){rel.detach(h, editId);}
			}
		}else if(relSchema.value.type === 'set'){
			return function(listener, rel, viewId, editId){
				_.assertFunction(listener.objectChange)
				_.assertFunction(listener.shouldHaveObject)
				if(relSchema.value.members.type === 'object'){
					var h = {
						putAdd: function(key, value, editId){
							_.assertInt(editId)
							_.assertPrimitive(value)
							var edit = {id: value}
							//console.log('got put')
							_.assertInt(value)
							listener.objectChange(viewTypeCode, viewId, viewTypeCode, viewId, [relCode, key], 'putAddExisting', edit, -1, editId)
						},
						shouldHaveObject: listener.shouldHaveObject
						//just forward property changes if our rels are themselves views or sets of views
	//					objectChange: listener.objectChange
					}
				}else{
					var ts = typeSuffix[relSchema.value.members.primitive]
					var putAddOpName = 'putAdd'+ts
					var h = {
						putAdd: function(key, value, editId){
							_.assertInt(editId)
							_.assertPrimitive(value)
							var edit = {value: value}
							//console.log('got put')
							listener.objectChange(viewTypeCode, viewId, viewTypeCode, viewId, [relCode, key], putAddOpName, edit, -1, editId)
						},
						shouldHaveObject: listener.shouldHaveObject
						//just forward property changes if our rels are themselves views or sets of views
	//					objectChange: listener.objectChange
					}
					
				}
				//console.log('view attaching to: ' + viewTypeCode + ' ' + relSchema.name)
				rel.attach(h, editId)
				return function(editId){rel.detach(h, editId);}
			}
		}else{
			var ts = typeSuffix[relSchema.value.primitive]
			if(ts === undefined) _.errout('TODO: ' + relSchema.value.primitive)
			var putOpName = 'put'+ts
			//var keyOpName = 'select'+ts+'Key'

			return function(listener, rel, viewId, editId){
				_.assertInt(editId)
				_.assertFunction(listener.objectChange)
				_.assertFunction(listener.shouldHaveObject)
				var h = {
					put: function(key, value, oldValue, editId){
						_.assertInt(editId)
						_.assertPrimitive(value)
						var edit = {value: value}
						//console.log('*got put')
						//listener.objectChange(viewTypeCode, viewId, viewTypeCode, viewId, [relCode], keyOpName, 
						//	{key: key}, -1, editId)
						listener.objectChange(viewTypeCode, viewId, viewTypeCode, viewId, [relCode, key], putOpName, edit, -1, editId)
					},
					del: function(key, editId){
						var edit = {key: key}
						listener.objectChange(viewTypeCode, viewId, viewTypeCode, viewId, [relCode, key], 'del', edit, -1, editId)
					},
					shouldHaveObject: listener.shouldHaveObject,
					//just forward property changes if our rels are themselves views or sets of views
					objectChange: listener.objectChange
				}
				rel.attach(h, editId)
				return function(editId){rel.detach(h, editId);}
			}
		}
	}else if(relSchema.type === 'view'){
		return function(listener, rel, viewId, editId){
			_.assertFunction(listener.objectChange)
			_.assertFunction(listener.shouldHaveObject)
			var h = {
				set: function(value, oldValue, editId){
					_.assertString(value)
					var edit = {id: value}
					//console.log('view translating set id to setObject')
					listener.objectChange(viewTypeCode, viewId, viewTypeCode, viewId, [relCode], 'setViewObject', edit, -1, editId)
				},
				shouldHaveObject: listener.shouldHaveObject,
				//just forward property changes if our rels are themselves views or sets of views
				objectChange: listener.objectChange
			}
			rel.attach(h, editId)
			return function(editId){rel.detach(h, editId);}
		}
	}else{
		console.log(JSON.stringify(relSchema))
		if(relSchema.members.type === 'object'){
			return function(listener, rel, viewId, editId){
				_.assertFunction(listener.objectChange)
				_.assertFunction(listener.shouldHaveObject)
				var h = {
					add: function(value, editId){
						console.log('got object add: ' + JSON.stringify([viewTypeCode, viewId, relCode, value, editId]))
						//if(viewId === 0) process.exit(0)
						_.assert(_.isString(value) || _.isInt(value))
						_.assert(_.isInt(value) || value.indexOf(':') !== -1)//must be id
						if(_.isInt(value)) _.assert(value >= 0)
						var edit = {id: value}
						listener.objectChange(viewTypeCode, viewId, viewTypeCode, viewId, [relCode], 'addExisting', edit, -1, editId)
					},
					remove: function(value, editId){
						_.assert(_.isString(value) || _.isInt(value))
						if(editId){
							var edit = {id: value}
							listener.objectChange(viewTypeCode, viewId, viewTypeCode, viewId, [relCode], 'remove', edit, -1, editId)
						}
					},
					shouldHaveObject: listener.shouldHaveObject,
					//just forward property changes if our rels are themselves views or sets of views
					objectChange: listener.objectChange
//					shouldHaveObject: listener.shouldHaveObject
				}
				//console.log('view attaching to: ' + viewTypeCode + ' ' + relSchema.name)
				rel.attach(h, editId)
				return function(editId){rel.detach(h, editId);}
			}
		}else if(relSchema.members.type === 'view'){
			return function(listener, rel, viewId, editId){
				_.assertFunction(listener.objectChange)
				_.assertFunction(listener.shouldHaveObject)
				var h = {
					add: function(value, editId){
						_.assertInt(editId)
						//console.log(relCode + ' got object add: ' + JSON.stringify([viewTypeCode, viewId, relCode, value, editId]))
						_.assert(_.isString(value) || _.isInt(value))
						_.assert(_.isInt(value) || value.indexOf(':') !== -1)//must be id
						var edit = {id: value}
						listener.objectChange(viewTypeCode, viewId, viewTypeCode, viewId, [relCode], 'addExistingViewObject', edit, -1, editId)
					},
					remove: function(value, editId){
						_.assert(_.isString(value) || _.isInt(value))
						var edit = {id: value}
						listener.objectChange(viewTypeCode, viewId, viewTypeCode, viewId, [relCode], 'removeViewObject', edit, -1, editId)
					},
					shouldHaveObject: listener.shouldHaveObject,
					//just forward property changes if our rels are themselves views or sets of views
					objectChange: listener.objectChange
				}
				//console.log('view attaching to: ' + viewTypeCode + ' ' + relSchema.name)
				rel.attach(h, editId)
				return function(editId){rel.detach(h, editId);}
			}
		}else{

			return function(listener, rel, viewId, editId){
				_.assertInt(editId)
				_.assertFunction(listener.objectChange)
				_.assertFunction(listener.shouldHaveObject)

				var ts = typeSuffix[relSchema.members.primitive]
				if(ts === undefined) _.errout('TODO: ' + relSchema.members.primitive)
				var addOpName = 'add'+ts
				var removeOpName = 'remove'+ts

				var h = {
					add: function(value, editId){
						_.assertInt(editId)
						//_.assert(_.isString(value) || _.isInt(value))
						var edit = {value: value}
						//console.log('LISTENER: ' + require('util').inspect(listener))
						//console.log('GENERIC ADD HERE: ' + relCode)
						//console.log(JSON.stringify(relSchema))
						listener.objectChange(viewTypeCode, viewId, viewTypeCode, viewId, [relCode], addOpName, edit, -1, editId)
					},
					remove: function(value, editId){
						var edit = {value: value}
						listener.objectChange(viewTypeCode, viewId, viewTypeCode, viewId, [relCode], removeOpName, edit, -1, editId)					
					},
					shouldHaveObject: listener.shouldHaveObject,
					//just forward property changes if our rels are themselves views or sets of views
					objectChange: listener.objectChange
				}
				rel.attach(h, editId)
				return function(editId){rel.detach(h, editId);}
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
	console.log('*************VIEW KEY: ' + key + ' ' + editId)
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
	
	var handle = {
		attach: function(listener, editId){
			//_.assertFunction(listener.objectChange)
			_.assertFunction(listener.shouldHaveObject)
			listeners.add(listener)
			_.assertInt(editId)
			var detachers = []
			//console.log('attached to view')
			listener.set(key, undefined, editId)
			Object.keys(rels).forEach(function(relCode){
				var rel = rels[relCode]
				//console.log('view attaching to rel ' + relCode)
				var d = attachRelFuncs[relCode](listener, rel, key, editId)
				detachers.push(d)
			})
			
			return listener[ourDetachKey] = function(editId){
				detachers.forEach(function(d){d(editId);})
			}
		},
		detach: function(listener, editId){
			
			listener[ourDetachKey](editId)
			/*listeners.remove(listener)
			if(editId){
				//TODO detach rel functions as reverse of attach
				Object.keys(rels).forEach(function(relCode){
					var rel = rels[relCode]
					detachRelFuncs[relCode](listener, rel, key, editId)
				})
			}*/
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

