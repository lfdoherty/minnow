
var _ = require('underscorem')

exports.make = function(s, rel, recurse, staticBindings){

	//var resultIndex = {}
	//var dirty = {}
	
	//var  = recurse(rel.params[0])

	//var bindingName = rel.params[0].name
	//var bindings = {}
	var map = recurse(rel.params[0])
	
	var reverseIndex = map.index.reverse()
	
	var macroCompute = recurse(rel.params[1].expr)
	var macroParamName = rel.params[1].implicits[0]
	function computeMembership(bindings, value){
		bindings[macroParamName] = value
		var result = macroCompute(bindings)
		//console.log('queryied membership ' + value + ' ' + result)
		return result
	}

	var params = rel.params.slice(2)
	var indexes = []
	params.forEach(function(p, index){
		var r = recurse(p)
		if(!r.index){
			throw new Error('TODO: ' + p.view)// + JSON.stringify(p) + '\n\n' + JSON.stringify(rel.params, null, 2))
		}
		indexes.push(r.index)
		
		r.index.listen(function(key){//, value){
			/*if(resultIndex[key] !== undefined){
				if(!dirty[key]){
					dirty[key] = true
					for(var i=0;i<listeners.length;++i){
						listeners[i](key)
					}
				}
			}*/
			var affectedValue = reverseIndex.get(key)
			//console.log('getting: ' + key + ' ' + affectedValue)
			//if(affectedKey){*/
			for(var i=0;i<listeners.length;++i){
				listeners[i](affectedValue, key)//key, value)
			}
		})
	})
	/*
	function updateKey(key){
		bindings[bindingName] = key
		var result = compute(bindings)
		resultIndex[key] = result
		//console.log('updated key: ' + key)
		if(result === undefined){
			dirty[key] = false
		}else{
			delete dirty[key]
		}
	}
	*/
	function getter(bindings){
		_.errout('TODO?')
		//var value = getParamValue(bindings)
		
		/*if(dirty[value] || (resultIndex[value] === undefined && dirty[value] === undefined)){
			updateKey(value)
		}
		var result = resultIndex[value]
		
		//console.log('generic-operator-index result: ' + JSON.stringify([bindings, value, result]))
		return result*/
	}
	
	var listeners = []
	getter.index = {
		listen: function(cb){
			listeners.push(cb)
		},
		reverse: function(){
			_.errout('TODO?')
		}
	}
	var emptyBindings = {}
	map.index.listen(function(key, value){
		//console.log('map dirty ' + key + ' ' + value)
		if(computeMembership(emptyBindings, value)){
			for(var i=0;i<listeners.length;++i){
				listeners[i](key, value)
			}
		}
	})
	
	getter.getValue = function(bindings, key){
		var values = map.getValue(bindings, key)
		var result = []
		//console.log('got value ' + key + ' -> ' + values.length)//JSON.stringify(values))
		for(var i=0;i<values.length;++i){
			var v = values[i]
			if(computeMembership(bindings, v)){
				result.push(v)
			}
		}
		//console.log('after reduction ' + key + ' -> ' + result.length)//JSON.stringify(result))
		return result
	}
	
	
	return getter
}
