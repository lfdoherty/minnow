
var _ = require('underscorem')

exports.make = function(s, rel, recurse, staticBindings){

	var computeSet = recurse(rel.params[0])
	var computeFor = recurse(rel.params[1].expr)
	var computeForName = rel.params[1].implicits[0]
	
	var filteredLookupIndex = {}

	var filterIndex
	if(rel.params[1].expr.view === 'not'){
		filterIndex = recurse(rel.params[1].expr.params[0]).index
	}else{
		filterIndex = recurse(rel.params[1].expr).index
	}
	
	if(!filterIndex){
		_.errout('TODO: ' + JSON.stringify(rel.params[1]))
	}
	
	filterIndex.listen(function(key){
		delete filteredLookupIndex[key]
	})
	
	//_.errout('TODO')
	
	function getter(bindings){
		var set = computeSet(bindings)
		var resultSet = []
		for(var i=0;i<set.length;++i){
			var v = set[i]
			var fv = filteredLookupIndex[v]
			if(fv === undefined){
				bindings[computeForName] = v
				fv = filteredLookupIndex[v] = computeFor(bindings)
			}
			//bindings[computeForName] = v
			//var fv = computeFor(bindings)
			if(fv){
				resultSet.push(v)
			}
		}
		//console.log('result set: ' + JSON.stringify(resultSet))
		return resultSet
	}
	
	return getter

	/*var compute = recurse(rel.params[1])

	var listeners = []
	
	var paramName = rel.params[0].name

	function getter(bindings){
		var value = compute(bindings)
		//console.log('computed: ' + value + ' ' + JSON.stringify(bindings) + ' ' + paramName)
		return value
	}
	getter.index = {
		listen: function(cb){
			//_.errout('tODO')
			listeners.push(cb)
		},
		get: function(bindings, key){
			//_.errout('TODO')
			bindings[paramName] = key
			var value = compute(bindings)
			//console.log('computed: ' + key + ' -> ' + value)
			return value
		}
	}
	
	function reportPossibleChange(key, value){
		for(var i=0;i<listeners.length;++i){
			var listener = listeners[i]
			listener(key, value)
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
		var reverse = r.index.reverse()
		reverseIndexes.push(reverse)
		
		r.index.listen(function(key){//, value){
			var keys = [key]
			var values
			for(var i=index-1;i>=0;--i){
				var prevIndex = reverseIndexes[i]
				var newKeys = []
				for(var j=0;j<keys.length;++j){
					if(!prevIndex.get) console.log(''+prevIndex.reverse)
					newKeys = newKeys.concat(prevIndex.get(keys[j]))
				}
				values = keys
				keys = newKeys
			}
			for(var i=0;i<keys.length;++i){
				var key = keys[i]
				//var value = getter.index.get(key)
				//console.log('reporting possible change: ' + key)
				reportPossibleChange(key)//, value)
			}
		})
	})	
	
	return getter*/
	
	
}
