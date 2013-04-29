
var _ = require('underscorem')
var editFp = require('./tcp_shared').editFp
var editCodes = editFp.codes
var editNames = editFp.names

var innerify = require('./innerId').innerify

function getDefaultValue(schema, typeCode, propertyCode){
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


function getPropertyValueAtViaFilter(makeDefaultValue, ol, id, propertyCode, desiredEditId, cb){
	_.assertFunction(cb)

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


function makeGetPropertyValueAtViaFilter(ol, makeDefaultValue, p){

	var propertyCode = p.code
	
	if(p === -2){
		//_.errout('TODO')
		return function(bindings, id, desiredEditId, cb){
			_.assertLength(arguments, 4)
			cb(ol.getUuid(id), id)
		}
	}else if(p.type.type === 'primitive'){
		var setOp = editCodes['set'+p.type.primitive.substr(0,1).toUpperCase()+p.type.primitive.substr(1)]
		_.assertInt(setOp)
		return function(bindings, id, desiredEditId, cb){
			_.assertLength(arguments, 4)
			_.assertFunction(cb)
			
			//if(id == '41_37' && !id.getPropertyValueAt) _.errout('error')
			/*if(id.getPropertyValueAt){
				id.getPropertyValueAt(id, p.code, desiredEditId, cb)
				return
			}*/
			
			if(id.inner) _.assert(id.inner !== id.top)

			var pv = undefined
			var isProperty
			var isObject = !id.inner
			function filter(editCode, editId){
				if(editId > desiredEditId) return false
				if(alwaysIgnorable[editCode]){
				}else if(editCode === editCodes.selectProperty || editCode === editCodes.selectObject || editCode === editCodes.clearObject){
					return true
				}else if(realEdits[editCode]){
					return isProperty && isObject
				}else{
					_.errout('TODO: ' + editNames[editCode] + ' ' + editId)
				}
			}
			ol.getPartiallyIncludingForked(id, filter, function(editCode, edit, editId){
				if(editCode === editCodes.selectProperty){
					isProperty = edit.typeCode === propertyCode
				}else if(editCode === editCodes.selectObject){
					isObject = id.inner ? edit.id===id.inner : (edit.id===id.top||edit.id===id)
				}else if(editCode === editCodes.clearObject){
					isObject = !id.inner
				}else if(editCode === setOp){
					pv = edit.value
				}else if(editCode === editCodes.clearProperty){
					pv = defaultValue
				}else{
					_.errout('TODO: ' + JSON.stringify([editCode, edit, editId]))
				}
			}, function(){
				cb(pv, id)
			})
		}
	}else if(p.type.type === 'set' && p.type.members.type === 'primitive'){

		var prim = p.type.members.primitive
		var addOp = editCodes['add'+prim.substr(0,1).toUpperCase()+prim.substr(1)]
		var removeOp = editCodes['remove'+prim.substr(0,1).toUpperCase()+prim.substr(1)]
		
		_.assertInt(addOp)
		_.assertInt(removeOp)
		
		return function(bindings, id, desiredEditId, cb){
			_.assertLength(arguments, 4)
			_.assertFunction(cb)
			
			if(id.getPropertyValueAt){
				id.getPropertyValueAt(id, p.code, editId, cb)
				return
			}
			
			if(id.inner) _.assert(id.inner !== id.top)

			var pv = []
			var isProperty
			var isObject = !id.inner
			function filter(editCode, editId){
				if(editId > desiredEditId) return false
				if(alwaysIgnorable[editCode]){
				}else if(editCode === editCodes.selectProperty || editCode === editCodes.selectObject || editCode === editCodes.clearObject){
					return true
				}else if(realEdits[editCode]){
					return isProperty && isObject
				}else{
					_.errout('TODO: ' + editNames[editCode] + ' ' + editId)
				}
			}
			ol.getPartiallyIncludingForked(id, filter, function(editCode, edit, editId){
				if(editCode === editCodes.selectProperty){
					isProperty = edit.typeCode === propertyCode
				}else if(editCode === editCodes.selectObject){
					isObject = id.inner ? edit.id===id.inner : (edit.id===id.top||edit.id===id)
				}else if(editCode === editCodes.clearObject){
					isObject = !id.inner
				}else if(editCode === addOp){
					pv.push(edit.value)
				}else if(editCode === removeOp){
					var i = pv.indexOf(edit.value)
					if(i !== -1) pv.splice(i, 1)
				}else if(editCode === editCodes.clearProperty){
					pv = []
				}else{
					_.errout('TODO: ' + JSON.stringify([editCode, edit, editId]))
				}
			}, function(){
				cb(pv, id)
			})
		}
	}/*else if(p.type.type === 'object'){
		_.errout('TODO')
	}else if(p.type.type === 'list'){
		_.errout('TODO')
	}else if(p.type.type === 'map'){
		_.errout('TODO')
	}*/else{
		//_.errout('TODO: ' + JSON.stringify(p))
		return function(bindings, id, desiredEditId, cb){
			_.assertLength(arguments, 4)
			//if(Math.random() < .001){
			//	console.log('getting property ' + JSON.stringify(p) + ' ' + id + ' ' + desiredEditId)
			//	console.log(new Error().stack)
			//}
			getPropertyValueAtViaFilter(makeDefaultValue, ol, id, p.code, desiredEditId, cb)
		}
	}
}

exports.make = function(schema, ol){
	_.assertLength(arguments, 2);
	
	var includeFunctions = {};
	
	function emptyIncludeFunction(id, obj, addObjectCb, endCb){endCb();}

	var indexing;
	
	var handle = {
		ol: ol,
		makeGetPropertyAt: function(typeCode, propertyCode){
			var p
			if(propertyCode !== -2){
				p = schema._byCode[typeCode].propertiesByCode[propertyCode]
				_.assertDefined(p)
			}else{
				p = -2
			}
			
			var makeDefaultValue = getDefaultValue(schema, typeCode, propertyCode)
			return makeGetPropertyValueAtViaFilter(ol, makeDefaultValue, p, typeCode)
		}
	};
	
	return handle;
}

