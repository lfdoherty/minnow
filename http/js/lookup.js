
var _ = require('underscorem')

var json = {"names":["made","addInt","addExisting","remove","removeInt","replacedExternalNew","replaceExternalExisting","putInt","shift","setObject","setData","truncate","writeData","append","replacedInternalNew","replaceInternalExisting","putExisting","del","wasSetToNew","madeViewObject","addExistingViewObject","setUuid","setToInner","insertString","setSyncId","selectObject","selectViewObject","selectProperty","selectSubObject","selectSubViewObject","addExistingInner","reset","selectTopObject","selectStringKey","selectIntKey","selectLongKey","selectBooleanKey","selectTopViewObject","clearObject","setInt","setLong","setString","setBoolean","addLong","addString","addBoolean","removeString","removeLong","removeBoolean","putString","putLong","putBoolean","addReal","addedNew","syntheticEdit","putReal","putAddExisting","putAddInt","putAddString","putAddLong","putAddBoolean","putAddReal","setViewObject","destroy","removeViewObject","didPutNew","madeSyncId","putViewObject","selectObjectKey","delKey","putRemoveExisting","putRemoveInt","putRemoveString","putRemoveLong","putRemoveBoolean","putRemoveReal","addLocalInner","addLocalInnerAfter","addLocalInnerAt","unshiftLocalInner","clearProperty","setReal","setStringAt","setLongAt","setIntAt","setBooleanAt","setRealAt","addedNewAt","removeAt","addAfter","addedNewAfter","unshiftExisting","unshiftedNew","moveToFront","moveToBack","moveToAfter","copied"],"codes":[2,10,12,13,14,16,17,18,20,21,23,25,26,27,28,29,30,31,32,33,35,38,44,49,50,51,52,53,54,55,56,58,64,65,66,67,68,71,73,75,76,77,78,79,80,81,82,83,84,85,86,87,92,96,98,99,100,101,102,103,104,105,107,108,109,110,111,112,118,119,124,125,126,127,128,129,133,134,135,136,140,141,142,143,144,145,146,148,149,150,152,156,158,160,161,162,163]}

var erModule = require('./edit_readers')

var editReaders = erModule.readers
var editReadersByCode = {}
for(var i=0;i<json.codes.length;++i){
	var code = json.codes[i]
	var name = json.names[i]
	editReadersByCode[code] = editReaders[name]
}

var codes = {}
var names = {}

for(var i=0;i<json.names.length;++i){
	var name = json.names[i]
	var code = json.codes[i]
	codes[name] = code
	names[code] = name
}

var lookup = {
	codes: codes,
	names: names,
	//editFp: editFp,
	//editSchema: editSchema,
	deserializeSnapshot: deserializeSnapshot,
	deserializeSnapshotInternal: deserializeSnapshotInternal
}

var isKeyCode = {}
isKeyCode[codes.selectStringKey] = true
isKeyCode[codes.selectIntKey] = true
isKeyCode[codes.selectLongKey] = true
isKeyCode[codes.selectBooleanKey] = true
isKeyCode[codes.selectObjectKey] = true
lookup.isKeyCode = isKeyCode

var isKeySelectCode = {}
isKeySelectCode[codes.selectStringKey] = true
isKeySelectCode[codes.selectIntKey] = true
isKeySelectCode[codes.selectLongKey] = true
isKeySelectCode[codes.selectBooleanKey] = true
isKeySelectCode[codes.selectObjectKey] = true
lookup.isKeySelectCode = isKeySelectCode

var isPrimitiveSetCode = {}
isPrimitiveSetCode[codes.setString] = true
isPrimitiveSetCode[codes.setLong] = true
isPrimitiveSetCode[codes.setInt] = true
isPrimitiveSetCode[codes.setBoolean] = true
isPrimitiveSetCode[codes.setReal] = true
lookup.isPrimitiveSetCode = isPrimitiveSetCode

var isSetCode = {}
isSetCode[codes.setString] = true
isSetCode[codes.setLong] = true
isSetCode[codes.setInt] = true
isSetCode[codes.setBoolean] = true
isSetCode[codes.setReal] = true
isSetCode[codes.setObject] = true
isSetCode[codes.setUuid] = true
lookup.isSetCode = isSetCode

var isPrimitiveAddCode = {}
isPrimitiveAddCode[codes.addString] = true
isPrimitiveAddCode[codes.addLong] = true
isPrimitiveAddCode[codes.addInt] = true
isPrimitiveAddCode[codes.addBoolean] = true
isPrimitiveAddCode[codes.addReal] = true
lookup.isPrimitiveAddCode = isPrimitiveAddCode

