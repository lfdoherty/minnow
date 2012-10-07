
var _ = require('underscorem')

var Cache = require('./../variable_cache')

var wrapParam = require('./syncplugins').wrapParam
var schema = require('./../../shared/schema')
var listenerSet = require('./../variable_listeners')

var fixedObject = require('./../fixed/object')

function fromMacro(e, implicits){
	if(e.view === 'property'){
		return fromMacro(e.params[1], implicits)
	}else{
		if(e.type === 'param'){
			//console.log('name: ' + e.name)
			//console.log(JSON.stringify(implicits))
			return implicits.indexOf(e.name) !== -1
		}
		//_.errout(JSON.stringify(e))
		throw new Error('each_subset_optimization not possible')
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
		throw new Error('each_subset_optimization not possible')
	}
	return res
}

/*
two types of inputs: 
- stuff that's already bound external to the filter function
- property expressions

Everything else should be composed of sync functions

*/
function makeSynchronousFunction(s, pes, typeBindings, objSchema, implicits, e){
	
	if(e.type === 'view'){
		if(e.view === 'property'){
			var propertyName = e.params[0].value
			_.assert(e.params[1].type === 'param')

			if(implicits.indexOf(e.params[1].name) === -1){
				throw new Error('cannot use this optimization')
			}
			
			//console.log(JSON.stringify(e))
			var pc = objSchema.properties[propertyName].code
			_.assertInt(pc)
			return function(bindings, propertiesMap){
				var v = propertiesMap[pc]
				//if(v === undefined) _.errout('no v(' + propertyName + '): ' + JSON.stringify(propertiesMap))
				//_.assertDefined(v)
				return v
			}
		}else{
			var funcs = []
			e.params.forEach(function(p){
				funcs.push(makeSynchronousFunction(s, pes, typeBindings, objSchema, implicits, p))
			})

			var impl = schema.getImplementation(e.view)
			if(!impl.isSynchronousPlugin) _.errout('not a sync plugin, fail: ' + e.view)
			//_.assert(impl.isSynchronousPlugin)
			var implFunc = impl.implementation//(s, self, e, typeBindings)

			return function(bindings, propertiesMap){
				var inputs = []
				for(var i=0;i<funcs.length;++i){
					inputs[i] = funcs[i](bindings, propertiesMap)
				}
				//console.log('computing: ' + e.view + JSON.stringify(inputs))
				var res = implFunc(inputs)
				//console.log('result: ' + JSON.stringify(res))
				return res
			}
		}
	}else if(e.type === 'param'){
		return function(bindings, propertiesMap){
			//_.errout('TODO get binding wrapper value')
			_.assertString(e.name)
			var v = bindings[e.name].get()
			//console.log('got param ' + e.name + ' value: ' + v)
			if(v === undefined){
				_.errout('param.get is undefined: ' + e.name)
			}
			_.assertDefined(v)
			return v
		}
	}else if(e.type === 'int'){
		return function(){
			return e.value
		}
	}else{
		_.errout('TODO: ' + JSON.stringify(e))
	}
}

function extractParams(e, implicits){
	
	var res = []
	if(e.type === 'view'){
		e.params.forEach(function(p){
			res = res.concat(extractParams(p, implicits))
		})
	}else if(e.type === 'param'){
		if(implicits.indexOf(e.name) === -1){
			res.push(e)
		}
	}else if(e.type === 'value'){
	}else if(e.type === 'int'){
	}else{
		_.errout('TODO: ' + JSON.stringify(e))
	}
	return res
}

function makeBindingWrappersFunction(s, self, e, typeBindings){
	var paramExprs = extractParams(e.expr, e.implicits)

	var bindingWrapperMakers = {}
	//callExpr.params.forEach(function(param, index){
	paramExprs.forEach(function(param){
		var v = self(param, typeBindings)
		var wv = wrapParam(v, param.schemaType, s)
		bindingWrapperMakers[param.name] = wv
	})	
	var bwKeys = Object.keys(bindingWrapperMakers)
	return function(bindings, editId){

		var bindingWrappers = {}
		//bwKeys.forEach(function(key){
		for(var i=0;i<bwKeys.length;++i){
			var key = bwKeys[i]
			bindingWrappers[key] = bindingWrapperMakers[key](bindings, editId)
		}
		
		return bindingWrappers
	}
}

