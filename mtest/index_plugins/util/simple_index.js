
var _ = require('underscorem')

exports.make = function(facade){
	
	_.assertFunction(facade.onLoaded)
	
	var index = {}
	var previousTokens = {}

	var activeQueriesByToken = {}
	//var queryCache = {}

	function refreshTokenKey(key){
		//console.log('refreshing key: ' + key + ' ' + JSON.stringify(activeQueriesByToken))
		
		var qf = activeQueriesByToken[key] || []
		for(var i=0;i<qf.length;++i){
			var str = qf[i]

			//forget dirty queries immediately (they only get dirtied once)
			console.log('got dirty query: ' + str)
			var tokens = str.split(' ')//computeTokens(str)
			//delete queryCache[str]
			for(var j=0;j<tokens.length;++j){
				delete activeQueriesByToken[tokens[j]]
			}

			facade.emitDirtyKey('simpleSearch', str)
		}
	}
	
	function indexObj(id, obj){
	
		var tokenStr = obj.text
				
		var tokens = tokenStr.split(' ')
		var prevTokens = previousTokens[id] || []
		
		facade.diffArrays(prevTokens, tokens,
			function added(token){
				var arr = index[token]
				if(!arr) arr = index[token] = []
				if(arr.indexOf(id) === -1){
					arr.push(id)
					refreshTokenKey(token)
					//console.log('add ' + token + ' ' + id + ' ' + JSON.stringify(tokens) + ' ' + tokenStr)
				}					
			}, 	
			function removed(token){
				var arr = index[token]
				var index = arr.indexOf(id)
				if(index === -1) _.errout('logic error')
				arr.splice(index, 1)
				refreshTokenKey(token)
				//console.log('remove ' + token + ' ' + id)
			})
		
		for(var i=0;i<tokens.length;++i){
			var token = tokens[i]
			var arr = index[token]
			if(!arr) arr = index[token] = []
			if(arr.indexOf(id) === -1){
				arr.push(id)
			}
		}
	}
	
	facade.onLoaded(function beginListening(){
		facade.eachOfType('entity', function(id){
			var obj = facade.getObjectState(id)
			indexObj(id, obj)
		})
		facade.listenForEdits('entity', function(id, e){
			//console.log(JSON.stringify(arguments))
			var obj = facade.getObjectState(id)
			indexObj(id, obj)
		})
	})
		
	function query(str){
		/*if(queryCache[str]){
			var cached = queryCache[str]
			console.log('cached: ' + str + ' -> ' + JSON.stringify(cached))// + ' ' + Object.keys(index).length + ' ' + JSON.stringify(Object.keys(index)))
			return cached
		}*/
		
		var queryTokens = str.split(' ')
		if(queryTokens.length === 0)return []
		
		var results = []
		var has = {}
		
		for(var i=0;i<queryTokens.length;++i){
			var t = queryTokens[i]
			var matches = index[t]
			if(matches){
				for(var j=0;j<matches.length;++j){
					var m = matches[j]
					if(has[m]) continue
					results.push(m)
					has[m] = true
				}
			}
			if(!activeQueriesByToken[t]){
				activeQueriesByToken[t] = []
			}
			activeQueriesByToken[t].push(str)
		}
		//queryCache[str] = results
		console.log(str + ' -> ' + JSON.stringify(queryTokens) + ' -> ' + JSON.stringify(results) + ' ' + Object.keys(index).length + ' ' + JSON.stringify(Object.keys(index)))
		return results
	}
	
	function manyQuery(str, id){
		var queryTokens = computeTokens(str)
		var count = 0
		for(var i=0;i<queryTokens.length;++i){
			var t = queryTokens[i]
			var matches = index[t]
			if(matches){
				for(var j=0;j<matches.length;++j){
					var m = matches[j]
					if(m === id) ++count
				}
			}
		}
		return count
	}
	
	return {
		functions: {
			simpleSearch: {
				func: query,
				type: 'set:entity'
			}
		}
	}
}

exports.functions = [{
	name: 'simpleSearch',
	type: 'set:entity',
	arity: 1
}]
