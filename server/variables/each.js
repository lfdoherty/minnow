"use strict";

//var Cache = require('./../variable_cache')

var schema = require('./../../shared/schema')
var listenerSet = require('./../variable_listeners')
var viewInclude = require('./../viewinclude')
var bubble = require('./bubble')

var _ = require('underscorem')

function stub(){}

var eachSubsetOptimization = require('./each_subset_optimization')

function eachType(rel, ch){

	var inputType = rel.params[0].schemaType

	var singleInputType = inputType.members

	if(singleInputType === undefined) _.errout('invalid input type for each: ' + JSON.stringify(inputType))
	
	_.assertDefined(singleInputType)
	var newBindings = {}
	var implicits = rel.params[1].implicits
	_.assertArray(implicits)

	newBindings[implicits[0]] = singleInputType

	var realValueType = ch.computeMacroType(rel.params[1], ch.bindingTypes, newBindings, implicits)
	var valueType = realValueType
	
	while(valueType.type === 'set' || valueType.type === 'list'){
		valueType = valueType.members;
	}
	if(valueType.type === 'map'){
		_.errout('internal error: values of result of each is a map')
	}
	if(inputType.type === 'set'){
		return {type: 'set', members: valueType}
	}else if(inputType.type === 'list'){
		if(realValueType.type === 'primitive' || realValueType.type === 'object'){
			return {type: 'list', members: valueType}
		}else{
			return {type: 'set', members: valueType}//if merging is part of the each result, it must lose its ordering
		}
	}else{
		_.errout('TODO?: ' + JSON.stringify(rel))
	}
}
schema.addFunction('each', {
	schemaType: eachType,
	implementation: eachMaker,
	minParams: 2,
	maxParams: 2,
	callSyntax: 'each(collection,macro)'
})

var bubbleImpl = {
	key: function(params){
		return params[0].key + ':' + params[1].key
	},
	name: 'general-each',
	macros: true,
	macroParamTypes: function(i, paramTypes){
		_.assertEqual(i, 1)
		console.log(JSON.stringify(paramTypes, null, 2))
		return [paramTypes[0].members]
	},
	/*update: {
		0: {
			addBefore: function(v, s){
				
			},
			add: function(result, s){
				s.counts.increment(result)
			},
			removeBefore: function(v, s){
				
			},
			remove: function(result, s){
				s.counts.decrement(result)
			}
		}
	},*/
	prepare: function(s, params, z){
		var inputSet = params[0]
		var macro = params[1]
		inputSet.each(function(v){
			macro.prepare(v)
		})
	},
	compute: function(s, params, z){
		
		_.assertLength(params, 2)

		var inputSet = params[0]
		var macro = params[1]
		
		s.counts = z.countMap(true)
		
		inputSet.each(function(v){
			var res = macro.result(v)
			//_.assertPrimitive(res)
			if(_.isArray(res)){
				//_.errout('TODO')
				res.forEach(function(resV){
					console.log(v + ' resV ' + resV)
					s.counts.increment(resV)
				})
			}else if(res !== undefined){
			
				console.log(v + ' res ' + res)
				s.counts.increment(res)
			}
		})

		return s.counts.values
	}
}

