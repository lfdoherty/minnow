
var _ = require('underscorem')

var schema = require('./../shared/schema')

var analytics = require('./analytics')


function makeMacroBinding(implicit, macroParamType){
	var nameStr = 'macro_param['+(JSON.stringify(macroParamType))+':'+implicit+']'
	var a = analytics.make(nameStr, [])
	return {
		name: nameStr,
		getStateSync: function(bindingValues){
			var b = bindingValues[implicit]
			return b
		},
		isFullySync: true,
		/*getConfiguredIdAt: function(id, bindings, editId, cb){
			handle.getStateAt(bindings, editId, function(realId){
				_.assert(realId === id || (realId.top === id.top && realId.inner === id.inner))
				cb(realId)
			})
		},*/
		getAt: function(bindings, editId){
			if(editId >= 0){
				console.log('getting binding(' + implicit+'): ' + bindings[implicit])
				var b = bindings[implicit]
				return b
			}else{
				if(macroParamType.type === 'set'){
					console.log(JSON.stringify(macroParamType))
					return []
				}else{
					return undefined
				}
			}
		},		
		getStateAt: function(bindings, editId, cb){
			if(editId >= 0){
				//console.log('getting binding(' + implicit+'): ' + bindings[implicit])
				var b = bindings[implicit]
				cb(b)
			}else{
				if(macroParamType.type === 'set'){
					console.log(JSON.stringify(macroParamType))
					cb([])
				}else{
					cb(undefined)
				}
			}
		},
		getChangesBetween: function(bindings, startEditId, endEditId, cb){
			if(startEditId > 0){
				//console.log('startEditId greater ' + startEditId + ',' + endEditId)
				cb([])
			}else if(endEditId >= 0){
				var v = bindings[implicit]
				if(_.isArray(v)){
					//_.errout('TODO?: ' + JSON.stringify(v))
					var edits = []
					v.forEach(function(ve){
						edits.push({type: 'add', value: ve, editId: 0})
					})
					cb(edits)
				}else{
					if(v===undefined){
						//console.log('no binding')
						cb([])
					}else{
						cb([{type: 'set', value: v, editId: endEditId}])//, editId: bindings.__bindingTimes[paramName]}])
					}
				}
			}else{
				//console.log('startEditId lesser ' + startEditId + ',' + endEditId)
				cb([])
			}
		},
		getBetween: function(bindings, startEditId, endEditId, cb){
			if(startEditId > 0){
				//console.log('startEditId greater ' + startEditId + ',' + endEditId)
				return []
			}else if(endEditId >= 0){
				var v = bindings[implicit]
				if(_.isArray(v)){
					//_.errout('TODO?: ' + JSON.stringify(v))
					var edits = []
					v.forEach(function(ve){
						edits.push({type: 'add', value: ve, editId: 0})
					})
					return edits
				}else{
					if(v===undefined){
						//console.log('no binding')
						return []
					}else{
						return [{type: 'set', value: v, editId: endEditId}]
					}
				}
			}else{
				//console.log('startEditId lesser ' + startEditId + ',' + endEditId)
				return []
			}
		},
		getHistoricalChangesBetween: function(bindings, startEditId, endEditId, cb){
			var v = bindings[implicit]
			//if(_.isArray(v)) _.errout('TODO?: ' + JSON.stringify(v))
			if(_.isArray(v)){
				/*if(v === undefined) _.errout('undefined set value in binding: ' + implicit)
				if(!_.isArray(v)){
					_.errout('invalid value, should be array: ' + JSON.stringify(macroParamType) + ' ' + JSON.stringify(v))
				}*/
				if(startEditId === -1 && endEditId >= 0){
					//cb([{type: 'set', value: v, editId: 0}])
					var edits = []
					v.forEach(function(ve){
						edits.push({type: 'add', value: ve, editId: 0})
					})
					cb(edits)
				}else{
					cb([])
				}
			}else if(v !== undefined){
				//console.log('got v: ' + JSON.stringify(v))
				if(startEditId === -1 && endEditId >= 0){
					cb([{type: 'set', value: v, editId: 0}])
				}else{
					cb([])
				}
			}else{
				cb([])
			}
		},
		getHistoricalBetween: function(bindings, startEditId, endEditId){
			var v = bindings[implicit]
			//if(_.isArray(v)) _.errout('TODO?: ' + JSON.stringify(v))
			if(_.isArray(v)){
				/*if(v === undefined) _.errout('undefined set value in binding: ' + implicit)
				if(!_.isArray(v)){
					_.errout('invalid value, should be array: ' + JSON.stringify(macroParamType) + ' ' + JSON.stringify(v))
				}*/
				if(startEditId === -1 && endEditId >= 0){
					//cb([{type: 'set', value: v, editId: 0}])
					var edits = []
					v.forEach(function(ve){
						edits.push({type: 'add', value: ve, editId: 0})
					})
					return edits
				}else{
					return []
				}
			}else if(v !== undefined){
				//console.log('got v: ' + JSON.stringify(v))
				if(startEditId === -1 && endEditId >= 0){
					return [{type: 'set', value: v, editId: 0}]
				}else{
					return []
				}
			}else{
				return []
			}
		},
		analytics: a
	}
}


