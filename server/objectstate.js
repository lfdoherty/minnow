"use strict";

var _ = require('underscorem');

var versions = require('./versions');

var set = require('structures').set;

var pathmerger = require('./pathmerger')
var pathsplicer = require('./pathsplicer')

var editFp = require('./tcp_shared').editFp
var editCodes = editFp.codes
var editNames = editFp.names

var log = require('quicklog').make('minnow/objectstate')

function errorStub(){_.errout('this should never be called');}


var differentPathEdits = require('./pathmerger').differentPathEdits

function makeObjectPropertyTracker(id, pc){

	var lastPathOpWasKey;
	
	var inProperty = false
	var inObj = false
	if(id.inner === undefined) inObj = true
	var f = function(e){
		var op = e.op
		//console.log(depth + ' ' + JSON.stringify(e))
		if(op === editCodes.selectProperty){
			
			if(e.edit.typeCode === pc){
				inProperty = true
			}else{
				inProperty = false
			}
			lastPathOpWasKey = false
		}else if(editFp.isKeyCode[op]){
		}else if(op === editCodes.selectObject){
			lastPathOpWasKey = false
			inObj = e.edit.id === id 
			if(id.inner) inObj = e.edit.id === id.inner
		}else if(op === editCodes.clearObject){
			inObj = id.inner === undefined
		}else if(op === editCodes.madeFork){
			if(id.inner === undefined) inObj = true
			inProperty = false
			lastPathOpWasKey = false
		}

		return inObj && inProperty
	}
	
	f.matchesSubsequence = function(){
		return depth === matchingDepth
	}
	f.getDepth = function(){
		return depth
	}
	
	return f
}

var innerify = require('./innerId').innerify

function indexOfRawId(arr, id){
	for(var i=0;i<arr.length;++i){
		var v = arr[i]
		if(typeof(v) === 'number'){
			if(v === id){
				return i
			}
		}else{
			if(v.inner === id){
				return i
			}
		}
	}
	return -1
}
function hasInnerId(arr, id){
	for(var i=0;i<arr.length;++i){
		var v = arr[i]
		if(typeof(v) === 'number'){
			if(v === id){
				return true
			}
		}else{
			if(v.inner === id){
				return true
			}
		}
	}
	return false
}

