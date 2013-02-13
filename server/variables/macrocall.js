"use strict";

var _ = require('underscorem')

//var Cache = require('./../variable_cache')

function findAndCountMacroParameters(rel){
	//console.log(JSON.stringify(rel))
	var count = 0
	rel.implicits.forEach(function(imp, index){
		if(rel.bindingsUsed[imp]){
			/*if(count !== index){
				console.log('implicits: ' + JSON.stringify(rel.implicits))
				console.log('bindings: ' + JSON.stringify(rel.bindingsUsed))
				_.errout('implicits must be used sequentially(' + count + ','+index+')')
			}*/
			//_.assertEqual(count, index)//implicits must be used sequentially
			
			//++count
			count = index+1
		}
	})
	return count
}

exports.make = function(s, self, rel, typeBindings){
	var mGetter = self(rel.expr, typeBindings)
	//console.log('used: ' + JSON.stringify(rel.bindingsUsed))
	//console.log(JSON.stringify(rel))
	//process.exit(0)

	var manyMacroParams = findAndCountMacroParameters(rel)
	if(manyMacroParams === 0){
		var f = function(bindings, editId){
			var internal = mGetter(bindings, editId)//TODO 
			_.assertString(internal.name)
			var f = function(){//dummy, editId){
				return internal
			}
			f.key = 'zeroparams:'+internal.key
			return f
		}
		f.wrapAsSet = mGetter.wrapAsSet
		f.wrappers = mGetter.wrappers
		f.getDescender = mGetter.getDescender
		
		//console.log('zero macro params')
		f.key = 'zeroparams'
		return f
	}
	
	_.assertObject(rel.bindingsUsed)
	function computeKey(bindings){
		var fullKey = '';
		_.each(bindings, function(v, key){
			if(rel.bindingsUsed[key]){
				fullKey += v.key+';'
			}
		})
		//console.log('macro key:', fullKey, ' ', rel.bindingsUsed)
		//s.log('bindings:', bindings)
		return fullKey
	}
	var f = svgMacroCall.bind(undefined, s, computeKey, mGetter)
	//_.assertFunction(mGetter.wrapAsSet)
	f.wrapAsSet = mGetter.wrapAsSet
	f.wrappers = mGetter.wrappers
	f.getDescender = mGetter.getDescender
	
	//TODO first compute the set of macro parameters (i.e. ~1, ~2, etc.)
	_.assert(manyMacroParams > 0)
	
	//TODO then map everything else external as rest parameters
	//some stuff must be external because it is async (i.e. *type and/or things derived from that)
	//for now we fail if those things exist in a query branch we're trying to make a sync implementation for.
	var parameterBindings = []
	for(var i=0;i<manyMacroParams;++i){
		parameterBindings.push(rel.implicits[i])
	}
	try{
		var internal = self.asSync(rel.expr, typeBindings, parameterBindings)
	
		f.asSyncMacro = internal
	}catch(e){
		f.asSyncMacro = function(){
			console.log(JSON.stringify(rel))
			console.log(e.stack)
			_.errout('could not make this a sync operation')
		}
	}
	/*function(bindings, editId){
		//_.errout('TODO')
		return internal(bindings, editId)
		return {
			compute: syncFunction.compute,
			listenForChanges: function(listener){
				syncFunction.listenForExternalChanges(listener)
			}
		}
	}*/
	
	return f;
}

function svgMacroCall(s, computeKey, mGetter, bindings, editId){

	//TODO only provide the bindings that are referred to within the macro
	var f = function(newBindings, editId){//note that the only new bindings possible are those injected via '~1','~2', etc.

		s.analytics.cachePut()//TODO track evictions
		//s.analytics.cacheEvict()
		
		var allBindings = {}//_.extend({}, bindings, newBindings)
		Object.keys(newBindings).forEach(function(key){
			_.assertDefined(newBindings[key])
			allBindings[key] = newBindings[key]
		})
		Object.keys(bindings).forEach(function(key){
			_.assertDefined(bindings[key])
			allBindings[key] = bindings[key]
		})
		
		//_.each(allBindings, function(b, key){
		Object.keys(allBindings).forEach(function(key){
			var b = allBindings[key]
			//console.log('key: ' + key)
			_.assertDefined(b)
			_.assertString(b.name)
		})
		var internal = mGetter(allBindings, editId)
		_.assertString(internal.name)
		//console.log('from original bindings: ' + JSON.stringify(bindings))
		//console.log('extending macro with more bindings: ' + JSON.stringify(newBindings))
		_.assertDefined(internal)
		
		return internal;
	}
	
	//TODO use only the keys of bindings that are referred to within the macro
	f.key = computeKey(bindings)
	
	//console.log('f.key: ' + f.key)

	return f
}
