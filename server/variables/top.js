"use strict";

var _ = require('underscorem')

var Cache = require('./../variable_cache')
var listenerSet = require('./../variable_listeners')

var buckets = require('./../../deps/buckets')

var schema = require('./../../shared/schema')
var _ = require('underscorem')

function topByValuesType(rel){
	if(rel.params[1].schemaType.type !== 'map') throw new Error('topByValues parameter 2 must be a map: ' + JSON.stringify(rel.params[1].type))
	if(rel.params[1].schemaType.value.type !== 'primitive') throw new Error('topByValues parameter 2 must be a map with primitive values')
	return rel.params[1].schemaType
}
schema.addFunction('topByValues', {
	schemaType: topByValuesType,
	implementation: topByValuesMaker,
	minParams: 2,
	maxParams: 2,
	callSyntax: 'topByValues(many, map)',
	description: "Takes a map and produces a map with a most 'many' values, based on selecting the highest-valued key-value pairs.  The map's values must be primitive for comparison purposes."
})


function topByValuesMaker(s, self, rel, typeBindings){
	var manyGetter = self(rel.params[0], typeBindings)
	var elementsGetter = self(rel.params[1], typeBindings)
	var cache = new Cache()
	var f = svgTopByValues.bind(undefined, s, cache, manyGetter, elementsGetter)
	f.wrapAsSet = elementsGetter.wrapAsSet
	return f
}

function svgTopByValues(s, cache, manyGetter, elementsGetter, bindings, editId){

	var many = manyGetter(bindings, editId)
	var elements = elementsGetter(bindings, editId)
	var key = elements.key+manyGetter.key
	if(cache.has(key)) return cache.get(key)
	
	var listeners = listenerSet()
	
	var manyValue;
	
	function compareFunction(kva, kvb){
		return kvb.value - kva.value
	}
	function inverseCompareFunction(kva, kvb){
		return kva.value - kvb.value
	}
	var topHeap = new buckets.Heap(inverseCompareFunction)
	var bottomHeap = new buckets.Heap(compareFunction)
	function oldest(){
		var old = Math.min(many.oldest(), elements.oldest())
		//console.log('top old: ' + old)
		return old
	}
	
	many.attach({set: function(value, oldValue, editId){
		var oldMany = many
		manyValue = value
		console.log('many for top: ' + manyValue)
		//_.errout('TODO adjust size of top')
		if(value > oldValue){
			while(bottomHeap.size() > 0 && topHeap.size() < manyValue){
				topHeap.add(bottomHeap.removeRoot())
			}
		}else if(value < oldValue){
			while(topHeap.size() > manyValue){
				bottomHeap.add(topHeap.removeRoot())
			}
		}
		if(oldMany === undefined){
			
			topHeap.forEach(function(kv){
				listeners.emitPut(kv.key, kv.value, undefined, editId)
			})			
		}
	}})
	
	var handle = {
		attach: function(listener, editId){
			listeners.add(listener)
			_.assertFunction(listener.put)
			_.assertFunction(listener.del)
			_.assertInt(editId)
			topHeap.forEach(function(kv){
				listener.put(kv.key, kv.value, undefined, editId)
			})
		},
		detach: function(listener, editId){
			listeners.remove(listener)
			if(editId){
				_.errout('TODO')
			}
		},
		oldest: oldest,
		key: key
	}
	
	var top = {}
	
	elements.attach({
		put: function(key, value, oldValue, editId){
			_.assertInt(editId)
			_.assertPrimitive(value)
			if(value === undefined) return
			console.log('top got put: ' + key + ' ' + value)
			if(manyValue === undefined){
				bottomHeap.add({key: key, value: value})
				return
			}
			
			if(top[key] !== undefined){
				console.log('already got')
				if(bottomHeap.size() > 0){
					var b = bottomHeap.peek()
					if(b.value > value){
						var oldValue = top[key]
						delete top[key]
						top[b.key] = b.value
						topHeap.add(b)
						listeners.emitPut(b.key, b.value, oldValue, editId)
						bottomHeap.removeRoot()
					}else{
						top[key] = value
						listeners.emitPut(key, value, oldValue, editId)
					}
				}else{
					top[key] = value
					listeners.emitPut(key, value, oldValue, editId)
				}
			}else{
				if(topHeap.size() === manyValue){
					console.log('full: ' + topHeap.size() +'==='+ manyValue)
					var t = topHeap.peek()
					if(t.value < value){
						var kv
						bottomHeap.data.forEach(function(kvv){
							if(kvv.key === key){kv = kvv}
						})
						if(kv){
							_.assertDefined(kv)
							bottomHeap.remove(kv)
						}else{
							kv = {key: key, value: value}
						}
						top[key] = value
						var rkv = topHeap.removeRoot()
						topHeap.add(kv)
						listeners.emitPut(kv.key, kv.value, undefined, editId)
						listeners.emitDel(rkv.key, editId)
						bottomHeap.add(rkv)							
						console.log('replaced ' + t.value + ' ' + rkv.value)
					}else{
						console.log('too small: ' + t.value + '>' + value)
					}
				}else{
					_.assertEqual(bottomHeap.size(), 0)
					var kv = {key: key, value: value}
					console.log('adding to top')
					top[key] = value
					topHeap.add(kv)
					listeners.emitPut(kv.key, kv.value, undefined, editId)
				}
			}
		},
		del: function(key, editId){
			if(bottomHeap.size() > 0){
				var kv;
				topHeap.data.forEach(function(kvv){
					if(kvv.key === key){kv = kvv}
				})
				if(kv){
					topHeap.remove(kv)
					listeners.emitDel(kv.key, kv.value, editId)
					var rkv = bottomHeap.removeRoot()
					topHeap.add(rkv)				
					listeners.emitPut(rkv.key, rkv.value, undefined, editId)
				}else{
					bottomHeap.data.forEach(function(kvv){
						if(kvv.key === key){kv = kvv}
					})
					bottomHeap.remove(kv)
				}
			}else{
				var kv;
				topHeap.data.forEach(function(kvv){
					if(kvv.key === key){kv = kvv}
				})
				_.assert(kv !== undefined)
				topHeap.remove(kv)
				listeners.emitDel(kv.key, kv.value, editId)
			}
		},
		objectChange: listeners.emitObjectChange//Unfortunately, there's no easy way to optimize this

	}, editId)
	return cache.store(key, handle)
}

