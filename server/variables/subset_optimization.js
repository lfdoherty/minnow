
var _ = require('underscorem')

function fromMacro(e, implicits){
	if(e.view === 'property'){
		return fromMacro(e.params[1], implicits)
	}else{
		if(e.type === 'param'){
			//console.log('name: ' + e.name)
			//console.log(JSON.stringify(implicits))
			return implicits.indexOf(e.name) !== -1
		}else if(e.type === 'view' && e.view === 'cast'){
			return fromMacro(e.params[1], implicits)
		}
		//_.errout(JSON.stringify(e))
		throw new Error('each_subset_optimization not possible, bad fromMacro: ' + JSON.stringify(e))
	}
}

function extractMacroPropertyExpressions(e, implicits){
	var res = []
	if(e.type === 'view'){
		if(e.view === 'property'){
			if(fromMacro(e, implicits)){
				res.push(e)
			}
		}else{
			e.params.forEach(function(p){
				res = res.concat(extractMacroPropertyExpressions(p, implicits))
			})
		}
	}else if(e.type === 'param'){
	}else if(e.type === 'value'){
	}else if(e.type === 'int'){
	}else{
		throw new Error('each_subset_optimization not possible: ' + JSON.stringify(e))
	}
	return res
}

function testCan(rel){
	var pes
	try{
		pes = extractMacroPropertyExpressions(rel.params[1].expr.params[1], rel.params[1].implicits)
	}catch(e){
		console.log('FAILED TO EXTRACT MACRO PROPERTY EXPRESSIONS: ' + e)
		return
	}
	//console.log(JSON.stringify(pes))
	var propertyCodes = []
	for(var i=0;i<pes.length;++i){
	
		if(pes[i].params[1].type !== 'param'){
			console.log('MORE THAN ONE PROPERTY')
			return//must be single-property descent (for now)
		}
		/*var propertyName = pes[i].params[0].value
		if(propertyName === 'id'){
			propertyCodes.push(-1)
		}else if(propertyName === 'uuid'){
			propertyCodes.push(-3)
		}else{
			var p = objSchema.properties[propertyName]
			if(p === undefined) _.errout('no property named "' + propertyName + '" for object "' + objSchema.name + '"')
			propertyCodes.push(p.code)
		}*/
	}
	return true
}

var shallowCopy = require('./../wrap').shallowCopy


function getMacroParam(e){
	if(e.type === 'param'){
		//console.log('name: ' + e.name)
		//console.log(JSON.stringify(implicits))
		return e
	}else if(e.type === 'view' && e.view === 'cast'){
		return getMacroParam(e.params[1])//fromMacro(e.params[1], implicits)
	}else{
		//throw new Error('cannot find macro param: ' + JSON.stringify(e))
		return
	}
}
function makeGlobalsChangeListener(rel, implicits, recurse){
	var t = rel
	
	var globals = []
	
	function pollForChange(f){
		return function(bindings, startEditId, endEditId, cb){
			f(bindings, startEditId, endEditId, function(changes){
				var editIds = []
				for(var i=0;i<changes.length;++i){
					var editId = changes[i].editId
					if(editIds.indexOf(editId) === -1){
						editIds.push(editId)
					}
				}
				cb(editIds)
			})
		}
	}
	if(t.type === 'view'){
		if(t.view === 'property'){
			var macroParam = getMacroParam(rel.params[1])

			if(macroParam && implicits.indexOf(macroParam.name) !== -1){
				//~ property, ignore
			}else{
				//global
				globals.push(pollForChange(recurse(rel).getChangesBetween))
			}
		}else{
			globals.push(pollForChange(recurse(rel).getChangesBetween))
			rel.params.forEach(function(p,i){
				//recurse(p)
				globals.push(makeGlobalsChangeListener(p, implicits, recurse))
			})
		}
	}else if(t.type === 'param' || t.type === 'int' || t.type === 'value'){
		//do nothing
	}else{
		_.errout('TODO: ' + JSON.stringify(rel))
	}
	
	return function(bindings, startEditId, endEditId, cb){
		var editIds = []
		var has = {}
		var cdl = _.latch(globals.length, function(){
			cb(editIds)
		})
		globals.forEach(function(g){
			g(bindings, startEditId, endEditId, function(editIds){
				editIds.forEach(function(editId){
					if(has[editId]){
						return
					}
					has[editId] = true
					editIds.push(editId)
				})
				cdl()
			})
		})
	}
}

