
var _ = require('underscorem')

exports.make = function(s, rel, recurse, staticBindings){

	var compute = recurse(rel.params[1])

	var listeners = []
	
	var paramName = rel.params[0].name

	function getter(bindings){
		var value = compute(bindings)
		//console.log('computed: ' + value + ' ' + JSON.stringify(bindings) + ' ' + paramName)
		return value
	}
	getter.index = {
		listen: function(cb){
			if(listeners.length === 0){
				startListening()
			}
			listeners.push(cb)
		},
		get: function(bindings, key){
			bindings[paramName] = key
			var value = compute(bindings)
			//console.log('computed: ' + key + ' -> ' + value)
			return value
		}
	}
	
	function reportPossibleChange(key){//, value){
		//console.log('reporting change: ' + key)
		for(var i=0;i<listeners.length;++i){
			var listener = listeners[i]
			listener(key)//, value)
		}
	}
	
	var indexParams = rel.params.slice(2)
	var reverseIndexes = []
	var indexes = []
	indexParams.forEach(function(p, index){
		var r = recurse(p)
		if(!r.index){
			throw new Error('TODO: ' + JSON.stringify(p))// + '\n\n' + JSON.stringify(rel.params, null, 2))
		}
		//indexes.push(r.index)
		indexes.push(r.index)
		//console.log(r.index.listen+'')
		//if(index+1<indexParams.length){
		if(index > 0){
			var reverse = r.index.reverse()
			reverseIndexes[index] = reverse
		}
		
		//var setup = Date.now()
		
		
	})	
	
	function startListening(){
		indexParams.forEach(function(p, index){
			function indexListener(key){
				//if(listeners.length === 0) return
			
				//if(Date.now() - setup > 60*1000){
				//	console.log('chain index dirtied ' + key + ' ' + listeners.length)
				//}
			
				var keys = [key]
				var values
				for(var i=index+1;i<indexParams.length;++i){
					var prevIndex = reverseIndexes[i]
					var newKeys = []
					for(var j=0;j<keys.length;++j){
						if(!prevIndex.get) console.log(''+prevIndex.reverse)
						newKeys = newKeys.concat(prevIndex.get(keys[j]))
						//console.log('prev mapped ' + JSON.stringify([keys[j], newKeys]))
					}
					values = keys
					keys = newKeys
				}
				for(var i=0;i<keys.length;++i){
					var key = keys[i]
					//console.log('reporting possible change: ' + key)
					reportPossibleChange(key)//, value)
				}
			}
			indexes[index].listen(indexListener)
		})
	}
	
	return getter
}
