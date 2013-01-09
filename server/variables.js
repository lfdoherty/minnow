
/*

svg is short for 'specificVariableGetter'

Variables may sometimes update out-of-order, but once all updates to a given sequence of edits are complete,
the result will have arrived at a correct state.  In order to obtain correct snapshots or edit sequences,
systems using variables must only release edits or sequences of edits once the editIds they provided along with their
edit are less than or equal to the result of calling oldest() on the variable.

*/

var _ = require('underscorem')

function tabs(depth){var str = '';for(var i=0;i<depth;++i){str+='\t';}return str;}

function makeAnalytics(expr, parent, name, s){
	//_.assertDefined(s)
	
	var counts = {
		hit: 0,
		put: 0,
		evict: 0
	}

	var exprName = expr.view || expr.type || expr.name || expr.value
	if(exprName === undefined) console.log(JSON.stringify(expr))
	var handle = {
		cacheHit: function(){
			++counts.hit
		},
		cachePut: function(){
			++counts.put
		},
		cacheEvict: function(){
			++counts.evict
		},
		children: [],
		counts: counts,
		parent: parent,
		report: report,
		name: (name?name+'^':'') + exprName
	}
	
	_.assertString(handle.name)
	_.assert(handle.name != 'undefined')
	
	//console.log('made analytics: ' + (expr.view || expr.type) + ' < ' + parent.name)

	function report(depth){
		depth = depth || 0
		var str = ''
		var sum = counts.hit+counts.put+counts.evict
		str += tabs(depth) + handle.name + ' -- hit: ' + counts.hit+', put: '+counts.put+', evict: '+counts.evict+'\n'
		//if(sum > 0){
			handle.children.forEach(function(a){
				str += a.report(depth+1)
			})
		//}else if(handle.children.length > 0){str += tabs(depth+1)+'...\n'}
		

		return str
	}
	
	parent.children.push(handle)
	
	return handle
}

exports.makeAnalytics = makeAnalytics


var viewstate = require('./viewstate')

function makeGetter(s){
	//_.assertFunction(log)
	
	//var s = {schema: schema, globalMacros:globalMacros, objectState: objectState, broadcaster: broadcaster}
	//s.getAllSubtypes = viewstate.makeGetAllSubtypes(s.schema)
	//s.log = log
	
	//s.analytics = makeAnalytics({name: 'getter'}, {children:[]})
	
	var f = variableGetter.bind(undefined, s);
	return f;
}
exports.makeGetter = makeGetter

var listenerSet = require('./variable_listeners').makeListenerSet

require('./variables/property')
require('./variables/count')
require('./variables/aggregate')
require('./variables/typeset')
var variableView = require('./variables/view')
require('./variables/one')
var variableParam = require('./variables/param')

var variableObjectRef = require('./variables/objectref')

require('./variables/time')
require('./variables/map')
require('./variables/multimap')
require('./variables/top')
require('./variables/switch')
require('./variables/type')
require('./variables/filter')
require('./variables/each')
require('./variables/subset')
require('./variables/traverse')
require('./variables/sessions')
require('./variables/versions')
require('./variables/lastVersion')
require('./variables/timestamps')
require('./variables/timestamp')
require('./variables/isOfType')
require('./variables/allForked')
require('./variables/preforked')

var fixedPrimitive = require('./fixed/primitive')
var fixedObject = require('./fixed/object')
var fixedSet = require('./fixed/set')
var fixedMap = require('./fixed/map')
var macroCall = require('./variables/macrocall')
var schema = require('./../shared/schema')
var syncplugins = require('./variables/syncplugins')

function isView(expr, name){return expr.type === 'view' && expr.view === name;}