var isAddCode = {}
isAddCode[codes.addString] = true
isAddCode[codes.addLong] = true
isAddCode[codes.addInt] = true
isAddCode[codes.addBoolean] = true
isAddCode[codes.addReal] = true
isAddCode[codes.addExisting] = true
isAddCode[codes.addedNew] = true
isAddCode[codes.addNewAt] = true
isAddCode[codes.addedNewAt] = true
isAddCode[codes.addAfter] = true
isAddCode[codes.addNewAfter] = true
isAddCode[codes.addedNewAfter] = true
isAddCode[codes.unshiftExisting] = true
isAddCode[codes.unshiftedNew] = true
lookup.isAddCode = isAddCode

var isRemoveCode = {}
isRemoveCode[codes.removeString] = true
isRemoveCode[codes.removeLong] = true
isRemoveCode[codes.removeInt] = true
isRemoveCode[codes.removeBoolean] = true
//isRemoveCode[codes.removeReal] = true
isRemoveCode[codes.remove] = true
lookup.isRemoveCode = isRemoveCode

var isPrimitiveRemoveCode = {}
isPrimitiveRemoveCode[codes.removeString] = true
isPrimitiveRemoveCode[codes.removeLong] = true
isPrimitiveRemoveCode[codes.removeInt] = true
isPrimitiveRemoveCode[codes.removeBoolean] = true
//isPrimitiveRemoveCode[codes.removeReal] = true
lookup.isPrimitiveRemoveCode = isPrimitiveRemoveCode

var isPutCode = {}
isPutCode[codes.putString] = true
isPutCode[codes.putLong] = true
isPutCode[codes.putInt] = true
isPutCode[codes.putBoolean] = true
isPutCode[codes.putReal] = true
isPutCode[codes.didPutNew] = true
isPutCode[codes.putExisting] = true
isPutCode[codes.putViewObject] = true
lookup.isPutCode = isPutCode

var isPutAddCode = {}
isPutAddCode[codes.putAddString] = true
isPutAddCode[codes.putAddLong] = true
isPutAddCode[codes.putAddInt] = true
isPutAddCode[codes.putAddBoolean] = true
isPutAddCode[codes.putAddReal] = true
isPutAddCode[codes.putAddExisting] = true
lookup.isPutAddCode = isPutAddCode

var isPutRemoveCode = {}
isPutRemoveCode[codes.putRemoveString] = true
isPutRemoveCode[codes.putRemoveLong] = true
isPutRemoveCode[codes.putRemoveInt] = true
isPutRemoveCode[codes.putRemoveBoolean] = true
isPutRemoveCode[codes.putRemoveReal] = true
isPutRemoveCode[codes.putRemoveExisting] = true
lookup.isPutRemoveCode = isPutRemoveCode

var isSetAt = {}
isSetAt[codes.setStringAt] = true
isSetAt[codes.setLongAt] = true
isSetAt[codes.setIntAt] = true
isSetAt[codes.setBooleanAt] = true
isSetAt[codes.setRealAt] = true
lookup.isSetAt = isSetAt


module.exports = lookup

var rs = require('./rs')
function makeSingleReader(buf){var r = rs.make();r.put(buf);return r.s}

function deserializeSnapshot(snap){
	_.assertLength(arguments, 1)
	var sr = makeSingleReader(snap)
	return deserializeSnapshotInternal(sr)
}

function deserializeSnapshotInternal(rs){
	_.assertLength(arguments, 1)
	var startEditId = rs.readInt()
	var endEditId = rs.readInt()
	
	//console.log(startEditId + ' -> ' + endEditId)
	
	var manyObjects = rs.readInt()
	var objects = {}
	//console.log('many objects: ' + manyObjects)
	//console.log(new Error().stack)
	for(var i=0;i<manyObjects;++i){
		var edits = []
		var e = editReaders.selectTopObject(rs)
		var id = e.id
		objects[id] = edits

		var many = rs.readInt()
		//console.log('many edits: ' + many)
		for(var j=0;j<many;++j){
			var code = rs.readByte()
			var editId = rs.readInt()
			//var name = names[code]
			//console.log('getting name(' + code + '): ' + name + ' ' + editId)
			//_.assertString(name)
			var e = editReadersByCode[code](rs)
			//console.log('got e: ' +code+' ' + editId + ' ' +  JSON.stringify(e))
			edits.push({op: code, edit: e, editId: editId})
		}
	}
	var manyViewObjects = rs.readInt()
	//console.log('many view objects: ' + manyViewObjects)
	for(var i=0;i<manyViewObjects;++i){
		var edits = []
		var e = editReaders.selectTopViewObject(rs)
		var id = e.id
		objects[id] = edits
		var many = rs.readInt()
		//console.log('many: ' + many)
		for(var j=0;j<many;++j){
			var code = rs.readByte()
			var editId = rs.readInt()
			//console.log(JSON.stringify(names))
			//if(name === undefined) _.errout(editId + ' cannot find name for code: ' + code)
			var e = editReadersByCode[code](rs)
			edits.push({op: code, edit: e, editId: editId})
		}
	}
	return {startVersion: startEditId, endVersion: endEditId, objects: objects}
}

