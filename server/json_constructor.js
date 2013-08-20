
var _ = require('underscorem')
var editFp = require('./tcp_shared').editFp
var editCodes = editFp.codes
var editNames = editFp.names

var innerify = require('./innerId').innerify


exports.make = function(schema){

	var impls = {}
	
	Object.keys(schema._byCode).forEach(function(typeCodeStr){
		var objSchema = schema._byCode[typeCodeStr]
		impls[typeCodeStr] = function(id, edits){
		
			var obj = {id: id, type: schema._byCode[typeCodeStr].name}
			var state = {obj: obj, top: obj, id: id, objects: {}, objSchema: objSchema, objectTypes: {}}
			state.objectTypes[typeCodeStr] = objSchema
			for(var i=0;i<edits.length;++i){
				var res = processEdit(edits[i], obj, state, objSchema, schema, edits)
				if(res) break
			}
			
			//if(obj.type === 'term') console.log('processing: ' + JSON.stringify(obj))
			
			
			//_.errout('tODO: ' + JSON.stringify(obj))
			return obj
		}
	})

	return function(typeCode, id, edits){
		return impls[typeCode](id, edits)
	}
	
}


function indexOfRawId(arr, id){
	for(var i=0;i<arr.length;++i){
		var v = arr[i]
		if(typeof(v) === 'number'){
			if(v === id){
				return i
			}
		}else{
			if(v.id === id){
				return i
			}
		}
	}
	return -1
}

