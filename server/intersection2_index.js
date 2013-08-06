
var _ = require('underscorem')

exports.make = function(s, rel, recurse, staticBindings){

	var valueOne = recurse(rel.params[0])
	var valueTwo = recurse(rel.params[1])

	var paramOne = recurse(rel.params[2])
	var paramTwo = recurse(rel.params[3])

	var indexOne = recurse(rel.params[4]).index
	var indexTwo = recurse(rel.params[5]).index

	var computeIntersection = require('./variables/sync/intersection').compute2
	
	var cache = {}
	var dirtyOne = {}
	var dirtyTwo = {}
	
	indexOne.listen(function(key){
		//console.log('one: ' + key)
		//cache = {}
		dirtyOne[key] = true
	})
	indexTwo.listen(function(key){
		//console.log('two: ' + key)
		//cache = {}
		dirtyTwo[key] = true
	})

	var hits = 0
	var misses = 0
	
	function getter(bindings){
		var keyOne = paramOne(bindings)
		var keyTwo = paramTwo(bindings)
		var key = keyOne+':'+keyTwo
		if(dirtyOne[keyOne] || dirtyTwo[keyTwo]){
			delete dirtyOne[keyOne]
			delete dirtyTwo[keyTwo]
		}else{
			var cached = cache[key]
			if(cached){
				++hits
				if(Math.random() <.01) console.log('h/m: ' + (hits/misses) + ' ' + hits + '/' + misses)
				return cached
			}
		}
		++misses
		if(Math.random() <.01) console.log('h/m: ' + (hits/misses) + ' ' + hits + '/' + misses)
		var result = computeIntersection(valueOne(bindings), valueTwo(bindings))
		cache[key] = result
		return result
	}
	
	return getter
	
	/*var resultIndex = {}
	var dirty = {}
	
	var getParamValue = recurse(rel.params[0])

	var bindingName = rel.params[0].name
	var bindings = {}
	var compute = recurse(rel.params[1])
	
	var params = rel.params.slice(2)
	var indexes = []
	params.forEach(function(p, index){
		var r = recurse(p)
		if(!r.index){
			throw new Error('TODO: ' + p.view)// + JSON.stringify(p) + '\n\n' + JSON.stringify(rel.params, null, 2))
		}
		indexes.push(r.index)
	})

	function startListening(){	
		params.forEach(function(p, index){
			indexes[index].listen(function(key){
				//console.log('generic-operator-index dirtied ' + key)
				if(resultIndex[key] !== undefined){
					if(!dirty[key]){
						dirty[key] = true
						for(var i=0;i<listeners.length;++i){
							listeners[i](key)
						}
					}
				}
			})
		})
	}
			
	function updateKey(key){
		bindings[bindingName] = key
		var result = compute(bindings)
		resultIndex[key] = result
		//console.log('updated key: ' + key + ' to ' + JSON.stringify(result))
		if(result === undefined){
			dirty[key] = false
		}else{
			delete dirty[key]
		}
	}
	
	function getter(bindings){

		var value = getParamValue(bindings)
		
		if(dirty[value] || (resultIndex[value] === undefined && dirty[value] === undefined)){
			updateKey(value)
		}
		var result = resultIndex[value]
		
		//console.log('generic-operator-index result: ' + JSON.stringify([bindings, value, result]))
		return result
	}
	
	var reversed
	function makeReversed(){
		reversed = {
			listen: function(cb){
				_.errout('TODO')
			},
			reverse: function(){
				return getter.index
			},
			get: function(key){
				_.errout('TODO')
			}
		}
	}
	
	var listeners = []
	getter.index = {
		listen: function(cb){
			if(listeners.length === 0){
				startListening()
			}
			listeners.push(cb)
		},
		reverse: function(){
			//_.errout('TODO?')
			if(!reversed) makeReversed()
			return reversed
		}
	}
	
	
	return getter*/
}
