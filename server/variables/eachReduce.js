"use strict";

var Cache = require('./../variable_cache')

var schema = require('./../../shared/schema')
var listenerSet = require('./../variable_listeners')
var viewInclude = require('./../viewinclude')

var _ = require('underscorem')

function stub(){}

//var eachSubsetOptimization = require('./each_subset_optimization')

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
	
	var implicits2 = rel.params[2].implicits
	var moreBinding = {}
	moreBinding[implicits2[0]] = valueType
	moreBinding[implicits2[1]] = valueType
	var resultType = ch.computeMacroType(rel.params[2], ch.bindingTypes, moreBinding)
	
	return resultType
	
	//if(inputType.type === 'set'){
	//	return valueType
	/*}else if(inputType.type === 'list'){
		if(realValueType.type === 'primitive' || realValueType.type === 'object'){
			return {type: 'list', members: valueType}
		}else{
			return {type: 'set', members: valueType}//if merging is part of the each result, it must lose its ordering
		}
	}else{
		_.errout('TODO?: ' + JSON.stringify(rel))
	}*/
}
schema.addFunction('eachReduce', {
	schemaType: eachType,
	implementation: eachMaker,
	minParams: 3,
	maxParams: 3,
	callSyntax: 'eachReduce(collection,macro,macro)'
})

