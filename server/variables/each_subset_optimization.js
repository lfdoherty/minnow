
var _ = require('underscorem')

//var Cache = require('./../variable_cache')

var wrapParam = require('./syncplugins').wrapParam
var schema = require('./../../shared/schema')
var listenerSet = require('./../variable_listeners')

var fixedObject = require('./../fixed/object')

function fromMacro(e, implicits){
	if(e.view === 'property'){
		return fromMacro(e.params[1], implicits)
	}else{
		if(e.type === 'param'){
			//console.log('name: ' + e.name)
			//console.log(JSON.stringify(implicits))
			return implicits.indexOf(e.name) !== -1
		}else if(e.type === 'view' && e.view === 'cast'){
			return fromMacro(e.params[1], implicits)
		}
		//_.errout(JSON.stringify(e))
		throw new Error('each_subset_optimization not possible, bad fromMacro: ' + JSON.stringify(e))
	}
}

function getMacroParam(e){
	if(e.type === 'param'){
		//console.log('name: ' + e.name)
		//console.log(JSON.stringify(implicits))
		return e
	}else if(e.type === 'view' && e.view === 'cast'){
		return getMacroParam(e.params[1])//fromMacro(e.params[1], implicits)
	}else{
		throw new Error('cannot find macro param: ' + JSON.stringify(e))
	}
}

function extractMacroPropertyExpressions(e, implicits){
	var res = []
	if(e.type === 'view'){
		if(e.view === 'property'){
			if(fromMacro(e, implicits)){
				res.push(e)
			}
		}else{
			e.params.forEach(function(p){
				res = res.concat(extractMacroPropertyExpressions(p, implicits))
			})
		}
	}else if(e.type === 'param'){
	}else if(e.type === 'value'){
	}else if(e.type === 'int'){
	}else{
		throw new Error('each_subset_optimization not possible: ' + JSON.stringify(e))
	}
	return res
}
exports.extractMacroPropertyExpressions = extractMacroPropertyExpressions

function stub(){}

