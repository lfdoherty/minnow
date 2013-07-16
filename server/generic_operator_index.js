
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
			throw new Error('TODO: ' + JSON.stringify(p) + '\n\n' + JSON.stringify(rel.params, null, 2))
		}
		indexes.push(r.index)
		
		r.index.listen(function(key, value){
			if(resultIndex[key] !== undefined){
				dirty[key] = true
			}
		})
	})
	
	function updateKey(key){
		bindings[bindingName] = key
		var result = compute(bindings)
		resultIndex[key] = result
		delete dirty[key]
	}
	
	function getter(bindings){

		var value = getParamValue(bindings)
		
		if(dirty[value] || resultIndex[value] === undefined){
			updateKey(value)
		}
		var result = resultIndex[value]
		
		//console.log('generic-operator-index result: ' + JSON.stringify([bindings, value, result]))
		return result
	}
	return getter
}
