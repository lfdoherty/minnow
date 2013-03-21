"use strict";

var _ = require('underscorem')
var u = require('./optimization_util')
var schema = require('./../../shared/schema')
var analytics = require('./../analytics')

schema.addFunction('each-optimization', {
	schemaType: require('./each').eachType,
	minParams: 2,
	maxParams: -1,
	callSyntax: 'each-optimization(collection,macro,map,map,...)',
	macros: {1: 1},
	computeAsync: function(z, cb, input, macro){
		_.errout('this should never happen')
	}
})

//takes the rel for the each
exports.make = function(s, rel, recurse, handle, ws){

	rel = JSON.parse(JSON.stringify(rel))	
	
	var maps = rel.params.slice(2)
	
	//console.log('maps: ' + JSON.stringify(maps, null, 2))
	//console.log('rel.params: ' + JSON.stringify(rel.params))

	var macroExpr = rel.params[1].expr
	var macroHandle = recurse(macroExpr)
	
	if(maps.length === 0){
		return makeSimpleSyncEach(s, rel, recurse, ws)
	}
	
	var nameStr = 'each-optimization('+recurse(rel.params[0]).name+',{'+recurse(rel.params[1].expr).name+'})'

	var originalImplicit = rel.params[1].implicits[0]

	var externalBindingsUsed = Object.keys(rel.params[1].bindingsUsed)
	externalBindingsUsed = _.filter(externalBindingsUsed, function(b){
		return rel.params[1].implicits.indexOf(b) === -1
	})

	var mapHandles = []
	var mapOps = []
	var mapNames = '['
	maps.forEach(function(m,i){
		var h = recurse(m)
		mapOps.push(h)
		mapHandles.push({handle: h, uid: m.uid})
		if(i > 0) mapNames += ','
		mapNames += h.name
	})
	mapNames += ']'
	//_.errout('maps: ' + JSON.stringify(maps) + ' ' + JSON.stringify(rel))

	var inputSet = recurse(rel.params[0])
	
	if(!inputSet.getHistoricalChangesBetween) _.errout('missing getHistoricalChangesBetween: ' + inputSet.name)

	//console.log('complex each optimization applied to: ' + nameStr + '\nwith '+mapNames + ' ' + JSON.stringify(macroExpr))

	var isOneToOne = macroExpr.view === 'filter' && macroExpr.params[0].name === rel.params[1].implicits[0]
	
	var a = analytics.make('each-optimization', [inputSet].concat(mapOps))
	
	var newHandle = {
		name: nameStr,
		analytics: a,
		getStateAt: function(bindings, editId, cb){
			//_.errout('TODO')
			var cdl = _.latch(mapHandles.length+externalBindingsUsed.length+1, finish)
			var state
			inputSet.getStateAt(bindings, editId, function(ss){
				state = ss
				//console.log('got state: ' + JSON.stringify(ss) + ' at ' + editId)
				cdl()
			})
			var bindingValues = {}
			externalBindingsUsed.forEach(function(bk){
				bindings[bk].getStateAt(bindings, editId, function(state){
					bindingValues[bk] = state
					cdl()
				})
			})
			var mapStates = []
			mapHandles.forEach(function(mh,i){
				mh.handle.getStateAt(bindings, editId, function(ms){
					mapStates[i] = ms
					cdl()
				})
			})
			
			function finish(){
				if(state.length === 0){
					//console.log('zero state')
					cb([])
					return
				}
				//console.log('todo: ' + JSON.stringify([state, mapStates]))
				//_.errout('TODO')//: ' + JSON.stringify([state, mapStates]))
				var results = []
				var has = {}
				
				for(var i=0;i<state.length;++i){
					var key = state[i]
					bindingValues[originalImplicit] = key
					for(var j=0;j<mapStates.length;++j){
						var ms = mapStates[j]
						var value = ms[key]
						bindingValues[mapHandles[j].uid] = value
					}
					//console.log('computing at ' + editId)
					var res = macroHandle.getStateSync(bindingValues)
					//console.log(editId + ' ' + JSON.stringify(bindingValues) + ' -> ' + JSON.stringify(res))
					if(res !== undefined){
						//_.errout('TODO: ' + JSON.stringify(res))
						if(_.isArray(res)){
							for(var j=0;j<res.length;++j){
								var r = res[j]
								if(!has[r]){
									has[r] = true
									results.push(r)
								}
							}
						}else{
							if(!has[res]){
								has[res] = true
								results.push(res)
							}
						}
					}
				}
				//console.log('results: ' + JSON.stringify(results))
				cb(results)
			}
		},
		getStateCountsAt: function(bindings, editId, cb){
			//_.errout('TODO')
			var cdl = _.latch(mapHandles.length+externalBindingsUsed.length+1, finish)
			var state
			inputSet.getStateAt(bindings, editId, function(ss){
				state = ss
				//console.log('got state: ' + JSON.stringify(ss) + ' at ' + editId)
				cdl()
			})
			var bindingValues = {}
			externalBindingsUsed.forEach(function(bk){
				bindings[bk].getStateAt(bindings, editId, function(state){
					bindingValues[bk] = state
					cdl()
				})
			})
			var mapStates = []
			mapHandles.forEach(function(mh,i){
				mh.handle.getStateAt(bindings, editId, function(ms){
					mapStates[i] = ms
					cdl()
				})
			})
			
			function finish(){
				if(state.length === 0){
					//console.log('zero state')
					cb([])
					return
				}
				//console.log('todo: ' + JSON.stringify([state, mapStates]))
				//_.errout('TODO')//: ' + JSON.stringify([state, mapStates]))
				//var results = []
				var has = {}
				var counts = {}
				for(var i=0;i<state.length;++i){
					var key = state[i]
					bindingValues[originalImplicit] = key
					for(var j=0;j<mapStates.length;++j){
						var ms = mapStates[j]
						var value = ms[key]
						bindingValues[mapHandles[j].uid] = value
					}
					var res = macroHandle.getStateSync(bindingValues)
					//console.log(JSON.stringify(bindingValues) + ' -> ' + JSON.stringify(res))
					if(res !== undefined){
						//_.errout('TODO: ' + JSON.stringify(res))
						if(_.isArray(res)){
							for(var j=0;j<res.length;++j){
								var r = res[j]
								if(!has[r]){
									has[r] = true
									counts[r] = 1
								}else{
									++counts[r]
								}
							}
						}else{
							if(!has[res]){
								has[res] = true
								//results.push(res)
								counts[res] = 1
							}else{
								++counts[res]
							}
						}
					}
				}
				//console.log('results: ' + JSON.stringify(results))
				cb(counts)
			}
		},
		getChangesBetween: function(bindings, startEditId, endEditId, cb){

			var bindingValues = {}
			var oldBindingValues = {}

			var anyChanged = false
			var bcdl = _.latch(externalBindingsUsed.length, function(){
				//console.log('finished computing external bindings: ' + JSON.stringify(externalBindingsUsed)+ ' bindings: ' + JSON.stringify(bindings) + ' bindingValues: ' + JSON.stringify(bindingValues) + ' ' + anyChanged + ' ' + JSON.stringify(rel.params[1].implicits))
				if(anyChanged){
					computeComplete(bindings, startEditId, endEditId, cb)
				}else{
					if(isOneToOne){
						computeIncrementalOneToOne()
					}else{
						computeIncremental()
					}
				}
			})
			externalBindingsUsed.forEach(function(bk){
				//console.log(JSON.stringify([rel.params[1].bindingsUsed, externalBindingsUsed, rel.params[1].implicits]))
				//if(bindings[bk] === undefined) _.errout('missing binding: ' + bk + ' ' + JSON.stringify(externalBindingsUsed) + ' ' + JSON.stringify(Object.keys(bindings)))
				//console.log('calling getChangesBetween for binding(' + bk + '): ' + bindings[bk].getChangesBetween)
				bindings[bk].getChangesBetween(bindings, startEditId, endEditId, function(changes){
					if(changes.length > 0) anyChanged = true
					bcdl()
				})
			})
			
			function computeIncrementalOneToOne(){
				var addedIds = {}
				var cdl = _.latch(mapHandles.length+externalBindingsUsed.length+1, function(){
					var keyedChanges = {}
					var changedKeys = []
					mapHandles.forEach(function(mh, i){
						mapChanges[i].forEach(function(c){
							if(c.type === 'put'){
								if(keyedChanges[c.state.key] === undefined){
									keyedChanges[c.state.key] = {}
									changedKeys.push(c.state.key)
								}
								keyedChanges[c.state.key][mh.uid] = c.value
							}else if(c.type === 'putAdd'){
								_.assertDefined(c.state)
								if(keyedChanges[c.state.key] === undefined){
									keyedChanges[c.state.key] = {}
									changedKeys.push(c.state.key)
								}
								var kh = keyedChanges[c.state.key]
								if(kh[mh.uid] === undefined){
									kh[mh.uid] = []
								}
								kh[mh.uid].push(c.value)
							}else{
								_.errout('TODO: ' + JSON.stringify(c))
							}
						})
					})
			
					var results = []
					//var has = {}
					
			
					var needOldStateKeys = []
					for(var i=0;i<changedKeys.length;++i){
						var key = changedKeys[i]
						if(!addedIds[key]){
							needOldStateKeys.push(key)
						}
					}

					var cdl = _.latch(mapHandles.length, finish)
					mapHandles.forEach(function(mh,i){
						if(mh.handle.getPartialStateAt === undefined) _.errout('missing getPartialStateAt: ' + mh.handle.name)
						mh.handle.getPartialStateAt(bindings, startEditId, needOldStateKeys, function(ms){
							oldMapStates[i] = ms
							mh.handle.getPartialStateAt(bindings, endEditId, changedKeys, function(ms){
								mapStates[i] = ms
								cdl()
							})
						})
					})
			
					function finish(){
						//console.log('changedKeys: ' + JSON.stringify(changedKeys))
						for(var i=0;i<changedKeys.length;++i){
							var key = changedKeys[i]
							bindingValues[originalImplicit] = key

							for(var j=0;j<mapStates.length;++j){
								var ms = mapStates[j]
								var value = ms[key]
								bindingValues[mapHandles[j].uid] = value
							}
					
							var res = macroHandle.getStateSync(bindingValues)
							
							//console.log('recomputed ' + JSON.stringify(bindingValues) + ' -> ' + JSON.stringify(res))
				
							if(addedIds[key]){
								if(res !== undefined){
									//_.errout(JSON.stringify([res, macroExpr.schemaType]))
									if(macroExpr.schemaType.type === 'set' || macroExpr.schemaType.type === 'list'){
										//_.errout('TODO')
										_.assertArray(res)
										for(var j=0;j<res.length;++j){
											var r = res[j]
											results.push({type: 'add', value: r, editId: endEditId})									
										}
									}else{
										results.push({type: 'add', value: res, editId: endEditId})
									}
								}
							}else{
								oldBindingValues[originalImplicit] = key

								for(var j=0;j<oldMapStates.length;++j){
									var ms = oldMapStates[j]
									var value = ms[key]
									oldBindingValues[mapHandles[j].uid] = value
								}
								var oldRes = macroHandle.getStateSync(oldBindingValues)
								if(res !== oldRes){
									if(res === undefined){
										results.push({type: 'remove', value: oldRes, editId: endEditId})
									}else if(oldRes === undefined){
										results.push({type: 'add', value: res, editId: endEditId})
									}else{
										_.errout('TODO: ' + JSON.stringify([res, oldRes]))
									}
								}
							}
						}
						cb(results)
					}
				})
		
				inputSet.getChangesBetween(bindings, startEditId, endEditId, function(changes){
					for(var i=0;i<changes.length;++i){
						var c = changes[i]
						if(c.type === 'add'){
							addedIds[c.value] = true
						}else{
							_.errout('TODO')
						}
					}
					cdl()
				})
		
				externalBindingsUsed.forEach(function(bk){
					bindings[bk].getStateAt(bindings, startEditId, function(state){
						oldBindingValues[bk] = state
						bindings[bk].getStateAt(bindings, endEditId, function(state){
							bindingValues[bk] = state
							cdl()
						})
					})
				})
		
		
				var mapStates = []
				var oldMapStates = []
				var mapChanges = []
				mapHandles.forEach(function(mh,i){
					mh.handle.getChangesBetween(bindings, startEditId, endEditId, function(mc){
						mapChanges[i] = mc
						cdl()
					})
				})
			}

			function computeIncremental(){

				newHandle.getStateCountsAt(bindings, startEditId, function(counts){
					var addedIds = {}
			
					var cdl = _.latch(mapHandles.length+externalBindingsUsed.length+1, function(){
						var keyedChanges = {}
						var changedKeys = []
						mapHandles.forEach(function(mh, i){
							mapChanges[i].forEach(function(c){
								if(c.type === 'put'){
									if(keyedChanges[c.state.key] === undefined){
										keyedChanges[c.state.key] = {}
										changedKeys.push(c.state.key)
									}
									keyedChanges[c.state.key][mh.uid] = c.value
								}else if(c.type === 'putAdd'){
									_.assertDefined(c.state)
									if(keyedChanges[c.state.key] === undefined){
										keyedChanges[c.state.key] = {}
										changedKeys.push(c.state.key)
									}
									var kh = keyedChanges[c.state.key]
									if(kh[mh.uid] === undefined){
										kh[mh.uid] = []
									}
									kh[mh.uid].push(c.value)
								}else{
									_.errout('TODO: ' + JSON.stringify(c))
								}
							})
						})
				
						var results = []
						//var has = {}
						
				
						var needOldStateKeys = []
						for(var i=0;i<changedKeys.length;++i){
							var key = changedKeys[i]
							if(!addedIds[key]){
								needOldStateKeys.push(key)
							}
						}

						var cdl = _.latch(mapHandles.length, finish)
						mapHandles.forEach(function(mh,i){
							if(mh.handle.getPartialStateAt === undefined) _.errout('missing getPartialStateAt: ' + mh.handle.name)
							mh.handle.getPartialStateAt(bindings, startEditId, needOldStateKeys, function(ms){
								oldMapStates[i] = ms
								mh.handle.getPartialStateAt(bindings, endEditId, changedKeys, function(ms){
									mapStates[i] = ms
									cdl()
								})
							})
						})
				
						function finish(){
							//console.log('changedKeys: ' + JSON.stringify(changedKeys))
							for(var i=0;i<changedKeys.length;++i){
								var key = changedKeys[i]
								bindingValues[originalImplicit] = key

								for(var j=0;j<mapStates.length;++j){
									var ms = mapStates[j]
									var value = ms[key]
									bindingValues[mapHandles[j].uid] = value
								}
						
								var res = macroHandle.getStateSync(bindingValues)
					
								if(addedIds[key]){
									if(res !== undefined){
										//_.errout(JSON.stringify([res, macroExpr.schemaType]))
										if(macroExpr.schemaType.type === 'set' || macroExpr.schemaType.type === 'list'){
											//_.errout('TODO')
											_.assertArray(res)
											for(var j=0;j<res.length;++j){
												var r = res[j]
												if(counts[r]){
													++counts[r]
												}else{
													results.push({type: 'add', value: r, editId: endEditId})									
												}
											}
										}else{
											if(counts[res]){
												++counts[res]
											}else{
												results.push({type: 'add', value: res, editId: endEditId})
											}
										}
									}
								}else{
									oldBindingValues[originalImplicit] = key

									for(var j=0;j<oldMapStates.length;++j){
										var ms = oldMapStates[j]
										var value = ms[key]
										oldBindingValues[mapHandles[j].uid] = value
									}
									var oldRes = macroHandle.getStateSync(oldBindingValues)
									if(res !== oldRes){
										if(res === undefined){
											--counts[oldRes]
											if(counts[oldRes] === 0){
												results.push({type: 'remove', value: oldRes, editId: endEditId})
											}
										}else if(oldRes === undefined){
											if(counts[res]){
												++counts[res]
											}else{
												counts[res] = 1
												results.push({type: 'add', value: res, editId: endEditId})
											}
										}else{
											_.errout('TODO: ' + JSON.stringify([res, oldRes]))
										}
									}
								}
							}
							cb(results)
						}
					})
			
					inputSet.getChangesBetween(bindings, startEditId, endEditId, function(changes){
						for(var i=0;i<changes.length;++i){
							var c = changes[i]
							if(c.type === 'add'){
								addedIds[c.value] = true
							}else{
								_.errout('TODO')
							}
						}
						cdl()
					})
			
					externalBindingsUsed.forEach(function(bk){
						bindings[bk].getStateAt(bindings, startEditId, function(state){
							oldBindingValues[bk] = state
							bindings[bk].getStateAt(bindings, endEditId, function(state){
								bindingValues[bk] = state
								cdl()
							})
						})
					})
			
			
					var mapStates = []
					var oldMapStates = []
					var mapChanges = []
					mapHandles.forEach(function(mh,i){
						mh.handle.getChangesBetween(bindings, startEditId, endEditId, function(mc){
							mapChanges[i] = mc
							cdl()
						})
					})
				})
			}
			
		},
		getHistoricalChangesBetween: function(bindings, startEditId, endEditId, cb){
			newHandle.getStateCountsAt(bindings, startEditId, function(counts){
				var allChanges = []
				var externalBindingStates = {}
				var cdl = _.latch(1+externalBindingsUsed.length+mapHandles.length, function(){
				
					//if(mapHandles.length > 1){
					_.errout('TODO: get associated binding values for all other maps for each map put, and previous associated result value')
					//}
				
					if(allChanges.length === 0){
						cb([])
						return
					}
					
					allChanges.sort(function(a,b){
						return a.editId - b.editId
					})
					
					var changeTransactions = mergeTransactions(allChanges)
					
					_.assert(changeTransactions.length > 0)
					
					var changes = []
					
					changeTransactions.forEach(function(c){

						externalBindingsUsed.forEach(function(bk, i){
							if(c[bk]){
								_.errout('TODO')
							}
						})
						
						var bindingValues = {}
						mapHandles.forEach(function(mh,i){
							var cc = c['mh'+i]
							if(cc){
								_.assertEqual(cc.type, 'put')
								if(c.input) _.assertEqual(cc.state.key, c.input.value)
								bindingValues[mh.uid] = cc.value
							}
						})
						externalBindingsUsed.forEach(function(bk, i){
							bindingValues[bk] = externalBindingStates[bk]
						})
						
						
						if(c.input){
							bindingValues[originalImplicit] = c.input.value
							if(c.input.type === 'add'){
								
								var res = macroHandle.getStateSync(bindingValues)
								if(res !== undefined){
									//_.errout('TODO: ' + JSON.stringify([bindings,res]))
									if(!counts[res]){
										counts[res] = 1
										changes.push({type: 'add', value: res, editId: c.input.editId})
									}else{
										_.errout('TODO')
									}
								}else{
									console.log('no res: ' + JSON.stringify(bindingValues))
								}
							}else{
								_.errout('TODO: ' + JSON.stringify(c))
							}
						}else{
							if(mapHandles.length > 1) _.errout('TODO')
							
							//_.errout('TODO: ' + JSON.stringify(c) + ' ' + JSON.stringify(bindingValues))
							bindingValues[originalImplicit] = c.mh0.state.key
							
							var res = macroHandle.getStateSync(bindingValues)
							if(res !== undefined){
								//_.errout('TODO: ' + JSON.stringify([bindings,res]))
								if(!counts[res]){
									counts[res] = 1
									changes.push({type: 'add', value: res, editId: c.input.editId})
								}else{
									_.errout('TODO')
								}
							}else{
								//need to know old value
								_.errout('TODO: ' + JSON.stringify(bindingValues))
							}
						}
					})
					console.log('got historical changes between: ' + startEditId + ' ' + endEditId + ': ' + JSON.stringify(changes))
					console.log(JSON.stringify(allChanges))
					console.log(JSON.stringify(externalBindingStates))
					cb(changes)
				})
				inputSet.getHistoricalChangesBetween(bindings, startEditId, endEditId, function(changes){
					tagInto(allChanges, changes, 'input')
					cdl()
				})
				console.log('externalBindingsUsed: ' + JSON.stringify(externalBindingsUsed))
				externalBindingsUsed.forEach(function(bk, i){
					var b = bindings[bk]
					b.getStateAt(bindings, startEditId, function(state){
						externalBindingStates[bk] = state
						b.getHistoricalChangesBetween(bindings, startEditId, endEditId, function(changes){
							tagInto(allChanges, changes, bk)
							console.log('got state and changes for ' + bk + ': ' + JSON.stringify([state, changes]))
							cdl()
						})
					})
				})
				mapHandles.forEach(function(mh,i){
					mh.handle.getChangesBetween(bindings, startEditId, endEditId, function(mc){
						tagInto(allChanges, mc, 'mh'+i)
						cdl()
					})
				})
			})
		//	_.errout('TODO')
			
		}
	}
	
	function computeComplete(bindings, startEditId, endEditId, cb){
		//console.log('compute complete')
		newHandle.getStateAt(bindings, startEditId, function(startState){
			newHandle.getStateAt(bindings, endEditId, function(state){
				var es = ws.diffFinder(startState, state)
				var changes = []
				es.forEach(function(e){
					e.editId = endEditId//editId+1
					changes.push(e)
				})
				//console.log(JSON.stringify([startState, state, changes]))
				cb(changes)
			})
		})
	}
	
	return newHandle
}

