"use strict";

var _ = require('underscorem')

var editFp = require('./tcp_shared').editFp
var editCodes = editFp.codes
var editNames = editFp.names

function stub(){}


function mergeSets(a,b){
	var has = {}
	a.forEach(function(v){
		has[v] = true
	})
	var rem = []
	b.forEach(function(v){
		if(!has[v]) rem.push(v)
	})
	return a.concat(rem)
}

function range(start, end, f){
	var j=0;
	for(var i=start;i<end;++i,++j){
		f(i, j)
	}
}

function makeGenericGetInclusionsDuring(handle, ws){
	function genericGetInclusionsDuring(bindings, lastEditId, endEditId, cb){
		handle.getChangesBetween(bindings, lastEditId, endEditId, function(edits){
			var ids = ws.extractInclusions(edits)
			console.log('extracted ' + JSON.stringify(ids)+' from: ' + JSON.stringify(edits))
			cb(ids)
		})
	}
	return genericGetInclusionsDuring
}

exports.range = range
exports.mergeSets = mergeSets
exports.makeGenericGetInclusionsDuring = makeGenericGetInclusionsDuring

exports.makeUtilities = function(schemaType){
	_.assertDefined(schemaType)
	
	return {
		extractInclusions: makeInclusionsExtractor(schemaType),
		extractInclusionsFromState: makeStateInclusionsExtractor(schemaType),
		//stateConstructor: makeStateConstructor(schemaType),
		diffFinder: makeDiffFinder(schemaType),
		convertToChange: makeChangeConverter(schemaType),
		convertToEdit: makeEditConverter(schemaType),
		defaultState: makeDefaultState(schemaType),
		validateState: makeStateValidator(schemaType),
		makeVersions: makeVersionMaker(schemaType)
	}
}

function makeVersionMaker(type){
	if(type.type === 'object' || type.type === 'view' || type.type === 'primitive'){
		return function(startState, changes){
			var versions = []
			for(var i=0;i<changes.length;++i){
				var c = changes[i]
				versions.push({state: c.value, editId: c.editId})
			}
			return versions
		}
	}else if(type.type === 'set' || type.type === 'list'){
		return function(startState, changes){
			var versions = []
			var state = [].concat(startState)
			for(var i=0;i<changes.length;++i){
				var c = changes[i]
				if(c.type === 'add'){
					state.push(c.value)
				}else if(c.type === 'remove'){
					var i = state.indexOf(c.value)
					if(i === -1) _.errout('change sequence error')
					state.splice(i, 1)
				}else{
					_.errout('TODO: ' + JSON.stringify(c))
				}
				versions.push({state: [].concat(state), editId: c.editId})
			}
			return versions
		}
	}else if(type.type === 'map'){
		return function(startState, changes){
			var versions = []
			var state = _.extend({}, startState)
			
			for(var i=0;i<changes.length;++i){
				var c = changes[i]
				if(c.type === 'put'){
					state[c.state.key] = c.value
				}else if(c.type === 'remove'){
					state[c.value] = undefined
				}else{
					_.errout('TODO: ' + JSON.stringify(c))
				}
				versions.push({state: _.extend({}, state), editId: c.editId})
			}
			return versions
		}
	}else if(type.type === 'nil'){
		return function(){
			_.errout('cannot have versions of nil')
		}
	}else{
		_.errout('TODO: ' + JSON.stringify(type))
	}
}

function diffSets(a, b,addCb,removeCb){
	var aHas = {}
	var bHas = {}
	for(var i=0;i<a.length;++i){
		aHas[a[i]] = true
	}
	for(var i=0;i<b.length;++i){
		bHas[b[i]] = true
	}
	for(var i=0;i<a.length;++i){
		var v = a[i]
		if(!bHas[v]){
			removeCb(v)
		}
	}
	for(var i=0;i<b.length;++i){
		var v = b[i]
		if(!aHas[v]){
			addCb(v)
		}
	}	
}

