
var u = require('./util')
var _ = require('underscorem')
var jsonutil = require('./../jsonutil')

var ObjectSetHandle = require('./objectset')


function ViewObjectSetHandle(typeSchema, obj, part, parent){
	this.part = part;
	this.obj = obj || [];
	this.parent = parent;
	this.schema = typeSchema;

	this.apiCache = {};
}

ViewObjectSetHandle.prototype.count = function(){return this.obj.length;}
ViewObjectSetHandle.prototype.size = ObjectSetHandle.prototype.count

ViewObjectSetHandle.prototype.eachJson = ObjectSetHandle.prototype.eachJson
ViewObjectSetHandle.prototype.contains = ObjectSetHandle.prototype.contains
ViewObjectSetHandle.prototype.has = ObjectSetHandle.prototype.has
ViewObjectSetHandle.prototype.get = ObjectSetHandle.prototype.get

ViewObjectSetHandle.prototype.each = ObjectSetHandle.prototype.each

ViewObjectSetHandle.prototype.remove = function(){
	_.errout('TODO: remove from view set')
}

//TODO detect when set should have seen an add edit from addNewFromJson's make, and check that it actually did happen
//if it doesn't that's a client error
ViewObjectSetHandle.prototype.changeListener = ObjectSetHandle.prototype.changeListener

ViewObjectSetHandle.prototype.toJson = ObjectSetHandle.prototype.toJson

ViewObjectSetHandle.prototype.types = u.genericCollectionTypes

//TODO setup listen for correctness
ViewObjectSetHandle.prototype.add = function(objHandle){
	_.assertObject(objHandle)
	
	var id = objHandle.id();
	
	if(this.obj.indexOf(objHandle) !== -1){
		console.log('WARNING: ignored redundant add on viewobjectset')
	}else{
		this.obj.push(id);

		this.emit(undefined, 'add', objHandle)()
	}
}

module.exports = ViewObjectSetHandle