function mergeTransactions(changes){
	var changeTransactions = []
	var currentSet
	var currentEditId
	changes.forEach(function(c){
		_.assertInt(c.editId)
		if(currentEditId !== c.editId){
			if(currentSet !== undefined){
				changeTransactions.push(currentSet)
			}
			currentSet = {}
			currentEditId = c.editId
		}
		if(currentSet[c.source])_.errout('TODO: ' + JSON.stringify(changes))
		currentSet[c.source] = c
	})
	if(currentSet) changeTransactions.push(currentSet);
	return changeTransactions
}
function tagInto(all, changes, tag){
	for(var i=0;i<changes.length;++i){
		var c = changes[i]
		all.push({type: c.type, value: c.value, editId: c.editId, state: c.state, source: tag})
	}
}

function makeSimpleSyncEach(s, rel, recurse, ws){
	var macro = recurse(rel.params[1].expr)
	if(macro.getStateSync === undefined) _.errout('missing getStateSync: ' + macro.name)//_.assertFunction(macro.computeSync)
	var macroImplicit = rel.params[1].implicits[0]
	
	var bindingsUsed = Object.keys(rel.params[1].bindingsUsed)
	_.assert(bindingsUsed.indexOf(macroImplicit) !== -1)
	bindingsUsed.splice(bindingsUsed.indexOf(macroImplicit), 1)
	
	var inputSet = recurse(rel.params[0])
	
	//console.log('simple: ' + JSON.stringify(rel, null, 2))
	//console.log(new Error().stack)
	//_.errout('ERRPOR: ' + JSON.stringify(rel))
	var nameStr = 'simple-sync-each-optimization('+inputSet.name+')'
	var a = analytics.make(nameStr, [inputSet])
	var handle = {
		name: nameStr,
		analytics: a,
		getStateAt: function(bindings, editId, cb){
			//_.errout('tODO')
			//console.log('bindings used: ' + JSON.stringify(bindingsUsed))
			var bindingValues = {}
			var cdl = _.latch(bindingsUsed.length+1, finish)
			var state
			inputSet.getStateAt(bindings, editId, function(ss){
				state = ss
				//console.log('got state: ' + JSON.stringify(ss) + ' at ' + editId)
				//console.log('from: ' + JSON.stringify(rel.params[0]))
				cdl()
			})
			
			bindingsUsed.forEach(function(bk){
				bindings[bk].getStateAt(bindings, editId, function(state){
					bindingValues[bk] = state
					cdl()
				})
			})
			
			function finish(){
				if(state.length === 0){
					//console.log('finished: -' + JSON.stringify(rel))
					cb([])
					return
				}
				
				var results = []
				for(var i=0;i<state.length;++i){
					var v = state[i]
					bindingValues[macroImplicit] = v
					var r = macro.getStateSync(bindingValues)
					if(r !== undefined){
						results.push(r)
					}
				}
				if(results.length === 0){
					cb([])
					return
				}
				//console.log('merge: ' + JSON.stringify(results))
				var has = {}
				var merged = []
				for(var i=0;i<results.length;++i){
					var v = results[i]
					if(has[v]) continue
					has[v] = true
					merged.push(v)
				}
				cb(merged)
			}
		},
		getChangesBetween: function(bindings, startEditId, endEditId, cb){
			//_.errout('tODO')			
			handle.getStateAt(bindings, startEditId, function(startState){
				handle.getStateAt(bindings, endEditId, function(state){
					var es = ws.diffFinder(startState, state)
					var changes = []
					es.forEach(function(e){
						e.editId = endEditId//editId+1
						changes.push(e)
					})
					cb(changes)
				})
			})
		}
	}
	return handle
}

