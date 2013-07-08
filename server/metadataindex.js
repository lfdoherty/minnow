
//TODO externalize using primitivemap?
function MetadataIndex(){
	this.sub = {}
	this.obj = {}
	this.key = {}
	this.property = {}
}

MetadataIndex.prototype.selectProperty = function(id, pc){
	this.property[id] = pc
}
MetadataIndex.prototype.selectObject = function(id, objId){
	this.obj[id] = objId
}
MetadataIndex.prototype.selectSubObject = function(id, subId){
	this.sub[id] = subId
}
MetadataIndex.prototype.clearObject = function(id){
	this.obj[id] = undefined
}
function selectKey(id, key){
	this.key[id] = key
}
MetadataIndex.prototype.selectStringKey = selectKey
MetadataIndex.prototype.selectIntKey = selectKey
MetadataIndex.prototype.selectLongKey = selectKey
MetadataIndex.prototype.selectBooleanKey = selectKey
MetadataIndex.prototype.selectObjectKey = selectKey

MetadataIndex.prototype.get = function(id){
	return new MetadataState(id, this.sub[id], this.obj[id], this.key[id], this.property[id])
}

function MetadataState(id, sub, obj, key, property){
	this.top = id
	this.sub = sub
	this.object = obj
	this.key = key
	this.property = property
}

exports.make = function(){
		
	return new MetadataIndex()
}