function advanceStateAndReportChange(objId, prop, changeReport, e, lastKey, subObj){
	var op = e.op
	var syncId
	if(editFp.isSetCode[op]){
		if(editFp.isPrimitiveSetCode[op]){
			if(e.edit.value !== prop){
				_.assertDefined(e.edit.value)
				changeReport({type: 'set', value: e.edit.value, old: prop, editId: e.editId, syncId: syncId})
				prop = e.edit.value
			}
		}else if(op === editCodes.setExisting || op === editCodes.setObject){
			if(e.edit.id !== prop){
				if(e.edit.id === undefined){
					changeReport({type: 'clear', editId: e.editId, syncId: syncId})
				}else{
					_.assertDefined(e.edit.id)
					changeReport({type: 'set', value: e.edit.id, old: prop, editId: e.editId, syncId: syncId})
				}
				prop = e.edit.id
			}
		}else if(op === editCodes.setSyncId){
			syncId = e.edit.syncId
			_.assertInt(syncId)
		}else{
			_.errout('TODO: ' + op)
		}
	}else if(op === editCodes.clearProperty){
		if(prop !== undefined){
			changeReport({type: 'clear', old: prop, editId: e.editId, syncId: syncId})
			prop = undefined
		}
	}else if(op === editCodes.setSyncId){
		syncId = e.edit.syncId
		_.assertInt(syncId)
	}else if(op === editCodes.wasSetToNew){
		//_.errout('TODO')
		var v = innerify(objId, e.edit.id) 
		changeReport({type: 'set', value: v, old: prop, editId: e.editId, syncId: syncId})
		prop = v
	}else if(editFp.isAddCode[op]){
		if(prop === undefined) prop = []
		if(editFp.isPrimitiveAddCode[op]){
			if(prop.indexOf(e.edit.value) === -1){
				//console.log('added primitive: ' + e.edit.value)
				changeReport({type: 'add', value: e.edit.value, editId: e.editId, syncId: syncId})
				prop.push(e.edit.value)
			}
		}else if(op === editCodes.addExisting){
			if(prop.indexOf(e.edit.id) === -1){
				changeReport({type: 'add', value: e.edit.id, editId: e.editId, syncId: syncId})
				prop.push(e.edit.id)
			}
		}else if(op === editCodes.addedNew){
			var innerId = innerify(objId, e.edit.id)
			if(!hasInnerId(prop, innerId)){
				console.log('reporting change: ' + JSON.stringify({type: 'add', value: innerId, editId: e.editId, syncId: syncId}))
				changeReport({type: 'add', value: innerId, editId: e.editId, syncId: syncId})
				prop.push(innerId)
			}
		}else if(op === editCodes.unshiftExisting){
			if(prop.indexOf(e.edit.id) === -1){
				prop.unshift(e.edit.id)
			}
		}else if(op === editCodes.unshiftedNew){
			var innerId = innerify(objId, e.edit.id)
			if(!hasInnerId(prop, innerId)){//prop.indexOf(e.edit.id) === -1){
				//prop.push(e.edit.id)
				//prop.unshift(innerId)
				changeReport({type: 'unshift', value: e.edit.id, editId: e.editId, syncId: syncId})

			}
		}else if(op === editCodes.addAfter){
			if(prop.indexOf(e.edit.id) === -1){
				_.errout('TODO')
				var beforeId = editPath[editPath.length-1].edit.id
				var beforeIndex = indexOfRawId(prop, beforeId)
				if(beforeIndex === -1){
					changeReport({type: 'add', value: e.edit.id, editId: e.editId, syncId: syncId})
					prop.push(e.edit.id)
				}else{
					changeReport({type: 'addAt', index: beforeIndex+1, value: e.edit.id, editId: e.editId, syncId: syncId})
					prop.splice(beforeIndex+1, 0, e.edit.id)
				}
			}
		}else if(op === editCodes.addedNewAfter){
			var innerId = innerify(objId, e.edit.id)
			if(!hasInnerId(prop, innerId)){//prop.indexOf(e.edit.id) === -1){
				_.errout('TODO')
				var beforeId = editPath[editPath.length-1].edit.id
				var beforeIndex = indexOfRawId(prop, beforeId)
				if(beforeIndex === -1){
					changeReport({type: 'add', value: innerId, editId: e.editId, syncId: syncId})
					prop.push(innerId)
				}else{
					changeReport({type: 'addAt', index: beforeIndex+1, value: innerId, editId: e.editId, syncId: syncId})
					prop.splice(beforeIndex+1, 0, innerId)
				}
			}else{
				//TODO is this even possible?
			}
		}else{
			_.errout('TODO: ' + JSON.stringify(e))
		}
	}else if(editFp.isRemoveCode[op]){
		if(op === editCodes.remove){
			var i = indexOfRawId(prop, subObj)
			if(i !== -1){
				//console.log('removing object from property')
				changeReport({type: 'remove', value: subObj, editId: e.editId, syncId: syncId})
				prop.splice(i, 1)
			}else{
				//_.errout('TODO: ' + JSON.stringify([op, subObj, prop, e]))
				console.log('ignoring invalid remove: ' + JSON.stringify([op, subObj, prop, e]))
			}
			/*_.errout('TODO')
			
			var id = editPath[editPath.length-1].edit.id
			var i = indexOfRawId(prop, id)//prop.indexOf(id)
			if(i !== -1){
				c//onsole.log('removing object from property')
				changeReport({type: 'remove', value: e.edit.id, editId: e.editId, syncId: syncId})
				prop.splice(i, 1)
			}else{
				_.errout('TODO: ' + JSON.stringify([op, edit]))
			}	*/					
		}else if(editFp.isPrimitiveRemoveCode[op]){
			var i = prop.indexOf(e.edit.value)
			if(i !== -1){
				changeReport({type: 'remove', value: e.edit.value, editId: e.editId, syncId: syncId})
				prop.splice(i, 1)
			}else{
				_.errout('TODO: ' + JSON.stringify([op, edit]))
			}
		}else{
			_.errout('TODO: ' + op)
		}
	}else if(op === editCodes.didPutNew){
		//_.errout('TODO: put')
		if(prop === undefined) prop = {}
		prop[lastKey] = innerify(objId, e.edit.id)
		changeReport({type: 'put', key: lastKey, value: prop[lastKey], editId: e.editId, syncId: syncId})
	}else if(editFp.isPutCode[op]){
		//_.errout('TODO: put')
		if(prop === undefined) prop = {}
		if(op === editCodes.putExisting){
			changeReport({type: 'put', key: lastKey, value: e.edit.id, editId: e.editId, syncId: syncId})
			prop[lastKey] = (e.edit.id)
		}else{
			_.assertDefined(e.edit.value)
			changeReport({type: 'put', key: lastKey, value: e.edit.value, editId: e.editId, syncId: syncId})
			prop[lastKey] = e.edit.value
			//_.errout('TODO: ' + op)
		}
	}else if(op === editCodes.refork){
		_.errout('TODO')
		//TODO recompute the subject property with the new initial properties, diff compared to now
	}
	return prop
}

function getDefaultValue(ol, schema, typeCode, propertyCode){
	var defaultValue
	if(propertyCode === -2) return function(){return undefined}
	//console.log(typeCode + ' ' + JSON.stringify(schema._byCode[typeCode]))
	if(schema._byCode[typeCode].propertiesByCode === undefined) _.errout('cannot get non-existent property ' + id + ' ' + typeCode + '.' + propertyCode)
	var propertyType = schema._byCode[typeCode].propertiesByCode[propertyCode]
	if(propertyType === undefined) _.errout('cannot get non-existent property ' + typeCode + '.' + propertyCode)
	if(propertyType.type.type === 'set' || propertyType.type.type === 'list') return function(){return []}
	else if(propertyType.type.type === 'map') return function(){return {}}
	return function(){return undefined}
}

var realEdits = {}
realEdits[editCodes.setLong] = true
realEdits[editCodes.setString] = true
realEdits[editCodes.setObject] = true
realEdits[editCodes.setBoolean] = true
realEdits[editCodes.setInt] = true
realEdits[editCodes.wasSetToNew] = true
realEdits[editCodes.addExisting] = true
realEdits[editCodes.addString] = true
realEdits[editCodes.removeString] = true
realEdits[editCodes.addInt] = true
realEdits[editCodes.removeInt] = true
realEdits[editCodes.addedNew] = true
realEdits[editCodes.putString] = true
realEdits[editCodes.putBoolean] = true
realEdits[editCodes.delKey] = true
realEdits[editCodes.didPutNew] = true
realEdits[editCodes.putExisting] = true
realEdits[editCodes.delKey] = true
realEdits[editCodes.remove] = true
realEdits[editCodes.clearProperty] = true
realEdits[editCodes.addedNewAt] = true
realEdits[editCodes.addAfter] = true
realEdits[editCodes.addedNewAfter] = true
realEdits[editCodes.unshiftExisting] = true
realEdits[editCodes.unshiftedNew] = true
realEdits[editCodes.moveToAfter] = true
realEdits[editCodes.moveToFront] = true
realEdits[editCodes.moveToBack] = true