function eachMaker(s, self, rel, typeBindings){

	//console.log('##### making each: ' + JSON.stringify(rel))
	//console.log(new Error().stack)
	
	var inputType = rel.params[0].schemaType.type
	if(inputType !== 'set' && inputType !== 'list'){
		throw new Error('each param 1 must be a collection, not: ' + JSON.stringify(rel.params[0].schemaType))
	}

	var cache = s.makeCache()//new Cache(s.analytics)
	s = _.extend({}, s)
	s.outputType = rel//.params[1].schemaType
	if(rel.params[1].type === 'macro' || rel.params[1].type === 'partial-application' || rel.params[1].type === 'param'){
	

		res = eachSubsetOptimization.make(s, self, rel, typeBindings)
		if(res !== undefined) return res
		
		//console.log('subset optimization failed for: ' + JSON.stringify(rel))

		var contextGetter = self(rel.params[0], typeBindings)
	
		var newTypeBindings = _.extend({}, typeBindings)
		newTypeBindings[rel.params[1].implicits[0]] = contextGetter//rel.params[0].schemaType.members
		//console.log('extended type bindings with each param: ' + JSON.stringify(newTypeBindings))
		var exprGetter = self(rel.params[1], newTypeBindings)//typeBindings)
		//console.log(JSON.stringify(rel.params[1]))
	
		if(contextGetter.wrapAsSet === undefined) _.errout('context missing wrapAsSet: ' + JSON.stringify(rel.params[0]))
		if(exprGetter.wrapAsSet === undefined) _.errout('missing wrapAsSet: ' + JSON.stringify(rel.params[1]))
		_.assertFunction(exprGetter.wrapAsSet)
		//console.log(JSON.stringify(rel.params[0]))
		_.assertFunction(contextGetter.wrapAsSet)

		var res
		
		/*rel.params[1].manyImplicits = 1
		res = bubble.wrap(bubbleImpl, s, cache, [contextGetter, exprGetter], [rel.params[0], rel.params[1]], rel)
		res.schemaType = rel.schemaType
		res.wrappers = exprGetter.wrappers
		res.wrapAsSet = function(v, editId, context){
			return exprGetter.wrapAsSet(v, editId, context)
		}
		return res*/
	
		var t = rel.params[1].schemaType
		if(t.type === 'set' || t.type === 'list'){
			res = svgEachMultiple.bind(undefined, s, rel.params[1].implicits, cache, exprGetter, contextGetter)
			_.assertObject(rel.schemaType)
			res.schemaType = rel.schemaType
			res.wrappers = exprGetter.wrappers
			res.wrapAsSet = function(v){
				return exprGetter.wrapAsSet(v)
			}
		}else{
			var isView
			if(rel.params[1].schemaType.type == 'view'){
				//console.log(JSON.stringify(rel.params[1]))
				//console.log(require('util').inspect(exprGetter))
				_.assertObject(exprGetter.wrappers)
				isView = true
			}
			res = svgEachSingle.bind(undefined, s, rel.params[1].implicits, cache, exprGetter, contextGetter, isView)
			_.assertObject(rel.schemaType)
			res.schemaType = rel.schemaType
			res.wrappers = exprGetter.wrappers
			res.wrapAsSet = function(v, editId, context){
				return exprGetter.wrapAsSet(v, editId, context)
			}
		}
		return res
	}else{
		_.errout('TODO: ' + JSON.stringify(rel))//TODO this is probably just a syntax error
	}
}

function copyBindings(bindings){
	var newBindings = Object.create(null)
	Object.keys(bindings).forEach(function(key){
		newBindings[key] = bindings[key]
	})
	return newBindings
}

