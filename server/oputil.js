
var _ =  require('underscorem')

var wu = require('./wraputil')

function makeSyncGeneralOperatorHistoricalChangesBetween(paramRels, handle, ws){
	var cc = 0
	function getHistoricalBetween(bindings, startEditId, endEditId){
		
		var realEditIds = []

		var has = {}

		for(var index=0;index<paramRels.length;++index){
			var pr = paramRels[index]
			if(!pr.isMacro){
				if(pr.getHistoricalBetween === undefined) _.errout('missing getHistoricalBetween: ' + pr.name)
				
				var changes = pr.getHistoricalBetween(bindings, startEditId, endEditId)
				changes.forEach(function(c){
					if(has[c.editId]) return
					has[c.editId] = true
					_.assertInt(c.editId)
					realEditIds.push(c.editId)
				})
			}
		}
		
		if(startEditId === -1 && !has['0']) realEditIds.unshift(0)
		if(!has[startEditId]) realEditIds.unshift(startEditId)
		if(!has[endEditId]) realEditIds.push(endEditId)
		
		//console.log('&& ' + handle.name)
	
		var states = []

		//console.log('realEdits: ' + handle.name + ' ' + JSON.stringify(realEditIds))
		for(var index=0;index<realEditIds.length;++index){
			var editId = realEditIds[index]
			var v = handle.getAt(bindings, editId)
			states[index] = v
		}
		
		var results = []
		for(var index=0;index<realEditIds.length-1;++index){
			var editId = realEditIds[index]
			var es = ws.diffFinder(states[index], states[index+1])
			for(var i=0;i<es.length;++i){
				var e = es[i]
				e.editId = realEditIds[index+1]
				results.push(e)
			}
		}
		return results
		
	}
	return getHistoricalBetween
}

function makeGeneralOperatorHistoricalChangesBetween(paramRels, handle, ws){
	var cc = 0
	function getHistoricalChangesBetween(bindings, startEditId, endEditId, cb){
		
		var realEditIds = []

		//console.log('&&: ' + handle.name)
		//++cc
		var cdl = _.latch(paramRels.length, function(){
			if(startEditId === -1 && !has['0']) realEditIds.unshift(0)
			if(!has[startEditId]) realEditIds.unshift(startEditId)
			if(!has[endEditId]) realEditIds.push(endEditId)
			
			//console.log('&& ' + handle.name)
		
			var states = []
			
			var ncdl = _.latch(realEditIds.length, function(){
				var changes = []
				realEditIds.slice(0, realEditIds.length-1).forEach(function(editId, index){
					var es = ws.diffFinder(states[index], states[index+1])
					for(var i=0;i<es.length;++i){
						var e = es[i]
						e.editId = realEditIds[index+1]
						changes.push(e)
					}
				})
				//--cc
				//console.log(cc+' wallaby: ' + handle.name)//JSON.stringify([realEditIds, states, changes]))
				cb(changes)
			})
			
			realEditIds.forEach(function(editId, index){
				handle.getStateAt(bindings, editId, function(v){
					states[index] = v
					ncdl()
				})
			})
			
			
		})

		var has = {}
		paramRels.forEach(function(pr, index){
			if(pr.isMacro){
				cdl()
			}else{
				if(pr.getHistoricalChangesBetween === undefined) _.errout('missing getHistoricalChangesBetween: ' + pr.name)
				
				pr.getHistoricalChangesBetween(bindings, startEditId, endEditId, function(changes){
					//console.log('got historical: ' + JSON.stringify(changes))
					changes.forEach(function(c){
						if(has[c.editId]) return
						has[c.editId] = true
						_.assertInt(c.editId)
						realEditIds.push(c.editId)
					})
					cdl()
				})
			}
		})
	}
	return getHistoricalChangesBetween
}


function makeSetSyncBetween(handle, ws){
	function setSyncBetween(bindings, startEditId, endEditId){
		//console.log('here: ' + handle.name)
		var startState = handle.getAt(bindings, startEditId)
		var state = handle.getAt(bindings, endEditId)
		//console.log('and here')
		if(startState !== state){
			if(state === undefined){
				return [{type: 'clear', editId: endEditId, syncId: -1}]
			}else{
				return [{type: 'set', value: state, editId: endEditId, syncId: -1}]
			}
		}else{
			return []
		}
	}
	
	return setSyncBetween
}

function makeSetChangesBetween(handle, ws){
	function setChangesBetween(bindings, startEditId, endEditId, cb){
		//console.log('here: ' + handle.name)
		handle.getStateAt(bindings, startEditId, function(startState){
			handle.getStateAt(bindings, endEditId, function(state){
				//console.log('and here')
				if(startState !== state){
					if(state === undefined){
						cb([{type: 'clear', editId: endEditId, syncId: -1}])
					}else{
						cb([{type: 'set', value: state, editId: endEditId, syncId: -1}])
					}
				}else{
					cb([])
				}
			})
		})
	}
	
	return	setChangesBetween
}

