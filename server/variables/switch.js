"use strict";

var _ = require('underscorem')

var Cache = require('./../variable_cache')
var listenerSet = require('./../variable_listeners')

var schema = require('./../../shared/schema')
var _ = require('underscorem')

require('./case')

function switchType(rel, ch){

	var types = []

	//TODO specialize binding types depending on the original global-macro signature
	rel.params.forEach(function(c, index){
		if(index === 0) return
		_.assertDefined(c.schemaType)
		types.push(c.schemaType)
	})
	
	//console.log('switchType: ' + JSON.stringify(rel))
	
	//console.log(JSON.stringify(types))
	var temp = JSON.stringify(types[0])
	for(var i=1;i<types.length;++i){
		var t = JSON.stringify(types[i])
		if(temp !== t){
			console.log(JSON.stringify(types))
			_.errout('TODO implement type base computation')
		}
	}
	return types[0]
}
schema.addFunction('switch', {
	schemaType: switchType,
	implementation: maker,
	minParams: 3,
	maxParams: -1,
	callSyntax: 'switch(primitive, case, case, ...)'
})


function maker(s, self, rel, typeBindings){
	var primGetter = self(rel.params[0], typeBindings)
	var cases = []
	for(var i=1;i<rel.params.length;++i){
		var param = rel.params[i]
		_.assertEqual(param.params[0].type, 'value')
		var caseValue = param.params[0].value;
		var caseGetter = self(param.params[1], typeBindings)
	//	console.log('self: ' + caseValue)
		//console.log('f: ' + JSON.stringify(param.params[1]))
		_.assertFunction(caseGetter)
		cases.push({value: caseValue.toString(), getter: caseGetter})
	}
	//var cache = new Cache()
	var f = svgGeneralSwitch.bind(undefined, s, /*cache, */primGetter, cases)
	f.wrapAsSet = function(){
		_.errout('TODO')
	}
	return f
}

function svgGeneralSwitch(s, /*cache, */primGetter, cases, bindings, editId){

	var primVariable = primGetter(bindings, editId)

	for(var i=0;i<cases.length;++i){
		_.assertFunction(cases[i].getter)
	}

	/*var key = elements.key
	cases.forEach(function(c){
	})

	
	if(cache.has(key)) return cache.get(key)*/
	
	var listeners = []//just caching them for attaching to the caseVariable
	var caseVariable
	
	function oldest(){
		var o = primVariable.oldest()
		if(caseVariable){
			var old = caseVariable.oldest()
			if(old < o) o = old
		}/*else{
			o = -1
		}*/
		return o;
	}
	/*function descend(){
		var args = Array.prototype.slice.apply(arguments)
		caseVariable.descend.apply(args)
	}*/
	
	function getType(id){
		_.errout('TODO')
	}
	
	var handle = {
		name: 'switch',
		attach: function(listener, editId){
			listeners.push(listener)
			_.assertInt(editId)
			if(caseVariable !== undefined){
				//listener.set(value, undefined, editId)
				caseVariable.attach(listener, editId)
			}
		},
		detach: function(listener, editId){
			listeners.splice(listeners.indexOf(listener), 1)
			if(caseVariable !== undefined){
				caseVariable.detach(listener, editId)
			}
		},
		oldest: oldest,
		key: Math.random(),
		descend: function(){_.errout('TODO?')},
		getType: getType
	}
	
	function useCase(getter, editId){
		if(caseVariable) _.errout('TODO support varying prim variable');
		caseVariable = getter(bindings, editId)
		handle.descend = caseVariable.descend
		//console.log('got case variable ' + listeners.length)
		listeners.forEach(function(listener){
			caseVariable.attach(listener, editId)
		})
	}
	
	var currentPrim
	primVariable.attach({
		set: function(v, oldV, editId){
			//console.log('got prim variable: ' + v)
			if(v === currentPrim) return
			for(var i=0;i<cases.length;++i){
				var c = cases[i]
				//console.log('trying: ' + c.value)
				_.assertFunction(c.getter)
				if(c.value === v.toString()){
					useCase(c.getter, editId)
					return
				}
			}
		}
	}, editId)
	return handle//cache.store(key, handle)
}

