"use strict";

var schema = require('./../../shared/schema')
//var viewInclude = require('./../viewinclude')


var _ = require('underscorem')

function stub(){}

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
	minParams: 3,
	maxParams: -1,
	callSyntax: 'traverse(params...,macro,maxDepth)',
	computeAsync: function(z, cb){
		var args = Array.prototype.slice.call(arguments, 2)
		var maxDepth = args[args.length-1]
		var macro = args[args.length-2]
		var rest = args.slice(0, args.length-2)
		
		if(!_.isInt(maxDepth)){
			cb([])
			return
		}
		
		//console.log('computing traverse: ' + JSON.stringify([rest, maxDepth]))
		
		var results = []
		var has = {}
		function addResult(result){
			if(result === undefined) return
			if(has[result]) return
			has[result] = true
			results.push(result)
		}
		
		descend(rest, 1, function(){
			//console.log('traverse result: ' + JSON.stringify([rest, maxDepth]) + ' ' + JSON.stringify(results))
			cb(results)
		})
		
		function descend(params, depth,cb){
			if(depth >= maxDepth){
				cb()
				return
			}
			setImmediate(function(){
				macro.getArray(params, function(result){
					if(_.isArray(result)){
						if(result.length === 0){
							cb()
							return
						}
						var cdl = _.latch(result.length, cb)
						result.forEach(function(r){
							addResult(r)
							var newParams = params.slice(1)
							newParams.push(r)
							descend(newParams, depth+1, cdl)
						})
					}else{
						addResult(result)
						var newParams = params.slice(1)
						newParams.push(result)
						descend(newParams, depth+1, cb)
					}
				})
			})
		}
	}
})
/*
function traverseMaker(s, self, rel, typeBindings){

	var macroParam = rel.params[rel.params.length-2]
	var depthParam = rel.params[rel.params.length-1]
	var inputParams = rel.params.slice(0, rel.params.length-2)

	var cache = s.makeCache()//new Cache(s.analytics)
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
	var leaves = []
	
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
	
	function makeResultListener(previous, ourDepth, f, editId){
		
		//console.log('made result listener: ' + ourDepth)
		var attachedTo = f()
		
		function extendSelf(v, editId){
			var newPrevious = [].concat(previous)
			newPrevious.shift()
			var mv = makeMacroVariable(v)
			newPrevious.push(mv)
			extendMacroChain(newPrevious, ourDepth+1, editId)
		}
		
		var value = []
		var variable
		var attachedListeners = listenerSet()
		
		var resultListener = {
			add: function(v, editId){
				//_.assertPrimitive(v)
				value.push(v)
				
				//console.log('added value: ' + v + ' ' + JSON.stringify(count))
				//console.log(new Error().stack)
				
				attachedListeners.emitAdd(v, editId)				
				
				if(count[v] === undefined){
					count[v] = 0
					values.push(v)
					listeners.emitAdd(v, editId)
				}
				++count[v]
				
				if(depth > ourDepth+1){
					//console.log('descending: ' + (ourDepth + 1))
					extendSelf(v, editId)
				}else{
					if(!isLeaf){
						leaves.push(variable)
					}
					isLeaf = true
				}
			},
			remove: function(v, editId){
			
				//console.log('removed value: ' + v + ' ' + JSON.stringify(count))

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
		
		var isLeaf = false
		var isAttached = false
		
		function depthChange(d, editId){
			//console.log('depth change ' + d + ' ' + ourDepth + ' ' + JSON.stringify(value) + ' ' + attachedTo.name + ' ' + isAttached + ' ' + isLeaf)
			if(d < ourDepth){
				if(isAttached){
					attachedTo.detach(resultListener, editId)

					isAttached = false
				}
				
				_.assertEqual(attachedListeners.many(), 0)
				variables.splice(variables.indexOf(variable), 1)
				//console.log('discarded: ' + JSON.stringify(value))
			}else if(d === ourDepth){
				isLeaf = true
				//console.log('leaf')
				if(isAttached){
					attachedTo.detach(resultListener, editId)
					isAttached = false

					_.assertEqual(attachedListeners.many(), 0)				
					variables.splice(variables.indexOf(variable), 1)
					leaves.push(variable)
				}
			}else if(d > ourDepth){
				if(isLeaf){
					isLeaf = false
					leaves.splice(leaves.indexOf(variable), 1)
				}
				
				//_.assert(!isAttached)
				if(!isAttached){
					attachedTo = f()
					value.forEach(function(v){
						extendSelf(v, editId, attachedTo)
					})
					variables.push(variable)
					attachedTo.attach(resultListener, editId)
					isAttached = true
				}
			}
		}
		
		
		function makeMacroVariable(v){
			_.assertDefined(v)
			
			var listeners = listenerSet()
			
			var mv = {
				name: 'traverse-macro-variable',
				attach: function(listener, editId){

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
				getTopParent: function(id){
					if(!attachedTo.getTopParent) _.errout('missing getTopParent: ' + attachedTo.name)
					return attachedTo.getTopParent(id)
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

			streamProperty: attachedTo.streamProperty,
			getTopParent: function(id){
				return attachedTo.getTopParent(id)
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
		_.assertInt(editId)
	
		//var prevKey = ''
		var newBindings = _.extend({},bindings)
		
		for(var i=0;i<previous.length;++i){
			newBindings[implicits[i]] = previous[i]
			//prevKey += previous[i].key+','
		}
		
		//console.log('extending: ' + prevKey + ' ' + ourDepth)
		
		
		//var m = 
		var f = function(){
			return concreteGetter(newBindings, editId)
		}
		//console.log('extending macro chain: ' + ourDepth)// + ' '+ require('util').inspect(newBindings))


		makeResultListener(previous, ourDepth, f, editId)
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
	
	var depthListener = {
		set: function(v, old, editId){
			//console.log(' got depth: ' + v)

			depth = v

			if(v !== undefined && !initialized){
				initialized = true
				root = extendMacroChain(paramVariables, 0, editId)
				//console.log('initialized: ' + v + ' ' + values.length)
			}
			
			[].concat(variables).concat(leaves).reverse().forEach(function(v){
				v.depthChange(depth, editId)
			})
		},
		includeView: function(){_.errout('ERROR');},
		removeView: function(){_.errout('ERROR');}
	}
	depthVariable.attach(depthListener, editId)
	
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
		},
		getTopParent: function(id){
			if(s.objectState.isTopLevelObject(id)) return id
			
			for(var i=0;i<paramVariables.length;++i){
				var pv = paramVariables[i]
				if(pv.getTopParent){
					var worked = pv.getTopParent(id)
					if(worked) return true
				}else{
					console.log('has no getTopParent: ' + pv.name)
				}
			}
			for(var i=0;i<variables.length;++i){
				var pv = variables[i]
				if(pv.getTopParent){
					var res = pv.getTopParent(id)
					if(res) return res
				}else{
					console.log('has no getTopParent: ' + pv.name)
				}
			}
			return false
		},
		destroy: function(){
			depthVariable.detach(depthListener);
			//reduceMacroChain(0)
			[].concat(variables).reverse().forEach(function(v){
				v.depthChange(0)
			})
			listeners.destroyed()
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
	var leaves = []
	
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
		variables.forEach(f)
		paramVariables.forEach(f)
		return oldestEditId
	}
	
	
	var values = []
	var count = {}
	
	var root;
	
	function makeResultListener(previous, ourDepth, f, editId){
		
		//console.log(rr+' made result listener: ' + ourDepth)
		var attachedTo = f()
		
		var isLeaf = false
		var isAttached = false
		
		function depthChange(d, editId){
			//console.log('got depth change: ' + d + ' ' + ourDepth)
			if(d < ourDepth+1){
				if(isAttached){
					attachedTo.detach(resultListener, editId)
					//variable.destroy()
					variables.splice(variables.indexOf(variable), 1)
					isAttached = false
				}
			}else if(d === ourDepth+1){
				if(isAttached){
					attachedTo.detach(resultListener, editId)
					//variable.destroy()
					variables.splice(variables.indexOf(variable), 1)
					isAttached = false
				}
				if(!isLeaf){
					leaves.push(variable)
					isLeaf = true
				}
			}else if(d > ourDepth+1){
				if(isLeaf){
					leaves.splice(leaves.indexOf(variable), 1)
				}
				isLeaf = false
				extendSelf(editId)
				if(!isAttached){
					isAttached = true
					attachedTo = f()
					//remakeVariable()
					//variables.push(variable)
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

					if(depth > ourDepth + 1){
						//console.log('descending: ' + (ourDepth + 1))
						//console.log('extending: ' + (ourDepth + 1))
						extendSelf(editId)
					}else{
						//console.log('leaf: ' + (ourDepth+1) + ' ' + depth)
						
						isLeaf = true
					}
				}else{
					
				}
			},
			includeView: vi.includeView,
			removeView: vi.includeView
		}

		function remakeVariable(){
			value = undefined
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
					//console.log('detaching traverse-macro-result')
					if(editId && value !== undefined){
						listener.set(undefined, value, editId)
					}
				},
				listener: resultListener,

				streamProperty: attachedTo.streamProperty,
				key: '*'+attachedTo.key,
				oldest: attachedTo.oldest,

			}
			variables.push(variable)
		}
		remakeVariable()		

		_.assert(depth > ourDepth)
		isAttached = true
		attachedTo.attach(resultListener, editId)		
	}
	
	
	
	function extendMacroChain(previous, ourDepth, editId){
	
		var newBindings = _.extend({},bindings)
		
		for(var i=0;i<previous.length;++i){
			newBindings[implicits[i]] = previous[i]
		}

		var f = function(){
			return concreteGetter(newBindings, editId)
		}
		makeResultListener(previous, ourDepth, f, editId)
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
	
	var depthListener = {
		set: function(v, old, editId){
			//console.log(' got depth: ' + v)

			depth = v

			if(v !== undefined && !initialized){
				initialized = true
				//console.log('extending macro chain')
				root = extendMacroChain(paramVariables, 1, editId)
				//console.log('initialized: ' + v + ' ' + values.length)
			}
			
			variables.concat(leaves).forEach(function(v){
				v.depthChange(depth, editId)
			})
		},
		includeView: function(){_.errout('ERROR');},
		removeView: function(){_.errout('ERROR');}
	}
	depthVariable.attach(depthListener, editId)

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
					console.log('has no descend: ' + pv.name)
				}
			}
			return false
		},
		destroy: function(){
			depthVariable.detach(depthListener);
			//reduceMacroChain(0)
			[].concat(variables).reverse().forEach(function(v){
				v.depthChange(-1)
			})
			listeners.destroyed()
		}
	}
		
	return cache.store(key, handle)
}*/