/*
two types of inputs: 
- stuff that's already bound external to the filter function
- property expressions

Everything else should be composed of sync functions

*/
function makeSynchronousFunction(s, self, pes, typeBindings, objSchema, implicits, e){
	
	if(e.type === 'view'){
		if(e.view === 'property'){
			var propertyName = e.params[0].value
			//_.assert(e.params[1].type === 'param')
			
			var macroParam = getMacroParam(e.params[1])
			

			if(implicits.indexOf(macroParam.name) === -1){

				if(typeBindings[macroParam.name]){//wrap global in sync wrapper

					var v = self(e, typeBindings)
					var wv = wrapParam(v, e.schemaType, s)

					return function(variableBindings, editId){
						
						var bound = wv(variableBindings, editId)

						var f = function(bindings, propertiesMap){
							var v = bound.get()
							return v
						
						}
						var listener
						var attacher = {
							changed: function(editId){
								//console.log('changed')
								listener(editId)
							},
							includeView: stub,
							removeView: stub
						}
						f.listenForChange = function(cb, editId){
							listener = cb
							bound.attach(attacher, editId)
						}
						return f
					}
				}else{
					throw new Error('cannot use this optimization: ' + JSON.stringify(e.params[1]))
				}
				//if(e.params[1].
			}
			
			if(propertyName === 'uuid'){
				//var pc = -3
				return function(variableBindings, editId){
					return function(bindings, propertiesMap){
						var v = propertiesMap[-3]
						//if(v === undefined) _.errout('no v(' + propertyName + '): ' + JSON.stringify(propertiesMap))
						//_.assertDefined(v)
						console.log('got uuid: ' + v)
						return v
					}
				}
			}
			
			//console.log(JSON.stringify(e))
			var pc = objSchema.properties[propertyName].code
			_.assertInt(pc)
			return function(variableBindings, editId){
				return function(bindings, propertiesMap){
					var v = propertiesMap[pc]
					//if(v === undefined) _.errout('no v(' + propertyName + '): ' + JSON.stringify(propertiesMap))
					//_.assertDefined(v)
					return v
				}
			}
		}else{
			var funcs = []
			e.params.forEach(function(p){
				funcs.push(makeSynchronousFunction(s, self, pes, typeBindings, objSchema, implicits, p))
			})

			var impl = schema.getImplementation(e.view)
			if(!impl.isSynchronousPlugin) _.errout('not a sync plugin, fail: ' + e.view)
			//_.assert(impl.isSynchronousPlugin)
			var implFunc = impl.implementation//(s, self, e, typeBindings)

			return function(variableBindings, editId){
				var boundFuncs = []
				for(var i=0;i<funcs.length;++i){
					boundFuncs[i] = funcs[i](variableBindings, editId)
				}
				var f = function(bindings, propertiesMap, macroParams){
					var inputs = []
					for(var i=0;i<boundFuncs.length;++i){
						var v = boundFuncs[i](bindings, propertiesMap, macroParams)
						if(v == null && !impl.nullsOk){
							return undefined
						}
						inputs[i] = v
					}
					//console.log('computing: ' + e.view + JSON.stringify(inputs))
					
					var res = implFunc(inputs)
					//console.log('result: ' + JSON.stringify(res))
					return res
				}
				
				var mayChange = false
				for(var i=0;i<boundFuncs.length;++i){
					var bf = boundFuncs[i]
					if(bf.listenForChange){
						mayChange = true
						break;
					}
				}
				if(mayChange){
					f.listenForChange = function(cb, editId){
						for(var i=0;i<boundFuncs.length;++i){
							var bf = boundFuncs[i]
							if(bf.listenForChange){
								bf.listenForChange(cb, editId)
							}
						}
					}
				}
				return f
			}
		}
	}else if(e.type === 'param'){
		for(var i=0;i<implicits.length;++i){
			if(implicits[i] === e.name){
				return function(variableBindings, editId){
					return function(bindings, propertiesMap, macroParams){
						//console.log('returning ' + i + ' ' + macroParams[i])
						return macroParams[i]
					}
				}
			}
		}
		return function(variableBindings, editId){
			return function(bindings, propertiesMap){
				//_.errout('TODO get binding wrapper value')
				_.assertString(e.name)
				if(bindings[e.name] === undefined){
					_.errout('binding is missing: ' + JSON.stringify(e) + ' ' + JSON.stringify(bindings))
				}
				var v = bindings[e.name].get()
				//console.log('got param ' + e.name + ' value: ' + v)
				if(v === undefined){
					_.errout('param.get is undefined: ' + e.name)
				}
				_.assertDefined(v)
				return v
			}
		}
	}else if(e.type === 'int'){
		return function(variableBindings, editId){
			return function(){
				return e.value
			}
		}
	}else if(e.type === 'value'){
		return function(variableBindings, editId){
			return function(){
				return e.value
			}
		}
	}else{
		_.errout('TODO: ' + JSON.stringify(e))
	}
}
exports.makeSynchronousFunction = makeSynchronousFunction

function extractParams(e, implicits){
	
	var res = []
	if(e.type === 'view'){
		e.params.forEach(function(p){
			res = res.concat(extractParams(p, implicits))
		})
	}else if(e.type === 'param'){
		//console.log('examining param: ' + JSON.stringify([e, implicits]))
		if(implicits.indexOf(e.name) === -1){
			//console.log('did extract: ' + e.name)
			res.push(e)
		}
	}else if(e.type === 'value'){
	}else if(e.type === 'int'){
	}else{
		_.errout('TODO: ' + JSON.stringify(e))
	}
	return res
}

function makeBindingWrappersFunction(s, self, e, typeBindings){
	var paramExprs = extractParams(e.expr, e.implicits)

	var bindingWrapperMakers = {}
	//callExpr.params.forEach(function(param, index){
	paramExprs.forEach(function(param){
		var v = self(param, typeBindings)
		var wv = wrapParam(v, param.schemaType, s)
		bindingWrapperMakers[param.name] = wv
	})	
	var bwKeys = Object.keys(bindingWrapperMakers)
	return function(bindings, editId){

		var bindingWrappers = {}
		//bwKeys.forEach(function(key){
		for(var i=0;i<bwKeys.length;++i){
			var key = bwKeys[i]
			bindingWrappers[key] = bindingWrapperMakers[key](bindings, editId)
		}
		
		return bindingWrappers
	}
}