//these are not really real, but we treat them like they are
realEdits[editCodes.selectStringKey] = true
realEdits[editCodes.selectSubObject] = true
realEdits[editCodes.selectObjectKey] = true
realEdits[editCodes.selectIntKey] = true

var alwaysIgnorable = {}
alwaysIgnorable[editCodes.setSyncId] = true
alwaysIgnorable[editCodes.made] = true
alwaysIgnorable[editCodes.madeFork] = true
alwaysIgnorable[editCodes.initializeUuid] = true
alwaysIgnorable[editCodes.refork] = true


function getPropertyChangesDuringViaFilter(makeDefaultValue, ol, id, propertyCode, lastEditId, endEditId, cb){
	_.assertFunction(cb)
	
	if(id.inner) _.assert(id.inner !== id.top)

	var pv = makeDefaultValue()
	var changes = []
	
	var isProperty
	var isObject = !id.inner
	var currentKey
	var currentSubObj
	function filter(editCode, editId){
		//console.log('filtering: ' + editNames[editCode] + ' ' + propertyCode)
		if(editId > endEditId) return false
		if(alwaysIgnorable[editCode]){
		}else if(editCode === editCodes.selectProperty || editCode === editCodes.selectObject || editCode === editCodes.clearObject){
			return true
		}else if(realEdits[editCode]){
			//console.log('result: ' + (isProperty && isObject))
			return isProperty && isObject
		}else{
			_.errout('TODO: ' + editNames[editCode] + ' ' + editId)
		}
	}
	//var used = []//temporary, for debugging
	ol.getPartiallyIncludingForked(id, filter, function(editCode, edit, editId){
		//console.log('using: ' + editNames[editCode] + ' ' + JSON.stringify(edit) + ' ' + editId)
		//used.push([editNames[editCode], edit, editId])
		if(editCode === editCodes.selectProperty){
			isProperty = edit.typeCode === propertyCode
		}else if(editCode === editCodes.selectObject){
			isObject = id.inner ? edit.id===id.inner : (edit.id===id.top||edit.id===id)
		}else if(editCode === editCodes.clearObject){
			isObject = !id.inner
		}else if(editCode === editCodes.selectSubObject){
			currentSubObj = edit.id
		}else if(editId < lastEditId){
			//do nothing
		}else{
			if(editCode === editCodes.setString || editCode === editCodes.setInt || editCode === editCodes.setBoolean || editCode === editCodes.setLong){
				changes.push({type: 'set', value: edit.value, old: pv, editId: editId})
				pv = edit.value
			}else if(editCode === editCodes.setObject){
				changes.push({type: 'set', value: edit.id,  old: pv, editId: editId})
				pv = edit.id
			}else if(editCode === editCodes.wasSetToNew){
				changes.push({type: 'set', value: innerify(id, edit.id),  old: pv, editId: editId})
				pv = edit.id
			}else if(editCode === editCodes.addExisting){
				pv.push(edit.id)
				changes.push({type: 'add', value: edit.id, editId: editId})
			}else if(editCode === editCodes.addedNew){
				var newId = innerify(id, edit.id)
				pv.push(newId)
				changes.push({type: 'add', value: newId, editId: editId})
			}else if(editCode === editCodes.addedNewAt){
				var newId = innerify(id, edit.id)
				pv.push(newId)
				changes.push({type: 'add', value: newId, editId: editId})
			}else if(editCode === editCodes.addedNewAfter){
				pv.push(innerify(id, edit.id))
				var newId = innerify(id, edit.id)
				pv.push(newId)
				changes.push({type: 'add', value: newId, editId: editId})
			}else if(editCode === editCodes.addAfter){
				pv.push(edit.id)
				changes.push({type: 'add', value: edit.id, editId: editId})
			}else if(editCode === editCodes.moveToAfter){
				//TODO
			}else if(editCode === editCodes.moveToFront){
				//TODO
			}else if(editCode === editCodes.moveToBack){
				//TODO
			}else if(editCode === editCodes.unshiftExisting){
				pv.unshift(edit.id)
				changes.push({type: 'add', value: edit.id, editId: editId})			
			}else if(editCode === editCodes.unshiftedNew){
				pv.unshift(innerify(id, edit.id))
				changes.push({type: 'add', value: innerify(id, edit.id), editId: editId})			
			}else if(editCode === editCodes.addString || editCode === editCodes.addInt){
				changes.push({type: 'add', value: edit.value, editId: editId})			
				pv.push(edit.value)
			}else if(editCode === editCodes.removeString || editCode === editCodes.removeInt){
				var i = pv.indexOf(edit.value)
				if(i !== -1){
					pv.splice(i, 1)
					changes.push({type: 'remove', value: edit.value, editId: editId})			
				}
				//else console.log('WARNING: did not need to remove: ' + edit.value)
			}else if(editCode === editCodes.remove){
				_.assertDefined(currentSubObj)
				var i = pv.indexOf(currentSubObj)
				
				var i = indexOfRawId(pv, currentSubObj)
				if(i !== -1){
					pv.splice(i, 1)
					changes.push({type: 'remove', value: currentSubObj, editId: editId})			
				}
				//else console.log('WARNING: did not need to remove object: ' + currentSubObj)
			}else if(editCode === editCodes.selectStringKey || editCode === editCodes.selectObjectKey || editCode === editCodes.selectIntKey){
				currentKey = edit.key
			}else if(editCode === editCodes.putString || editCode === editCodes.putBoolean){
				_.assertDefined(currentKey)
				//pv[currentKey] = edit.value
				changes.push({type: 'put', value: edit.value, key: currentKey, editId: editId})			
			}else if(editCode === editCodes.putExisting){
				_.assertDefined(currentKey)
				//pv[currentKey] = edit.id
				changes.push({type: 'put', value: edit.id, key: currentKey, editId: editId})			
			}else if(editCode === editCodes.delKey){
				_.assertDefined(currentKey)
				//delete pv[currentKey]// = undefined
				changes.push({type: 'remove', value: currentKey, editId: editId})			
			}else if(editCode === editCodes.didPutNew){
				_.assertDefined(currentKey)
				//pv[currentKey] = innerify(id, edit.id)
				changes.push({type: 'put', value: innerify(id, edit.id), key: currentKey, editId: editId})			
			}else if(editCode === editCodes.clearProperty){
				pv = makeDefaultValue()
				changes.push({type: 'clear', editId: editId})			
			}else{
				_.errout('TODO: ' + JSON.stringify([editCode, edit, editId]))
			}
		}
	}, function(){
		cb(changes, id)
	})
}

