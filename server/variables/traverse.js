"use strict";

var Cache = require('./../variable_cache')

var schema = require('./../../shared/schema')
var listenerSet = require('./../variable_listeners')
var viewInclude = require('./../viewinclude')

var fixedPrimitive = require('./../fixed/primitive')
var fixedObject = require('./../fixed/object')


var _ = require('underscorem')

function stub(){}

//var wrapParam = require('./syncplugins').wrapParam

function traverseType(rel, ch){

	var macroParam = rel.params[rel.params.length-2]
	var depthParam = rel.params[rel.params.length-1]
	var inputParams = rel.params.slice(0, rel.params.length-2)

	var newBindings = {}

	var inputType = inputParams[0].schemaType
	var implicits = macroParam.implicits
	//console.log(JSON.stringify(macroParam))
	_.assertArray(implicits)

	for(var i=0;i<inputParams.length;++i){
		newBindings[implicits[i]] = inputType
		_.assertEqual(JSON.stringify(inputParams[i].schemaType), JSON.stringify(inputType))
	}

	var realValueType = ch.computeMacroType(macroParam, ch.bindingTypes, newBindings, implicits)
	var valueType = realValueType
	
	if(valueType.type === 'set' || valueType.type === 'list'){
		valueType = valueType.members;
	}
	return {type: 'set', members: valueType}
}
schema.addFunction('traverse', {
	schemaType: traverseType,
	implementation: traverseMaker,
	minParams: 3,
	maxParams: -1,
	callSyntax: 'traverse(params...,macro,maxDepth)'
})

function traverseMaker(s, self, rel, typeBindings){

	var macroParam = rel.params[rel.params.length-2]
	var depthParam = rel.params[rel.params.length-1]
	var inputParams = rel.params.slice(0, rel.params.length-2)

	var cache = new Cache(s.analytics)
	s = _.extend({}, s)
	s.outputType = rel
	
	if(macroParam.type !== 'macro' && macroParam.type !== 'partial-application' && macroParam.type === 'param'){
		_.errout('syntax error?')
	}

	var paramGetters = []
	
	var newTypeBindings = _.extend({}, typeBindings)
	var implicits = macroParam.implicits
	_.assertArray(implicits)
	var inputType = inputParams[0].schemaType
	//console.log('adding implicits: ' + JSON.stringify(implicits.slice(0, inputParams.length)))
	//console.log('before: ' + JSON.stringify(newTypeBindings))
	for(var i=0;i<inputParams.length;++i){
		_.assertUndefined(newTypeBindings[implicits[i]])
		newTypeBindings[implicits[i]] = inputType
		paramGetters.push(self(inputParams[i], typeBindings))
	}
	//console.log(JSON.stringify([implicits, newTypeBindings]))
	var exprGetter = self(macroParam, newTypeBindings)
	
	var depthGetter
	if(depthParam){
		depthGetter = self(depthParam, typeBindings)
	}

	var res

	var t = rel.params[0].schemaType
	if(t.type === 'set' || t.type === 'list' || t.type === 'map'){
		_.errout('Error: traverse initial parameters must be single values, not collections: ' + JSON.stringify(t))
	}

	if(macroParam.schemaType.type === 'set' || macroParam.schemaType.type === 'list'){
	
		var ipt = inputParams[0].schemaType.type
		var makeFixedMacroVariable
		if(ipt === 'object'){
			var fo = fixedObject.make(s)
			makeFixedMacroVariable = fo
		}else if(ipt === 'primitive'){
			var fp = fixedPrimitive.make(s)
			makeFixedMacroVariable = fp
		}else{
			_.errout('TODO?: ' + JSON.stringify(inputParams[0]))
		}
		
		res = svgTraverseMultiple.bind(undefined, s, macroParam.implicits, cache, exprGetter, paramGetters, inputType, depthGetter, makeFixedMacroVariable)
	}else{
		_.assertNot(macroParam.schemaType.type === 'map')
		res = svgTraverseSingle.bind(undefined, s, macroParam.implicits, cache, exprGetter, paramGetters, inputType, depthGetter)
	}


	res.schemaType = rel.schemaType
	res.wrappers = exprGetter.wrappers
	res.wrapAsSet = function(v, editId, context){
		return exprGetter.wrapAsSet(v, editId, context)
	}
	
	return res
}