function makeDiffFinder(type){
	if(type.type === 'set' || type.type === 'list'){
		return function(a, b){

			var has = {}
			var changes = []
			if(a !== undefined){
				for(var i=0;i<a.length;++i){
					var v = a[i]
					if(_.isArray(v)) _.errout('fix')
					has[v] = true
				}
			}
			
			var bhas = {}
			if(b !== undefined){
				for(var i=0;i<b.length;++i){
					var v = b[i]
					bhas[v] = true
					if(_.isArray(v)) _.errout('fix: ' + JSON.stringify([a,b]))
					if(!has[v]){
						_.assertDefined(v)
						changes.push({type: 'add', value: v})
					}
				}
			}
			if(a !== undefined){
				for(var i=0;i<a.length;++i){
					var v = a[i]
					if(!bhas[v]){
						changes.push({type: 'remove', value: v})
					}
				}
			}
			return changes
		}
	}else if(type.type === 'map'){
		if(type.value.type === 'set'){
			var keyOp = getKeyOp(type.key)
			return function(a, b){
				//_.errout('TODO')
				//console.log('states: ' + JSON.stringify([a,b]))
				//console.log(JSON.stringify(type))
				if(a === undefined) a = {}
				if(b === undefined) b = {}
				
				var changes = []
				Object.keys(a).forEach(function(aKeyStr){
					if(b[aKeyStr] === undefined){
						_.assertDefined(aKeyStr)
						changes.push({type: 'remove', value: aKeyStr})//state: {key: aKeyStr, keyOp: keyOp}})
					}else{
						//console.log('not removed: ' + JSON.stringify(b[aKeyStr]))
					}
				})
				Object.keys(b).forEach(function(bKeyStr){
					_.assertDefined(bKeyStr)
					if(a[bKeyStr] === undefined){
						var values = b[bKeyStr]
						_.assertArray(values)
						values.forEach(function(v){
							_.assertPrimitive(v)
							_.assertDefined(v)
							changes.push({type: 'putAdd', value: v, state: {key: bKeyStr, keyOp: keyOp}})
						})
					}else{
						diffSets(a[bKeyStr], b[bKeyStr], function(added){
							_.assertPrimitive(added)
							_.assertDefined(added)
							changes.push({type: 'putAdd', value: added, state: { key: bKeyStr, keyOp: keyOp}})
						},function(removed){
							//_.errout('TODO')
							_.assertDefined(removed)
							changes.push({type: 'putRemove', value: removed, state: {key: bKeyStr, keyOp: keyOp}})
						})
					}
				})
				return changes
			}
		}else{
			return function(a, b){
				//_.errout('TODO')
				//console.log(JSON.stringify([a,b]))
				var changes = []
				Object.keys(a).forEach(function(aKeyStr){
					if(a[aKeyStr] === undefined) _.errout('bad value') 
					if(b[aKeyStr] === undefined){
						//console.log(JSON.stringify([aKeyStr,b[aKeyStr]]))
						changes.push({type: 'remove', value: aKeyStr})
					}
				})
				Object.keys(b).forEach(function(bKeyStr){
					var key = bKeyStr
					_.assertDefined(key)
					if(type.key.type === 'object'){
						key = parseInt(key)
					}
					_.assertDefined(key)
					if(b[key] === undefined) _.errout('bad value - key set for value undefined') 
					if(a[key] === undefined){
						changes.push({type: 'put', state: {key: key, keyOp: keyOp}, value: b[key]})
					}else if(a[key] !== b[key]){
						changes.push({type: 'put', state: {key: key, keyOp: keyOp}, value: b[key]})
					}
				})
				//console.log('changes: ' + JSON.stringify([a,b,changes]))
				return changes
			}
		}
	}else if(type.type === 'primitive' || type.type === 'object' || type.type === 'view'){
		return function(a, b){
			//console.log('*finding diff: ' + JSON.stringify([a,b]))
			if(_.isArray(a)) _.errout('fix')
			if(_.isArray(b)) _.errout('fix')
			
			if(a !== b){
				//_.assertDefined(b)
				//.if(b === undefined){
				if(type.primitive === 'string'){
					return [{type: 'set', value: b||''}]
				}else{
					if(b === undefined){
						return [{type: 'clear'}]
					}else{
						return [{type: 'set', value: b}]
					}
				}
			}else{
				return []
			}
		}
	}else if(type.type === 'nil'){
		return function(a,b){
			_.errout('TODO?')
		}
	}
	
	_.errout('tODO: ' + JSON.stringify(type))
}