exports.makeBindingWrappersFunction = makeBindingWrappersFunction

exports.make = function(s, self, rel, typeBindings){

	var cache = s.makeCache()//new Cache(s.analytics)

	if(rel.params[0].type !== 'view' || rel.params[0].view !== 'typeset'){
		//console.log('NOT A SUBSET')
		return //must involve a *<type> input set
	}
	_.assert(rel.params[1].type === 'macro')
	if(rel.params[1].expr.view !== 'filter'){
		//console.log('NOT A FILTER')	
		return//must be a subset call
	}

	var objSchema = s.schema[rel.params[0].params[0].value]
	var objTypeCode = objSchema.code
	
	//console.log(JSON.stringify(rel))//.params[1]))
	var pes
	try{
		pes = extractMacroPropertyExpressions(rel.params[1].expr.params[1], rel.params[1].implicits)
	}catch(e){
		console.log('FAILED TO EXTRACT MACRO PROPERTY EXPRESSIONS: ' + e)
		return
	}
	//console.log(JSON.stringify(pes))
	var propertyCodes = []
	for(var i=0;i<pes.length;++i){
	
		if(pes[i].params[1].type !== 'param'){
			console.log('MORE THAN ONE PROPERTY')
			return//must be single-property descent (for now)
		}
		var propertyName = pes[i].params[0].value
		if(propertyName === 'id'){
			propertyCodes.push(-1)
		}else if(propertyName === 'uuid'){
			propertyCodes.push(-3)
		}else{
			var p = objSchema.properties[propertyName]
			if(p === undefined) _.errout('no property named "' + propertyName + '" for object "' + objSchema.name + '"')
			propertyCodes.push(p.code)
		}
	}

	try{
		var wrapper = makeSynchronousFunction(s, self, pes, typeBindings, objSchema, rel.params[1].implicits, rel.params[1].expr.params[1])
	}catch(e){
		console.log('subset optimization failed - could not construct sync wrapper: ' + JSON.stringify(rel.params[1].expr))
		console.log(e.stack)
		return
	}
	
	var makeBindingWrappers = makeBindingWrappersFunction(s, self, rel.params[1], typeBindings)

	var streamAllPropertyValues
	//console.log('isHistorical: ' + s.isHistorical)
	if(s.isHistorical){
		streamAllPropertyValues = s.objectState.streamAllPropertyValuesHistorically
	}else{
		streamAllPropertyValues = s.objectState.streamAllPropertyValues
	}
	var f = makeF(s, rel, objTypeCode, propertyCodes, wrapper, makeBindingWrappers, cache, streamAllPropertyValues)

	var fixedObjGetter = fixedObject.make(s)	
	f.wrapAsSet = function(id, editId, context){//same as typeset
		_.assertInt(editId)
		return fixedObjGetter(id, editId, context)
	}
	return f
}