function svgTraverseMultiple(s, implicits, cache, exprExprGetter, paramExprGetters, paramType, depthGetter, makeFixedMacroVariable, bindings, editId){

	var concreteGetter = exprExprGetter(bindings, editId)
	//console.log(require('util').inspect(exprExprGetter))
	_.assertDefined(concreteGetter.key)
	
	var key = concreteGetter.key
	paramExprGetters.forEach(function(p){
		key += ':'+p.key
	})
	
	if(cache.has(key)) return cache.get(key)
	
	var listeners = listenerSet()
	var vi = viewInclude.make(listeners)
	
	var paramVariables = []
	paramExprGetters.forEach(function(pg){
		var pv = pg(bindings, editId)
		_.assertDefined(pv)
		_.assertString(pv.name)
		paramVariables.push(pv)
	})

	//var rr = Math.random()
	//console.log('made traverse-single: ' + rr)

	var depthVariable = depthGetter(bindings, editId)

	var depth = 0

	var variables = []

	function oldest(){
	//	console.log('oldest')
		var oldestEditId = s.objectState.getCurrentEditId()
		function f(pv){
			var old = pv.oldest()
			if(old < oldestEditId){
				//console.log('reducing old to: ' + old + ' < ' + oldestEditId + ' ' + pv.name)
				oldestEditId = old
			}
		}
		paramVariables.forEach(f)
		variables.forEach(f)
		return oldestEditId
	}
	
	var alreadyTraversed = {}
	
	var values = []
	var count = {}
	
	var root;
	
	function makeResultListener(previous, ourDepth, attachedTo, editId){
		
		//console.log('made result listener: ' + ourDepth)
		
		var isLeaf = false
		var isAttached = false
		
		function depthChange(d, editId){
			if(d <= ourDepth){
				attachedTo.detach(resultListener, editId)
				isLeaf = true
				isAttached = false
			}else if(isLeaf && d > ourDepth+1){
				isLeaf = false
				//
				value.forEach(function(v){
					extendSelf(v, editId, attachedTo)
				})
				if(!isAttached){
					isAttached = true
					attachedTo.attach(resultListener, editId)
				}
			}
		}

		
		function extendSelf(v, editId){
			/*var vv = variables[variables.length-1]
			var context = {
				name: 'context-mixing',
				key: Math.random()+'',
				descend: function(path, editId, cb){
					var res = vv.descend(path, editId, cb)
					if(res) return res
					for(var i=0;i<paramVariables.length;++i){
						var pv = paramVariables[i]
						var res = pv.descend(path, editId, cb)
						if(res) return res
					}
					return false
				}
			}*///variables.length > 0 ? variables[variables.length-1] : paramVariables[paramVariables.length-1]//TODO merge paramVariables contexts for fixed objects (for descent purposes)
			var newPrevious = [].concat(previous)
			newPrevious.shift()
			var mv = makeMacroVariable(v)//, editId, context)
			newPrevious.push(mv)
			extendMacroChain(newPrevious, ourDepth+1, editId)
		}
		
		var value = []
		var variable
		var attachedListeners = listenerSet()
		
		var resultListener = {
			add: function(v, editId){
				_.assertPrimitive(v)
				value.push(v)
				
				//console.log('added value: ' + v)
				
				attachedListeners.emitAdd(v, editId)				
				
				if(count[v] === undefined){
					count[v] = 0
					values.push(v)
					listeners.emitAdd(v, editId)
				}
				++count[v]
				
				/*if(depth > ourDepth){

					extendSelf(v, editId)
				}*/
				if(depth > ourDepth+1){
					//console.log('descending: ' + (ourDepth + 1))
					extendSelf(v, editId)
				}else{
					isLeaf = true
				}
			},
			remove: function(v, editId){

				value.splice(value.indexOf(v), 1)

				attachedListeners.emitRemove(v, editId)
			
				--count[v]
				if(count[v] === 0){
					values.splice(values.indexOf(v), 1)
					delete count[v]
					listeners.emitRemove(v, editId)
				}
			},
			includeView: vi.includeView,
			removeView: vi.includeView
		}
		
		function makeMacroVariable(v){
			_.assertDefined(v)
			
			var listeners = listenerSet()
			
			var mv = {
				name: 'traverse-macro-variable',
				attach: function(listener, editId){
					//if(attached) _.errout('dup?')
					//attached = listener
					_.assertInt(editId)
					
					listeners.add(listener)
					listener.set(v, undefined, editId)
				},
				detach: function(listener, editId){
					listeners.remove(listener)
					if(editId){
						listener.set(undefined, v, editId)
					}
				},
				descend: function(path, editId, cb){
					return attachedTo.descend(path, editId, cb)
				},
				key: '*'+v+':'+variable.key,
				oldest: s.objectState.getCurrentEditId
			}
			return mv
		}

		variable = {
			name: 'traverse-macro-result',
			attach: function(listener, editId){
				attachedListeners.add(listener)
				_.assertFunction(listener.add)
				value.forEach(function(v){
					listener.add(v, editId)
				})
			},
			detach: function(listener, editId){
				if(editId && value !== undefined){
					value.forEach(function(v){
						listener.remove(v, editId)
					})
				}
			},
			listener: resultListener,
			descend: function(path, editId, cb){
				//_.errout('TODO');
				return attachedTo.descend(path, editId, cb)
			},
			key: '*'+attachedTo.key,
			oldest: attachedTo.oldest,
			depthChange: depthChange
		}
		
		variables.push(variable)

		attachedTo.attach(resultListener, editId)		
	}
	
	function extendMacroChain(previous, ourDepth, editId){
		_.assertInt(editId)
	
		var prevKey = ''
		var newBindings = _.extend({},bindings)
		
		for(var i=0;i<previous.length;++i){
			newBindings[implicits[i]] = previous[i]
			prevKey += previous[i].key+','
		}
		
		//console.log('extending: ' + prevKey + ' ' + ourDepth)
		if(alreadyTraversed[prevKey]){
			return//TODO something else? count?
		}
		alreadyTraversed[prevKey] = 1
		
		var m = concreteGetter(newBindings, editId)
		
		//console.log('extending macro chain: ' + ourDepth)// + ' '+ require('util').inspect(newBindings))


		makeResultListener(previous, ourDepth, m, editId)
	}
	
	function reduceMacroChain(correctDepth, editId){
		//console.log('reduce macro chain: ' + correctDepth)
		
		while(macroChain.length > correctDepth){
			var mc = macroChain.pop()
			var rl = resultListeners.pop()
			mc.detach(rl.listener, editId)
		}
	}
	
	var initialized = false
	
	depthVariable.attach({
		set: function(v, old, editId){
			//console.log(' got depth: ' + v)

			depth = v

			if(v !== undefined && !initialized){
				initialized = true
				root = extendMacroChain(paramVariables, 0, editId)
				//console.log('initialized: ' + v + ' ' + values.length)
			}
			
			variables.forEach(function(v){
				v.depthChange(depth, editId)
			})
		},
		includeView: function(){_.errout('ERROR');},
		removeView: function(){_.errout('ERROR');}
	}, editId)
	

	//var rr = Math.random()

	//listeners.rr = rr
	
	var paramStr = ' ['
	for(var i=0;i<paramVariables.length;++i){
		if(i > 0) paramStr += ', '
		paramStr += paramVariables[i].name
	}
	paramStr += ']'
	
	var handle = {
		name: 'traverse-multiple'+paramStr,
		attach: function(listener, editId){
			_.assertFunction(listener.objectChange)
			
			//console.log(rr + ' listener added ************8 ' + values.length)
			listeners.add(listener)

			values.forEach(function(v){listener.add(v, editId)})
		},
		detach: function(listener, editId){

			//console.log(rr+' listener removed ************8 ' + values.length)

			listeners.remove(listener)
			if(editId){
				values.forEach(function(v){listener.remove(v, editId)})
			}
		},
		oldest: oldest,
		key: key,
		descend: function(path, editId, cb){
			//_.errout('TODO')
			for(var i=0;i<paramVariables.length;++i){
				var pv = paramVariables[i]
				if(pv.descend){
					var worked = pv.descend(path, editId, cb)
					if(worked) return true
				}else{
					console.log('has no descend: ' + pv.name)
				}
			}
			for(var i=0;i<variables.length;++i){
				var pv = variables[i]
				if(pv.descend){
					var res = pv.descend(path, editId, cb)
					if(res) return res
				}else{
					console.log('has no descend: ' + pv.name)
				}
			}
			return false
		}
	}
		
	return cache.store(key, handle)
}

