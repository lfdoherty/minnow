
var _ = require('underscorem')

var fp = require('./tcp_shared').editFp
var editCodes = fp.codes
var editNames = fp.names

var innerify = require('./innerId').innerify

function makeGetDefaultValue(schema, typeCode, propertyCode){
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


exports.make = function(schema, ol){
	
	var currentProperty = {}//current property for each object
	var currentObject = {}
	var currentSub = {}
	var currentKey = {}
	
	var propertyIndexes = {}
	var objectCreation = {}
	
	var uuidPropertyIndexes = {}
	
	var typeCodeSubTypes = {}
	_.each(schema, function(objSchema){
		if(!objSchema.isView){
			uuidPropertyIndexes[objSchema.code] = []
			_.each(objSchema.properties, function(p){
				var key = objSchema.code+':'+p.code
				//if(p.type.type !== 'map'){
					propertyIndexes[key] = []
					objectCreation[objSchema.code] = []
				//}
			})
			var list = typeCodeSubTypes[objSchema.code] = [objSchema.code]
			if(objSchema.subTypes){
				Object.keys(objSchema.subTypes).forEach(function(stName){
					if(schema[stName]){//might be a contract keyword like 'readonly'
						list.push(schema[stName].code)
					}
				})
			}
		}
	})
	
	var attachingEnded
	
	var handle = {
		attachIndex: function(typeCode, propertyCode, callback, creationCallback){
			if(attachingEnded){
				_.errout('too late to attach an index')
			}
			
			if(propertyCode === -2){
				uuidPropertyIndexes[typeCode].push(callback)
				_.assertUndefined(creationCallback)//TODO?
			}else{
			
				typeCodeSubTypes[typeCode].forEach(function(tc){
					var key = tc+':'+propertyCode
					if(!propertyIndexes[key]) _.errout('cannot index: ' + key)
					//if(propertyIndexes[key].length > 1){
					//	console.log('duplication: ' + key)
					//	console.log(new Error().stack)
					//}
					propertyIndexes[key].push(callback)
				
					if(creationCallback){
						objectCreation[tc].push(creationCallback)
					}
				})
			}
		},
		endIndexAttaching: function(){
			attachingEnded = true
		},
		creation: function(typeCode, id, editId){
			var listeners = objectCreation[typeCode]
			if(listeners){
				for(var i=0;i<listeners.length;++i){
					listeners[i](typeCode, id, editId)
				}
			}
		},
		addEdit: function(id, op, edit, editId){
			//return
			//if(Math.random() < .0001) console.log(JSON.stringify(propertyChanges).length)

			var curId = currentObject[id] || id			
			var cp = currentProperty[curId]
			
			if(op === editCodes.selectProperty){
				currentProperty[curId] = edit.typeCode
			}else if(op === editCodes.selectObject){
				currentObject[id] = edit.id !== id ? innerify(id, edit.id) : id
			}else if(op === editCodes.selectSubObject){
				currentSub[id] = edit.id
			}else if(fp.isKeySelectCode[op]){
				currentKey[id] = edit.key
			}else if(op === editCodes.clearObject){
				currentObject[id] = id
			}else{
			
				var typeCode = ol.getObjectType(curId)
				var indexes
				if(op === editCodes.initializeUuid){
					indexes = uuidPropertyIndexes[typeCode]
					if(!indexes) return
					c = {type: 'set', value: edit.uuid, editId: editId}
				}else{
			
					var indexKey = typeCode+':'+cp
					indexes = propertyIndexes[indexKey]
					if(!indexes){
						//console.log('skipping: ' + indexKey)
						return
					}
					//console.log('& ' + JSON.stringify([id, editNames[op], edit, editId]))
				
					var c
				
					if(fp.isSetCode[op]){
						//if(curId === id){
							if(op === editCodes.setObject){
								c = {type: 'set', value: edit.id, editId: editId}
							}else{
								_.assertDefined(edit.value)
								c = {type: 'set', value: edit.value, editId: editId}
							}
						//}
					}else if(op === editCodes.wasSetToNew){
						c = {type: 'set', value: innerify(id, edit.id), editId: editId}
					}else if(op === editCodes.replacedNew || op === editCodes.replaceExternalExisting || op === editCodes.replaceInternalExisting){
						var oldC = {type: 'remove', value: edit.oldId, editId: editId}
						for(var i=0;i<indexes.length;++i){
							indexes[i](curId, oldC)
						}
						c = {type: 'add', value: edit.newId, editId: editId}
					}else if(op === editCodes.shift){
						c = {type: 'shift', editId: editId}
					}else if(op === editCodes.clearProperty || op === editCodes.clearObject){
						c = {type: 'clear', editId: editId}
					}else if(op === editCodes.made){
						//do nothing
					}else if(fp.isAddCode[op]){
						if(op === editCodes.addExisting || op === editCodes.addAfter || op === editCodes.unshiftExisting){
							c = {type: 'add', value: edit.id, editId: editId}
						}else if(op === editCodes.addedNew || op === editCodes.addedNewAfter || op === editCodes.addedNewAt || op === editCodes.unshiftedNew){
							c = {type: 'add', value: innerify(id, edit.id), editId: editId}
						}else{
							//console.log(JSON.stringify([editNames[op], edit]))
							if(edit.value === undefined) _.errout('cannot process edit: ' + editNames[op] + ' ' + JSON.stringify(arguments))
							c = {type: 'add', value: edit.value, editId: editId}
						}
					}else if(op === editCodes.addLocalInner){
						c = {type: 'add', value: edit.id, editId: editId}
					}else if(op === editCodes.addLocalInnerAfter){
						c = {type: 'add', value: edit.id, editId: editId}
					}else if(op === editCodes.unshiftLocalInner){
						c = {type: 'add', value: edit.id, editId: editId}
					}else if(fp.isRemoveCode[op]){
						if(op === editCodes.remove){
							var sub = currentSub[id]
							_.assertDefined(sub)
							c = {type: 'remove', value: sub, editId: editId}
						}else{
							_.assertDefined(edit.value)
							c = {type: 'remove', value: edit.value, editId: editId}
						}
					}else if(fp.isPutCode[op]){
						var key = currentKey[id]
						_.assertDefined(key)
						if(op === editCodes.putExisting){
							c = {type: 'put', value: edit.id, key: key, editId: editId}
						}else if(op === editCodes.didPutNew){
							c = {type: 'put', value: innerify(id, edit.id), key: key, editId: editId}
						}else{
							_.assertDefined(edit.value)
							c = {type: 'put', value: edit.value, key: key, editId: editId}
						}
					}else if(op === editCodes.delKey){
						var key = currentKey[id]
						_.assertDefined(key)
						c = {type: 'removeKey', key: key, editId: editId}
					}else if(op === editCodes.destroy){
						//do nothing?
						console.log('destroyed')
						c = {type: 'destroyed', editId: editId}
					}else if(op === editCodes.moveToAfter || op === editCodes.moveToFront || op === editCodes.moveToBack){
						//TODO
						//for now, do nothing
					}else{
						_.errout('TODO: ' + JSON.stringify([id, editNames[op], edit, editId]))
					}
				}
				if(c){
					for(var i=0;i<indexes.length;++i){
						indexes[i](curId, c)
					}
				}
			}
			//console.log(JSON.stringify([id, op, edit, editId]))
		}
	}
	
	handle.facade = require('./indexfacade').make(schema, handle)

	return handle
}

