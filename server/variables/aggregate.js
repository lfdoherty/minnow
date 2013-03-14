"use strict";

//var Cache = require('./../variable_cache')
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
	callSyntax: 'max(number|collection:number,...)',
	computeAsync: function(z, cb){
		var rest = Array.prototype.slice.call(arguments, 2)
		//var cb = arguments[arguments.length-1]
		//var rest = Array.prototype.slice.call(arguments, 1, arguments.length-1)
		
		var max
		rest.forEach(function(ns){
			if(_.isArray(ns)){
				ns.forEach(function(v){
					if(max === undefined || max < v) max = v
				})
			}else{
				if(max === undefined || max < ns) max = ns
			}
		})
		//console.log('max: ' + max + ' ' + JSON.stringify(rest))
		cb(max)
	}
})

schema.addFunction('min', {
	schemaType: longType,
	implementation: aggregateMaker.bind(undefined, minFunction),
	minParams: 1,
	maxParams: -1,
	callSyntax: 'min(number|collection:number,...)',
	computeAsync: function(z, cb){
		var rest = Array.prototype.slice.call(arguments, 2)
		
		var min
		rest.forEach(function(ns){
			if(_.isArray(ns)){
				ns.forEach(function(v){
					if(min === undefined || min > v) min = v
				})
			}else{
				if(min === undefined || min > ns) min = ns
			}
		})
		cb(min)
	}
})

//note that these are backwards since we're using a MinHeap
function maxFunction(a, b){
	return b - a
}
function minFunction(a, b){
	return a - b
}

function stub(){}

function aggregateMaker(compareFunction, s, self, expr, typeBindings){
	var defaultValue
	if(expr.params.length > 1) defaultValue = Number(expr.params[1].name)
	
	var elementsGetterList = []
	expr.params.forEach(function(p){
		var elementsGetter = self(p, typeBindings)
		elementsGetterList.push(elementsGetter)
	})

	var cache = s.makeCache()//new Cache(s.analytics)		
	return svgGeneralAggregate.bind(undefined, s, cache, compareFunction, defaultValue, elementsGetterList)//, elementsGetter)
}

function svgGeneralAggregate(s, cache, compareFunction, defaultValue, elementsGetterList, bindings, editId){

	var elementsList = []
	var elementsListenerList = []
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
	
		var elementsListener = {
			add: function(v, editId){
				_.assertDefined(v)
				//console.log('adding to aggregate: ' + v)
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
			},
			includeView: stub,
			removeView: stub
		}
		elementsListenerList.push(elementsListener)
		elements.attach(elementsListener, editId)
	})
	
	function oldest(){
		var old = elementsList[0].oldest()
		elementsList.forEach(function(e){
			var v = e.oldest()
			if(v < old) old = v;
		})
		//console.log('aggregate oldest: ' + old)
		return old
	}
	
	var handle = {
		name: 'aggregation',
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
		key: key,
		destroy: function(){
			handle.attach = handle.detach = handle.oldest = function(){_.errout('destroyed');}
			elementsList.forEach(function(elements, index){
				
				var elementsListener = elementsListenerList[index]
				elements.detach(elementsListener)
				
			})
			listeners.destroyed()
		}
	}
	if(elementsList.length === 1){
		handle.oldest = elementsList[0].oldest
	}else{
		handle.oldest = oldest
	}
	
	return cache.store(key, handle)
}
