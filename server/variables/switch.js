"use strict";

var _ = require('underscorem')

var Cache = require('./../variable_cache')
var listenerSet = require('./../variable_listeners')

var schema = require('./../../shared/schema')
var _ = require('underscorem')

require('./case')
require('./default')

var fixedPrimitive = require('./../fixed/primitive')
var fixedObject = require('./../fixed/object')

function stub(){}

function switchType(rel, ch){

	var types = []

	//TODO specialize binding types depending on the original global-macro signature
	rel.params.forEach(function(c, index){
		if(index === 0) return
		_.assertDefined(c.schemaType)
		types.push(c.schemaType)
	})
	
	return this.mergeTypes(types)
}
schema.addFunction('switch', {
	schemaType: switchType,
	implementation: maker,
	minParams: 3,
	maxParams: -1,
	callSyntax: 'switch(primitive, case, case, ..., [default])'
})


function maker(s, self, rel, typeBindings){
	var primGetter = self(rel.params[0], typeBindings)
	var defaultCase;
	var cases = []
	for(var i=1;i<rel.params.length;++i){
		var param = rel.params[i]
		if(param.view === 'default'){
			var caseGetter = self(param.params[0], typeBindings)
			defaultCase = {getter: caseGetter}
		}else{
			_.assertEqual(param.params[0].type, 'value')

			if(param.params[1].type === 'nil'){
				continue;
			}
			
			var caseValue = param.params[0].value;
			var caseGetter = self(param.params[1], typeBindings)
			_.assertFunction(caseGetter)
			cases.push({value: caseValue.toString(), getter: caseGetter})
		}
	}
	
	var cache = new Cache(s.analytics)
	
	var f = svgGeneralSwitch.bind(undefined, s, cache, primGetter, cases, defaultCase)
	f.wrapAsSet = function(v, editId, context){
		//_.errout('TODO: ' + value)
		if(rel.schemaType.type === 'primitive'){
			return fixedPrimitive.make(s)(v, editId)
		}else if(rel.schemaType.type === 'object' || (rel.schemaType.members && rel.schemaType.members.type === 'object')){
			return fixedObject.make(s)(v, editId, context)
		}else{
			_.errout('TODO: ' + v + ' ' + JSON.stringify(rel.schemaType))
		}
	}
	return f
}

function makeConstantSwitch(s, cache, primGetter, cases, defaultCase, bindings, editId, primVariable){
	
	var theCase
	
	var primValue = primVariable.get()
	if(primValue === undefined) _.errout('get provided undefined: ' + primVariable.get)
	
	for(var i=0;i<cases.length;++i){
		var c = cases[i]
		if(c.value === primValue.toString()){
			theCase = c.getter(bindings, editId)
		}
	}
	if(!theCase && defaultCase){
		theCase = defaultCase.getter(bindings, editId)
	}
	
	if(!theCase) _.errout('no cases match, no default case defined, TODO?')
	
	theCase.name += ' [fixed-switch]'
	return theCase
}

function svgGeneralSwitch(s, cache, primGetter, cases, defaultCase, bindings, editId){

	var primVariable = primGetter(bindings, editId)
	
	if(primVariable.isConstant){
		//_.errout('TODO')
		return makeConstantSwitch(s, cache, primGetter, cases, defaultCase, bindings, editId, primVariable)
	}

	for(var i=0;i<cases.length;++i){
		_.assertFunction(cases[i].getter)
	}
	
	var listeners = []//just caching them for attaching to the caseVariable
	var caseVariable
	
	function oldest(){
		var o = primVariable.oldest()
		if(caseVariable){
			var old = caseVariable.oldest()
			if(old < o) o = old
		}
		//if(o < 1856) console.log('switch oldest: ' + o + ' ' + caseVariable + ' ' + primVariable.oldest() + ' ' + caseVariable.oldest)
		return o;
	}

	var handle = {
		name: 'switch',
		attach: function(listener, editId){
			listeners.push(listener)
			_.assertInt(editId)
			if(caseVariable !== undefined){
				//listener.set(value, undefined, editId)
				//console.log('attaching listener to caseVariable')
				caseVariable.attach(listener, editId)
			}else{
				//console.log('no caseVariable to attach to')
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
		descend: function(path, editId, cb){
			console.log('TODO? - switch.descend?: ' + JSON.stringify(path))
			return false
		},
		getTopParent: function(id){
			if(s.objectState.isTopLevelObject(id)) return id
			_.assert(caseVariable)
			return caseVariable.getTopParent(id)
			
		}
	}
	
	function useCase(getter, editId){
		if(caseVariable) _.errout('TODO support varying prim variable');
		caseVariable = getter(bindings, editId)
		handle.descend = caseVariable.descend
		//handle.descendTypes = caseVariable.descendTypes
		//console.log('got case variable ' + listeners.length + ' ' + caseVariable.name)
		listeners.forEach(function(listener){
			caseVariable.attach(listener, editId)
		})
	}
	
	function switchCase(editId){
		for(var i=0;i<cases.length;++i){
			var c = cases[i]
			//console.log('trying: ' + c.value)
			_.assertFunction(c.getter)
			if(c.value === currentPrim.toString()){
				useCase(c.getter, editId)
				return
			}
		}
		if(defaultCase){
			//console.log('using default case')
			useCase(defaultCase.getter, editId)
		}else{
			//console.log('no default case')
		}
	}
	var currentPrim
	primVariable.attach({
		set: function(v, oldV, editId){
			//console.log('got prim variable: ' + v)
			if(v === currentPrim) _.errout('set to existing value: ' + currentPrim)
			currentPrim = v
			switchCase(editId)
		},
		includeView: function(){
			_.errout('TODO')
		},
		removeView: function(){
			_.errout('TODO')
		}
	}, editId)
	
	if(!caseVariable && defaultCase){
		useCase(defaultCase.getter, editId)
	}
	
	return handle//cache.store(key, handle)
}

