"use strict";

//var Cache = require('./../variable_cache')
var listenerSet = require('./../variable_listeners')

var schema = require('./../../shared/schema')
var _ = require('underscorem')
var bubble = require('./bubble')

function longType(rel, computeType){return {type: 'primitive', primitive: 'long'};}

function stub(){}

schema.addFunction('count', {
	schemaType: longType,
	implementation: countMaker,
	minParams: 1,
	maxParams: 1,
	callSyntax: 'count(collection)'
})


/*
TODO: could the principle of delaying and merging multiple sets implemented here be generalized and wrapped 
around all set-style variables?

Note that the delay-optimization here is a good demonstration of how editIds and oldest() should function:
- when a delayed-update is in progress, oldest always reports the editId before the one that started the delayed update
- once the delayed update happens, it has the current oldest editId (of the wrapped type), so that it won't be sent
  too soon if further changes happened during the delay
  
*/

function countMaker(s, self, rel, typeBindings){
	var elementsExpr = rel.params[0]
	var cache = s.makeCache()//new Cache(s.analytics)	
	
	if(elementsExpr.type === 'view' && elementsExpr.view === 'typeset'){//optimization to avoid loading all the object ids into memory just to count them
		var typeName = elementsExpr.params[0].value
		var typeCode = s.schema[typeName].code

		return svgTypeCount.bind(undefined, s, cache, typeCode)
	}else{
		var elementsGetter = self(elementsExpr, typeBindings)
		//return svgGeneralCount.bind(undefined, s, cache, elementsGetter, rel)
		return bubble.wrap(bubbleImpl, s, cache, [elementsGetter], [elementsExpr], rel)
	}
}


var bubbleImpl = {
	key: function(params){
		return params[0].key
	},
	name: 'general-count',
	update: {
		0: {
			add: function(v, s){
				s.count.increment()
			},
			remove: function(v, s){
				s.count.decrement()
			}
		}
	},
	compute: function(s, params, z){
		_.assertLength(params, 1)

		s.count = z.integer(0)
		s.count.set(params[0].count())

		return s.count
	}
}


function svgGeneralCount(s, cache, elementsExprGetter, rel, bindings, editId){

	var elements = elementsExprGetter(bindings, editId)

	var key = elements.key
	if(cache.has(key)) return cache.get(key)
	
	var listeners = listenerSet()
	
	var count = 0;
	var currentCount = 0;
	
	var elementsListener
	
	var handle = {
		key: key,
		name: 'general-count',
		attach: function(listener, editId){
			listeners.add(listener)
			//console.log('attached, setting count to: ' + currentCount)
			listener.set(currentCount, 0, editId)
		},
		detach: function(listener, editId){
			listeners.remove(listener)
			if(editId){
				listener.set(0, currentCount, editId)
			}
		},
		oldest: oldest,
		destroy: function(){
			handle.attach = handle.detach = handle.oldest = function(){_.errout('destroyed');}
			elements.detach(elementsListener)
			listeners.destroyed()
		}
	}
	
	var currentOldest = elements.oldest()
	function oldest(){
		if(will){
			//console.log('count returning oldest: ' + currentOldest)
			return currentOldest
		}
		else return elements.oldest()
	}
	
	var will = false;
	function reportCountChangeEventually(editId){
		/*if(will) return
		will = true
		currentOldest = editId-1
		setTimeout(reportCountChange, 10);*/
		reportCountChange()
	}
	function reportCountChange(){
		will = false;
		//var oldOldest = currentOldest
		currentOldest = elements.oldest()-1
		if(currentCount !== count){
			//console.log('reporting count change ' + currentCount + ' -> ' + count)
			var oldCount = currentCount
			currentCount = count
			listeners.emitSet(count, oldCount, currentOldest)
		}
	}
	//console.log(JSON.stringify(rel.params[0].schemaType))
	if(rel.params[0].schemaType.type === 'map'){
		elementsListener = {
			put: function(key, value, oldValue, editId){
				_.assertDefined(value)
				if(oldValue === undefined){
					++count
					reportCountChangeEventually(editId)
				}
			},
			del: function(key, editId){
				--count
				reportCountChangeEventually(editId)
			},
			objectChange: stub
		}
	}else{
		elementsListener = {
			add: function(value, editId){
				++count
				//console.log('count increased: ' + count)
				reportCountChangeEventually(editId)
				//listeners.emitSet(count, count-1, editId)
			},
			remove: function(value, editId){
				--count
				//console.log('count decreased: ' + count)
				reportCountChangeEventually(editId)
				//listeners.emitSet(count, count+1, editId)
			},
			objectChange: stub,
			includeView: stub,
			removeView: stub
		}
	}

	elements.attach(elementsListener, editId)
		
	return cache.store(key, handle)
}

function svgTypeCount(s, cache, typeCode, bindings, editId){

	var key = typeCode+''
	if(cache.has(key)) return cache.get(key)
	
	var listeners = listenerSet()
	
	var count = s.objectState.getManyOfType(typeCode)
	var currentCount = count
	
	var will = false
	var timeoutHandle
	function reportCountChangeEventually(editId){
		if(will) return
		will = true
		currentOldest = editId-1
		timeoutHandle = setTimeout(reportCountChange, 10);
	}
	function reportCountChange(){
		will = false;
		currentOldest = s.objectState.getCurrentEditId()-1
		if(currentCount !== count){
			var oldCount = currentCount
			currentCount = count
			listeners.emitSet(count, oldCount, currentOldest)
		}
	}
	
	function listenCreated(){
		++count
		//s.log('created ##############################33')
		//listeners.emitSet(count,count-1, s.objectState.getCurrentEditId())
		reportCountChangeEventually(editId)
	}
	function listenDeleted(){
		--count
		//listeners.emitSet(count,count+1, s.objectState.getCurrentEditId())
		reportCountChangeEventually(editId)
	}
	s.broadcaster.listenForNew(typeCode, listenCreated)
	s.broadcaster.listenForDeleted(typeCode, listenDeleted)
	
	var currentOldest = s.objectState.getCurrentEditId()
	var handle = {
		name: 'type-count',
		attach: function(listener, editId){
			listeners.add(listener)
			listener.set(count, 0, editId)
		},
		detach: function(listener, editId){
			listeners.remove(listener)
			if(editId !== undefined){
				listener.set(0, count, editId)
			}
		},
		oldest: oldest,
		destroy: function(){
			handle.attach = handle.detach = handle.oldest = function(){_.errout('destroyed');}
			if(will){
				clearTimeout(timeoutHandle)
			}
			s.broadcaster.stopListeningForNew(typeCode, listenCreated)
			s.broadcaster.stopListeningForDeleted(typeCode, listenDeleted)
			listeners.destroyed()
		}
	}
	function oldest(){
		if(!will){
			currentOldest = s.objectState.getCurrentEditId()
		}
		return currentOldest
	}
	
	return cache.store(key, handle);
}