function makeMacroBindingSync(implicit, macroParamType){
	var nameStr = 'macro_param['+(JSON.stringify(macroParamType))+':'+implicit+']'
	var a = analytics.make(nameStr, [])
	
	function getAtSingle(bindings, editId){
		if(editId >= 0){
			//console.log('getting binding(' + implicit+'): ' + bindings[implicit])
			//_.assert(Object.keys(bindings).indexOf(implicit) !== -1)
			var b = bindings[implicit]
			if(editId > 0){
				if(b === undefined) _.errout('missing binding?: ' + implicit)
			}
			return b
		}else{
			return undefined
		}
	}
	function getAtSet(bindings, editId){
		if(editId >= 0){
			//console.log('getting binding(' + implicit+'): ' + bindings[implicit])
			//_.assert(Object.keys(bindings).indexOf(implicit) !== -1)
			var b = bindings[implicit]
			if(editId > 0){
				if(b === undefined) _.errout('missing binding?: ' + implicit)
			}
			return b
		}else{
			return []
		}
	}
	var handle = {
		name: nameStr,
		
		//getAt: ,
		getBetween: function(bindings, startEditId, endEditId){
			if(startEditId > 0){
				//console.log('startEditId greater ' + startEditId + ',' + endEditId)
				return []
			}else if(endEditId >= 0){
				var v = bindings[implicit]
				if(_.isArray(v)){
					//_.errout('TODO?: ' + JSON.stringify(v))
					var edits = []
					v.forEach(function(ve){
						edits.push({type: 'add', value: ve, editId: 0})
					})
					return edits
				}else{
					if(v===undefined){
						//console.log('no binding')
						return []
					}else{
						return [{type: 'set', value: v, editId: endEditId}]
					}
				}
			}else{
				//console.log('startEditId lesser ' + startEditId + ',' + endEditId)
				return []
			}
		},
		getHistoricalBetween: function(bindings, startEditId, endEditId){
			var v = bindings[implicit]
			//if(_.isArray(v)) _.errout('TODO?: ' + JSON.stringify(v))
			if(_.isArray(v)){
				/*if(v === undefined) _.errout('undefined set value in binding: ' + implicit)
				if(!_.isArray(v)){
					_.errout('invalid value, should be array: ' + JSON.stringify(macroParamType) + ' ' + JSON.stringify(v))
				}*/
				if(startEditId === -1 && endEditId >= 0){
					//cb([{type: 'set', value: v, editId: 0}])
					var edits = []
					v.forEach(function(ve){
						edits.push({type: 'add', value: ve, editId: 0})
					})
					return edits
				}else{
					return []
				}
			}else if(v !== undefined){
				//console.log('got v: ' + JSON.stringify(v))
				if(startEditId === -1 && endEditId >= 0){
					return [{type: 'set', value: v, editId: 0}]
				}else{
					return []
				}
			}else{
				return []
			}
		},
		analytics: a
	}
	
	if(macroParamType.type === 'set'){
		handle.getAt = getAtSet
	}else{
		handle.getAt = getAtSingle
	}
	
	return handle
}

exports.makeMacroBinding = makeMacroBinding
exports.makeMacroBindingSync = makeMacroBindingSync