function getKeyOp(t){
	if(t.type === 'primitive'){
		if(t.primitive === 'string'){
			return editCodes.selectStringKey
		}else if(t.primitive === 'int'){
			return editCodes.selectIntKey
		}else{
			_.errout('tODO: ' + JSON.stringify(type))
		}
	}else if(t.type === 'object'){
		return editCodes.selectObjectKey
	}else{
		_.errout('tODO: ' + JSON.stringify(type))
	}
}
function makeEditConverter(type){
	
	if(type.type === 'set' || type.type === 'list'){
		var mt = type.members.type
		if(mt === 'object'){
			return function(e){
				if(e.type === 'add'){
					return {op: editCodes.addExisting, edit: {id: e.value}, syncId: -1, editId: e.editId}
				}else{
					return {op: editCodes.remove, edit: {}, state: {sub: e.value}, syncId: -1, editId: e.editId}
				}
			}
		}else if(mt === 'primitive'){
			
			if(type.members.primitive === 'int'){
				return function(e){
					_.assertInt(e.editId)
					if(e.type === 'add'){
						return {op: editCodes.addInt, edit: {value: e.value}, syncId: -1, editId: e.editId}
					}else if(e.type === 'remove'){
						return {op: editCodes.removeInt, edit: {value: e.value}, syncId: -1, editId: e.editId}
					}else{
						_.errout('TODO: ' + JSON.stringify(e))
					}
				}
			}else if(type.members.primitive === 'string'){
				return function(e){
					//console.log(JSON.stringify(e))
					_.assertInt(e.editId)
					_.assertString(e.value)
					if(e.type === 'add'){
						return {op: editCodes.addString, edit: {value: e.value}, syncId: -1, editId: e.editId}
					}else if(e.type === 'remove'){
						return {op: editCodes.removeString, edit: {value: e.value}, syncId: -1, editId: e.editId}
					}else{
						_.errout('TODO: ' + JSON.stringify(e))
					}
				}
			}else if(type.members.primitive === 'long'){
				return function(e){
					_.assertInt(e.editId)
					//return {op: editCodes.addLong, edit: {value: e.value}, syncId: -1, editId: e.editId}
					if(e.type === 'add'){
						return {op: editCodes.addLong, edit: {value: e.value}, syncId: -1, editId: e.editId}
					}else if(e.type === 'remove'){
						return {op: editCodes.removeLong, edit: {value: e.value}, syncId: -1, editId: e.editId}
					}else{
						_.errout('TODO: ' + JSON.stringify(e))
					}
				}
				
			}else if(type.members.primitive === 'boolean'){
				return function(e){
					_.assertInt(e.editId)
					//return {op: editCodes.addBoolean, edit: {value: e.value}, syncId: -1, editId: e.editId}
					if(e.type === 'add'){
						return {op: editCodes.addBoolean, edit: {value: e.value}, syncId: -1, editId: e.editId}
					}else if(e.type === 'remove'){
						return {op: editCodes.removeBoolean, edit: {value: e.value}, syncId: -1, editId: e.editId}
					}else{
						_.errout('TODO: ' + JSON.stringify(e))
					}
				}
			}
		}else if(mt === 'view'){
			return function(e){
				//_.errout('TODO: ' + JSON.stringify(edits))
				_.assertInt(e.editId)
				if(e.type === 'add'){
					return {op: editCodes.addExistingViewObject, edit: {id: e.value}, syncId: -1, editId: e.editId}
				}else if(e.type === 'remove'){
					return {op: editCodes.removeViewObject, edit: {}, state: {sub: e.value}, syncId: -1, editId: e.editId}
				}else{
					_.errout('TODO: ' + JSON.stringify(e))
				}
			}
		}
	}else if(type.type === 'map'){
		var mt = type.value.type
		
		var keyOp = getKeyOp(type.key)
		
		
		if(mt === 'object'){
			return function(e){
				if(e.type === 'put'){
					_.assertDefined(e.state.key)
					return {op: editCodes.putExisting, state: {key: e.state.key, keyOp: keyOp}, edit: {id: e.value}, syncId: -1, editId: e.editId}
				}else if(e.type === 'remove'){
					_.assertDefined(e.value)
					return {op: editCodes.delKey, edit: {}, state: {key: e.value, keyOp: keyOp}, syncId: -1, editId: e.editId}
				}else{
					_.errout('TODO: ' + JSON.stringify(e))
				}
			}
		}else if(mt === 'primitive'){
			
			if(type.value.primitive === 'int'){
				return function(e){
					_.assertInt(e.editId)
					if(e.type === 'put'){
						_.assertDefined(e.state.key)
						return {op: editCodes.putInt, edit: {value: e.value}, state: {key: e.state.key, keyOp: keyOp}, syncId: -1, editId: e.editId}
					}else if(e.type === 'remove'){
						_.assertDefined(e.value)
						return {op: editCodes.delKey, edit: {}, state: {key: e.value, keyOp: keyOp}, syncId: -1, editId: e.editId}
					}else{
						_.errout('TODO: ' + JSON.stringify(e))
					}
				}
			}else if(type.value.primitive === 'string'){
				return function(e){
					//console.log(JSON.stringify(e))
					_.assertInt(e.editId)
					_.assertString(e.value)
					_.assertDefined(e.state.key)
					return {op: editCodes.putString, edit: {value: e.value}, state: {key: e.state.key, keyOp: keyOp}, syncId: -1, editId: e.editId}
				}
			}else if(type.value.primitive === 'long'){
				return function(e){
					_.assertInt(e.editId)
					_.assertDefined(e.value)
					_.assertDefined(e.state.key)
					return {op: editCodes.putLong, edit: {value: e.value}, state: {key: e.state.key, keyOp: keyOp}, syncId: -1, editId: e.editId}
				}
			}else if(type.value.primitive === 'boolean'){
				return function(e){
					_.assertInt(e.editId)
					_.assertDefined(e.value)
					_.assertDefined(e.state.key)
					return {op: editCodes.putBoolean, edit: {value: e.value}, state: {key: e.state.key, keyOp: keyOp}, syncId: -1, editId: e.editId}
				}
			}
			_.errout('TODO: ' + JSON.stringify(type))
		}else if(mt === 'view'){
			return function(c){
				if(c.type === 'put'){
					_.assertDefined(c.state.key)
					return {op: editCodes.putViewObject, edit: {id: c.value}, state: {key: c.state.key, keyOp: keyOp}, syncId: -1, editId: c.editId}
				}else if(c.type === 'remove'){
					_.assertDefined(c.value)
					return {op: editCodes.delKey, edit: {}, state: {key: c.value, keyOp: keyOp}, syncId: -1, editId: c.editId}
				}else{
					_.errout('TODO: ' + JSON.stringify(c))
				}
				//return {op: editCodes.addExistingViewObject, edit: {id: e.value}, syncId: -1, editId: e.editId}
			}
		}else if(mt === 'set' || mt === 'list'){
			var multiType = type.value.members.type
			if(multiType === 'primitive'){
				var pt = type.value.members.primitive
				if(pt === 'int'){
					return function(e){
						//_.assertInt(e.editId)
						//return {op: editCodes.putInt, edit: {value: e.value}, syncId: -1, editId: e.editId}
						_.errout('TODO')
					}
				}else if(pt === 'string'){
					return function(e){
						//console.log(JSON.stringify(e))
						_.assertInt(e.editId)
						//
						if(e.type === 'putAdd'){
							_.assertDefined(e.state.key)
							_.assertString(e.value)
							return {op: editCodes.putAddString, edit: {value: e.value}, state: {key: e.state.key, keyOp: keyOp}, syncId: -1, editId: e.editId}
						}else if(e.type === 'putRemove'){
							_.assertDefined(e.state.key)
							_.assertString(e.value)
							return {op: editCodes.putRemoveString, edit: {value: e.value}, state: {key: e.state.key, keyOp: keyOp}, syncId: -1, editId: e.editId}
						}else if(e.type === 'remove'){
							_.assertDefined(e.value)
							return {op: editCodes.delKey, edit: {}, state: {key: e.value, keyOp: keyOp}, syncId: -1, editId: e.editId}
						}else{
							_.errout('TODO')
						}
					}
				}else if(pt === 'long'){
					return function(e){
						//_.assertInt(e.editId)
						//return {op: editCodes.addLong, edit: {value: e.value}, syncId: -1, editId: e.editId}
						_.errout('TODO')
					}
				}else if(pt === 'boolean'){
					return function(e){
						//_.assertInt(e.editId)
						//return {op: editCodes.addBoolean, edit: {value: e.value}, syncId: -1, editId: e.editId}
						_.errout('TODO')
					}
				}
			}else if(multiType === 'object'){
				return function(c){
					if(c.type === 'putAdd'){
						_.assertDefined(c.state.key)
						return {op: editCodes.putAddExisting, edit: {id: c.value}, state: {key: c.state.key, keyOp: keyOp}, syncId: -1, editId: c.editId}
					}else if(c.type === 'remove'){
						_.assertDefined(c.value)
						return {op: editCodes.delKey, edit: {}, state: {key: c.value, keyOp: keyOp}, syncId: -1, editId: c.editId}
					}else if(c.type === 'putRemove'){
						_.assertDefined(c.state.key)
						return {op: editCodes.putRemoveExisting, edit: {id: c.value}, state: {key: c.state.key, keyOp: keyOp}, syncId: -1, editId: c.editId}
					}else{
						_.errout('TODO: ' + JSON.stringify(c))
					}
				}
			}else{
				_.errout('TODO: ' + JSON.stringify(type.value.members))
			}
		}else if(mt === 'map'){
			return function(){
				_.errout('cannot instantiate edits for a map whose values are also maps')
			}
		}
	}else if(type.type === 'primitive'){
		if(type.primitive === 'int'){
			return function(e){
				_.assertInt(e.editId)
				return {op: editCodes.setInt, edit: {value: e.value}, syncId: -1, editId: e.editId}
			}
		}else if(type.primitive === 'string'){
			return function(e){
				console.log(JSON.stringify(e))
				_.assertInt(e.editId)
				_.assertString(e.value)
				return {op: editCodes.setString, edit: {value: e.value}, syncId: -1, editId: e.editId}
			}
		}else if(type.primitive === 'long'){
			return function(e){
				_.assertInt(e.editId)
				return {op: editCodes.setLong, edit: {value: e.value}, syncId: -1, editId: e.editId}
			}
		}else if(type.primitive === 'boolean'){
			return function(e){
				_.assertInt(e.editId)
				return {op: editCodes.setBoolean, edit: {value: e.value}, syncId: -1, editId: e.editId}
			}
		}
	}else if(type.type === 'object'){
		return function(e){
			if(e.type === 'set'){
				_.assertInt(e.editId)
				var id = e.value
				
				//console.log(JSON.stringify(e))
				
				if(_.isInt(id.inner)){
					return {op: editCodes.setToInner, edit: {top: id.top, inner: id.inner}, syncId: -1, editId: e.editId}
				}else{
					if(_.isObject(id)){
						_.assertUndefined(id.inner)
						id = id.top
					}
					//_.assertDefined(id)
					_.assertInt(id)
					return {op: editCodes.setObject, edit: {id: id}, syncId: -1, editId: e.editId}
				}
			}else if(e.type === 'clear'){
				return {op: editCodes.clearProperty, edit: {}, syncId: -1, editId: e.editId}
			}else{
				_.errout('TODO: ' + JSON.stringify(e))
			}
		}
	}else if(type.type === 'view'){
		return function(e){
			_.assertInt(e.editId)
			_.assertString(e.value)
			return {op: editCodes.setViewObject, edit: {id: e.value}, syncId: -1, editId: e.editId}
		}
	}else if(type.type === 'nil'){
		return function(e){
			_.errout('TODO?')
		}
	}
	
	_.errout('tODO: ' + JSON.stringify(type))	
}

