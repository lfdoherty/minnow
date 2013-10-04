var readers = exports.readers = {}
readers.made = function(r){
	var e = {}
	e.id = r.readUuid()
	e.typeCode = r.readInt()
	e.following = r.readInt()
	return e;
}
readers.putUuid = function(r){
	var e = {}
	e.value = r.readUuid()
	return e;
}
readers.addInt = function(r){
	var e = {}
	e.value = r.readInt()
	return e;
}
readers.addExisting = function(r){
	var e = {}
	e.id = r.readUuid()
	return e;
}
readers.remove = function(r){
	var e = {}
	return e;
}
readers.removeInt = function(r){
	var e = {}
	e.value = r.readInt()
	return e;
}
readers.replacedExternalNew = function(r){
	var e = {}
	e.newId = r.readUuid()
	e.id = r.readUuid()
	e.typeCode = r.readInt()
	e.following = r.readInt()
	return e;
}
readers.replaceExternalExisting = function(r){
	var e = {}
	e.oldId = r.readUuid()
	e.newId = r.readUuid()
	e.newType = r.readInt()
	return e;
}
readers.putInt = function(r){
	var e = {}
	e.value = r.readInt()
	return e;
}
readers.shift = function(r){
	var e = {}
	return e;
}
readers.setObject = function(r){
	var e = {}
	e.id = r.readUuid()
	return e;
}
readers.setData = function(r){
	var e = {}
	e.data = r.readData()
	return e;
}
readers.truncate = function(r){
	var e = {}
	e.newLength = r.readInt()
	return e;
}
readers.writeData = function(r){
	var e = {}
	e.position = r.readInt()
	e.data = r.readData()
	return e;
}
readers.append = function(r){
	var e = {}
	e.data = r.readData()
	return e;
}
readers.replacedInternalNew = function(r){
	var e = {}
	e.newId = r.readUuid()
	e.id = r.readUuid()
	e.typeCode = r.readInt()
	e.following = r.readInt()
	return e;
}
readers.replaceInternalExisting = function(r){
	var e = {}
	e.oldId = r.readUuid()
	e.newId = r.readUuid()
	e.newType = r.readInt()
	return e;
}
readers.putExisting = function(r){
	var e = {}
	e.id = r.readUuid()
	return e;
}
readers.del = function(r){
	var e = {}
	return e;
}
readers.wasSetToNew = function(r){
	var e = {}
	e.id = r.readUuid()
	e.typeCode = r.readInt()
	return e;
}
readers.madeViewObject = function(r){
	var e = {}
	e.id = r.readVarString()
	e.typeCode = r.readInt()
	return e;
}
readers.addExistingViewObject = function(r){
	var e = {}
	e.id = r.readVarString()
	return e;
}
readers.setUuid = function(r){
	var e = {}
	e.value = r.readUuid()
	return e;
}
readers.setToInner = function(r){
	var e = {}
	e.top = r.readUuid()
	e.inner = r.readUuid()
	return e;
}
readers.insertString = function(r){
	var e = {}
	e.value = r.readVarString()
	e.index = r.readInt()
	return e;
}
readers.setSyncId = function(r){
	var e = {}
	e.syncId = r.readUuid()
	return e;
}
readers.selectObject = function(r){
	var e = {}
	e.id = r.readUuid()
	return e;
}
readers.selectViewObject = function(r){
	var e = {}
	e.id = r.readVarString()
	return e;
}
readers.selectProperty = function(r){
	var e = {}
	e.typeCode = r.readInt()
	return e;
}
readers.selectSubObject = function(r){
	var e = {}
	e.id = r.readUuid()
	return e;
}
readers.selectSubViewObject = function(r){
	var e = {}
	e.id = r.readVarString()
	return e;
}
readers.addExistingInner = function(r){
	var e = {}
	e.top = r.readUuid()
	e.inner = r.readUuid()
	return e;
}
readers.reset = function(r){
	var e = {}
	return e;
}
readers.selectTopObject = function(r){
	var e = {}
	e.id = r.readUuid()
	return e;
}
readers.selectStringKey = function(r){
	var e = {}
	e.key = r.readVarString()
	return e;
}
readers.selectIntKey = function(r){
	var e = {}
	e.key = r.readInt()
	return e;
}
readers.selectLongKey = function(r){
	var e = {}
	e.key = r.readLong()
	return e;
}
readers.selectBooleanKey = function(r){
	var e = {}
	e.key = r.readBoolean()
	return e;
}
readers.selectTopViewObject = function(r){
	var e = {}
	e.id = r.readVarString()
	return e;
}
readers.clearObject = function(r){
	var e = {}
	return e;
}
readers.setInt = function(r){
	var e = {}
	e.value = r.readInt()
	return e;
}
readers.setLong = function(r){
	var e = {}
	e.value = r.readLong()
	return e;
}
readers.setString = function(r){
	var e = {}
	e.value = r.readVarString()
	return e;
}
readers.setBoolean = function(r){
	var e = {}
	e.value = r.readBoolean()
	return e;
}
readers.addLong = function(r){
	var e = {}
	e.value = r.readLong()
	return e;
}
readers.addString = function(r){
	var e = {}
	e.value = r.readVarString()
	return e;
}
readers.addBoolean = function(r){
	var e = {}
	e.value = r.readBoolean()
	return e;
}
readers.removeString = function(r){
	var e = {}
	e.value = r.readVarString()
	return e;
}
readers.removeLong = function(r){
	var e = {}
	e.value = r.readLong()
	return e;
}
readers.removeBoolean = function(r){
	var e = {}
	e.value = r.readBoolean()
	return e;
}
readers.putString = function(r){
	var e = {}
	e.value = r.readVarString()
	return e;
}
readers.putLong = function(r){
	var e = {}
	e.value = r.readLong()
	return e;
}
readers.putBoolean = function(r){
	var e = {}
	e.value = r.readBoolean()
	return e;
}
readers.addReal = function(r){
	var e = {}
	e.value = r.readVarString()
	return e;
}
readers.addedNew = function(r){
	var e = {}
	e.id = r.readUuid()
	e.typeCode = r.readInt()
	e.following = r.readInt()
	return e;
}
readers.syntheticEdit = function(r){
	var e = {}
	return e;
}
readers.putReal = function(r){
	var e = {}
	e.value = r.readReal()
	return e;
}
readers.putAddExisting = function(r){
	var e = {}
	e.id = r.readUuid()
	return e;
}
readers.putAddInt = function(r){
	var e = {}
	e.value = r.readInt()
	return e;
}
readers.putAddString = function(r){
	var e = {}
	e.value = r.readVarString()
	return e;
}
readers.putAddLong = function(r){
	var e = {}
	e.value = r.readLong()
	return e;
}
readers.putAddBoolean = function(r){
	var e = {}
	e.value = r.readBoolean()
	return e;
}
readers.putAddReal = function(r){
	var e = {}
	e.value = r.readReal()
	return e;
}
readers.setViewObject = function(r){
	var e = {}
	e.id = r.readVarString()
	return e;
}
readers.destroy = function(r){
	var e = {}
	return e;
}
readers.removeViewObject = function(r){
	var e = {}
	return e;
}
readers.didPutNew = function(r){
	var e = {}
	e.typeCode = r.readInt()
	e.id = r.readUuid()
	e.following = r.readInt()
	return e;
}
readers.madeSyncId = function(r){
	var e = {}
	return e;
}
readers.putViewObject = function(r){
	var e = {}
	e.id = r.readVarString()
	return e;
}
readers.selectObjectKey = function(r){
	var e = {}
	e.key = r.readUuid()
	return e;
}
readers.delKey = function(r){
	var e = {}
	return e;
}
readers.putRemoveExisting = function(r){
	var e = {}
	e.id = r.readInt()
	return e;
}
readers.putRemoveInt = function(r){
	var e = {}
	e.value = r.readInt()
	return e;
}
readers.putRemoveString = function(r){
	var e = {}
	e.value = r.readVarString()
	return e;
}
readers.putRemoveLong = function(r){
	var e = {}
	e.value = r.readLong()
	return e;
}
readers.putRemoveBoolean = function(r){
	var e = {}
	e.value = r.readBoolean()
	return e;
}
readers.putRemoveReal = function(r){
	var e = {}
	e.value = r.readReal()
	return e;
}
readers.addLocalInner = function(r){
	var e = {}
	e.id = r.readUuid()
	return e;
}
readers.addLocalInnerAfter = function(r){
	var e = {}
	e.id = r.readUuid()
	return e;
}
readers.addLocalInnerAt = function(r){
	var e = {}
	e.id = r.readUuid()
	e.index = r.readInt()
	e.following = r.readInt()
	return e;
}
readers.unshiftLocalInner = function(r){
	var e = {}
	e.id = r.readUuid()
	return e;
}
readers.clearProperty = function(r){
	var e = {}
	return e;
}
readers.setReal = function(r){
	var e = {}
	e.value = r.readVarString()
	return e;
}
readers.setStringAt = function(r){
	var e = {}
	e.value = r.readVarString()
	e.index = r.readInt()
	return e;
}
readers.setLongAt = function(r){
	var e = {}
	e.value = r.readLong()
	e.index = r.readInt()
	return e;
}
readers.setIntAt = function(r){
	var e = {}
	e.value = r.readInt()
	e.index = r.readInt()
	return e;
}
readers.setBooleanAt = function(r){
	var e = {}
	e.value = r.readBoolean()
	e.index = r.readInt()
	return e;
}
readers.setRealAt = function(r){
	var e = {}
	e.value = r.readReal()
	e.index = r.readInt()
	return e;
}
readers.addedNewAt = function(r){
	var e = {}
	e.id = r.readUuid()
	e.typeCode = r.readInt()
	e.index = r.readInt()
	e.following = r.readInt()
	return e;
}
readers.removeAt = function(r){
	var e = {}
	e.index = r.readInt()
	e.many = r.readInt()
	return e;
}
readers.addAfter = function(r){
	var e = {}
	e.id = r.readUuid()
	return e;
}
readers.addedNewAfter = function(r){
	var e = {}
	e.typeCode = r.readInt()
	e.id = r.readUuid()
	e.following = r.readInt()
	return e;
}
readers.unshiftExisting = function(r){
	var e = {}
	e.id = r.readUuid()
	return e;
}
readers.unshiftedNew = function(r){
	var e = {}
	e.id = r.readUuid()
	e.typeCode = r.readInt()
	e.following = r.readInt()
	return e;
}
readers.moveToFront = function(r){
	var e = {}
	return e;
}
readers.moveToBack = function(r){
	var e = {}
	return e;
}
readers.moveToAfter = function(r){
	var e = {}
	e.id = r.readUuid()
	return e;
}
readers.copied = function(r){
	var e = {}
	e.id = r.readUuid()
	e.typeCode = r.readInt()
	e.sourceId = r.readUuid()
	e.following = r.readInt()
	return e;
}
