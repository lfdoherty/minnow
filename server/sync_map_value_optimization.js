
var _ = require('underscorem')

exports.make = function(s, rel, recurse, staticBindings){

	var mapFunc = recurse(rel.params[0])
	var valueFunc = recurse(rel.params[1])
	
	if(mapFunc.getValue){
		return function(bindings){
			var value = valueFunc(bindings)
			var res = mapFunc.getValue(bindings, value)
			return res
		}
	}else{
		return function(bindings){
			var value = valueFunc(bindings)
			var map = mapFunc(bindings)
			if(!map){
				//console.log('mapValue undefined -> undefined')
				return
			}
			//console.log('mapValue '+JSON.stringify(map)+' -> '+value)
			return map[value]
		}
	}
}