function makeMerger(type){
	if(type.type === 'set' || type.type === 'list'){
		return function(res){
			//console.log('merging: ' + JSON.stringify(res))
			if(res.length === 0) return []
			var total = res[0]
			for(var i=1;i<res.length;++i){
				total = wu.mergeSets(total, res[i])
			}
			//console.log(JSON.stringify(res) + ' -> ' + JSON.stringify(total))
			return total
		}
	}else if(type.type === 'primitive' || type.type==='object'||type.type==='view'){
		return function(res){
			var arr = []
			var has = {}
			for(var i=0;i<res.length;++i){
				var v = res[i]
				if(has[v]) continue
				has[v] = true
				arr.push(v)
			}
			//console.log(JSON.stringify(res) + ' -> ' + JSON.stringify(arr))
			return arr
		}
	}else if(type.type === 'map'){
		return function(res){
			_.errout('TODO')
		}
	}else{
		_.errout('TODO: ' + JSON.stringify(type))
	}
}


function computeBindingsUsed(macroRel, staticBindings){
	var bindingsUsed = Object.keys(macroRel.bindingsUsed)
	if(staticBindings.isMutated){
		//_.errout('tODO: ' + JSON.stringify
		bindingsUsed.push('__mutatorKey')
		bindingsUsed.push('getMutatorPropertyAt')		
	}
	return bindingsUsed
}



function makeSimpleParamMacroFunctionSync(mergeResults){
	var simpleParamMacroObject = {
		get: function(key){
			return key
		},
		getArray: function(key, cb){
			_.errout('TODO')
		},
		mergeResults: mergeResults
	}
	function simpleParamMacro(bindings, editId){
		return simpleParamMacroObject
	}
	return simpleParamMacro
}


function makeMacroWrapper1Sync(pr, mergeResults, macroRel, staticBindings){
	if(!macroRel.bindingsUsed) _.errout('missing bindingsUsed: ' + JSON.stringify(macroRel))

	var bindingsUsed = computeBindingsUsed(macroRel, staticBindings)
	
	var implicit = pr.implicits[0]
	function MacroWrapper1(bindings, editId){
		this.bindings = bindings
		this.editId = editId
		this.newBindings = {}
		//console.log('*mutatorKey: ' + this.bindings.__mutatorKey)
		if(this.bindings.__mutatorKey){
			var keys = Object.keys(this.bindings)
			for(var i=0;i<keys.length;++i){
				var key = keys[i]
				this.newBindings[key] = this.bindings[key]
			}
		}else{
			for(var i=0;i<bindingsUsed.length;++i){
				var bu = bindingsUsed[i]
				this.newBindings[bu] = this.bindings[bu]
			}
		}
	}
	MacroWrapper1.prototype.get = function(av){
		_.assertDefined(av)
		
		this.newBindings[implicit] = av
		this.newBindings.__key = this.bindings.__key+'_'+av
		//console.log('mutatorKey: ' + this.bindings.__mutatorKey)
		
		return pr.getAt(this.newBindings, this.editId)
	}
	MacroWrapper1.prototype.mergeResults = mergeResults
	MacroWrapper1.prototype.getArray = function(arr, cb){
		_.assertLength(arr, 1)
		var newBindings = {}
		for(var i=0;i<bindingsUsed.length;++i){
			var bu = bindingsUsed[i]
			newBindings[bu] = this.bindings[bu]
		}
		_.assertDefined(arr[0])
		newBindings[implicit] = arr[0]
		newBindings.__key = this.bindings.__key+'_'+arr[0]
		
		//console.log('set binding ' + implicit + ' to ' + arr[0])

		return pr.getAt(newBindings, this.editId)
	}
	return MacroWrapper1
}

function makeMacroWrapper2Sync(pr, mergeResults, macroRel, staticBindings){

	var implicitA = pr.implicits[0]
	var implicitB = pr.implicits[1]

	var bindingsUsed = computeBindingsUsed(macroRel, staticBindings)
	
	function MacroWrapper2(bindings, editId){
		this.bindings = bindings
		this.editId = editId
	}
	MacroWrapper2.prototype.get = function(av, bv){
		_.assertDefined(av)
		_.assertDefined(bv)
		
		var newBindings = {}
		for(var i=0;i<bindingsUsed.length;++i){
			var bu = bindingsUsed[i]
			newBindings[bu] = this.bindings[bu]
		}
		newBindings[implicitA] = av
		newBindings[implicitB] = bv
		newBindings.__key = this.bindings.__key+'_'+av+':'+bv
		return pr.getAt(newBindings, this.editId)
	}
	MacroWrapper2.prototype.mergeResults = mergeResults
	MacroWrapper2.prototype.getArray = function(arr){
		_.assertLength(arr, 2)
		var newBindings = {}
		for(var i=0;i<bindingsUsed.length;++i){
			var bu = bindingsUsed[i]
			newBindings[bu] = this.bindings[bu]
		}
		_.assertDefined(arr[0])
		_.assertDefined(arr[1])
		newBindings[implicitA] = arr[0]
		newBindings[implicitB] = arr[1]
		newBindings.__key = this.bindings.__key+'_'+arr[0]+':'+arr[1]
		return pr.getAt(newBindings, this.editId)
	}
	return MacroWrapper2
}