exports.make = function(s, rel, paramRels, impl, viewName, ws, generalHandle, recurse){

	//1. check that no ~.property descent descends more than a single step (i.e. no ~.x.y)
	var can = testCan(rel)
	if(!can) return generalHandle

	var inputSetHandle = recurse(rel.params[0])
	
	var macroHandle = recurse(rel.params[1].expr.params[1])
	var implicit = rel.params[1].implicits[0]
	_.assertDefined(implicit)
	
	//monitor non-property stuff referenced in macro for changes as well
	var globals = makeGlobalsChangeListener(rel.params[1].expr.params[1], rel.params[1].implicits, recurse)
	
	function doOptimized(bindings, startEditId, endEditId, cb){
		//console.log('do optimized')
		inputSetHandle.getChangesBetween(bindings, startEditId, endEditId, function(inputChanges){
			//console.log('changes: ' + JSON.stringify(inputChanges))
			inputSetHandle.getStateAt(bindings, startEditId, function(inputState){
				s.objectState.getSubsetThatChangesBetween(inputState, startEditId, endEditId, function(changedObjects){

					var realChanged = [].concat(changedObjects)
					var creationTime = {}
					
					inputChanges.forEach(function(c){
						_.assertEqual(c.type, 'add')
						_.assertInt(c.value)
						realChanged.push(c.value)
						creationTime[c.value] = c.editId
					})
					
					var changes = []
					var cdl = _.latch(realChanged.length, function(){
						cb(changes)
					});
					
					function makeWrapper(value){
						_.assertDefined(value)
						return {
							name: 'value',
							getStateAt: function(bindings, editId, cb){
								//console.log('getting state of value at ' + editId + ' ' + rel.value)
								if(editId === -1){
									cb(undefined)
									return
								}
								cb(value)
							},
							getChangesBetween: function(bindings, startEditId, endEditId, cb){
								if(startEditId === -1 && endEditId >= 0){
									cb([{type: 'set', value: value, editId: 0}])
								}else{
									cb([])
								}
							}
						}
					}
					
					//console.log('realChanged: ' + JSON.stringify(realChanged))
					realChanged.forEach(function(id){
						var newBindings = shallowCopy(bindings)
						newBindings[implicit] = makeWrapper(id)
						newBindings.__key += '_'+id

						
						if(creationTime[id]){
							macroHandle.getStateAt(newBindings, endEditId, function(es){
								if(es){
									//console.log('adding' + id + ' ' + idStartEditId + ' ' + endEditId)
									changes.push({type: 'add', value: id, editId: endEditId, syncId: -1})
								}
								cdl()
							})
						}else{
							var idStartEditId = creationTime[id]||startEditId
							//console.log('start: ' + idStartEditId + ' ' + startEditId + ' ' + endEditId)
							macroHandle.getStateAt(newBindings, idStartEditId, function(ss){
								//_.assertBoolean(ss)
								if(creationTime[id]) ss = false
								macroHandle.getStateAt(newBindings, endEditId, function(es){
									//_.assertBoolean(es)
									ss = !!ss
									es = !!es

									if(ss !== es){
										//TODO correct editId
										if(es === true){
											//console.log('adding' + id + ' ' + idStartEditId + ' ' + endEditId)
											changes.push({type: 'add', value: id, editId: endEditId, syncId: -1})
										}else{
											//console.log('removing: ' + id + ' ' + idStartEditId + ' ' + endEditId)
											changes.push({type: 'remove', value: id, editId: endEditId, syncId: -1})
										}
									}
									cdl()
								})
							})
						}
					})
				})
			})
		})
	}
	var handle = {
		name: 'subset-optimization',
		getStateAt: function(bindings, editId, cb){
			//_.errout('TODO')
			generalHandle.getStateAt(bindings, editId, cb)
		},
		getChangesBetween: function(bindings, startEditId, endEditId, cb){
			//console.log('here')
			globals(bindings, startEditId, endEditId, function(editIds){
				if(editIds.length > 0){
					console.log('general changes, no optimization: ' + JSON.stringify(editIds))
					generalHandle.getChangesBetween(bindings, startEditId, endEditId, cb)
				}else{
					doOptimized(bindings, startEditId, endEditId, cb)
				}
			})
		}
	}
	
	return handle
}
