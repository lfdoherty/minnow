"use strict";

var Cache = require('./../variable_cache')

var schema = require('./../../shared/schema')
var listenerSet = require('./../variable_listeners')

var _ = require('underscorem')

var editFp = require('./../tcp_shared').editFp
var editCodes = editFp.codes
var editNames = editFp.names

function stub(){}

function type(rel, ch){
	return rel.params[0].schemaType
}
schema.addFunction('preforked', {
	schemaType: type,
	implementation: maker,
	minParams: 2,
	maxParams: 2,
	callSyntax: 'preforked(obj,newPreforked)'
})

function maker(s, self, rel, typeBindings){
	var cache = new Cache(s.analytics)	
	var objGetter = self(rel.params[0], typeBindings)
	var f = svgPreforked.bind(undefined, s, cache, objGetter, self(rel.params[1], typeBindings))
	_.assertFunction(objGetter.wrapAsSet)
	f.wrapAsSet = objGetter.wrapAsSet
	return f
}

function copyBindings(bindings){
	var newBindings = Object.create(null)
	Object.keys(bindings).forEach(function(key){
		newBindings[key] = bindings[key]
	})
	return newBindings
}

function svgPreforked(s, cache, objGetter, forkedGetter, bindings, editId){
	_.assertInt(editId)

	var objValue = objGetter(bindings, editId)
	var preforkedValue = forkedGetter(bindings, editId)
	
	var key = objValue.key+preforkedValue.key
	if(cache.has(key)){
		return cache.get(key)
	}

	var listeners = listenerSet()
	
	var value
	var pfValue
	
	function oldest(){
		var old = Math.min(objValue.oldest(), preforkedValue.oldest())
		return old	
	}
	
	var objValueListener = {
		set: function(v, oldV, editId){
			value = v
			listeners.emitSet(value, oldV, editId)
		},
		includeView: listeners.emitIncludeView.bind(listeners),
		removeView: listeners.emitRemoveView.bind(listeners)
	}
	objValue.attach(objValueListener, editId)
	
	var preforkedValueListener = {
		set: function(newValue, oldValue, editId){
			pfValue = newValue
		},
		includeView: function(){_.errout('TODO')},
		removeView: function(){_.errout('TODO')}
	}
	preforkedValue.attach(preforkedValueListener,editId)
	
	function descend(path, editId, cb){
		//_.errout('TODO')
		//console.log(pfValue + ' ' + JSON.stringify(path))
		var current
		
		//TODO adjust as pfValue changes
		preforkedValue.descend([{op: editCodes.selectObject, edit: {id: pfValue}}].concat(path.slice(1)), editId, function(prop, editId){
			//console.log('got descent ' + prop)
			current = prop
			cb(prop, editId)
		})
		
		return objValue.descend(path, editId, function(prop, editId){
			//console.log('got descent* ' + prop)
			if(prop !== current && prop !== undefined) cb(prop, editId)
		})
	}
	
	var handle = {
		name: 'preforked',
		attach: function(listener, editId){
			listeners.add(listener)
			if(value){
				listener.set(value, undefined, editId)
			}
		},
		detach: function(listener, editId){
			listeners.remove(listener)
			if(editId && value){
				listener.set(undefined, value, editId)
			}
		},
		oldest: oldest,
		key: key,
		descend: descend,
		getTopParent: function(id){
			return value
		},
		destroy: function(){
			handle.attach = handle.detach = handle.oldest = function(){_.errout('destroyed');}
			
			objValue.detach(objValueListener)
			preforkedValue.detach(preforkedValueListener)
			
			listeners.destroyed()
		}
	}
		
	return cache.store(key, handle)
}