function eachMaker(s, self, rel, typeBindings){

	//console.log('##### making each: ' + JSON.stringify(rel))
	//console.log(new Error().stack)
	
	var inputType = rel.params[0].schemaType.type
	if(inputType !== 'set' && inputType !== 'list'){
		throw new Error('each param 1 must be a collection, not: ' + JSON.stringify(rel.params[0].schemaType))
	}

	var cache = new Cache(s.analytics)
	s = _.extend({}, s)
	s.outputType = rel//.params[1].schemaType
	if(rel.params[1].type === 'macro' || rel.params[1].type === 'partial-application' || rel.params[1].type === 'param'){
	
		var res;
		
		//res = eachSubsetOptimization.make(s, self, rel, typeBindings)
		//if(res !== undefined) return res

		var contextGetter = self(rel.params[0], typeBindings)
	
		var newTypeBindings = _.extend({}, typeBindings)
		newTypeBindings[rel.params[1].implicits[0]] = contextGetter//rel.params[0].schemaType.members
		//console.log('extended type bindings with each param: ' + JSON.stringify(newTypeBindings))
		var exprGetter = self(rel.params[1], newTypeBindings)//typeBindings)
		//console.log(JSON.stringify(rel.params[1]))

		var reduceGetter = self(rel.params[2], newTypeBindings)//typeBindings)
	
		if(contextGetter.wrapAsSet === undefined) _.errout('context missing wrapAsSet: ' + JSON.stringify(rel.params[0]))
		if(exprGetter.wrapAsSet === undefined) _.errout('missing wrapAsSet: ' + JSON.stringify(rel.params[1]))
		_.assertFunction(exprGetter.wrapAsSet)
		//console.log(JSON.stringify(rel.params[0]))
		_.assertFunction(contextGetter.wrapAsSet)
	
		var t = rel.params[1].schemaType
		if(t.type === 'set' || t.type === 'list'){
			/*res = svgEachMultiple.bind(undefined, s, rel.params[1].implicits, cache, exprGetter, contextGetter)
			_.assertObject(rel.schemaType)
			res.schemaType = rel.schemaType
			res.wrappers = exprGetter.wrappers
			res.wrapAsSet = function(v){
				return exprGetter.wrapAsSet(v)
			}*/
			_.errout('TODO')
		}else{
			var isView
			if(rel.params[1].schemaType.type == 'view'){
				//console.log(JSON.stringify(rel.params[1]))
				//console.log(require('util').inspect(exprGetter))
				_.assertObject(exprGetter.wrappers)
				isView = true
			}
			res = svgEachSingle.bind(undefined, s, rel.params[1].implicits, cache, exprGetter, contextGetter, reduceGetter, isView)
			_.assertObject(rel.schemaType)
			res.schemaType = rel.schemaType
			res.wrappers = exprGetter.wrappers
			res.wrapAsSet = function(v, editId, context){
				return exprGetter.wrapAsSet(v, editId, context)
			}
		}
		return res
	}/*else if(rel.params[1].type === 'view'){
		var gm = s.globalMacros[rel.params[1].view]
		_.assertObject(gm)
		_.errout('TODO gm')
	}*/else{
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
/*
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
			

			values.forEach(function(v){listener.add(v, editId)})
			cachedObjectChanges.forEach(function(v){
				listener.objectChange.apply(undefined, v)
			})
		},
		detach: function(listener, editId){
			listeners.remove(listener)
			if(editId){

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
*/

function svgEachSingle(s, implicits, cache, exprGetter, contextGetter, reduceGetter, isView, bindings, editId){
	var elements = contextGetter(bindings, editId)

	var concreteGetter = exprGetter(bindings, editId)
	
	var key = elements.key+':'+concreteGetter.key
	if(cache.has(key)) return cache.get(key)
	
	var listeners = listenerSet()
	
	var allSets = {}
	var counts = {}
	var values = []
	
	var producingSet = {}

	var cReduceGetter = reduceGetter.asSyncMacro(bindings, editId)
	_.assert(cReduceGetter.isSyncMacro)
	
	var result;
	var oldValue
	function computeResult(editId){
		_.assertInt(editId)
		
		if(values.length === 0){
			result = undefined
			return
		}/*else if(values.length === 1){
			result = values[0]
			return
		}*/
		
		var v = values[0]
		//console.log('reducing ' + JSON.stringify(counts))
		for(var i=0;i<values.length;++i){
			var ov = values[i]
			var count = counts[ov]
			if(i === 0) --count
			//console.log('reducing ' + ov + ' ' + count)
			for(var j=0;j<count;++j){
				//console.log('reducing for eachReduce ' + v + ' ' + ov)
				v = cReduceGetter(v, ov)
			}
		}
		result = v
		if(result !== oldValue){
			listeners.emitSet(result, oldValue, editId)
		}
		oldValue = result
	}

	var vi = viewInclude.make(listeners)

	//TODO extract to top-level
	function ResultSetListener(sourceSet){
		this._sourceSet = sourceSet
	}	
	ResultSetListener.prototype.set = function(value, oldValue, editId){
		_.assertInt(editId)
		
		if(oldValue !== undefined){
			--counts[oldValue]
			if(counts[oldValue] === 0){
				delete counts[oldValue]
				values.splice(values.indexOf(oldValue), 1)
				//listeners.emitRemove(oldValue, editId)
			}
			computeResult(editId)
		}
		//console.log('value: ' + value)
		if(value !== undefined && (!isView || value !== '')){
			//console.log('set: ' + value + ' ' + counts[value])
			if(!counts[value]){
				counts[value] = 1
				//console.log('result set adding: ' + value)
				producingSet[value] = this._sourceSet
				//listeners.emitAdd(value, editId)
				values.push(value)
			}else{
				++counts[value]
			}
			computeResult(editId)
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
			//console.log('adding each id: ' + v)
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
	
	function descend(path, editId, cb){
		//call the correct newSet's descend method based on the root object of the path
		var id = path[0].edit.id
		_.assertInt(id)

		var ps = producingSet[id]
		if(ps === undefined){
			//console.log('known ids: ' + JSON.stringify(Object.keys(allSets)))
			//console.log('WARNING: each does not know id: ' + path[0].edit.id)
			return
			//_.errout('error, tried to descend into unknown object path: ' + JSON.stringify(path))
		}
		return ps.descend(path, editId, cb)
	}
	
	var handle = {
		name: 'eachReduce-single',
		attach: function(listener, editId){
			listeners.add(listener)

			vi.include(listener, editId)
			
			//values.forEach(function(v){listener.add(v, editId)})
			if(result){
				listener.set(result, undefined, editId)
			}

		},
		detach: function(listener, editId){
			listeners.remove(listener)
			//console.log('IN EACH')
			if(editId){
				//values.forEach(function(v){listener.remove(v, editId)})
				listener.set(undefined, result, editId)
			}
		},
		descend: descend,
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
				if(set.blah) _.errout('blah!')
				set.detach(set.resultSetListener)
			})
			allSets = undefined
			listeners.destroyed()
		}
	}
		
	return cache.store(key, handle)
}
