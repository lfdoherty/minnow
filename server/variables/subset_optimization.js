"use strict";

var _ = require('underscorem')
var u = require('./optimization_util')
var schema = require('./../../shared/schema')
var analytics = require('./../analytics')

/*
let(*typeset,'gp',
	intersection(
		mapValue(param, multimap-optimization(gp, {~.property1}, {~}))
		mapValue(param, multimap-optimization(gp, {~.property2}, {~}))
	)
)

single case:
let(*typeset,'gp',
	mapValue(param, multimap-optimization(gp, {~.property1}, {~}))
)
*/
schema.addFunction('subset-optimization-with-params', {
	schemaType: require('./each').eachType,
	minParams: 3,
	maxParams: -1,
	callSyntax: 'subset-optimization-with-params(mergeMacro,params,...,multimaps,...)',
	//macros: {1: 1},
	computeAsync: function(z, cb, input, macro){
		_.errout('this should never happen')
	}
})

//takes the rel for the each
exports.make = function(s, rel, recurse, handle, ws){

	//console.log(JSON.stringify(rel, null, 2))
	
	var manyParts = (rel.params.length-1)/2
	
	var multimaps = []
	var params = []
	for(var i=1;i<rel.params.length-1;++i){
		var externalParam = rel.params[i]
		var multimapExpr = rel.params[i+1]
		multimaps.push(recurse(multimapExpr))
		params.push(recurse(externalParam))
	}
	
	var a = analytics.make('subset-optimization-with-params', multimaps)
	
	//if(multimaps.length > 1) _.errout('TODO')
	
	var handle = {
		name: 'subset-optimization-with-params',
		analytics: a,
		getStateAt: function(bindings, editId, cb){
			params[0].getStateAt(bindings, editId, function(paramValue){
				//console.log('paramValue: ' + JSON.stringify(paramValue))
				multimaps[0].getValueStateAt(paramValue, bindings, editId, function(values){
					//_.errout('TODO: ' + JSON.stringify(values))
					cb(values)
				})
			})
		},
		getChangesBetween: function(bindings, startEditId, endEditId, cb){
			//_.errout('TODO')
			params[0].getHistoricalChangesBetween(bindings, startEditId, endEditId, function(changes){
				if(changes.length > 0){
					if(changes.length === 1 && changes[0].editId === 0){
					
						params[0].getStateAt(bindings, 0, function(paramValue){
							//console.log('paramValue: ' + JSON.stringify(paramValue) + ' ' + JSON.stringify(changes))
							multimaps[0].getValueChangesBetween(paramValue, bindings, startEditId, endEditId, function(changes){
								//_.errout('TODO: ' + JSON.stringify(changes))
								cb(changes)
							})
						})
					}else{
						_.errout('TODO: ' + JSON.stringify(changes) + ' ' + startEditId + ' ' + endEditId)
					}
					//_.errout('TODO: ' + JSON.stringify(changes))
				}else{
					//_.errout('TODO: ' + JSON.stringify(changes))
					params[0].getStateAt(bindings, startEditId, function(paramValue){
						//console.log('paramValue: ' + JSON.stringify(paramValue) + ' ' + JSON.stringify(changes))
						multimaps[0].getValueChangesBetween(paramValue, bindings, startEditId, endEditId, function(changes){
							//_.errout('TODO: ' + JSON.stringify(changes))
							cb(changes)
						})
					})
				}
			})
		},
		
	}
	handle.getHistoricalChangesBetween = handle.getChangesBetween
	return handle
}