function makeChangeConverter(type){
	if(type.type === 'set' || type.type === 'list'){
		return function(state){
			var changes = []
			_.assertDefined(state)
			_.assertArray(state)
			
			state.forEach(function(v){
				changes.push({type: 'add', value: v})
			})
			return changes
		}
	}else if(type.type === 'map'){
		return function(edits){
			_.errout('TODO')			
		}
	}else if(type.type === 'primitive' || type.type === 'object' || type.type === 'view'){
		return function(state){
			if(_.isArray(state)) _.errout('bad convert')
			if(state !== undefined){
				return [{type: 'set', value: state}]
			}else{
				return []
			}
		}
	}else if(type.type === 'nil'){
		return function(state){
			_.errout('TODO?')
		}
	}
	
	_.errout('tODO: ' + JSON.stringify(type))	
}
function makeStateValidator(type){
	if(type.type === 'set' || type.type === 'list'){
		return function(s){
			_.assertArray(s)
			return s
		}
	}else if(type.type === 'map'){
		return function(m){
			if(m === undefined) return {}
			_.assertObject(m)
			return m
		}
	}else if(type.type === 'primitive'){
		return function(v){
			_.assertPrimitive(v)
			return v
		}
	}else if(type.type === 'object'){
		return function(id){
			_.assertNot(_.isArray(id))
			return id
		}
	}else if(type.type === 'view'){
		return function(id){
			_.assertNot(_.isArray(id))
			if(id !== undefined) _.assertString(id)
			return id
		}
	}else if(type.type === 'nil'){
		return function(n){
			return n
		}
	}else{
		_.errout('TODO: ' + JSON.stringify(type))
	}
}
function makeDefaultState(type){
	if(type.type === 'set' || type.type === 'list'){
		return []
	}else if(type.type === 'map'){
		return {}
	}else if(type.type === 'primitive'){
		return undefined
	}else if(type.type === 'object'){
		return undefined;
	}else if(type.type === 'nil'){
		return undefined;
	}
}
/*
function makeStateConstructor(type){
	if(type.type === 'set' || type.type === 'list'){
		return function(edits){
			var values = []
			for(var i=0;i<edits.length;++i){
				var e = edits[i]
				if(e.type === 'add'){
					values.push(e.value)
				}else if(e.type === 'remove'){
					var index = values.indexOf(e.value)
					_.assert(index !== -1)
					values.splice(index, 1)
				}else{
					_.errout('TODO: ' + JSON.stringify(e))
				}
			}
			return values
		}
	}else if(type.type === 'map'){
		return function(edits){
			var values = {}
			for(var i=0;i<edits.length;++i){
				var e = edits[i]
				if(e.type === 'put'){
					values[e.key] = e.value
				}else{
					_.errout('TODO: ' + JSON.stringify(e))
				}
			}
			return values
		}
	}else if(type.type === 'primitive' || type.type === 'object' || type.type === 'view'){
		return function(edits){
			var value
			for(var i=0;i<edits.length;++i){
				var e = edits[i]
				if(e.type === 'set'){
					value = e.value
				}else{
					_.errout('TODO: ' + JSON.stringify(e))
				}
			}
			return value
		}
	}else if(type.type === 'nil'){
		return function(edits){
			_.errout('TODO?')
		}
	}
	
	_.errout('tODO: ' + JSON.stringify(type))	
}*/

