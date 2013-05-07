

var _ = require('underscorem')

var schema = require('./../shared/schema')

var analytics = require('./analytics')

var editFp = require('./tcp_shared').editFp
var editCodes = editFp.codes
var editNames = editFp.names

var wu = require('./wraputil')

var opu = require('./oputil')



function makeSwitchRel(s, context, cases, defaultCase, ws, rel, staticBindings){

	_.assertNot(rel.sync)
	//console.log(JSON.stringify(rel.params, null, 2))
	//_.errout('TODO')
	/*if(rel.params[0].view === 'type' && context.isFullySync){
		_.errout('TODO: ' + JSON.stringify(rel.params[0].params[0]))
	}*/
	
	var staticCaseValues = []
	cases.forEach(function(c, index){
		/*c.value.getStateAt(bindings, editId, function(state){
			caseValues[index] = state
			cdl()
		})*/
		//if(!c.expr.getHistoricalChangesBetween) _.errout('missing getHistoricalChangesBetween: ' + c.expr.name)
		
		staticCaseValues[index] = c.value.getStaticValue()
	})
	
	var na = analytics.make('switch-null-case', [])
	var nullCase = {
		name: 'switch-null-case',
		analytics: na,
		getStateAt: function(bindings, editId, cb){
			cb(undefined)
		},
		getChangesBetween: function(bindings, startEditId, endEditId, cb){
			cb([])
		},
		getHistoricalChangesBetween: function(bindings, startEditId, endEditId, cb){
			cb([])
		}
	}
	
	function getCurrentCase(bindings, editId, cb){
		//var caseValues = []
		//var contextState
		//var cdl = _.latch(cases.length+1, function(){
		if(context.getAt){
			var contextState = context.getAt(bindings, editId)

			if(!_.isPrimitive(contextState)) _.errout('TODO: ' + JSON.stringify(contextState))
		
			for(var i=0;i<staticCaseValues.length;++i){
				var cv = staticCaseValues[i]
				if(!_.isPrimitive(cv)) _.errout('TODO: ' + JSON.stringify(cv))
				if(cv === contextState){
					cases[i].expr
					cb(cases[i].expr)
					return
				}
			}
			if(!defaultCase){
				console.log('WARNING: (' + editId + ') all cases ' + JSON.stringify(staticCaseValues) + ' failed to match ' + JSON.stringify(contextState)+', need default case for value: ' + JSON.stringify(contextState))
				cb(nullCase)
				return
			}
		
			//console.log('default case')
			cb(defaultCase)
		}else{
			context.getStateAt(bindings, editId, function(contextState){

				if(!_.isPrimitive(contextState)) _.errout('TODO: ' + JSON.stringify(state))
			
				for(var i=0;i<staticCaseValues.length;++i){
					var cv = staticCaseValues[i]
					if(!_.isPrimitive(cv)) _.errout('TODO: ' + JSON.stringify(cv))
					if(cv === contextState){
						cases[i].expr
						cb(cases[i].expr)
						return
					}
				}
				if(!defaultCase){
					console.log('WARNING: (' + editId + ') all cases ' + JSON.stringify(staticCaseValues) + ' failed to match ' + JSON.stringify(contextState)+', need default case for value: ' + JSON.stringify(contextState))
					cb(nullCase)
					return
				}
			
				//console.log('default case')
				cb(defaultCase)
			})
		}
		//})
		/*cases.forEach(function(c, index){
			c.value.getStateAt(bindings, editId, function(state){
				caseValues[index] = state
				cdl()
			})
		})*/
		/*context.getStateAt(bindings, editId, function(state){
			contextState = state
			cdl()
		})*/
	}
	
	var aChildren = [context]
	cases.forEach(function(c){aChildren.push(c.expr);aChildren.push(c.value);})
	if(defaultCase) aChildren.push(defaultCase)
	var a = analytics.make('switch', aChildren)
	
	var parts = ''
	cases.forEach(function(c, index){
		if(index > 0) parts += ', '
		parts += c.expr.name
	})
	if(defaultCase){
		parts += ', default: ' + defaultCase.name
	}
	var handle = {
		name: 'switch['+parts+']',
		analytics: a,
		getStateAt: function(bindings, editId, cb){
			//console.log('here')
			
			getCurrentCase(bindings, editId, function(currentCase){
				//console.log('currentCase: ' + JSON.stringify(currentCase) + ' ' + JSON.stringify(cv) + ' ' + JSON.stringify(currentState))
				//console.log('case: ' + currentCase.getStateAt)
				currentCase.getStateAt(bindings, editId, function(state){
					//console.log('got state: ' + cb)
					cb(state)
				})
			})
		}
	}
	//handle.getInclusionsDuring = wu.makeGenericGetInclusionsDuring(handle, ws)
	handle.getChangesBetween = wu.makeGenericGetChangesBetween(handle, ws, rel)
	
	var genericHistoricalChangesBetween = wu.makeGenericHistoricalChangesBetween(handle, ws)
	
	handle.getHistoricalChangesBetween = function(bindings, startEditId, endEditId, cb){	
		context.getHistoricalChangesBetween(bindings, startEditId, endEditId, function(changes){
			if(changes.length === 1 && changes[0].editId === 0 && changes[0].type === 'set'){
				
				var singleResult = changes[0].value
				
				for(var i=0;i<staticCaseValues.length;++i){
					var scv = staticCaseValues[i]
					if(singleResult === scv){
						cases[i].expr.getHistoricalChangesBetween(bindings, -1, endEditId, function(exprChanges){
							cb(exprChanges)
						})
						return
					}
				}
				if(defaultCase){
					defaultCase.getHistoricalChangesBetween(bindings, -1, endEditId, function(exprChanges){
						cb(exprChanges)
					})
					return
				}
				_.errout('error, cannot compute result, no case matches: ' + JSON.stringify([singleResult, staticCaseValues]))
			}else{
				//console.log(JSON.stringify(changes))
				
				genericHistoricalChangesBetween(bindings, startEditId, endEditId, cb)
			}
		})
	}
	
	handle.getPropertyValueAt = function(bindings, mutatorToken, getter, id, editId, cb){
		getCurrentCase(bindings, editId, function(currentCase){
			if(!currentCase.getPropertyValueAt) _.errout('missing getPropertyValueAt: ' + currentCase.name)
			//console.log('getting case propertyValueAt')
			currentCase.getPropertyValueAt(bindings, mutatorToken, getter, id, editId, cb)
		})
	}
	handle.getPropertyValueAt
	
	return handle
}

