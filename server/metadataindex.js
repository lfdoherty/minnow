
var editCodes = require('./../http/js/lookup').codes

//TODO externalize using primitivemap?
function MetadataIndex(){
	this.sub = {}
	this.obj = {}
	this.key = {}
	this.property = {}
	this.keyOp = {}
}

MetadataIndex.prototype.selectProperty = function(id, pc){
	this.property[id] = pc
	//console.log('select property: ' + id + ' ' + pc)
}
MetadataIndex.prototype.selectObject = function(id, objId){
	this.obj[id] = objId
	this.property[id] = undefined
}
MetadataIndex.prototype.selectSubObject = function(id, subId){
	this.sub[id] = subId
}
MetadataIndex.prototype.clearObject = function(id){
	this.obj[id] = undefined
	this.property[id] = undefined
}
function selectKey(id, key){
	this.key[id] = key
}
MetadataIndex.prototype.selectStringKey = function selectKey(id, key){
	this.key[id] = key
	this.keyOp[id] = editCodes.selectStringKey
}
MetadataIndex.prototype.selectIntKey = function selectKey(id, key){
	this.key[id] = key
	this.keyOp[id] = editCodes.selectIntKey
}
MetadataIndex.prototype.selectLongKey = function selectKey(id, key){
	this.key[id] = key
	this.keyOp[id] = editCodes.selectLongKey
}
MetadataIndex.prototype.selectBooleanKey = function selectKey(id, key){
	this.key[id] = key
	this.keyOp[id] = editCodes.selectBooleanKey
}
MetadataIndex.prototype.selectObjectKey = function selectKey(id, key){
	this.key[id] = key
	this.keyOp[id] = editCodes.selectObjectKey
}

MetadataIndex.prototype.get = function(id){
	return new MetadataState(id, this.sub[id], this.obj[id], this.key[id], this.keyOp[id], this.property[id])
}

function MetadataState(id, sub, obj, key, keyOp, property){
	this.top = id
	this.sub = sub
	this.object = obj
	this.key = key
	this.property = property
	this.keyOp = keyOp
}

exports.make = function(){
		
	return new MetadataIndex()
}
