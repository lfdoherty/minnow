
var _ = require('underscorem')

/*

Removed duplicate let expressions, replacing the param references to the duplicates.

*/

exports.apply = function(view){
	_.each(view, function(v, viewName){
		if(v.schema){
			_.each(v.rels, function(rel, relName){
				var newRel = v.rels[relName] = applyCollapseToView(rel)
			})
		}
	})
}

function replaceParam(oldName, newName, r){
	if(r.type === 'view'){
		r.params.forEach(function(p){
			replaceParam(oldName, newName, p)
		})
	}else if(r.type == 'let'){
		replaceParam(oldName, newName, r.expr)
		replaceParam(oldName, newName, r.rest)
	}else if(r.type === 'macro'){
		replaceParam(oldName, newName, r.expr)
	}else if(r.type === 'param'){
		if(r.name === oldName) r.name = newName
	}
}

function makeExprKey(r, ignorable){
	ignorable = JSON.parse(JSON.stringify(ignorable||{}))
	
	if(r.type === 'param'){
		if(ignorable[r.name]) return '<ignorable-param>'
	}else if(r.type === 'view'){
		var str = ''+r.view+'('
		r.params.forEach(function(p){
			str += makeExprKey(p, ignorable)+','
		})
		str +=')'
		return str
	}else if(r.type === 'macro'){
		r.implicits.forEach(function(v){
			ignorable[v] = true
		})
		return 'macro['+makeExprKey(r.expr)+']'
	}else if(r.type === 'value'){
		return 'value<'+r.value+'>'
	}else if(r.type === 'int'){
		return 'int<'+r.int+'>'
	}else if(r.type === 'nil'){
		return '<nil>'
	}else if(r.type === 'let'){
		return 'let['+makeExprKey(r.expr)+':'+makeExprKey(r.rest)+']'
	}else{
		_.errout('TODO: ' + JSON.stringify(r))
	}
}

exports.makeExprKey = makeExprKey

function collapseLetChainDuplicates(lets){
	var byExprStr = {}
	for(var i=0;i<lets.length;++i){
		var r = lets[i]
		var key = makeExprKey(r.expr)//JSON.stringify(r.expr)
		if(byExprStr[key]){
			replaceParam(r.name, byExprStr[key].name, r)
			lets[i-1].rest = lets[i+1]||r.rest
			lets.splice(i, 1)
			--i
		}else{
			byExprStr[key] = r
		}
	}
}

function applyCollapseToView(r){
	if(r.type === 'view'){
		r.params.forEach(function(p,i){
			r.params[i] = applyCollapseToView(p)
		})
	}else if(r.type === 'let'){
		var curLet = r
		var letChain = []
		while(curLet.type === 'let'){
			letChain.push(curLet)
			_.assertDefined(r.rest)
			curLet = curLet.rest
		}
		if(letChain.length > 1){
			collapseLetChainDuplicates(letChain)
		}
		applyCollapseToView(r.expr)
		applyCollapseToView(r.rest)
	}else if(r.type === 'macro'){
		r.expr = applyCollapseToView(r.expr)
	}else if(r.type === 'param' || r.type === 'value' || r.type === 'int' || r.type === 'nil'){
		//do nothing
	}
	return r
}