function processEdit(e, obj, state, objSchema, schema, edits){

	function typeName(tc){
		return schema._byCode[tc].name
	}

	var editCode = e.op
	var edit = e.edit
	
	//console.log(editNames[e.op] + ' ' + JSON.stringify(e))
	
	if(editCode === editCodes.selectProperty){
		//isProperty = edit.typeCode === propertyCode
		state.property = edit.typeCode
		
		if(!state.objSchema){
			console.log(JSON.stringify(edits))
			console.log('ERROR: no objSchema')
			return true
		}
		
		if(!state.objSchema.propertiesByCode[state.property]){
			_.errout('TODO: ' + JSON.stringify([state.objSchema.name, state.property, state.propertyName, obj, state.obj]))//[e, obj, state]))
		}
		state.propertyName = state.objSchema.propertiesByCode[state.property].name
		
	}else if(editCode === editCodes.setSyncId){
	}else if(editCode === editCodes.made){
	}else if(editCode === editCodes.copied){
	}else if(editCode === editCodes.initializeUuid){
		obj.uuid = edit.uuid
	}else if(editCode === editCodes.selectObject){
		//isObject = id.inner ? edit.id===id.inner : (edit.id===id.top||edit.id===id)
		//_.errout('TODO')
		state.obj = state.objects[edit.id]
		if(!state.obj){
			//console.log('not yet: ' + edit.id)
			state.obj = state.objects[edit.id] = {}
		}
		state.objSchema = state.objectTypes[edit.id]
		if(!state.objSchema){
			console.log(JSON.stringify(edits))
			console.log('ERROR: no object type known for id: ' + edit.id + ' ' + JSON.stringify(e))
			return true
		}
		
	}else if(editCode === editCodes.clearObject){
		//isObject = !id.inner
		//_.errout('TODO')
		state.obj = state.top
		state.objSchema = schema[state.top.type]
	}else if(editCode === editCodes.selectSubObject){
		//currentSubObj = edit.id
		//_.errout('TODO')
		state.sub = edit.id
	}else if(editCode === editCodes.setString || editCode === editCodes.setInt || editCode === editCodes.setBoolean || editCode === editCodes.setLong){
		state.obj[state.propertyName] = edit.value
	}else if(editCode === editCodes.setObject){
		state.obj[state.propertyName] = edit.id
	}else if(editCode === editCodes.wasSetToNew){
		var newObj = {id: edit.id, type: typeName(edit.typeCode)}
		//state.obj[state.propertyName] = newObj
		state.objects[edit.id] = newObj
		state.objectTypes[edit.id] = schema._byCode[edit.typeCode]
		//state.objSchema = schema._byCode[edit.typeCode]
	}else if(editCode === editCodes.addExisting){
		state.obj[state.propertyName] = state.obj[state.propertyName]||[]
		state.obj[state.propertyName].push(edit.id)
	}else if(editCode === editCodes.addedNew){
		var newObj = {id: edit.id, type: typeName(edit.typeCode)}
		state.obj[state.propertyName] = state.obj[state.propertyName]||[]
		state.obj[state.propertyName].push(newObj)
		state.objectTypes[edit.id] = schema._byCode[edit.typeCode]
		state.objects[edit.id] = newObj
		//state.obj = newObj
		//state.objSchema = schema._byCode[edit.typeCode]
	}else if(editCode === editCodes.addedNewAt){
		var newObj = {id: edit.id, type: typeName(edit.typeCode)}
		state.obj[state.propertyName] = state.obj[state.propertyName]||[]
		state.obj[state.propertyName].push(newObj)
		state.objectTypes[edit.id] = schema._byCode[edit.typeCode]
		state.objects[edit.id] = newObj
		//state.obj = newObj
		//state.objSchema = schema._byCode[edit.typeCode]
	}else if(editCode === editCodes.addedNewAfter){
		var newObj = {id: edit.id, type: typeName(edit.typeCode)}
		state.obj[state.propertyName] = state.obj[state.propertyName]||[]
		state.obj[state.propertyName].push(newObj)
		state.objectTypes[edit.id] = schema._byCode[edit.typeCode]
		state.objects[edit.id] = newObj
		//state.obj = newObj
		//state.objSchema = schema._byCode[edit.typeCode]
	}else if(editCode === editCodes.addAfter){
		var newObj = {id: edit.id, type: typeName(edit.typeCode)}
		state.obj[state.propertyName] = state.obj[state.propertyName]||[]
		state.obj[state.propertyName].push(newObj)
		//state.obj = newObj
	}else if(editCode === editCodes.moveToAfter){
		//TODO
	}else if(editCode === editCodes.moveToFront){
		//TODO
	}else if(editCode === editCodes.moveToBack){
		//TODO
	}else if(editCode === editCodes.unshiftExisting){
		state.obj[state.propertyName] = state.obj[state.propertyName]||[]
		state.obj[state.propertyName].unshift(edit.id)
	}else if(editCode === editCodes.unshiftedNew){
		var newObj = {id: edit.id, type: typeName(edit.typeCode)}
		state.obj[state.propertyName] = state.obj[state.propertyName]||[]
		state.obj[state.propertyName].unshift(newObj)
		state.objectTypes[edit.id] = schema._byCode[edit.typeCode]
		state.objects[edit.id] = newObj
		//state.obj = newObj
		//state.objSchema = schema._byCode[edit.typeCode]
	}else if(editCode === editCodes.addString || editCode === editCodes.addInt){
		state.obj[state.propertyName] = state.obj[state.propertyName]||[]
		state.obj[state.propertyName].push(e.edit.value)
	}else if(editCode === editCodes.insertString){
		var str = state.obj[state.propertyName]
		state.obj[state.propertyName] = str.substr(0, edit.index) + edit.value + str.substr(edit.index)
	}else if(editCode === editCodes.removeString || editCode === editCodes.removeInt){
		var pv = state.obj[state.propertyName]
		var i = pv.indexOf(edit.value)
		if(i !== -1) pv.splice(i, 1)
		//else console.log('WARNING: did not need to remove: ' + edit.value)
	}else if(editCode === editCodes.remove){
		var pv = state.obj[state.propertyName]
		_.assertDefined(state.sub)
		//var i = pv.indexOf(currentSubObj)
		var i = indexOfRawId(pv, state.sub)
		if(i !== -1) pv.splice(i, 1)
		else console.log('WARNING: did not need to remove object: ' + state.sub)
	}else if(editCode === editCodes.selectStringKey || editCode === editCodes.selectObjectKey || editCode === editCodes.selectIntKey){
		currentKey = edit.key
	}else if(editCode === editCodes.putString || editCode === editCodes.putBoolean || editCode === editCodes.putInt || editCode === editCodes.putLong){
		_.assertDefined(currentKey)
		var pv = state.obj[state.propertyName] = state.obj[state.propertyName]||{}
		pv[state.key] = e.edit.value
	}else if(editCode === editCodes.putExisting){
		_.assertDefined(currentKey)
		//pv[currentKey] = edit.id
		var pv = state.obj[state.propertyName] = state.obj[state.propertyName]||{}
		pv[state.key] = e.edit.value
	}else if(editCode === editCodes.delKey){
		//_.assertDefined(currentKey)
		//delete pv[currentKey]// = undefined
		var pv = state.obj[state.propertyName]
		delete pv[state.key]
	}else if(editCode === editCodes.didPutNew){
		//_.assertDefined(currentKey)
		var pv = state.obj[state.propertyName] = state.obj[state.propertyName]||{}
		pv[state.key] = innerify(state.id, e.edit.id)
	}else if(editCode === editCodes.clearProperty){
		state.obj[state.propertyName] = makeDefaultValue(objSchema.propertiesByCode[state.property])
	}else{
		_.errout('TODO: ' + JSON.stringify([e, obj, editNames[e.op]]))
	}
	
}