function makeSwitchRelSync(s, context, cases, defaultCase, ws, rel, staticBindings){

	/*if(rel.params[0].view === 'type' && context.isFullySync){
		_.errout('TODO: ' + JSON.stringify(rel.params[0].params[0]))
	}*/
	
	var staticCaseValues = []
	cases.forEach(function(c, index){
		/*c.value.getStateAt(bindings, editId, function(state){
			caseValues[index] = state
			cdl()
		})*/
		if(!c.expr.getHistoricalBetween) _.errout('missing getHistoricalBetween: ' + c.expr.name)
		
		var value = staticCaseValues[index] = c.value.getStaticValue()
		if(!_.isPrimitive(value)) _.errout('TODO: ' + JSON.stringify(value))
	})
	
	if(!context.getAt) _.errout('missing getAt: ' + context.name)
	
	function getCurrentCase(bindings, editId){
		//var caseValues = []
		//var contextState
		//var cdl = _.latch(cases.length+1, function(){
		var contextState = context.getAt(bindings, editId)//, function(contextState){

		if(!_.isPrimitive(contextState)) _.errout('TODO: ' + JSON.stringify(state))
		//console.log('selecting switch match for: ' + JSON.stringify(contextState) + ' ' + JSON.stringify(staticCaseValues) + ' ' + context.name)
		
		for(var i=0;i<staticCaseValues.length;++i){
			var cv = staticCaseValues[i]
			//console.log('comparing: ' + cv)
			if(cv === contextState){
				cases[i].expr
				//cb(cases[i].expr,cv)
				return cases[i].expr//,cv, contextState]
				//return
			}
		}
		if(!defaultCase) _.errout('ERROR: all cases ' + JSON.stringify(staticCaseValues) + ' failed to match ' + JSON.stringify(contextState)+', need default case for value: ' + JSON.stringify(contextState))
		
		//console.log('default case')
		return defaultCase//, 'default case', contextState]
		//})
		//})
		/*cases.forEach(function(c, index){
			c.value.getStateAt(bindings, editId, function(state){
				caseValues[index] = state
				cdl()
			})
		})*/
		/*context.getStateAt(bindings, editId, function(state){
			contextState = state
			cdl()
		})*/
	}
	
	var aChildren = [context]
	cases.forEach(function(c){aChildren.push(c.expr);aChildren.push(c.value);})
	if(defaultCase) aChildren.push(defaultCase)
	var a = analytics.make('switch', aChildren)
	
	var parts = ''
	cases.forEach(function(c, index){
		if(index > 0) parts += ', '
		parts += c.expr.name
	})
	if(defaultCase){
		parts += ', default: ' + defaultCase.name
	}
	var handle = {
		name: 'switch['+parts+']',
		analytics: a,
		getAt: function(bindings, editId){
			//console.log('here')
			
			var currentCase = getCurrentCase(bindings, editId)//, function(currentCase,cv,currentState){
			//var currentCase = resarr[0]
			//var cv = resarr[1]
			//var contextState = resarr[2]
			
			var res = currentCase.getAt(bindings, editId)
			//console.log(editId + ' switch getAt: ' + currentCase.name + ' ' + JSON.stringify(res) + ' ' + JSON.stringify(staticCaseValues))// + ' ' + context.name)
			return res
			
			//cb(currentState)
				//console.log('currentCase: ' + JSON.stringify(currentCase) + ' ' + JSON.stringify(cv) + ' ' + JSON.stringify(currentState))
				//console.log('case: ' + currentCase.getStateAt)
			//currentCase.getStateAt(bindings, editId)//, function(state){
				//console.log('got state: ' + cb)
			//	cb(state)
			//})
			//})
		}
	}
	//handle.getInclusionsDuring = wu.makeGenericGetInclusionsDuring(handle, ws)
	handle.getBetween = wu.makeGenericGetBetween(handle, ws, rel)
	
	var genericHistoricalChangesBetween = wu.makeGenericHistoricalChangesBetween(handle, ws)
	
	handle.getHistoricalBetween = function(bindings, startEditId, endEditId){	
		var changes = context.getHistoricalBetween(bindings, startEditId, endEditId)//, function(changes){
		if(changes.length === 1 && changes[0].editId === 0 && changes[0].type === 'set'){
			
			var singleResult = changes[0].value
			
			for(var i=0;i<staticCaseValues.length;++i){
				var scv = staticCaseValues[i]
				if(singleResult === scv){
					var exprChanges = cases[i].expr.getHistoricalBetween(bindings, -1, endEditId)//, function(exprChanges){
					return exprChanges
				}
			}
			if(defaultCase){
				var exprChanges = defaultCase.getHistoricalBetween(bindings, -1, endEditId)
				return exprChanges
			}
			_.errout('error, cannot compute result, no case matches: ' + JSON.stringify([singleResult, staticCaseValues]))
		}else if(changes.length === 0){
			var currentCase = getCurrentCase(bindings, startEditId)
			return currentCase.getHistoricalBetween(bindings, startEditId, endEditId)
		}else{
			//console.log(JSON.stringify(changes))
			
			//genericHistoricalChangesBetween(bindings, startEditId, endEditId, cb)
			_.errout('tODO: ' + JSON.stringify(changes))
		}
	}
	
	handle.getPropertyValueAt = function(bindings, mutatorToken, getter, id, editId, cb){
		getCurrentCase(bindings, editId, function(currentCase){
			if(!currentCase.getPropertyValueAt) _.errout('missing getPropertyValueAt: ' + currentCase.name)
			//console.log('getting case propertyValueAt')
			currentCase.getPropertyValueAt(bindings, mutatorToken, getter, id, editId, cb)
		})
	}
	handle.getPropertyValueAt
	
	//if(handle.newStaticBindings) h
	
	return handle
}

exports.make = makeSwitchRel
exports.makeSync = makeSwitchRelSync