function svgEachMultiple(s, implicits, cache, exprExprGetter, contextExprGetter, bindings, editId){

	var elements = contextExprGetter(bindings, editId)

	var concreteGetter = exprExprGetter(bindings, editId)
	_.assertDefined(concreteGetter.key)
	
	var key = elements.key+':'+concreteGetter.key
	if(cache.has(key)) return cache.get(key)
	
	var listeners = listenerSet()
	
	var allSets = {}
	var counts = {}
	var values = []
	
	var cachedObjectChanges = []
	
	//var should = {}
	//var shouldCounts = {}
	
	var resultSetListener = {
		add: function(value, editId){
			//console.log('each got add: ' + value)
			if(!counts[value]){
				counts[value] = 1
				listeners.emitAdd(value, editId)
				values.push(value)
			}else{
				++counts[value]
			}
		},
		remove: function(value, editId){
			if(counts[value] === 1){
				delete counts[value]
				listeners.emitRemove(value, editId)
				values.splice(values.indexOf(value), 1)
			}else{
				--counts[value]
			}
		},
		objectChange: function(typeCode, id, path, op, edit, syncId, editId){
			//console.log('each passing on objectChange to ' + listeners.many())
			_.errout('TODO?')
			var e = [typeCode, id, path, op, edit, syncId, editId]
			cachedObjectChanges.push(e)
			listeners.emitObjectChange(typeCode, id, path, op, edit, syncId, editId)
		},
		includeView: listeners.emitIncludeView.bind(listeners),
		removeView: listeners.emitRemoveView.bind(listeners)
	}
	
	function oldest(){
		var oldestEditId = elements.oldest()
		Object.keys(allSets).forEach(function(key){
			var valueSet = allSets[key]
			var old = valueSet.oldest()
			if(old < oldestEditId) oldestEditId = old
		})
		return oldestEditId
	}
	
	var elementsListener = {
		add: function(v, editId){
			//console.log('adding: ' + v)
			var newBindings = copyBindings(bindings)
			var ss = contextExprGetter.wrapAsSet(v, editId, elements)
			if(ss.isType) _.errout('isType')
			newBindings[implicits[0]] = ss
			var newSet = concreteGetter(newBindings, editId)
			//console.log('multiple each attaching to macro: ' + key)
			//console.log(JSON.stringify(s.outputType))
			allSets[v] = newSet
			newSet.attach(resultSetListener, editId)
		},
		remove: function(v, editId){
			//console.log('remove -000000000')
			var removedSet = allSets[v]
			removedSet.detach(resultSetListener, editId)
		},
		objectChange: function(typeCode, id, path, op, edit, syncId, editId){
			_.errout('TODO?')
		},
		includeView: listeners.emitIncludeView.bind(listeners),
		removeView: listeners.emitRemoveView.bind(listeners)
	}
	elements.attach(elementsListener, editId)
	
	var handle = {
		name: 'each-multiple (' + elements.name+')',
		attach: function(listener, editId){
			_.assertFunction(listener.objectChange)
			
			listeners.add(listener)
			//console.log('multiple: ' + new Error().stack)
			//console.log(JSON.stringify(s.outputType))
			/*Object.keys(should).forEach(function(key){
				var id = should[key]
				listener.shouldHaveObject(id, true, editId)
			})*/
			values.forEach(function(v){listener.add(v, editId)})
			cachedObjectChanges.forEach(function(v){
				listener.objectChange.apply(undefined, v)
			})
		},
		detach: function(listener, editId){
			listeners.remove(listener)
			if(editId){
				/*Object.keys(should).forEach(function(key){
					var id = should[key]
					listener.shouldHaveObject(id, false, editId)
				})*/
				values.forEach(function(v){listener.remove(v, editId)})
			}
		},
		oldest: oldest,
		key: key,
		descend: function(path, editId, cb){
			//_.errout('TODO: ' + JSON.stringify(path) + ' ' + elements.name + ' ' + JSON.stringify(bindings))
			return elements.descend(path, editId, cb)
		},
		getTopParent: function(id){
			return elements.getTopParent(id)
		},
		destroy: function(){
			handle.attach = handle.detach = handle.oldest = handle.destroy = function(){_.errout('destroyed');}
			elements.detach(elementsListener)
			Object.keys(allSets).forEach(function(k){
				var set = allSets[k]
				set.detach(resultSetListener)
			})
			listeners.destroyed()
		}
	}
		
	return cache.store(key, handle)
}


