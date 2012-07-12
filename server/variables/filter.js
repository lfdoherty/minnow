"use strict";

var Cache = require('./../variable_cache')

var schema = require('./../../shared/schema')
var listenerSet = require('./../variable_listeners')

var _ = require('underscorem')

function filterType(rel, ch){
	return rel.params[0].schemaType
}
schema.addFunction('filter', {
	schemaType: filterType,
	implementation: filterMaker,
	minParams: 2,
	maxParams: 2,
	callSyntax: 'filter(any,boolean)'
})

function filterMaker(s, self, rel, typeBindings){
	var cache = new Cache()	
	var inputGetter = self(rel.params[0], typeBindings)
	var f = svgFilter.bind(undefined, s, cache, inputGetter, self(rel.params[1], typeBindings))
	//console.log(JSON.stringify(rel.params[0]))
	_.assertFunction(inputGetter.wrapAsSet)
	f.wrapAsSet = inputGetter.wrapAsSet
	return f
}

function copyBindings(bindings){
	var newBindings = Object.create(null)
	Object.keys(bindings).forEach(function(key){
		newBindings[key] = bindings[key]
	})
	return newBindings
}

function svgFilter(s, cache, inputGetter, passedGetter, bindings, editId){
	_.assertInt(editId)

	var inputValue = inputGetter(bindings, editId)
	var passedValue = passedGetter(bindings, editId)
	
	var key = inputValue.key+passedValue.key
	if(cache.has(key)) return cache.get(key)
	
	var listeners = listenerSet()
	
	var value
	var passed
	
	function oldest(){
		return Math.min(inputValue.oldest(), passedValue.oldest())
	}
	
	var shouldVotes = {}
	
	inputValue.attach({
		set: function(v, oldV, editId){
			value = v
			console.log('set ' + v + ', passed: ' + passed)
			if(passed){
				listeners.emitSet(value, oldV, editId)
			}else{
			}
		},
		shouldHaveObject: function(id, flag, editId){
			if(passed){
				if(!!shouldVotes[id] !== flag){
					if(flag){
						listeners.emitShould(id, true, editId)
					}else{
						if(shouldVotes[id]){
							listeners.emitShould(id, false, editId)
						}
					}
				}
			}
			if(flag){
				shouldVotes[id] = id
			}else{
				delete shouldVotes[id]
			}
		}
	}, editId)
	
	passedValue.attach({set: function(newPassed, oldPassed, editId){
		_.assertBoolean(newPassed)
		console.log('*passed: ' + newPassed)
		if(value){
			if(newPassed){
				Object.keys(shouldVotes).forEach(function(key){
					var id = shouldVotes[key]
					listeners.emitShould(id, true, editId)
				})
				listeners.emitSet(value, undefined, editId)
			}else{
				if(passed){
					Object.keys(shouldVotes).forEach(function(key){
						var id = shouldVotes[key]
						listeners.emitShould(id, false, editId)
					})
					listeners.emitSet(undefined, value, editId)
				}
			}
		}
		passed = newPassed
	}})
	
	var handle = {
		attach: function(listener, editId){
			listeners.add(listener)
			if(passed) listener.set(value, undefined, editId)
		},
		detach: function(listener, editId){
			listeners.remove(listener)
			if(editId){
				if(passed) listener.set(undefined, value, editId)
			}
		},
		oldest: oldest,
		key: key
	}
		
	return cache.store(key, handle)
}