exports.make = function(s, self, rel, typeBindings){

	var cache = new Cache()

	if(rel.params[0].type !== 'view' || rel.params[0].view !== 'typeset') return //must involve a *<type> input set
	_.assert(rel.params[1].type === 'macro')
	if(rel.params[1].expr.view !== 'filter') return//must be a subset call

	var objSchema = s.schema[rel.params[0].params[0].value]
	var objTypeCode = objSchema.code
	
	//console.log(JSON.stringify(rel))//.params[1]))
	var pes
	try{
		pes = extractMacroPropertyExpressions(rel.params[1].expr.params[1], rel.params[1].implicits)
	}catch(e){
		return
	}
	//console.log(JSON.stringify(pes))
	var propertyCodes = []
	for(var i=0;i<pes.length;++i){
	
		if(pes[i].params[1].type !== 'param') return//must be single-property descent (for now)
		var propertyName = pes[i].params[0].value
		propertyCodes.push(objSchema.properties[propertyName].code)
	}

	try{	
		var wrapper = makeSynchronousFunction(s, pes, typeBindings, objSchema, rel.params[1].implicits, rel.params[1].expr.params[1])
	}catch(e){
		return
	}
	
	var makeBindingWrappers = makeBindingWrappersFunction(s, self, rel.params[1], typeBindings)


	function f(bindings, editId){
	
		//_.errout('TODO')
	
	
		var ids = []
		var has = {}
		
		var bindingWrappers = makeBindingWrappers(bindings, editId)
		var bindingWrapperKeys = Object.keys(bindingWrappers)
		
		var streamingEditId = -1
		
		var key = ''
		_.each(bindings, function(value, k){
			key += bindings[k].key + ';'
		})
		//console.log('each_subset_key: ' + key)

		//var key = JSON.stringify(rel.params[1])
		key += JSON.stringify(rel.params[1].expr)//TODO better keys?
		
		if(cache.has(key)){
			//console.log('returning cached each_subset_optimization')
			return cache.get(key)
		}else{
			//console.log('keys different: ' + key)
		}
		
		function oldest(){
			var old = s.objectState.getCurrentEditId()
			for(var i=0;i<bindingWrapperKeys.length;++i){
				var bw = bindingWrappers[bindingWrapperKeys[i]]
				var o = bw.oldest()
				if(o < old) old = o
			}
			if(!streamUpToDate){
				if(old > streamLast) old = streamLast
			}
			return old
		}

		var listeners = listenerSet()
		
		var handle = {
			name: 'each-subset-optimization',
			attach: function(listener, editId){
				_.assertInt(editId)
				listeners.add(listener)
				for(var i=0;i<ids.length;++i){
					var id = ids[i]
					listener.add(id, editId)
				}
			},
			detach: function(listener, editId){
				listeners.remove(listener)
				if(editId){
					for(var i=0;i<ids.length;++i){
						var id = ids[i]
						listener.remove(id, editId)
					}
				}
			},
			oldest: oldest,
			key: key,
			descend: function(path, editId, cb, continueListening){//same as typeset
				s.objectState.streamProperty(path, editId, cb, continueListening)
			},
			descendTypes: function(path, editId, cb, continueListening){
				s.objectState.streamPropertyTypes(path, editId, cb, continueListening)
			},
			getType: function(){
				_.errout('TODO')
			}
		}
		
		//_.errout('TODO here')
		
		var streamUpToDate = false
		var streamLast = -1
		//stream *all* property values for the input set
		//console.log('setting up object streaming')
		s.objectState.streamAllPropertyValues(objTypeCode, propertyCodes, function(id, propertyValueMap, editId){
			//console.log('got property values: ' + id + ' ' + JSON.stringify(propertyValueMap) + ' ' + editId)
			var singleResult = wrapper(bindingWrappers, propertyValueMap)
			if(singleResult){
				//console.log('got map ' + id + ' -> ' + JSON.stringify(propertyValueMap))
				//console.log('result: ' + singleResult)
				if(!has[id]){
					//console.log('adding ' + id)
					ids.push(id)
					has[id] = true
					listeners.emitAdd(id, editId)
				}
			}else{
				if(has[id]){
					delete has[id]
					ids.splice(i, 1)
					listeners.emitRemove(id, editId)
				}
			}
		}, function(live, editId){
			//console.log('has streamed all initial object property values: ' + live + ' ' + editId)
			streamUpToDate = live
			streamLast = editId
		}, function(id){
			if(has[id]){
				delete has[id]
				ids.splice(i, 1)
				listeners.emitRemove(id, editId)
			}			
		})
		
		//return handle;
		return cache.store(key, handle)
	}

	var fixedObjGetter = fixedObject.make(s)	
	f.wrapAsSet = function(id, editId, context){//same as typeset
		_.assertInt(editId)
		return fixedObjGetter(id, editId, context)
	}
	return f
}