function svgEachSingle(s, implicits, cache, exprGetter, contextGetter, isView, bindings, editId){
	var elements = contextGetter(bindings, editId)

	var concreteGetter = exprGetter(bindings, editId)
	
	var key = elements.key+':'+concreteGetter.key
	if(cache.has(key)) return cache.get(key)
	
	var listeners = listenerSet()
	
	var allSets = {}
	var counts = {}
	var values = []
	
	var producingSet = {}

	var vi = viewInclude.make(listeners)

	//TODO extract to top-level
	function ResultSetListener(sourceSet){
		this._sourceSet = sourceSet
	}	
	ResultSetListener.prototype.set = function(value, oldValue, editId){
		if(oldValue !== undefined){
			--counts[oldValue]
			if(counts[oldValue] === 0){
				delete counts[oldValue]
				values.splice(values.indexOf(oldValue), 1)
				listeners.emitRemove(oldValue, editId)
			}
		}
		//console.log('value: ' + value)
		if(value !== undefined && (!isView || value !== '')){
			if(!counts[value]){
				counts[value] = 1
				//console.log('result set adding: ' + value)
				producingSet[value] = this._sourceSet
				listeners.emitAdd(value, editId)
				values.push(value)
			}else{
				++counts[value]
			}
		}
	}
	ResultSetListener.prototype.includeView = vi.includeView
	ResultSetListener.prototype.removeView = vi.removeView
	
	function oldest(){
		var oldestEditId = elements.oldest()
		Object.keys(allSets).forEach(function(key){
			var valueSet = allSets[key]
			var old = valueSet.set.oldest()
			if(old < oldestEditId) oldestEditId = old
		})
		//console.log('each oldest ' + oldestEditId + ' ' + elements.oldest())
		return oldestEditId
	}
	
	var elementsListener = {
		add: function(v, editId){
			var newBindings = copyBindings(bindings)
			//console.log(JSON.stringify(Object.keys(elements)))
			//s.log('key: ' + elements.key + ' ' + v + ' ' + editId)
			//console.log('attach: ' + elements.attach)
			//console.log('add')
			console.log('adding each id: ' + JSON.stringify(v))
			var ss = newBindings[implicits[0]] = contextGetter.wrapAsSet(v, editId, elements)
			if(ss.isType) throw new Error('is type')
			var newSet = concreteGetter(newBindings, editId)
			//console.log('attaching to: ' + newSet.name)
			_.assertUndefined(allSets[v])
			var as = allSets[v] = {set: newSet, resultSetListener: new ResultSetListener(newSet)}
			_.assertFunction(as.resultSetListener.set)
			newSet.attach(as.resultSetListener, editId)
		},
		remove: function(v, editId){
			var removedSet = allSets[v]
			_.assertDefined(removedSet)
			//_.assertNot(removedSet.blah)
			delete allSets[v]
			removedSet.blah = true
			removedSet.set.detach(removedSet.resultSetListener, editId)
		},
		objectChange: stub,//ignore object changes - that's the result set listener's job?
		includeView: vi.includeView,
		removeView: vi.includeView
	}
	elements.attach(elementsListener, editId)
	
	/*function descend(path, editId, cb){
		//call the correct newSet's descend method based on the root object of the path
		var id = path[0].edit.id
		_.assertInt(id)
		
		_.errout('TODO REMOVEME')
		
		var ps = producingSet[id]
		if(ps === undefined){
			//console.log('known ids: ' + JSON.stringify(Object.keys(allSets)))
			//console.log('WARNING: each does not know id: ' + path[0].edit.id)
			return
			//_.errout('error, tried to descend into unknown object path: ' + JSON.stringify(path))
		}
		return ps.descend(path, editId, cb)
	}*/
	
	var handle = {
		name: 'each-single',
		attach: function(listener, editId){
			listeners.add(listener)

			vi.include(listener, editId)
			
			values.forEach(function(v){listener.add(v, editId)})

		},
		detach: function(listener, editId){
			listeners.remove(listener)
			//console.log('IN EACH')
			if(editId){
				values.forEach(function(v){listener.remove(v, editId)})
			}
		},
		//descend: descend,
		streamProperty: function(id, pc, editId, cb, continueListening){
			var ps = producingSet[id]
			if(ps){
				ps.streamProperty(id, pc, editId, cb, continueListening)
			}else{
				elements.streamProperty(id, pc, editId, cb, continueListening)
			}
		},//elements.streamProperty,
		getTopParent: function(id){
			var ps = producingSet[id]
			if(ps === undefined){
				return
			}
			if(!ps.getTopParent) _.errout('no getTopParent: ' + ps.name)
			return ps.getTopParent(id)
		},
		oldest: oldest,
		key: key,
		destroy: function(){
			handle.oldest = handle.attach = handle.detach = handle.destroy = function(){_.errout('destroyed');}
			elements.detach(elementsListener)
			Object.keys(allSets).forEach(function(k){
				var set = allSets[k]
				//if(set.blah) _.errout('blah!')
				if(!set.set.detach) _.errout('missing detach: ' + set.set.name)
				set.set.detach(set.resultSetListener)
			})
			allSets = undefined
			listeners.destroyed()
		}
	}
		
	return cache.store(key, handle)
}