function makeF(s, rel, objTypeCode, propertyCodes, wrapper, makeBindingWrappers, cache, streamAllPropertyValues){
	function f(bindings, editId){
			
		var streamingEditId = -1
		
		var key = ''
		_.each(bindings, function(value, k){
			key += bindings[k].key + ';'
		})

		key += JSON.stringify(rel.params[1].expr)//TODO better keys?
		
		if(cache.has(key)){
			return cache.get(key)
		}
	
		var ids = []
		var has = {}

		var bindingWrappers = makeBindingWrappers(bindings, editId)
		var bindingWrapperKeys = Object.keys(bindingWrappers)

		
		function oldest(){
			var old = s.objectState.getCurrentEditId()
			for(var i=0;i<bindingWrapperKeys.length;++i){
				var bw = bindingWrappers[bindingWrapperKeys[i]]
				var o = bw.oldest()
				if(o < old) old = o
			}
			if(!streamUpToDate){
				if(old > streamLast) old = streamLast
			}
			return old
		}

		var listeners = listenerSet()
		
		var boundWrapper = wrapper(bindings, editId)

		//TODO if globals that boundWrapper references change, refresh all
		if(boundWrapper.listenForChange){
			boundWrapper.listenForChange(function(editId){
				if(streamUpToDate){
					streamUpToDate = false
					streamLast = editId
				}
				streamAll(editId)
			}, editId)
		}

		var streamUpToDate = false
		var streamLast = -1

		if(s.isHistorical){
			var changeHistory = []
		}

		var stopFunction
		function streamAll(sourceEditId){
			_.assertInt(sourceEditId)
			
			if(stopFunction) stopFunction()
			//console.log('setup object type subset: ' + objTypeCode + ' ' + s.schema._byCode[objTypeCode].name)
			stopFunction = streamAllPropertyValues(objTypeCode, propertyCodes, sourceEditId, function(id, propertyValueMap, editId){
				//console.log('got property values(' + objTypeCode + '): ' + id + ' ' + JSON.stringify(propertyValueMap) + ' ' + editId + ' ' + JSON.stringify(propertyCodes))
				var realEditId = editId
				if(!s.isHistorical){
					realEditId = Math.max(sourceEditId, editId)
				}
				
				var singleResult = boundWrapper(bindingWrappers, propertyValueMap)
				if(singleResult){
					//console.log('got map ' + id + ' -> ' + JSON.stringify(propertyValueMap))
					//console.log('result: ' + singleResult)
					if(!has[id]){
						//console.log('adding ' + id)
						ids.push(id)
						has[id] = true
						if(s.isHistorical) changeHistory.push({type: 'add', id: id, editId: realEditId})
						listeners.emitAdd(id, realEditId)
					}
				}else{
					if(has[id]){
						delete has[id]
						ids.splice(ids.indexOf(id), 1)
						//console.log('remove id: ' + id + ' ' + realEditId)
						if(s.isHistorical) changeHistory.push({type: 'remove', id: id, editId: realEditId})
						listeners.emitRemove(id, realEditId)
					}
				}
			}, function(live, editId){
				//console.log('has streamed all initial object property values: ' + live + ' ' + editId)
				streamUpToDate = live
				streamLast = Math.max(editId, sourceEditId)
			}, function(id, editId){
				_.assertInt(editId)
				if(has[id]){
					//console.log('deleting id')
					delete has[id]
					ids.splice(ids.indexOf(id), 1)
					if(s.isHistorical) changeHistory.push({type: 'remove', id: id, editId: realEditId})
					listeners.emitRemove(id, editId)
				}			
			})
		}
		//console.log('streaming all: ' + editId)
		//console.log(new Error().stack)
		
		streamAll(editId)
				
		var handle = {
			name: 'each-subset-optimization',
			attach: function(listener, editId){
				_.assertInt(editId)
				_.assertFunction(listener.add)
				listeners.add(listener)
				/*for(var i=0;i<ids.length;++i){
					var id = ids[i]
					listener.add(id, editId)
				}*/
				if(s.isHistorical){
					//console.log('providing history to new attach: ' + JSON.stringify(changeHistory))
					changeHistory.forEach(function(c){
						if(c.type === 'add'){
							listener.add(c.id, c.editId)
						}else{
							listener.remove(c.id, c.editId)
						}//push({type: 'add', id: id, editId: realEditId})
					})
				}else{
					for(var i=0;i<ids.length;++i){
						var id = ids[i]
						listener.add(id, editId)
					}
				}
			},
			detach: function(listener, editId){
				listeners.remove(listener)
				if(editId){
					for(var i=0;i<ids.length;++i){
						var id = ids[i]
						listener.remove(id, editId)
					}
				}
			},
			oldest: oldest,
			key: key,
			/*descend: function(path, editId, cb, continueListening){//same as typeset
				if(s.objectState.isTopLevelObject(path[0].edit.id)){
					s.objectState.streamProperty(path, editId, cb, continueListening)
					return true
				}
				return false
			},*/
			streamProperty: s.objectState.streamProperty,
			destroy: function(){
				listeners.destroyed()
				stopFunction()
			},
			getTopParent: function(id){
				_.assert(s.objectState.isTopLevelObject(id))
				return id
			}
		}
		
		return cache.store(key, handle)
	}
	return f
}