function arrayStub(){return [];}

function makeStateInclusionsExtractor(type){
	if(type.type === 'set' || type.type === 'list'){
		if(type.members.type === 'object' || type.members.type === 'view'){
			return function(state){
				if(state === undefined) return []
				return [].concat(state)
			}
		}else{
			return arrayStub
		}
	}else if(type.type === 'object' || type.type === 'view'){
		return function(state){
			if(state === undefined) return []
			return [state]
		}
	}else if(type.type === 'map'){
		return function(state){
			var ids = []
			var has = {}
			if(type.key.type === 'object'){
				Object.keys(state).forEach(function(idStr){
					var id = parseInt(idStr)
					_.assertDefined(id)
					if(has[id]) return
					ids.push(id)
				})
			}
			if(type.value.type === 'object'){
				Object.keys(state).forEach(function(keyStr){
					var id = parseInt(state[keyStr])
					_.assertDefined(id)
					if(has[id]) return
					ids.push(id)
				})
			}
			if(type.value.type === 'object'){
				Object.keys(state).forEach(function(keyStr){
					var id = state[keyStr]
					_.assertDefined(id)
					if(has[id]) return
					ids.push(id)
				})
			}
			return ids
		}
	}else if(type.type === 'primitive' || type.type === 'nil'){
		return arrayStub
	}
	
	_.errout('tODO: ' + JSON.stringify(type))
}
function makeInclusionsExtractor(type){
	if(type.type === 'set' || type.type === 'list'){
		if(type.members.type === 'object' || type.members.type === 'view'){
			return function(changes){
				var ids = []
				var has = {}
				changes.forEach(function(c){
					if(c.type === 'add'){
						var id = c.value
						if(has[id]) return
						ids.push(id)						
					}else if(c.type === 'remove'){
					}/*else if(c.type === 'clear'){
					}*/else{
						_.errout('TODO: ' + JSON.stringify(c))
					}

					/*id = c.value
					if(id){
						if(has[id]) return
						//console.log('here: ' + JSON.stringify(c))
						//_.assertInt(id)
						ids.push(id)
					}*/
				})
				return ids
			}
		}else{
			return arrayStub
		}
	}else if(type.type === 'object'){
		return function(changes){
			var ids = []
			var has = {}
			changes.forEach(function(c){
				if(has[c.value]) return
				has[c.value] = true
				//if(!c.value) _.errout('TODO: ' + JSON.stringify(e))
				//_.assertInt(c.value)
				ids.push(c.value)
			})
			return ids
		}
	}else if(type.type === 'view'){
		return function(changes){
			var ids = []
			var has = {}
			changes.forEach(function(c){
				if(has[c.value]) return
				has[c.value] = true
				if(!c.value) _.errout('TODO: ' + JSON.stringify(c))
				_.assertString(c.value)
				ids.push(c.value)
			})
			return ids
		}
	}else if(type.type === 'map'){
		if((type.value.type === 'object' || type.value.type === 'view') && (type.key.type === 'object'||type.key.type==='view')){
			return function(changes){
				var ids = []
				changes.forEach(function(c){
					if(c.type === 'put'){
						if(ids.indexOf(c.value) === -1) ids.push(c.value)
						if(ids.indexOf(c.key) === -1) ids.push(c.key)
					}else{
						_.errout('TODO: ' + JSON.stringify(c))
					}
				})
				return ids
			}
		}else if(type.value.type === 'object' || type.value.type === 'view'){
			return function(changes){
				var ids = []
				changes.forEach(function(c){
					if(c.type === 'put'){
						_.assertDefined(c.value)
						if(ids.indexOf(c.value) === -1) ids.push(c.value)
					}else if(c.type === 'remove'){
					}else{
						_.errout('TODO: ' + JSON.stringify(c))
					}
				})
				return ids
			}
		}else if(type.key.type === 'object' || type.key.type === 'view'){
			return function(changes){
				var ids = []
				changes.forEach(function(c){
					if(c.type === 'put'){
						_.assertDefined(c.state.key)
						if(ids.indexOf(c.state.key) === -1) ids.push(c.state.key)
					}else{
						_.errout('TODO: ' + JSON.stringify(c))
					}
				})
				return ids
			}
		}else if(type.key.type === 'primitive' && type.value.members && type.value.members.type === 'object'){
			return function(changes){
				var ids = []
				changes.forEach(function(c){
					if(c.type === 'putAdd'){
						_.assertDefined(c.value)
						if(ids.indexOf(c.value) === -1) ids.push(c.value)
					}else if(c.type === 'remove'){
						//do nothing
					}else if(c.type === 'putRemove'){
						//do nothing
					}else{
						_.errout('TODO: ' + JSON.stringify(c))
					}
				})
				return ids
			}
		}else if(type.key.type === 'primitive' && (type.value.type === 'primitive' || (type.value.members && type.value.members.type === 'primitive'))){
			return function(){return []}
		}else{
			_.errout('TODO: ' + JSON.stringify(type))
		}
	}else if(type.type === 'primitive' || type.type  === 'nil'){
		return arrayStub
	}
	
	_.errout('tODO: ' + JSON.stringify(type))
}