function getPropertyValueAtViaFilter(makeDefaultValue, ol, id, propertyCode, desiredEditId, cb){
	_.assertFunction(cb)
	
	if(id.getPropertyValueAt){
		id.getPropertyValueAt(id, propertyCode, desiredEditId, cb)
		return
	}
	
	if(id.inner) _.assert(id.inner !== id.top)

	var pv = makeDefaultValue()
	var isProperty
	var isObject = !id.inner
	var currentKey
	var currentSubObj
	function filter(editCode, editId){
		//console.log('filtering: ' + editNames[editCode] + ' ' + propertyCode)
		if(editId > desiredEditId) return false
		if(alwaysIgnorable[editCode]){
		}else if(editCode === editCodes.selectProperty || editCode === editCodes.selectObject || editCode === editCodes.clearObject){
			return true
		}else if(realEdits[editCode]){
			//console.log('result: ' + (isProperty && isObject))
			return isProperty && isObject
		}else{
			_.errout('TODO: ' + editNames[editCode] + ' ' + editId)
		}
	}
	//var used = []//temporary, for debugging
	ol.getPartiallyIncludingForked(id, filter, function(editCode, edit, editId){
		//console.log('using: ' + editNames[editCode] + ' ' + JSON.stringify(edit) + ' ' + editId)
		//used.push([editNames[editCode], edit, editId])
		if(editCode === editCodes.selectProperty){
			isProperty = edit.typeCode === propertyCode
		}else if(editCode === editCodes.selectObject){
			isObject = id.inner ? edit.id===id.inner : (edit.id===id.top||edit.id===id)
		}else if(editCode === editCodes.clearObject){
			isObject = !id.inner
		}else if(editCode === editCodes.selectSubObject){
			currentSubObj = edit.id
		}else if(editCode === editCodes.setString || editCode === editCodes.setInt || editCode === editCodes.setBoolean || editCode === editCodes.setLong){
			pv = edit.value
		}else if(editCode === editCodes.setObject){
			pv = edit.id
		}else if(editCode === editCodes.addExisting){
			pv.push(edit.id)
		}else if(editCode === editCodes.addedNew){
			pv.push(innerify(id, edit.id))
		}else if(editCode === editCodes.addedNewAt){
			pv.push(innerify(id, edit.id))
		}else if(editCode === editCodes.addedNewAfter){
			pv.push(innerify(id, edit.id))
		}else if(editCode === editCodes.addAfter){
			pv.push(edit.id)
		}else if(editCode === editCodes.moveToAfter){
			//TODO
		}else if(editCode === editCodes.moveToFront){
			//TODO
		}else if(editCode === editCodes.moveToBack){
			//TODO
		}else if(editCode === editCodes.unshiftExisting){
			pv.unshift(edit.id)
		}else if(editCode === editCodes.unshiftedNew){
			pv.unshift(innerify(id, edit.id))
		}else if(editCode === editCodes.addString || editCode === editCodes.addInt){
			pv.push(edit.value)
		}else if(editCode === editCodes.removeString || editCode === editCodes.removeInt){
			var i = pv.indexOf(edit.value)
			if(i !== -1) pv.splice(i, 1)
			else console.log('WARNING: did not need to remove: ' + edit.value)
		}else if(editCode === editCodes.remove){
			_.assertDefined(currentSubObj)
			//var i = pv.indexOf(currentSubObj)
			var i = indexOfRawId(pv, currentSubObj)
			if(i !== -1) pv.splice(i, 1)
			else console.log('WARNING: did not need to remove object: ' + currentSubObj)
		}else if(editCode === editCodes.selectStringKey || editCode === editCodes.selectObjectKey || editCode === editCodes.selectIntKey){
			currentKey = edit.key
		}else if(editCode === editCodes.putString || editCode === editCodes.putBoolean){
			_.assertDefined(currentKey)
			pv[currentKey] = edit.value
		}else if(editCode === editCodes.putExisting){
			_.assertDefined(currentKey)
			pv[currentKey] = edit.id
		}else if(editCode === editCodes.delKey){
			_.assertDefined(currentKey)
			delete pv[currentKey]// = undefined
		}else if(editCode === editCodes.didPutNew){
			_.assertDefined(currentKey)
			pv[currentKey] = innerify(id, edit.id)
		}else if(editCode === editCodes.clearProperty){
			pv = makeDefaultValue()
		}else{
			_.errout('TODO: ' + JSON.stringify([editCode, edit, editId]))
		}
	}, function(){
		cb(pv, id)
	})
}