function asSync(s, expr, typeBindings, parameterBindings){
	//_.errout('TODO')
	if(expr.type === 'macro'){
		//return macroCall.make(s, self, setExpr, typeBindings)
		throw new Error('TODO: ' + JSON.stringify(expr))
	}else if(expr.type === 'param'){
		//return variableParam.make(s, setExpr, typeBindings)
		throw new Error('TODO')
	}else if(expr.type === 'value'){
		return function(){return setExpr.value;}
	}else if(expr.type === 'int'){
		return function(){return setExpr.value;}
	}else if(expr.type === 'concrete-specialization'){
		//return specialization.make(s, self, setExpr, typeBindings)
		throw new Error('TODO?')
	}else if(expr.type === 'array'){
		//return function(){return setExpr.value;}
		_.errout('DEPRECATED')
	}else{
		var viewName = expr.view
		var impl = schema.getImplementation(viewName)
		checkImpl(impl, expr, viewName)
		if(impl.isSynchronousPlugin){

			var f;

			if(expr.params.length === parameterBindings.length){
				var missing = false
				var paramMap = {}
				var isLinear = true
				parameterBindings.forEach(function(b, bIndex){
					var found = false
					expr.params.forEach(function(param, pIndex){
						if(param.name === b){
							paramMap[bIndex] = pIndex
							if(bIndex !== pIndex) isLinear = false
							found = true
						}
					})
					if(!found) missing = true
				})
				//console.log('missing: ' + missing)
				if(!missing){
					var f
					if(isLinear){
						f = function(){
							return impl.implementation(arguments)
						}						
					}else{
						f = function(){
							var params = []
							params.length = parameterBindings.length
							for(var i=0;i<parameterBindings.length;++i){
								params[paramMap[i]] = arguments[i]
							}
							return impl.implementation(params)
						}
					}
					f.isPure = true
					f.key = 'pure:'+JSON.stringify(expr)
					f.isSyncMacro = true
					
					var nf = function(/*bindings, editId*/){
						return f
					}
					nf.isSyncMacro = true
					return nf
				}
			}
				
			throw new Error('TODO: ' + JSON.stringify([expr.params, parameterBindings, missing]))
		}else{
			throw new Error('TODO: ' + JSON.stringify(expr))
		}
	}
}



function variableGetter(s, setExpr, typeBindings){
	_.assertObject(typeBindings)
	_.assertDefined(setExpr)
	_.assertFunction(s.log)
	_.assertObject(s.analytics)
	
	var ns = _.extend({}, s)
	ns.analytics = makeAnalytics(setExpr, s.analytics, '$', s)
	s = ns
	
	var self = variableGetter.bind(undefined, s)
	
	self.asSync = asSync.bind(undefined, s)
	
	if(setExpr.type === 'macro'){
		return macroCall.make(s, self, setExpr, typeBindings)
	}else if(setExpr.type === 'param'){
		return variableParam.make(s, setExpr, typeBindings)
	}else if(setExpr.type === 'value'){
		return fixedPrimitive.make(s, setExpr.value)
	}else if(setExpr.type === 'int'){
		return fixedPrimitive.make(s, setExpr.value)
	}else if(setExpr.type === 'concrete-specialization'){
		_.errout('TODO?')
	}else if(setExpr.type === 'nil'){
		_.errout('Should not instantiate nil')
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
			checkImpl(impl, setExpr, viewName)
			if(impl.isSynchronousPlugin){
				return syncplugins.wrap(s, self, setExpr, typeBindings, impl)
			}else{

				//console.log('setExpr: ' + JSON.stringify(setExpr))
				var implFunc = impl.implementation(s, self, setExpr, typeBindings)
				if(implFunc === undefined){
					_.errout('undefined implementation function: ' + JSON.stringify(setExpr))
				}
				_.assertFunction(implFunc)
				implFunc.implName = viewName
				return implFunc
			}
		}
	}
}

exports.variableGetter = variableGetter

function checkImpl(impl, setExpr, viewName){
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
		if(impl.callSyntax === undefined){
			_.errout('sync plugin has no callSyntax: ' + require('util').inspect(impl))
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

	for(var i=0;i<viewSchema.params.length;++i){
		var param = viewSchema.params[i]
		paramNames[i] = param.name
		if(param.type.type === 'primitive'){
			paramGetters[i] = fixedPrimitive.make(s)
		}else if(param.type.type === 'object'){
			paramGetters[i] = fixedObject.make(s)
		}else if(param.type.type === 'map'){
			paramGetters[i] = fixedMap.make(s)
		}else if(param.type.type === 'set'){
			paramGetters[i] = fixedSet.make(s)
		}else{
			_.errout('TODO: ' + JSON.stringify(param))
		}
	}
	
	var topLevel = {
		name: 'top-level',
		descend: function(path, editId, cb){
			//console.log('descending: ' + JSON.stringify(path))
			_.assert(s.objectState.isTopLevelObject(path[0].edit.id))
			
			s.objectState.streamProperty(path, editId, cb)
			return true
		},
		descendTypes: function(path, editId, cb, continueListening, mustMatch){
			//console.log('descending: ' + JSON.stringify(path))
			s.objectState.streamPropertyTypes(path, editId, cb, continueListening, mustMatch)
			return true
		},
		getType: function(id){
			return s.objectState.getObjectType(id)
		}
	}
	return function(params, startingEditId){
		_.assertArray(params)
		var bindings = {}

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


