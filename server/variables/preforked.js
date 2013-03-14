"use strict";

//var Cache = require('./../variable_cache')

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
	var cache = s.makeCache()//new Cache(s.analytics)	
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
	
	//if(!_.isFunction(preforkedValue.streamProperty)) _.errout('missing streamProperty: ' + preforkedValue.name)
	
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
	
	var waitingForPreforked = true
	var oldWaiting
	var objValueListener = {
		set: function(v, oldV, editId){
			//value = v
			value = {top: v, inner: v, stream: streamProperty}
			_.errout('TODO this should never be called anymore')
			if(!pfValue){
				waitingForPreforked = true
				oldWaiting = oldV
			}else{
				listeners.emitSet(value, oldV, editId)
			}
		},
		includeView: listeners.emitIncludeView.bind(listeners),
		removeView: listeners.emitRemoveView.bind(listeners)
	}
	objValue.attach(objValueListener, editId)
	
	var preforkedValueListener = {
		set: function(newValue, oldValue, editId){
			if(!pfValue) _.assert(newValue)
			pfValue = newValue
			//if(!newValue){
			//	_.errout('UNDEFINING PF VALUE')
			//}
			console.log('got preforked: ' + newValue)
			if(waitingForPreforked){
				waitingForPreforked = false
				listeners.emitSet(value, oldWaiting, editId)
			}
		},
		includeView: function(){_.errout('TODO')},
		removeView: function(){_.errout('TODO')}
	}
	preforkedValue.attach(preforkedValueListener,editId)
	
	function streamProperty(id, propertyCode, editId, cb){
		//_.errout('TODO REMOVEME')
		//console.log(pfValue + ' ' + JSON.stringify(path))
		//console.log('streamProperty through prefork ' + id + ' ' + propertyCode)
		var current

		console.log('got preforked stream property call ' + JSON.stringify(id))
		console.log('pf: ' + JSON.stringify(pfValue))
		
		_.assertEqual(id, value)
		
		//TODO adjust as pfValue changes
		//preforkedValue.descend([{op: editCodes.selectObject, edit: {id: pfValue}}].concat(path.slice(1)), editId, function(prop, editId){
		;(pfValue.id||s.objectState.streamProperty)(pfValue, propertyCode, editId, function(prop, editId){
			current = prop
			console.log('preforked got prop: ' + JSON.stringify(prop))
			cb(prop, editId)
		})
		
		;(id.stream!==streamProperty&&id.stream?id.stream:s.objectState.streamProperty)(id, propertyCode, editId, function(prop, editId){
			console.log('preforked got prop2: ' + JSON.stringify(prop))
			if(prop !== current && prop !== undefined) cb(prop, editId)
		})
		console.log('!preforked')
	}
	
	var handle = {
		name: 'preforked',
		attach: function(listener, editId){
			listeners.add(listener)
			if(value && !waitingForPreforked){
				listener.set(value, undefined, editId)
			}
		},
		detach: function(listener, editId){
			listeners.remove(listener)
			if(editId && value &&  !waitingForPreforked){
				listener.set(undefined, value, editId)
			}
		},
		oldest: oldest,
		key: key,
		get: function(){
			if(!waitingForPreforked) return value
		},
		//descend: descend,
		//getTopParent: function(id){
		//},
		destroy: function(){
			handle.attach = handle.detach = handle.oldest = function(){_.errout('destroyed');}
			
			objValue.detach(objValueListener)
			preforkedValue.detach(preforkedValueListener)
			
			listeners.destroyed()
		}
	}
		
	return cache.store(key, handle)
}