function svgTraverseSingle(s, implicits, cache, exprExprGetter, paramExprGetters, paramType, depthGetter, bindings, editId){

	var concreteGetter = exprExprGetter(bindings, editId)
	//console.log(require('util').inspect(exprExprGetter))
	_.assertDefined(concreteGetter.key)
	
	var key = concreteGetter.key
	paramExprGetters.forEach(function(p){
		key += ':'+p.key
	})
	
	if(cache.has(key)) return cache.get(key)
	
	var listeners = listenerSet()
	var vi = viewInclude.make(listeners)
	
	var paramVariables = []
	paramExprGetters.forEach(function(pg){
		var pv = pg(bindings, editId)
		_.assertDefined(pv)
		paramVariables.push(pv)
	})

	//var rr = Math.random()
	//console.log('made traverse-single: ' + rr)

	var depthVariable = depthGetter(bindings, editId)

	var depth = 0

	var variables = []

	function oldest(){
		//console.log('*oldest')
		//console.log(new Error().stack)
		
		var oldestEditId = s.objectState.getCurrentEditId()
		function f(pv){
			var old = pv.oldest()
			if(old < oldestEditId){
				//console.log('reducing old to: ' + old + ' < ' + oldestEditId + ' ' + pv.name)
				oldestEditId = old
			}
		}
		paramVariables.forEach(f)
		variables.forEach(f)
		return oldestEditId
	}
	
	
	var values = []
	var count = {}
	
	var root;
	
	function makeResultListener(previous, ourDepth, attachedTo, editId){
		
		//console.log(rr+' made result listener: ' + ourDepth)
		
		var isLeaf = false
		var isAttached = false
		
		function depthChange(d, editId){
			if(d <= ourDepth){
				attachedTo.detach(resultListener, editId)
				isLeaf = true
				isAttached = false
			}else if(isLeaf && d > ourDepth+1){
				isLeaf = false
				extendSelf(editId)
				if(!isAttached){
					isAttached = true
					attachedTo.attach(resultListener, editId)
				}
			}
		}
		
		function extendSelf(editId){
			//console.log('extending ' + ourDepth)
			var newPrevious = [].concat(previous)
			newPrevious.shift()
			newPrevious.push(variable)
			extendMacroChain(newPrevious, ourDepth+1, editId)
		}
		
		var value
		var variable
		var attachedListeners = listenerSet()
		
		var resultListener = {
			set: function(v, old, editId){

				//console.log(rr + ' set: ' + v + ' ' + old + ' ' + value)
				//console.log(new Error().stack)
				
				_.assert(old === undefined || old !== v)
				_.assert(value !== v)
				value = v
				
				attachedListeners.emitSet(v, old, editId)
				
				if(old !== undefined){
					--count[old]
					//console.log('reducing count: ' + old)
					if(count[old] === 0){
						values.splice(values.indexOf(old), 1)
						delete count[old]
						listeners.emitRemove(old, editId)
						//console.log(rr + ' removing: ' + old)
					}
				}
				if(v !== undefined){
					if(count[v] === undefined){
						count[v] = 0
						values.push(v)
						//console.log(rr +' adding: ' + v)
						listeners.emitAdd(v, editId)
					}
					++count[v]

					if(depth > ourDepth+1){
						//console.log('descending: ' + (ourDepth + 1))
						extendSelf(editId)
					}else{
						isLeaf = true
					}
				}/*else{
					//console.log(rr+' detaching: ' + old)
					attachedTo.detach(resultListener, editId)
				}*/
			},
			includeView: vi.includeView,
			removeView: vi.includeView
		}

		variable = {
			name: 'traverse-macro-result',
			attach: function(listener, editId){

				attachedListeners.add(listener)
				if(value !== undefined){
					listener.set(value, undefined, editId)
				}
			},
			detach: function(listener, editId){
				attachedListeners.remove(listener)
				if(editId && value !== undefined){
					listener.set(undefined, value, editId)
				}
			},
			listener: resultListener,
			descend: function(path, editId, cb){
				//_.errout('TODO');
				attachedTo.descend(path, editId, cb)
			},
			key: '*'+attachedTo.key,
			oldest: attachedTo.oldest,
			depthChange: depthChange
		}
		
		variables.push(variable)

		isAttached = true
		attachedTo.attach(resultListener, editId)		
	}
	
	
	
	function extendMacroChain(previous, ourDepth, editId){
	
		var newBindings = _.extend({},bindings)
		
		for(var i=0;i<previous.length;++i){
			newBindings[implicits[i]] = previous[i]
		}
		var m = concreteGetter(newBindings, editId)

		makeResultListener(previous, ourDepth, m, editId)
	}
	
	function reduceMacroChain(correctDepth, editId){
		//console.log('reduce macro chain: ' + correctDepth)
		
		while(macroChain.length > correctDepth){
			var mc = macroChain.pop()
			var rl = resultListeners.pop()
			mc.detach(rl.listener, editId)
		}
	}
	
	var initialized = false
	
	depthVariable.attach({
		set: function(v, old, editId){
			//console.log(' got depth: ' + v)

			depth = v

			if(v !== undefined && !initialized){
				initialized = true
				root = extendMacroChain(paramVariables, 0, editId)
				//console.log('initialized: ' + v + ' ' + values.length)
			}
			
			variables.forEach(function(v){
				v.depthChange(depth, editId)
			})
		},
		includeView: function(){_.errout('ERROR');},
		removeView: function(){_.errout('ERROR');}
	}, editId)

	var handle = {
		name: 'traverse-single',
		attach: function(listener, editId){
			_.assertFunction(listener.objectChange)
			
			//console.log(rr + ' listener added ************8 ' + values.length)
			listeners.add(listener)

			values.forEach(function(v){listener.add(v, editId)})
			
			//listeners.emitRemove(1, editId)
		},
		detach: function(listener, editId){

			//console.log(rr+' listener removed ************8 ' + values.length)

			listeners.remove(listener)
			if(editId){
				values.forEach(function(v){listener.remove(v, editId)})
			}
		},
		oldest: oldest,
		key: key,
		descend: function(path, editId, cb){
			//_.errout('TODO')
			for(var i=0;i<paramVariables.length;++i){
				var pv = paramVariables[i]
				if(pv.descend){
					var worked = pv.descend(path, editId, cb)
					if(worked) return true
				}
			}
			for(var i=0;i<variables.length;++i){
				var pv = variables[i]
				if(pv.descend){
					var res = pv.descend(path, editId, cb)
					if(res) return res
				}else{
					console.log('has no descendTypes: ' + pv.name)
				}
			}
			return false
		}
	}
		
	return cache.store(key, handle)
}