function advanceState(objId, prop, e, state){
	_.assertObject(state)
	var op = e.op
	
	//var lastKey
	
	if(editFp.isSetCode[op]){
		if(editFp.isPrimitiveSetCode[op]){
			if(e.edit.value !== prop){
				prop = e.edit.value
			}
		}else if(op === editCodes.setExisting || op === editCodes.setObject){
			if(e.edit.id !== prop){
				prop = e.edit.id
			}
		}else if(op === editCodes.setSyncId){
		}else{
			_.errout('TODO: ' + op)
		}
	}else if(op === editCodes.clearProperty){
		//_.errout('TODO')
		prop = undefined
	}else if(op === editCodes.selectSubObject){
		state.sub = e.edit.id
	}else if(op === editCodes.wasSetToNew){
		//_.errout('TODO')
		prop = innerify(objId, e.edit.id)
	}else if(editFp.isAddCode[op]){
		if(prop === undefined) prop = []
		if(editFp.isPrimitiveAddCode[op]){
			if(prop.indexOf(e.edit.value) === -1){
				//console.log('added primitive: ' + e.edit.value)
				prop.push(e.edit.value)
			}
		}else if(op === editCodes.addExisting){
			if(prop.indexOf(e.edit.id) === -1){
				prop.push(e.edit.id)
			}
		}else if(op === editCodes.addedNew){
			var innerId = innerify(objId.top||objId, e.edit.id)
			if(!hasInnerId(prop, innerId)){//prop.indexOf(e.edit.id) === -1){
				//prop.push(e.edit.id)
				prop.push(innerId)
			}
		}else if(op === editCodes.unshiftExisting){
			if(prop.indexOf(e.edit.id) === -1){
				prop.unshift(e.edit.id)
			}
		}else if(op === editCodes.unshiftedNew){
			var innerId = innerify(objId, e.edit.id)
			if(!hasInnerId(prop, innerId)){//prop.indexOf(e.edit.id) === -1){
				//prop.push(e.edit.id)
				prop.unshift(innerId)
			}
		}else if(op === editCodes.addAfter){
			if(prop.indexOf(e.edit.id) === -1){
				var beforeId = state.sub//editPath[editPath.length-1].edit.id
				var beforeIndex = indexOfRawId(prop, beforeId)
				if(beforeIndex === -1){
					prop.push(e.edit.id)
				}else{
					prop.splice(beforeIndex+1, 0, e.edit.id)
				}
			}
		}else if(op === editCodes.addedNewAfter){
			var innerId = innerify(objId, e.edit.id)
			if(!hasInnerId(prop, innerId)){//prop.indexOf(e.edit.id) === -1){
				var beforeId = state.sub//editPath[editPath.length-1].edit.id
				var beforeIndex = indexOfRawId(prop, beforeId)
				if(beforeIndex === -1){
					prop.push(innerId)
				}else{
					prop.splice(beforeIndex+1, 0, innerId)
				}
			}else{
				//TODO is this even possible?
			}
		}else{
			_.errout('TODO: ' + JSON.stringify(e))
		}
	}else if(editFp.isRemoveCode[op]){
		if(op === editCodes.remove){
			//_.errout('TODO')
			
			var id = state.sub//editPath[editPath.length-1].edit.id
			_.assertDefined(id)
			
			var i = indexOfRawId(prop, id)//prop.indexOf(id)
			if(i !== -1){
				//console.log('removing object from property')
				prop.splice(i, 1)
			}else{
				//_.errout('TODO: ' + JSON.stringify([op, state]))
				//just ignore
			}						
		}else if(editFp.isPrimitiveRemoveCode[op]){
			var i = prop.indexOf(e.edit.value)
			if(i !== -1){
				prop.splice(i, 1)
			}else{
				_.errout('TODO: ' + JSON.stringify([op, edit]))
			}
		}else{
			_.errout('TODO: ' + op)
		}
	}else if(op === editCodes.didPutNew){
		//_.errout('TODO: put')
		if(prop === undefined) prop = {}
		prop[state.key] = innerify(objId, e.edit.id)
	}else if(editFp.isPutCode[op]){
		//_.errout('TODO: put')
		if(prop === undefined) prop = {}
		if(op === editCodes.putExisting){
			prop[state.key] = (e.edit.id)
		}else{
			_.assertDefined(e.edit.value)
			prop[state.key] = e.edit.value
			//_.errout('TODO: ' + op)
		}
	}else if(op === editCodes.refork){
		//_.errout('TODO')//TODO?
	}
	return prop
}

