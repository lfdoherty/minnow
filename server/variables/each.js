"use strict";

var Cache = require('./../variable_cache')

var schema = require('./../../shared/schema')
var listenerSet = require('./../variable_listeners')

var _ = require('underscorem')

function stub(){}

var eachSubsetOptimization = require('./each_subset_optimization')

function eachType(rel, ch){
	//var r = Math.random()
	//console.log('each computing input type... ' + r)
	var inputType = rel.params[0].schemaType//ch.computeType(rel.params[0], ch.bindingTypes)
	//console.log('...done ' + r)
	//console.log('inputType: ' + JSON.stringify(inputType))
	var singleInputType = inputType.members
	_.assertDefined(singleInputType)
	var newBindings = {}
	var implicits = rel.params[1].implicits//['p'+Math.random()]
	_.assertArray(implicits)
	//console.log('implicits: ' + JSON.stringify(implicits))
	newBindings[implicits[0]] = singleInputType
	//console.log('\n\neach bound ' + implicits[0] + ' to ' + JSON.stringify(singleInputType))
	//console.log('each reduced bindings to: ' + JSON.stringify(newBindings))
	//console.log('each: ' + JSON.stringify(rel))
	//_.assertDefined(rel.params[1].schemaType)
	var valueType = ch.computeMacroType(rel.params[1], ch.bindingTypes, newBindings, implicits)

	if(valueType.type === 'set' || valueType.type === 'list'){
		valueType = valueType.members;
	}
	if(inputType.type === 'set'){
		return {type: 'set', members: valueType}
	}else if(inputType.type === 'list'){
		return {type: 'list', members: valueType}
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

	var cache = new Cache()
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
		}
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
			//_.errout('TODO')
		}
	}, editId)
	
	var handle = {
		name: 'each-multiple',
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
		descend: function(){
			_.errout('TODO')
		}
	}
		
	return cache.store(key, handle)
}


function svgEachSingle(s, implicits, cache, exprGetter, contextGetter, isView, bindings, editId){
	var elements = contextGetter(bindings, editId)

	if(!_.isFunction(elements.getType))_.errout('no getType: ' + elements.name)
	//if(!_.isFunction(elements.descendTypes)) _.errout('no descendTypes: ' + elements.name)

	var concreteGetter = exprGetter(bindings, editId)
	
	var key = elements.key+':'+concreteGetter.key
	if(cache.has(key)) return cache.get(key)
	
	var listeners = listenerSet()
	
	var allSets = {}
	var counts = {}
	var values = []
	
	var cachedObjectChanges = []

	//console.log('name: ' + elements.name)
	//_.assertFunction(elements.descend)
	
	//var should = {}
	//var shouldCounts = {}
	
	var resultSetListener = {
		set: function(value, oldValue, editId){
			//console.log('each got set ' + value + ' ' + oldValue)
			//console.log(new Error().stack)
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
					listeners.emitAdd(value, editId)
					values.push(value)
				}else{
					++counts[value]
				}
			}
		},
		objectChange: function(subjTypeCode, subjId,/* typeCode, id, */path, op, edit, syncId, editId){
			//console.log('each passing on objectChange to ' + listeners.many() + ': ' + JSON.stringify([op, edit, syncId, editId]))
			//console.log(new Error().stack)
			_.assert(editId < s.objectState.getCurrentEditId())
			var e = [subjTypeCode, subjId,/* typeCode, id,*/ path, op, edit, syncId, editId]
			cachedObjectChanges.push(e)
			listeners.emitObjectChange(subjTypeCode, subjId, /*typeCode, id,*/ path, op, edit, syncId, editId)
			//_.errout('TODO: ' + op + ' ' + JSON.stringify(edit))
		}
	}
	
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
			s.log('key: ' + elements.key + ' ' + v + ' ' + editId)
			//console.log('attach: ' + elements.attach)
			//console.log('add')
			var ss = newBindings[implicits[0]] = contextGetter.wrapAsSet(v, editId, elements)
			if(ss.isType) throw new Error('is type')
			var newSet = concreteGetter(newBindings, editId)
			//console.log('attaching to: ' + newSet.name)
			newSet.attach(resultSetListener, editId)
			allSets[v] = newSet
		},
		remove: function(v, editId){
			var removedSet = allSets[v]
			//console.log('remove &&&& ' + removedSet.detach)
			removedSet.detach(resultSetListener, editId)
		},
		objectChange: stub//ignore object changes - that's the result set listener's job?
	}, editId)
	
	var handle = {
		name: 'each-single',
		attach: function(listener, editId){
			listeners.add(listener)
			//console.log('attached to each: ' + JSON.stringify(s.outputType))
			//_.assertFunction(listener.shouldHaveObject)
			if(cachedObjectChanges.length > 0) _.assertFunction(listener.objectChange)

			//console.log('sending cached to attached: ' + cachedObjectChanges.length)
			cachedObjectChanges.forEach(function(v){
				listener.objectChange.apply(undefined, v)
			})
			
			values.forEach(function(v){listener.add(v, editId)})

		},
		detach: function(listener, editId){
			listeners.remove(listener)
			//console.log('IN EACH')
			if(editId){
				values.forEach(function(v){listener.remove(v, editId)})
			}
		},
		descend: elements.descend,//TODO this is not necessarily right
		descendTypes: elements.descendTypes,//TODO this is not necessarily right
		oldest: oldest,
		key: key,
		getType: elements.getType//TODO this is not necessarily right
	}
		
	return cache.store(key, handle)
}