function makeMacroWrapper2(pr, mergeResults, macroRel, staticBindings){

	var implicitA = pr.implicits[0]
	var implicitB = pr.implicits[1]

	var bindingsUsed = computeBindingsUsed(macroRel, staticBindings)
	
	function MacroWrapper2(bindings, editId){
		this.bindings = bindings
		this.editId = editId
	}
	MacroWrapper2.prototype.get = function(av, bv, cb){
		var newBindings = {}
		for(var i=0;i<bindingsUsed.length;++i){
			var bu = bindingsUsed[i]
			newBindings[bu] = this.bindings[bu]
		}
		newBindings[implicitA] = av
		newBindings[implicitB] = bv
		newBindings.__key = this.bindings.__key+'_'+av+':'+bv
		pr.getStateAt(newBindings, this.editId, cb)
	}
	MacroWrapper2.prototype.mergeResults = mergeResults
	MacroWrapper2.prototype.getArray = function(arr, cb){
		_.assertLength(arr, 2)
		var newBindings = {}
		for(var i=0;i<bindingsUsed.length;++i){
			var bu = bindingsUsed[i]
			newBindings[bu] = this.bindings[bu]
		}
		newBindings[implicitA] = arr[0]
		newBindings[implicitB] = arr[1]
		newBindings.__key = this.bindings.__key+'_'+arr[0]+':'+arr[1]
		//console.log('getting macro: ' + pr.name)
		pr.getStateAt(newBindings, this.editId, cb)
	}
	return MacroWrapper2
}

function makeSimpleParamMacroFunction(mergeResults){
	var simpleParamMacroObject = {
		get: function(key, cb){
			//_.errout('TODO')
			cb(key)
		},
		getArray: function(key, cb){
			_.errout('TODO')
		},
		mergeResults: mergeResults
	}
	function simpleParamMacro(bindings, editId){
		return simpleParamMacroObject
	}
	return simpleParamMacro
}


function makeMacroWrapper1(pr, mergeResults, macroRel, staticBindings){
	if(!macroRel.bindingsUsed) _.errout('missing bindingsUsed: ' + JSON.stringify(macroRel))
//	console.log(JSON.stringify(Object.keys(staticBindings)))
	
	var bindingsUsed = computeBindingsUsed(macroRel, staticBindings)
	
	var implicit = pr.implicits[0]
	function MacroWrapper1(bindings, editId){
		this.bindings = bindings
		this.editId = editId
	}
	MacroWrapper1.prototype.get = function(av, cb){
		var newBindings = {}
		for(var i=0;i<bindingsUsed.length;++i){
			var bu = bindingsUsed[i]
			newBindings[bu] = this.bindings[bu]
		}
		
		newBindings[implicit] = av
		newBindings.__key = this.bindings.__key+'_'+av
		
		pr.getStateAt(newBindings, this.editId, function(state){
			cb(state)
		})
	}
	MacroWrapper1.prototype.mergeResults = mergeResults
	MacroWrapper1.prototype.getArray = function(arr, cb){
		_.assertLength(arr, 1)
		var newBindings = {}
		for(var i=0;i<bindingsUsed.length;++i){
			var bu = bindingsUsed[i]
			newBindings[bu] = this.bindings[bu]
		}
		newBindings[implicit] = arr[0]
		newBindings.__key = this.bindings.__key+'_'+arr[0]

		pr.getStateAt(newBindings, this.editId, function(state){
			cb(state)
		})
	}
	return MacroWrapper1
}


exports.makeGeneralOperatorHistoricalChangesBetween = makeGeneralOperatorHistoricalChangesBetween
exports.makeSyncGeneralOperatorHistoricalChangesBetween = makeSyncGeneralOperatorHistoricalChangesBetween
exports.makeSetChangesBetween = makeSetChangesBetween
exports.makeSetSyncBetween = makeSetSyncBetween
exports.makeMerger = makeMerger
exports.computeBindingsUsed = computeBindingsUsed

exports.makeMacroWrapper1Sync = makeMacroWrapper1Sync
exports.makeMacroWrapper2Sync = makeMacroWrapper2Sync
exports.makeSimpleParamMacroFunctionSync = makeSimpleParamMacroFunctionSync

exports.makeMacroWrapper1 = makeMacroWrapper1
exports.makeMacroWrapper2 = makeMacroWrapper2