function getPropertyValueChangesDuring(objId, propertyCode, edits, startEditId, endEditId){
	var prop;

	//console.log('streamProperty got ' + edits.length + ' edits, path: ' + JSON.stringify(path))
	//console.log('streamProperty got ' + edits.length + ' edits ' + editId + ' ' + objId + ' ' + propertyCode)
	//console.log(objId + ' edits: ' + JSON.stringify(edits))
	
	var tracker = makeObjectPropertyTracker(objId, propertyCode)
	
	//console.log(JSON.stringify(edits))
	
	//console.log('!!!! objId: ' + JSON.stringify(objId) + ', ' + propertyCode + ' has stream override: ' + (!!objId.stream))
	//console.log(new Error().stack)
	
	var lastKey
	var subObj
	
	var changes = []
	function changeReport(change){
		if(change.editId > startEditId){
			changes.push(change)
		}
	}
	
	//edits.forEach(function(e){
	for(var i=0;i<edits.length;++i){
		var e = edits[i]
		//if(e.editId < startEditId) continue
		if(e.editId > endEditId) break
		
		var op = e.op
		var matching = tracker(e)

		_.assertInt(op)
		
		//console.log(matching, ' <- ', propertyCode + ' ' + editNames[e.op] + ' ' + JSON.stringify(e.edit))
		if(editFp.isKeyCode[op]){
			lastKey = e.edit.key
		}

		if(!matching){
			//console.log('not matching(' + JSON.stringify(objId) + ', ' + propertyCode + '): ' + JSON.stringify(e))
			continue
		}

		if(op === editCodes.selectSubObject){
			subObj = e.edit.id
			//console.log('selected sub obj: ' + JSON.stringify([subObj,edits]))
		}
		
		//console.log('op: ' + editNames[op] + ' ' + JSON.stringify(e))
		
		prop = advanceStateAndReportChange(objId, prop, changeReport, e, lastKey, subObj)
	}
	//log('streaming ', path, ':', prop)
	//console.log(' here streaming ' + JSON.stringify(prop))//, path, ':', prop)
	//console.log(JSON.stringify(edits))
	return changes
}
function getResultingPropertyValue(objId, propertyCode, edits, defaultValue){
	var prop = defaultValue;

	//console.log('streamProperty got ' + edits.length + ' edits, path: ' + JSON.stringify(path))
	//console.log('streamProperty got ' + edits.length + ' edits ' + editId + ' ' + objId + ' ' + propertyCode)
	//console.log(objId + ' edits: ' + JSON.stringify(edits))
	
	var tracker = makeObjectPropertyTracker(objId, propertyCode)
	
	//console.log(JSON.stringify(edits))
	
	//console.log('!!!! objId: ' + JSON.stringify(objId) + ', ' + propertyCode + ' has stream override: ' + (!!objId.stream))
	//console.log(new Error().stack)
	
	//var lastKey
	var state = {}
	//edits.forEach(function(e){
	for(var i=0;i<edits.length;++i){
		var e = edits[i]
		
		var op = e.op
		var matching = tracker(e)

		_.assertInt(op)
		
		//console.log(matching, state, ' <- ', editNames[e.op] + ' ' + JSON.stringify(e.edit))
		if(editFp.isKeyCode[op]){
			//lastKey = e.edit.key
			state.key = e.edit.key
		}

		if(!matching){
			//console.log('not matching(' + JSON.stringify(objId) + ', ' + propertyCode + '): ' + JSON.stringify(e))
			//return
			continue
		}
		
		//console.log('op: ' + editNames[op] + ' ' + JSON.stringify(e))
		
		prop = advanceState(objId, prop, e, state)
		if(prop === undefined) prop = defaultValue
	}
	//})
	//log('streaming ', path, ':', prop)
	//console.log(' here streaming ' + JSON.stringify(prop))//, path, ':', prop)
	//console.log(JSON.stringify(edits))
	return prop
}

