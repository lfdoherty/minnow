"use strict";

var Cache = require('./../variable_cache')

var schema = require('./../../shared/schema')
var listenerSet = require('./../variable_listeners')
var viewInclude = require('./../viewinclude')

var _ = require('underscorem')

function stub(){}

var wrapParam = require('./syncplugins').wrapParam

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
	for(var i=0;i<inputParams.length;++i){
		newTypeBindings[implicits[i]] = inputType
		paramGetters.push(self(inputParams[i], typeBindings))
	}
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
		res = svgTraverseMultiple.bind(undefined, s, macroParam.implicits, cache, exprGetter, paramGetters, inputType, depthGetter)
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

function svgTraverseMultiple(s, implicits, cache, exprExprGetter, paramExprGetters, paramType, depthGetter, bindings, editId){
	_.errout('TODO')
}

function svgTraverseSingle(s, implicits, cache, exprExprGetter, paramExprGetters, paramType, depthGetter, bindings, editId){
	
	var paramVariables = []
	paramExprGetters.forEach(function(pg){
		var pv = pg(bindings, editId)
		_.assertDefined(pv)
		paramVariables.push(pv)
	})

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

	function changed(){
		_.errout('changed')
	}
	var ch = {changed: changed}

	var depthVariable = depthGetter(bindings, editId)

	var depth = 0
	
	var macroChain = []
	
	var resultListeners = []

	function oldest(){
		var oldestEditId = s.objectState.getCurrentEditId()
		function f(pv){
			var old = pv.oldest()
			if(old < oldestEditId) oldestEditId = old
		}
		paramVariables.forEach(f)
		macroChain.forEach(f)
		return oldestEditId
	}
	
	var values = []
	var count = {}
	
	function makeResultListener(attachedTo){
		
		var value
		
		var variable
		
		var attachedListener
		
		var resultListener = {
			set: function(v, old, editId){
				//console.log('set: ' + v)
				_.assert(old === undefined || old !== v)
				_.assert(value !== v)
				value = v
				
				if(attachedListener) attachedListener.set(v, old, editId)
				
				if(old !== undefined){
					--count[old]
					//console.log('reducing count: ' + old)
					if(count[old] === 0){
						values.splice(values.indexOf(old), 1)
						delete count[old]
						listeners.emitRemove(old, editId)
						//console.log('removing: ' + old)
					}
				}
				if(v !== undefined){
					if(count[v] === undefined){
						count[v] = 0
						values.push(v)
						listeners.emitAdd(v, editId)
					}
					++count[v]
					
					resultListener.has = true
					resultListener.hasValue = v
					//console.log('has: ' + v)
					
					if(macroChain.length === resultListeners.indexOf(variable) + 1){
						//console.log('extending: ' + v)
						extendMacroChain(editId)
					}
				}else{
					resultListener.has = false
					resultListener.hasValue = undefined

					//remove all subsequent
					//console.log('removing subsequent: '+(resultListeners.indexOf(variable)+1))
					reduceMacroChain(resultListeners.indexOf(variable)+1, editId)
				}
			},
			includeView: vi.includeView,
			removeView: vi.includeView,
			has: false,
			hasValue: undefined
		}

		var attached = false
		variable = {
			name: 'traverse-macro-result',
			attach: function(listener, editId){
				if(attached) _.errout('dup attach?')
				attached = true
				attachedListener = listener
				if(value !== undefined){
					listener.set(value, undefined, editId)
				}
			},
			detach: function(listener, editId){
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
			oldest: attachedTo.oldest
		}
		return variable
	}
	
	function extendMacroChain(editId){
	
		var newBindings = {}
		
		if(macroChain.length >= depth){
			return
		}
		
		for(var i=0;i<paramVariables.length;++i){
			var offset = (macroChain.length-1)-i
			var mc
			if(offset >= 0){
				mc = resultListeners[offset]
			}else{
				mc = paramVariables[paramVariables.length+offset]
			}
			//console.log('offset: ' + offset + ' ' + paramVariables.length + ' ' + macroChain.length)
			_.assertDefined(mc)
			newBindings[implicits[i]] = mc
		}
		
		var index = macroChain.length
		//console.log('new bindings: ' + JSON.stringify(newBindings))
		var m = concreteGetter(newBindings, editId)
		macroChain[index] = m
		//console.log('set macro chain: ' + index + ' ' + m.name)

		var rl = makeResultListener(m)
		resultListeners.push(rl)
		m.attach(rl.listener, editId)
	}
	
	function reduceMacroChain(correctDepth, editId){
		//console.log('reduce macro chain: ' + correctDepth)
		
		while(macroChain.length > correctDepth){
			var mc = macroChain.pop()
			var rl = resultListeners.pop()
			mc.detach(rl.listener, editId)
		}
	}
	
	depthVariable.attach({
		set: function(v, old, editId){
			//console.log('got depth: ' + v)
			if(v !== undefined){
				depth = v
				if(old !== undefined){
					if(v > old){
						extendMacroChain(editId)
					}else if(v < old && macroChain.length > v){
						reduceMacroChain(depth, editId)
					}
				}else if(depth > 0){
					extendMacroChain(editId)
				}
			}else{
				if(depth && depth > 0){
					depth = 0
					reduceMacroChain(depth, editId)
				}else{
					depth = 0
				}
			}
		},
		includeView: function(){_.errout('ERROR');},
		removeView: function(){_.errout('ERROR');}
	}, editId)
	
	var handle = {
		name: 'traverse-single',
		attach: function(listener, editId){
			_.assertFunction(listener.objectChange)
			
			listeners.add(listener)

			values.forEach(function(v){listener.add(v, editId)})
		},
		detach: function(listener, editId){
			listeners.remove(listener)
			if(editId){
				values.forEach(function(v){listener.remove(v, editId)})
			}
		},
		oldest: oldest,
		key: key,
		descend: function(){
			_.errout('TODO')
		}
	}
		
	return cache.store(key, handle)
}

