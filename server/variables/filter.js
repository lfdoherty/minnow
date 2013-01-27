"use strict";

var Cache = require('./../variable_cache')

var schema = require('./../../shared/schema')
var listenerSet = require('./../variable_listeners')

var _ = require('underscorem')

function stub(){}

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
	var cache = new Cache(s.analytics)	
	var inputGetter = self(rel.params[0], typeBindings)
	var f = svgFilter.bind(undefined, s, cache, inputGetter, self(rel.params[1], typeBindings))
	//console.log(JSON.stringify(rel.params[0]))
	_.assertFunction(inputGetter.wrapAsSet)
	f.wrapAsSet = inputGetter.wrapAsSet
	//f.getDescender = inputGetter.getDescender
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
	if(cache.has(key)){
		return cache.get(key)
	}

	//s.analytics.creation()
	
	var listeners = listenerSet()
	
	var value
	var passed// = false
	
	function oldest(){
		var old = Math.min(inputValue.oldest(), passedValue.oldest())
		//if(s.objectState.getCurrentEditId() !== old) console.log('filter oldest: ' + old + ' ' + value + ' ' + passed)
		//console.log(new Error().stack)
		return old
	}
	
	var inputListener = {
		set: function(v, oldV, editId){
			value = v
			//console.log('set ' + v + ', passed: ' + passed)
			if(passed){
				listeners.emitSet(value, oldV, editId)
			}else{
			}
		},
		includeView: listeners.emitIncludeView.bind(listeners),
		removeView: listeners.emitRemoveView.bind(listeners)
	}
	
	inputValue.attach(inputListener, editId)
	
	var passedListener = {
		set: function(newPassed, oldPassed, editId){
			_.assertNot(_.isInt(newPassed))
			//_.assertBoolean(newPassed)
			//console.log('*passed: ' + newPassed + ' for value: ' + value)
			if(value !== undefined){
				if(newPassed){
					listeners.emitSet(value, undefined, editId)
				}else{
					if(passed){
						listeners.emitSet(undefined, value, editId)
					}
				}
			}
			passed = newPassed
		},
		includeView: function(){
			_.errout('TODO')
		},
		removeView: function(){
			_.errout('TODO')
		}
	}
	
	passedValue.attach(passedListener,editId)
	
	var handle = {
		name: 'filter (' + inputValue.name + ')',
		attach: function(listener, editId){
			listeners.add(listener)
			if(passed && value !== undefined) listener.set(value, undefined, editId)
		},
		detach: function(listener, editId){
			listeners.remove(listener)
			if(editId){
				if(passed && value !== undefined) listener.set(undefined, value, editId)
			}
		},
		oldest: oldest,
		key: key,
		descend: inputValue.descend,
		getTopParent: inputValue.getTopParent,
		destroy: function(){
			handle.attach = handle.detach = handle.oldest = handle.destroy = function(){_.errout('destroyed');}
			
			passedValue.detach(passedListener)
			inputValue.detach(inputListener)
			listeners.destroyed()
		}
	}
		
	return cache.store(key, handle)
}


