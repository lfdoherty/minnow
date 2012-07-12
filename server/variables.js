
/*

svg is short for 'specificVariableGetter'

Variables may sometimes update out-of-order, but once all updates to a given sequence of edits are complete,
the result will have arrived at a correct state.  In order to obtain correct snapshots or edit sequences,
systems using variables must only release edits or sequences of edits once the editIds they provided along with their
edit are less than or equal to the result of calling oldest() on the variable.

*/

var _ = require('underscorem')

//var schemaModule = require('schema')
/*
var old = console.log
console.log = function(msg){
	msg = msg + ''
	if(msg.length > 1000) _.errout('too long: ' + msg.slice(0, 500))
	old(msg)
}*/

function makeGetter(schema, globalMacros, objectState, broadcaster){
	var s = {schema: schema, globalMacros:globalMacros, objectState: objectState, broadcaster: broadcaster}
	var f = variableGetter.bind(undefined, s);
	return f;
}
exports.makeGetter = makeGetter

var listenerSet = require('./variable_listeners').makeListenerSet

var variableProperty = require('./variables/property')
var variableCount = require('./variables/count')
var variableAggregate = require('./variables/aggregate')
var variableType = require('./variables/type')
var variableView = require('./variables/view')
var variableOne = require('./variables/one')
var variableParam = require('./variables/param')

var variableObjectRef = require('./variables/objectref')

require('./variables/time')
require('./variables/map')
require('./variables/multimap')
require('./variables/top')
//require('./variables/merge')
require('./variables/math')

var fixedPrimitive = require('./fixed/primitive')
var fixedObject = require('./fixed/object')

var macroCall = require('./variables/macrocall')

var schema = require('./../shared/schema')

var syncplugins = require('./variables/syncplugins')

function isView(expr, name){return expr.type === 'view' && expr.view === name;}

function variableGetter(s, setExpr, typeBindings){
	_.assertObject(typeBindings)
	_.assertDefined(setExpr)
	var self = variableGetter.bind(undefined, s)
	
	if(setExpr.type === 'property'){
		return variableProperty.make(s, self, setExpr, typeBindings)
	}else if(setExpr.type === 'macro'){
		return macroCall.make(s, self, setExpr, typeBindings)
	}else if(setExpr.type === 'param'){
		return variableParam.make(s, setExpr, typeBindings)
	}else if(setExpr.type === 'value'){
		return fixedPrimitive.make(s, setExpr.value)
	}else if(setExpr.type === 'int'){
		return fixedPrimitive.make(s, setExpr.value)
	}else{
		//console.log('did not find macro type for: ' + setExpr.view)
		//console.log(JSON.stringify(typeBindings))
		
		var viewName = setExpr.view
		//console.log(JSON.stringify(setExpr))
		_.assertString(viewName)
		_.assert(viewName.length > 0)
		
		if(s.schema[viewName] !== undefined){
			if(s.schema[viewName].isView){
				//_.errout('TODO wrap view object')
				return variableView.make(s, self, setExpr, typeBindings)
			}else{
				return variableObjectRef.make(s, self, setExpr, typeBindings)
			}
		}else{
			var impl = schema.getImplementation(viewName)
			if(!_.isInt(impl.minParams)) throw new Error(viewName + ' missing minParams setting')
			if(!_.isInt(impl.maxParams)) throw new Error(viewName + ' missing maxParams setting')
			if(impl.maxParams !== 0 && !_.isString(impl.callSyntax)) throw new Error(viewName + ' missing callSyntax setting')
			if(impl.maxParams === 0 && setExpr.params.length !== 0){
				throw new Error(setExpr.params.length + ' is too many parameters for ' + viewName + '()');
			}else{
				if(setExpr.params.length < impl.minParams) throw new Error(setExpr.params.length + ' is too few params for ' + callSyntax)
				if(impl.maxParams !== -1){
					if(setExpr.params.length > impl.maxParams) throw new Error(setExpr.params.length + ' is too many params for ' + callSyntax)
				}
			}
			if(impl.isSynchronousPlugin){
				//_.errout('TODO')
				return syncplugins.wrap(s, self, setExpr, typeBindings, impl)
			}else{
				var implFunc = impl.implementation(s, self, setExpr, typeBindings)
				_.assertFunction(implFunc)
				implFunc.implName = viewName
				return implFunc
			}
		}
	}
}

//TODO make function that goes through params of view described in viewSchema
//and builds variables for each
//TODO note the issue that if the param is an object, we want to immediately shortcut any
//property descent.
//TODO impl. param.js first?

exports.makeBindingsForViewGetter = function(s, viewSchema){
	var paramGetters = []
	var paramNames = []
	viewSchema.params.forEach(function(param, index){
		paramNames[index] = param.name
		if(param.type.type === 'primitive'){
			paramGetters[index] = fixedPrimitive.make(s)
		}else if(param.type.type === 'object'){
			paramGetters[index] = fixedObject.make(s)
		}else{
			_.errout('TODO: ' + JSON.stringify(param))
		}
		//variableGetter(
	})
	
	return function(params, startingEditId){
		_.assertArray(params)
		var bindings = {}
		paramGetters.forEach(function(pg, index){
			bindings[paramNames[index]] = pg(params[index], startingEditId)
		})
		console.log('created bindings for params: ' + JSON.stringify(params) + '->' + JSON.stringify(bindings))
		return bindings;
	}
}


