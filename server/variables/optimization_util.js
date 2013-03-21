"use strict";

function fromMacro(e, implicits){
	if(e.view === 'property'){
		return fromMacro(e.params[1], implicits)
	}else{
		if(e.type === 'param'){
			//console.log('name: ' + e.name)
			//console.log(JSON.stringify(implicits))
			return implicits.indexOf(e.name) !== -1
		}else if(e.type === 'view' && e.view === 'cast'){
			return fromMacro(e.params[1], implicits)
		}
		//_.errout(JSON.stringify(e))
		throw new Error('subset_optimization not possible, bad fromMacro: ' + JSON.stringify(e))
	}
}

function extractMacroPropertyExpressions(e, implicits){
	var res = []
	if(e.type === 'view'){
		if(e.view === 'property'){
			if(fromMacro(e, implicits)){
				res.push(e)
			}
		}else{
			e.params.forEach(function(p){
				res = res.concat(extractMacroPropertyExpressions(p, implicits))
			})
		}
	}else if(e.type === 'param'){
	}else if(e.type === 'value'){
	}else if(e.type === 'int'){
	}else{
		throw new Error('each_subset_optimization not possible: ' + JSON.stringify(e))
	}
	return res
}

exports.fromMacro = fromMacro
exports.extractMacroPropertyExpressions = extractMacroPropertyExpressions
