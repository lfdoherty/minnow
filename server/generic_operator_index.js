
var _ = require('underscorem')

exports.make = function(s, rel, recurse, staticBindings){

	var resultIndex = {}
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

	var isListening = false
	function startListening(){	
		isListening = true
		params.forEach(function(p, index){
			//console.log('listening to index ' + p.name)
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

		if(!isListening){
			startListening()
		}
		
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
			if(!isListening){
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
	
	
	return getter
}
