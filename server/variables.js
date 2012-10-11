
/*

svg is short for 'specificVariableGetter'

Variables may sometimes update out-of-order, but once all updates to a given sequence of edits are complete,
the result will have arrived at a correct state.  In order to obtain correct snapshots or edit sequences,
systems using variables must only release edits or sequences of edits once the editIds they provided along with their
edit are less than or equal to the result of calling oldest() on the variable.

*/

var _ = require('underscorem')

var viewstate = require('./viewstate')

function makeGetter(schema, globalMacros, objectState, broadcaster, log){
	_.assertFunction(log)
	
	var s = {schema: schema, globalMacros:globalMacros, objectState: objectState, broadcaster: broadcaster}
	s.getAllSubtypes = viewstate.makeGetAllSubtypes(schema)
	s.log = log
	var f = variableGetter.bind(undefined, s);
	return f;
}
exports.makeGetter = makeGetter

var listenerSet = require('./variable_listeners').makeListenerSet

var variableProperty = require('./variables/property')
var variableCount = require('./variables/count')
var variableAggregate = require('./variables/aggregate')
require('./variables/typeset')
var variableView = require('./variables/view')
var variableOne = require('./variables/one')
var variableParam = require('./variables/param')

var variableObjectRef = require('./variables/objectref')

require('./variables/time')
require('./variables/map')
require('./variables/multimap')
require('./variables/top')
require('./variables/switch')
require('./variables/type')
require('./variables/cast')
//require('./variables/values')
require('./variables/filter')
require('./variables/each')
require('./variables/subset')
require('./variables/sessions')
require('./variables/versions')
require('./variables/lastVersion')
require('./variables/timestamps')
require('./variables/timestamp')

var fixedPrimitive = require('./fixed/primitive')
var fixedObject = require('./fixed/object')
var fixedSet = require('./fixed/set')
var macroCall = require('./variables/macrocall')
var schema = require('./../shared/schema')
var syncplugins = require('./variables/syncplugins')

function isView(expr, name){return expr.type === 'view' && expr.view === name;}

function variableGetter(s, setExpr, typeBindings){
	_.assertObject(typeBindings)
	_.assertDefined(setExpr)
	_.assertFunction(s.log)
	
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
	}else if(setExpr.type === 'concrete-specialization'){
		//return specialization.make(s, self, setExpr, typeBindings)
		_.errout('TODO?')
	}else if(setExpr.type === 'array'){
		return fixedSet.make(s, setExpr.value)
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
				if(setExpr.params.length < impl.minParams) throw new Error(setExpr.params.length + ' is too few params for ' + impl.callSyntax)
				if(impl.maxParams !== -1){
					if(setExpr.params.length > impl.maxParams) throw new Error(setExpr.params.length + ' is too many params for ' + impl.callSyntax)
				}
			}
			if(impl.isSynchronousPlugin){
				//_.errout('TODO')
				//_.assertString(impl.syntax)
				if(impl.callSyntax === undefined){
					_.errout('sync plugin has no callSyntax: ' + require('util').inspect(impl))
				}
				return syncplugins.wrap(s, self, setExpr, typeBindings, impl)
			}else{
				//console.log('setExpr: ' + JSON.stringify(setExpr))
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
	//viewSchema.params.forEach(function(param, index){
	for(var i=0;i<viewSchema.params.length;++i){
		var param = viewSchema.params[i]
		paramNames[i] = param.name
		if(param.type.type === 'primitive'){
			paramGetters[i] = fixedPrimitive.make(s)
		}else if(param.type.type === 'object'){
			paramGetters[i] = fixedObject.make(s)
		}else{
			_.errout('TODO: ' + JSON.stringify(param))
		}
		//variableGetter(
	}
	
	var topLevel = {
		name: 'top-level',
		descend: function(path, editId, cb){
			//console.log('descending: ' + JSON.stringify(path))
			s.objectState.streamProperty(path, editId, cb)
		},
		getType: function(id){
			return s.objectState.getObjectType(id)
		}
	}
	return function(params, startingEditId){
		_.assertArray(params)
		var bindings = {}
		//paramGetters.forEach(function(pg, index){
		for(var i=0;i<paramGetters.length;++i){
			var pg = paramGetters[i]
			var pgv = pg(params[i], startingEditId, topLevel)
			_.assertString(pgv.name)
			bindings[paramNames[i]] = pgv
		}
		//console.log('created bindings for params: ' + JSON.stringify(params) + '->' + JSON.stringify(bindings))
		return bindings;
	}
}