exports.make = function(schema, ap, ol){
	_.assertLength(arguments, 3);
	
	var includeFunctions = {};
	
	function emptyIncludeFunction(id, obj, addObjectCb, endCb){endCb();}

	var indexing;

	function computeRealPath(path){
		var realPath = path			
		var index = path.length-2
		while(index > 0){
			var id = path[index].edit.id
			if(ol.isTopLevelObject(id)){
				realPath = path.slice(index)
				break;
			}
			index -= 2
		}
		return realPath
	}
	
	var handle = {
		ol: ol,
		getCurrentEditId: function(){
			return ol.getLatestVersionId()
		},
		forgetTemporary: function(temporary, syncId){
			ap.forgetTemporary(temporary, syncId)
			//var real = ap.translateTemporaryId(temporary, syncId)
			//pm.forgetTemporary(real, temporary, syncId)
			//TODO forget in ap?
		},
		isTopLevelObject: function(id){
			return ol.isTopLevelObject(id)
		},
		validateId: function(id){
			ol.validateId(id)
		},
		getUuid: function(id){
			return ol.getUuid(id)
		},
		isFork: function(id){
			return ol.isFork(id)
		},
		getForked: function(id){
			return ol.getForked(id)
		},
		getAllForked: function(id){
			return ol.getAllForked(id)
		},
		isDeleted: function(id){
			return ol.isDeleted(id)
		},
		addEdit: function(op, state, edit, syncId, computeTemporary, reifyCb){
			//_.assertLength(arguments, 7);

			//console.log('adding edit: ' + JSON.stringify(arguments))
			if(op !== editCodes.make && op !== editCodes.forgetTemporary){
				_.assertInt(state.object);
			}
			_.assertInt(syncId);
			_.assertInt(op)
			//TODO support merge models
			
			if(op === editCodes.make){
				return ap.persistEdit({}, op, edit, syncId, computeTemporary, Date.now())//TODO this timestamp is inconsistent with what will be serialized
			}else{
				_.assertInt(state.top)
				_.assert(state.object < -1 || state.object > 0)
				
				if(state.object < -1){
					state.object = ap.translateTemporaryId(state.object, syncId)
				}
				_.assert(state.object > 0)
				if(state.top < -1){
					state.top = ap.translateTemporaryId(state.top, syncId)
				}
				//console.log('state.top: ' + state.top)
				_.assert(state.top > 0)
				//pm(id, state, op, edit, syncId, computeTemporary, reifyCb)
				
				//console.log(new Error().stack)
				var currentState = ol.getObjectMetadata(state.top)
				//console.log(JSON.stringify(currentState) + ' -> ' + JSON.stringify(state))
				if(state.object && state.object !== currentState.object){// && state.object !== state.top){
					if(state.object === state.top){
						if(currentState.object !== undefined){
							ap.saveEdit(handle.getObjectType(state.top), state.top, editCodes.clearObject, {}, syncId, Date.now())						
						}
					}else{
						currentState.property = undefined
						ap.saveEdit(handle.getObjectType(state.top), state.top, editCodes.selectObject, {id: state.object}, syncId, Date.now())
					}
				}
				if(state.property && state.property !== currentState.property){
					ap.saveEdit(handle.getObjectType(state.top), state.top, editCodes.selectProperty, {typeCode: state.property}, syncId, Date.now())
				}
				if(state.sub && state.sub !== currentState.sub){
					ap.saveEdit(handle.getObjectType(state.top), state.top, editCodes.selectSubObject, {id: state.sub}, syncId, Date.now())
				}
				if(state.key !== undefined && state.key !== currentState.key){
					_.assertInt(state.keyOp)
					ap.saveEdit(handle.getObjectType(state.top), state.top, state.keyOp, {key: state.key}, syncId, Date.now())
				}
				
				//var objId = state.object
				//if(objId < 0) objId = ap.translateTemporaryId(state.object, syncId)
				
				//state.topTypeCode = handle.getObjectType(state.top)
				//state.objTypeCode = handle.getObjectType(objId||id)
				//state.top = id 
				_.assertInt(state.object)
				
				ap.persistEdit(state, op, edit, syncId, computeTemporary, Date.now(), reifyCb)
			}
		},

		translateTemporaryId: function(id, syncId){
			_.assertInt(id)
			_.assertInt(syncId)
			_.assert(id < 0)
			_.assert(syncId >= 0)
			return ap.translateTemporaryId(id, syncId)
		},
		syntheticEditId: function(){
			return ap.syntheticEditId()
		},
		getSyncIds: function(id, cb){
			ol.getSyncIds(id, cb)
		},
		getVersions: function(id, cb){
			ol.getVersions(id, cb)
		},
		getVersionsAt: function(id, editId, cb){
			ol.getVersionsAt(id, editId, cb)
		},
		getLastVersion: function(id, cb){
			cb(ol.getLastVersion(id))
		},
		getLastVersionAt: function(id, editId, cb){
			ol.getLastVersionAt(id, editId, cb)
		},
		getVersionTimestamp: function(id){
			return ol.getVersionTimestamp(id)
		},
		getCreationTimestamp: function(id){
			return ol.getVersionTimestamp(ol.getCreationVersion(id))
		},
		
		getInclusionsDuring: function(id, lastEditId, endEditId, cb){//TODO getExclusionsDuring?
			//_.assertInt(id)
			if(_.isObject(id)) id = id.top
			_.assertInt(id)
			ol._getForeignIdsDuring(id, lastEditId, endEditId, cb)
			/*
			ol._getForeignIds(id, lastEditId-1, function(a){
				ol._getForeignIds(id, endEditId, function(b){
				//	console.log('during: ' + lastEditId+' ' + endEditId + ' ' + JSON.stringify([id,a,b]))
					var has = {}
					var res = []
					a.forEach(function(id){
						has[id] = true
					})
					b.forEach(function(id){
						if(!has[id]){
							res.push(id)
						}
					})
					cb(res)
				})
			})*/
		},
		getInclusionsAt: function(id, editId, cb){
			_.assertInt(id)
			ol._getForeignIds(id, editId, cb)
		},
		getSyncIdFor: function(editId){
			return ol.getSyncIdFor(editId)
		},
		getEditsBetween: function(id, lastEditId, endEditId, cb){
			if(id.getChangesBetween) _.errout('TODO')
			
			ol.getIncludingForked(id, -1, -1, function(edits){
				var res = []
				//console.log(JSON.stringify(edits))
				var syncId = -100
				edits.forEach(function(e){
					if(e.op === editCodes.setSyncId){
						syncId = e.edit.syncId
					}
					if(e.editId > lastEditId && e.editId <= endEditId){
						//_.assertInt(e.syncId)
						e.syncId = syncId
						res.push(e)
					}
				})
				cb(res)
			})
		},
		getSetPropertyChangesDuring: function(set, propertyCode, lastEditId, endEditId, cb, doneCb){
			var cdl = _.latch(set.length, doneCb)
			for(var i=0;i<set.length;++i){
				var id = set[i]
				handle.getPropertyChangesDuring(id, propertyCode, lastEditId, endEditId, function(changes, id){
					cb(id, changes)
					cdl()
				})
			}
		},
		getHistoricalPropertyChangesDuring: function(id, propertyCode, lastEditId, endEditId, cb){
			//right now they're the same, but we differentiate for future compatibility in case getPropertyChangesDuring is optimized.
			handle.getPropertyChangesDuring(id, propertyCode, lastEditId, endEditId, cb)
		},
		getExistedAtAndMayHaveChangedDuring: function(typeCode, startEditId, endEditId, cb){
			ol.getExistedAtAndMayHaveChangedDuring(typeCode, startEditId, endEditId, cb)
		},
		getPropertyChangesDuring: function(id, propertyCode, lastEditId, endEditId, cb){
			_.assertDefined(id)
			if(ol.getLastVersion(id) <= lastEditId){
				cb([], id)
				return
			}
			/*if(id.getPropertyChangesDuring){
				id.getPropertyChangesDuring(id, propertyCode, lastEditId, endEditId, cb)
				return
			}

			if(!_.isInt(id)) _.assertInt(id.top)
			
			ol.getIncludingForked(id, -1, -1, function(edits){

				var changes = getPropertyValueChangesDuring(id, propertyCode, edits, lastEditId, endEditId)

				cb(changes, id)
			})*/

			var typeCode = ol.getObjectType(id.inner||id.top||id)
			var makeDefaultValue = getDefaultValue(ol, schema, typeCode, propertyCode)
			
			getPropertyChangesDuringViaFilter(makeDefaultValue, ol, id, propertyCode, lastEditId, endEditId, cb)
		},
		getChangedDuringOfType: function(typeCode, startEditId, endEditId, cb){
			ol.getChangedDuringOfType(typeCode, startEditId, endEditId, cb)
		},
		getPropertyValueAt: function(id, propertyCode, editId, cb){
			_.assertDefined(id)
			if(id.getPropertyValueAt){
				id.getPropertyValueAt(id, propertyCode, editId, cb)
				return
			}
			
			var typeCode = ol.getObjectType(id.inner||id.top||id)//TODO optimize this stuff
			var makeDefaultValue = getDefaultValue(ol, schema, typeCode, propertyCode)

			getPropertyValueAtViaFilter(makeDefaultValue, ol, id, propertyCode, editId, cb)
			
		},
		makeGetPropertyAt: function(typeCode, propertyCode){
			var p
			if(propertyCode !== -2){
				p = schema._byCode[typeCode].propertiesByCode[propertyCode]
				_.assertDefined(p)
			}else{
				p = -2
			}
			
			
			/*if(p.type.type === 'primitive' || p.type.type === 'object'){
				var getter = ol.propertyIndex.makePropertyValueGetter(typeCode, p)
				return function(bindings, id, editId, cb){
					getter(id, editId, cb)
				}
			}else{*/
				var makeDefaultValue = getDefaultValue(ol, schema, typeCode, propertyCode)
				return makeGetPropertyValueAtViaFilter(ol, makeDefaultValue, p, typeCode)
			//}		
		},
		

		streamObjectState: function(already, id, startEditId, endEditId, cb, endCb){
			_.assertLength(arguments, 6)
			_.assertInt(startEditId)
			_.assertInt(endEditId)
			_.assertObject(already)
			_.assert(id > 0)

			ol.streamVersion(already, id, startEditId, endEditId, cb, endCb)
		},

		updateObject: function(objId, editId, cb, doneCb){
			_.assertLength(arguments, 4)
			
			
			
			ol.getAll(objId, function(res){
				//var pu = pathsplicer.make()
				var typeCode = ol.getObjectType(objId)
				var syncId
				res.forEach(function(e){
					if(e.op === editCodes.setSyncId){//TODO do not provide this at all?
						syncId = e.edit.syncId
					}
					//var ignorable = pu.update(e)
					if(e.editId >= editId){
						cb(typeCode, objId, e.op, e.edit, syncId, e.editId)
					}
				})
				doneCb(objId)
			})
		},
		streamObject: function(objId, editId, cb){

			handle.updateObject(objId, editId, cb, function(){
				broadcaster.output.listenByObject(objId, cb)
			})
		},	

		//Note that these method's implementations will always return a result that is up-to-date,
		//by fetching the async parts and then synchronously merging them with the AP parts
		getManyOfType: function(typeCode){
			_.assertLength(arguments, 1)
			return ol.getMany(typeCode)
		},
		getManyOfTypeAt: function(typeCode, editId, cb){
			//_.assertLength(arguments, 3)
			return ol.getManyAt(typeCode, editId, cb)
		},
		getObjects: function(typeCode, ids, cb){
			_.assertFunction(cb);
			_.assertArray(ids)
			
			if(ids.length === 0){
				cb({})
				return;
			}

			//console.log('getting objects: ' + ids.length)

			var objs = {}
			var cdl = _.latch(ids.length, function(){
				//console.log('got all objects, done')
				cb(objs)
			})
			ol.getSet(ids, function(obj){
				objs[obj.meta.id] = obj
				//console.log('got obj')
				cdl()
			})
		},
		getAllIdsOfType: function(typeCode, cb){
			ol.getAllIdsOfType(typeCode, cb)
		},
		getAllIdsOfTypeAt: function(typeCode, editId, cb){
			return ol.getAllIdsOfTypeAt(typeCode, editId, cb)
		},
		getHistoricalCreationsOfType: function(typeCode, cb){
			ol.getHistoricalCreationsOfType(typeCode, cb)
		},
		getAllObjectCreationsOfType: function(typeCode, cb, doneCb){
			ol.getHistoricalCreationsOfType(typeCode, function(vs){
				vs.forEach(function(v){
					cb(v.id, v.editId)
				})
				doneCb()
			})
		},
		getAllObjects: function(typeCode, cb){
			ol.getAllOfType(typeCode, cb)
		},
		getObjectType: function(id){
			_.assertLength(arguments, 1)
			return ol.getObjectType(id)
		},
		getSubsetThatChangesBetween: function(ids, startEditId, endEditId, cb){
			return ol.getSubsetThatChangesBetween(ids, startEditId, endEditId, cb)
		},
		getCreationsOfTypeBetween: function(typeCode, startEditId, endEditId, cb){
			return ol.getCreationsOfTypeBetween(typeCode, startEditId, endEditId, cb)
		},
		getDestructionsOfTypeBetween: function(typeCode, startEditId, endEditId, cb){
			return ol.getDestructionsOfTypeBetween(typeCode, startEditId, endEditId, cb)
		},
		getIdsCreatedOfTypeBetween: function(typeCode, startEditId, endEditId, cb){
			return ol.getIdsCreatedOfTypeBetween(typeCode, startEditId, endEditId, cb)
		},
		getIdsDestroyedOfTypeBetween: function(typeCode, startEditId, endEditId, cb){
			return ol.getIdsDestroyedOfTypeBetween(typeCode, startEditId, endEditId, cb)
		}
	};
	
	return handle;
}

