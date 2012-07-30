"use strict";

var _ = require('underscorem')

var Cache = require('./../variable_cache')
var schema = require('./../../shared/schema')
var listenerSet = require('./../variable_listeners')

var fixedPrimitive = require('./../fixed/primitive')

function realType(){return {type: 'primitive', primitive: 'real'};}
function boolType(){return {type: 'primitive', primitive: 'boolean'};}

function stub(){}

schema.addFunction('div', {
	schemaType: realType,
	implementation: binaryMaker.bind(undefined, divFunction),
	minParams: 2,
	maxParams: 2,
	callSyntax: 'div(number, number)'
})
schema.addFunction('mul', {
	schemaType: realType,
	implementation: binaryMaker.bind(undefined, mulFunction),
	minParams: 2,
	maxParams: 2,
	callSyntax: 'mul(number, number)'
})
function isNumberType(v){
	return v.type === 'int' || v.type === 'long' || v.type === 'real' || v.primitive === 'int' || v.primitive === 'long' || v.primitive === 'real' || v.primitive === 'timestamp'
}

function addOrSubType(rel, ch){
	if(rel.params.length !== 2) throw new Error('wtf: ' + rel.params.length)
	var vta = rel.params[0].schemaType//ch.computeType(rel.params[0], ch.bindingTypes)
	var vtb = rel.params[1].schemaType//ch.computeType(rel.params[1], ch.bindingTypes)
	_.assertEqual(vta.type, 'primitive');
	_.assertEqual(vtb.type, 'primitive');

	if(!isNumberType(vta)) throw new Error('invalid param 1 type for ' + rel.view + ': ' + JSON.stringify(vta))
	if(!isNumberType(vtb)) throw new Error('invalid param 2 type for ' + rel.view + ': ' + JSON.stringify(vtb))

	if(vta.type === 'real' || vtb.type === 'real') return {type: 'primitive', primitive: 'real'};
	if(vta.type === 'long' || vtb.type === 'long') return {type: 'primitive', primitive: 'long'};
	return {type: 'primitive', primitive: 'int'}
}
function eitherType(rel, ch){
	var vta = rel.params[0].schemaType
	var vtb = rel.params[1].schemaType
	//TODO check that vta is the same as vtb
	return vta
}
schema.addFunction('add', {
	schemaType: addOrSubType,
	implementation: binaryMaker.bind(undefined, addFunction),
	minParams: 2,
	maxParams: 2,
	callSyntax: 'add(number,number)'
})
schema.addFunction('sub', {
	schemaType: addOrSubType,
	implementation: binaryMaker.bind(undefined, subFunction),
	minParams: 2,
	maxParams: 2,
	callSyntax: 'sub(number,number)'
})

schema.addFunction('greaterThan', {
	schemaType: boolType,
	implementation: binaryMaker.bind(undefined, greaterThanFunction),
	minParams: 2,
	maxParams: 2,
	callSyntax: 'greaterThan(number,number)'
})
schema.addFunction('lessThan', {
	schemaType: boolType,
	implementation: binaryMaker.bind(undefined, lessThanFunction),
	minParams: 2,
	maxParams: 2,
	callSyntax: 'lessThan(number,number)'
})

schema.addFunction('and', {
	schemaType: boolType,
	implementation: binaryMaker.bind(undefined, andFunction),
	minParams: 2,
	maxParams: 2,
	callSyntax: 'and(boolean, boolean)'
})
schema.addFunction('or', {
	schemaType: boolType,
	implementation: binaryMaker.bind(undefined, orFunction),
	minParams: 2,
	maxParams: 2,
	callSyntax: 'or(boolean, boolean)'
})
schema.addFunction('eq', {
	schemaType: boolType,
	implementation: binaryMaker.bind(undefined, eqFunction),
	minParams: 2,
	maxParams: 2,
	callSyntax: 'eq(primitive, primitive)'
})

schema.addFunction('log', {
	schemaType: realType,
	implementation: binaryMaker.bind(undefined, logFunction),
	minParams: 2,
	maxParams: 2,
	callSyntax: 'log(base, value)'
})

schema.addFunction('either', {
	schemaType: eitherType,
	implementation: eitherMaker.bind(undefined, eitherFunction),
	minParams: 2,
	maxParams: 2,
	callSyntax: 'either(a,b)'
})


function isView(expr, name){return expr.type === 'view' && expr.view === name;}

function divFunction(a, b){return a/b}
function mulFunction(a, b){return a*b}
function addFunction(a, b){return a+b}
function subFunction(a, b){return a-b}
function andFunction(a, b){return a&&b}
function orFunction(a, b){return a||b}
function eqFunction(a, b){return a===b}
function logFunction(base, value){return Math.log(value)/Math.log(base)}

function eitherFunction(a, b){
	if(a){
		//console.log('either a: ' + a)
		return a
	}else{
		//console.log('either b: ' + b)
		return b
	}
}

