"use strict";

var Cache = require('./../variable_cache')
var listenerSet = require('./../variable_listeners')

var buckets = require('./../../deps/buckets')

var schema = require('./../../shared/schema')
var _ = require('underscorem')

function longType(rel, computeType){return {type: 'primitive', primitive: 'long'};}

schema.addFunction('max', {
	schemaType: longType,
	implementation: aggregateMaker.bind(undefined, maxFunction),
	minParams: 1,
	maxParams: -1,
	callSyntax: 'max(number|collection:number,...)'
})

schema.addFunction('min', {
	schemaType: longType,
	implementation: aggregateMaker.bind(undefined, minFunction),
	minParams: 1,
	maxParams: -1,
	callSyntax: 'min(number|collection:number,...)'
})

//note that these are backwards since we're using a MinHeap
function maxFunction(a, b){
	return b - a
}
function minFunction(a, b){
	return a - b
}


function aggregateMaker(compareFunction, s, self, expr, typeBindings){
	var defaultValue
	if(expr.params.length > 1) defaultValue = Number(expr.params[1].name)
	
	var elementsGetterList = []
	expr.params.forEach(function(p){
		var elementsGetter = self(p, typeBindings)
		elementsGetterList.push(elementsGetter)
	})

	var cache = new Cache()		
	return svgGeneralAggregate.bind(undefined, s, cache, compareFunction, defaultValue, elementsGetterList)//, elementsGetter)
}

function svgGeneralAggregate(s, cache, compareFunction, defaultValue, elementsGetterList, bindings, editId){

	var elementsList = []
	var key = ''
	elementsGetterList.forEach(function(eg){
		var e = eg(bindings, editId)
		elementsList.push(e)
		key += ','+e.key
	})

	if(cache.has(key)) return cache.get(key)
	
	var listeners = listenerSet()

	var root;
	var heap = new buckets.Heap(compareFunction)
	if(defaultValue){
		heap.add(defaultValue)
		root = defaultValue
	}
	
	function updateRoot(editId){
		if(root !== heap.peek()){
			var oldRoot = root
			root = heap.peek()
			listeners.emitSet(root, oldRoot, editId)
		}
	}
	
	elementsList.forEach(function(elements){
	
		elements.attach({
			add: function(v, editId){
				_.assertDefined(v)
				console.log('adding to aggregate: ' + v)
				//process.exit(0)
				heap.add(v)
				updateRoot(editId)
			},
			remove: function(v, editId){
				if(heap.peek() === v){
					heap.removeRoot()
					root = heap.peek()
					if(root !== v){//there might be duplicate values
						listeners.emitSet(root, v, editId)
					}
				}else{
					//var i = heap.data.indexOf(v)
					//heap.data.splice(i, 1)
					heap.remove(v)
				}
			}
		}, editId)
	})
	
	function oldest(){
		var old = elementsList[0].oldest()
		elementsList.forEach(function(e){
			var v = e.oldest()
			if(v < old) old = v;
		})
		console.log('aggregate oldest: ' + old)
		return old
	}
	
	var handle = {
		attach: function(listener, editId){
			listeners.add(listener)
			if(root !== undefined){
				listener.set(root, defaultValue, editId)
			}else{
				listener.set(defaultValue, undefined, editId)
			}
		},
		detach: function(listener, editId){
			listeners.remove(listener)
			if(editId){
				listener.set(defaultValue, root, editId)
			}
		},
		key: key
	}
	if(elementsList.length === 1){
		handle.oldest = elementsList[0].oldest
	}else{
		handle.oldest = oldest
	}
	
	return cache.store(key, handle)
}
