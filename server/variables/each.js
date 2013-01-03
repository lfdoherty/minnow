"use strict";

var Cache = require('./../variable_cache')

var schema = require('./../../shared/schema')
var listenerSet = require('./../variable_listeners')
var viewInclude = require('./../viewinclude')

var _ = require('underscorem')

function stub(){}

var eachSubsetOptimization = require('./each_subset_optimization')

function eachType(rel, ch){

	var inputType = rel.params[0].schemaType

	var singleInputType = inputType.members
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
		
		res = eachSubsetOptimization.make(s, self, rel, typeBindings)
		if(res !== undefined) return res

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
	
	elements.attach({
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
	}, editId)
	
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
		/*getType: function(v){
			if(elements.getType === undefined) _.errout('missing getType: ' + elements.name)
			return elements.getType(v)
		},*/
		descend: function(path, editId, cb){
			//_.errout('TODO: ' + JSON.stringify(path) + ' ' + elements.name + ' ' + JSON.stringify(bindings))
			return elements.descend(path, editId, cb)
		}/*,
		descendTypes: function(path, editId, cb){
			//_.errout('TODO: ' + JSON.stringify(path) + ' ' + elements.name + ' ' + JSON.stringify(bindings))
			return elements.descendTypes(path, editId, cb)
		}*/
	}
		
	return cache.store(key, handle)
}


function svgEachSingle(s, implicits, cache, exprGetter, contextGetter, isView, bindings, editId){
	var elements = contextGetter(bindings, editId)

	//if(!_.isFunction(elements.getType))_.errout('no getType: ' + elements.name)
	//if(!_.isFunction(elements.descendTypes)) _.errout('no descendTypes: ' + elements.name)

	var concreteGetter = exprGetter(bindings, editId)
	
	var key = elements.key+':'+concreteGetter.key
	if(cache.has(key)) return cache.get(key)
	
	var listeners = listenerSet()
	
	var allSets = {}
	var counts = {}
	var values = []
	
	var producingSet = {}

	//var cachedObjectChanges = []

	var vi = viewInclude.make(listeners)
	
	//console.log('name: ' + elements.name)
	//_.assertFunction(elements.descend)
	
	//var should = {}
	//var shouldCounts = {}

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
				console.log('result set adding: ' + value)
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
			var old = valueSet.oldest()
			if(old < oldestEditId) oldestEditId = old
		})
		//console.log('each oldest ' + oldestEditId + ' ' + elements.oldest())
		return oldestEditId
	}
	
	elements.attach({
		add: function(v, editId){
			var newBindings = copyBindings(bindings)
			//console.log(JSON.stringify(Object.keys(elements)))
			//s.log('key: ' + elements.key + ' ' + v + ' ' + editId)
			//console.log('attach: ' + elements.attach)
			//console.log('add')
			var ss = newBindings[implicits[0]] = contextGetter.wrapAsSet(v, editId, elements)
			if(ss.isType) throw new Error('is type')
			var newSet = concreteGetter(newBindings, editId)
			//console.log('attaching to: ' + newSet.name)
			allSets[v] = newSet
			newSet.resultSetListener = new ResultSetListener(newSet)
			_.assertFunction(newSet.resultSetListener.set)
			newSet.attach(newSet.resultSetListener, editId)
		},
		remove: function(v, editId){
			var removedSet = allSets[v]
			//console.log('remove &&&& ' + removedSet.detach)
			removedSet.detach(removedSet.resultSetListener, editId)
		},
		objectChange: stub,//ignore object changes - that's the result set listener's job?
		includeView: vi.includeView,//listeners.emitIncludeView.bind(listeners),
		removeView: vi.includeView//listeners.emitRemoveView.bind(listeners)
	}, editId)
	
	function descend(path, editId, cb){
		//call the correct newSet's descend method based on the root object of the path
		var id = path[0].edit.id
		_.assertInt(id)
		//var set = allSets[id]
		var ps = producingSet[id]
		if(ps === undefined){
			console.log('known ids: ' + JSON.stringify(Object.keys(allSets)))
			console.log('WARNING: each does not know id: ' + path[0].edit.id)
			return
			//_.errout('error, tried to descend into unknown object path: ' + JSON.stringify(path))
		}
		return ps.descend(path, editId, cb)
	}
	
	var handle = {
		name: 'each-single',
		attach: function(listener, editId){
			listeners.add(listener)
			//console.log('attached to each: ' + JSON.stringify(s.outputType))
			//_.assertFunction(listener.shouldHaveObject)
			/*if(cachedObjectChanges.length > 0) _.assertFunction(listener.objectChange)

			//console.log('sending cached to attached: ' + cachedObjectChanges.length)
			cachedObjectChanges.forEach(function(v){
				listener.objectChange.apply(undefined, v)
			})*/
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
		descend: descend,
		oldest: oldest,
		key: key
	}
		
	return cache.store(key, handle)
}
