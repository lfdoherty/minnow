
var json = {
	names:["make","made","makeMapped","addInt","addNew","addExisting","remove","removeInt","replaceExternalNew","replaceExternalExisting","putInt","shift","setObject","setToNew","setData","putNew","truncate","writeData","append","replaceInternalNew","replaceInternalExisting","putExisting","del","wasSetToNew","madeViewObject","addExistingViewObject","revert","setSyncId","selectObject","selectViewObject","selectProperty","reselectObject","reselectViewObject","reselectProperty","ascend","reset","ascend1","ascend2","ascend3","ascend4","ascend5","selectTopObject","selectStringKey","selectIntKey","selectLongKey","selectBooleanKey","setDestinationSyncId","selectTopViewObject","clearObject","setInt","setLong","setString","setBoolean","addLong","addString","addBoolean","removeString","removeLong","removeBoolean","putString","putLong","putBoolean","reselectStringKey","reselectIntKey","reselectLongKey","reselectBooleanKey","addReal","replacedNew","addedNew","syntheticEdit","putReal","putAddExisting","putAddInt","putAddString","putAddLong","putAddBoolean","putAddReal","setViewObject","destroy","removeViewObject","didPutNew","madeSyncId","putViewObject","selectObjectKey","delKey","reselectObjectKey","putRemoveExisting","putRemoveInt","putRemoveString","putRemoveLong","putRemoveBoolean","putRemoveReal","clearProperty","setReal","setStringAt","setLongAt","setIntAt","setBooleanAt","setRealAt","addNewAt","addedNewAt","removeAt","addAfter","addNewAfter","addedNewAfter","makeFork","madeFork","refork","unshiftExisting","unshiftNew","unshiftedNew","initializeUuid"],
	codes:[1,2,3,10,11,12,13,14,16,17,18,20,21,22,23,24,25,26,27,28,29,30,31,32,33,35,40,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,70,71,73,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,92,95,96,98,99,100,101,102,103,104,105,107,108,109,110,111,112,118,119,120,124,125,126,127,128,129,140,141,142,143,144,145,146,147,148,149,150,151,152,153,154,155,156,157,158,159]
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
	names: names
}

var isKeyCode = {}
isKeyCode[codes.selectStringKey] = true
isKeyCode[codes.reselectStringKey] = true
isKeyCode[codes.selectIntKey] = true
isKeyCode[codes.reselectIntKey] = true
isKeyCode[codes.selectLongKey] = true
isKeyCode[codes.reselectLongKey] = true
isKeyCode[codes.selectBooleanKey] = true
isKeyCode[codes.reselectBooleanKey] = true
isKeyCode[codes.selectObjectKey] = true
isKeyCode[codes.reselectObjectKey] = true
lookup.isKeyCode = isKeyCode

var isKeySelectCode = {}
isKeySelectCode[codes.selectStringKey] = true
isKeySelectCode[codes.selectIntKey] = true
isKeySelectCode[codes.selectLongKey] = true
isKeySelectCode[codes.selectBooleanKey] = true
isKeySelectCode[codes.selectObjectKey] = true
lookup.isKeySelectCode = isKeySelectCode

var isKeyReselectCode = {}
Object.keys(isKeyCode).forEach(function(key){
	if(!isKeySelectCode[key]){
		isKeyReselectCode[key] = true
	}
})
lookup.isKeyReselectCode = isKeyReselectCode

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

var flipType = {}
flipType[codes.selectObject] = codes.reselectObject
flipType[codes.selectProperty] = codes.reselectProperty
flipType[codes.reselectObject] = codes.selectObject
flipType[codes.reselectProperty] = codes.selectProperty

flipType[codes.selectStringKey] = codes.reselectStringKey
flipType[codes.selectIntKey] = codes.reselectIntKey
flipType[codes.selectLongKey] = codes.reselectLongKey
flipType[codes.selectBooleanKey] = codes.reselectBooleanKey
flipType[codes.selectObjectKey] = codes.reselectObjectKey

flipType[codes.reselectStringKey] = codes.selectStringKey
flipType[codes.reselectIntKey] = codes.selectIntKey
flipType[codes.reselectLongKey] = codes.selectLongKey
flipType[codes.reselectBooleanKey] = codes.selectBooleanKey
flipType[codes.reselectObjectKey] = codes.selectObjectKey

lookup.flipType = flipType

module.exports = lookup