function greaterThanFunction(a, b){
	_.assertNumber(a);
	_.assertNumber(b);
	//console.log(a+' > '+b);
	return a>b
}
function lessThanFunction(a, b){return a<b}

function binaryMaker(f, s, self, rel, typeBindings){

	if(rel.params.length !== 2) throw new Error('wrong number of params for ' + rel.view + ': ' + rel.params.length)
	
	var aExprGetter = self(rel.params[0], typeBindings)
	var bExprGetter = self(rel.params[1], typeBindings)
	
	var cache = new Cache()	
	var f = svgBinary.bind(undefined, s, cache, f, aExprGetter, bExprGetter)
	f.wrapAsSet = function(v, editId){
		return fixedPrimitive.make(s, v)({},editId)
	}
	return f
}
function eitherMaker(f, s, self, rel, typeBindings){

	if(rel.params.length !== 2) throw new Error('wrong number of params for ' + rel.view + ': ' + rel.params.length)
	
	var aExprGetter = self(rel.params[0], typeBindings)
	var bExprGetter = self(rel.params[1], typeBindings)
	
	var cache = new Cache()	
	var f = svgEither.bind(undefined, s, cache, f, aExprGetter, bExprGetter)
	f.wrapAsSet = aExprGetter.wrapAsSet
	return f
}

function svgBinary(s, cache, func, aExprGetter, bExprGetter, bindings, editId){

	var a = aExprGetter(bindings, editId)
	var b = bExprGetter(bindings, editId)

	//console.log('making: ' + func)
	//console.log('a: ' + require('util').inspect(Object.keys(a)))
	
	var key = a.key+'+'+b.key
	if(cache.has(key)) return cache.get(key)
	
	var listeners = listenerSet()

	var av
	var bv
	var result
	
	function update(editId){
		var oldResult = result
		result = func(av, bv)
		if(result !== oldResult){
			//console.log('setting: ' + result + ' <- ' + oldResult)
			listeners.emitSet(result, oldResult, editId)
		}else{
			s.log('same: ' + result)
		}
	}
	
	a.attach({
		set: function(value, oldValue, editId){
			av = value
			//console.log('binary op value 1 set: ' + value)
			if(bv !== undefined && av !== undefined){
				update(editId)
			}
		}
	}, editId)
	b.attach({
		set: function(value, oldValue, editId){
			//if(value === undefined) throw new Error()
			//console.log('binary op value 2 set: ' + value)
			bv = value
			if(bv !== undefined && av !== undefined){
				//console.log('calculating binary result')
				update(editId)
			}
		},
		objectChange: stub
	}, editId)	
	
	function oldest(){
		return Math.min(a.oldest(), b.oldest())
	}
	
	var handle = {
		name: 'binaryop',
		attach: function(listener, editId){
			listeners.add(listener)
			if(result !== undefined){
				listener.set(result, undefined, editId)
			}
		},
		detach: function(listener, editId){
			listeners.remove(listener)
			if(editId !== undefined){
				if(result !== undefined){
					listener.set(undefined, result, editId)
				}
			}
		},
		oldest: oldest,
		key: key
	}
	
	return cache.store(key, handle)
}


function svgEither(s, cache, func, aExprGetter, bExprGetter, bindings, editId){

	var a = aExprGetter(bindings, editId)
	var b = bExprGetter(bindings, editId)

	var key = a.key+'+'+b.key
	if(cache.has(key)) return cache.get(key)
	
	var listeners = listenerSet()

	var av
	var bv
	var result
	
	a.attach({
		set: function(value, oldValue, editId){
			av = value
			//console.log('*binary op value 1 set: ' + value)
			if(av!==undefined){
				//console.log('either setting: ' + av)
				listeners.emitSet(av, bv!==undefined?bv:oldValue, editId)
			}
		}
	}, editId)
	b.attach({
		set: function(value, oldValue, editId){
			//if(value === undefined) throw new Error()
			//console.log('*binary op value 2 set: ' + value)
			bv = value
			if(bv!==undefined && av===undefined){
				//console.log('either setting: ' + bv)
				listeners.emitSet(bv, undefined, editId)
			}else if(av === undefined && oldValue !== undefined){
				listeners.emitSet(undefined, oldValue, editId)
			}
		},
		objectChange: stub
	}, editId)	
	
	function oldest(){
		return Math.min(a.oldest(), b.oldest())
	}
	
	var handle = {
		attach: function(listener, editId){
			listeners.add(listener)
			var result = av!==undefined?av:bv
			if(result !== undefined){
				listener.set(result, undefined, editId)
			}
		},
		detach: function(listener, editId){
			listeners.remove(listener)
			if(editId !== undefined){
				var result = av!==undefined?av:bv
				if(result !== undefined){
					listener.set(undefined, result, editId)
				}
			}
		},
		oldest: oldest,
		key: key
	}
	
	return cache.store(key, handle)
}

