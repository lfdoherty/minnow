var u = require('./util')
var _ = require('underscorem')

var jsonutil = require('./../jsonutil')

var ObjectHandle = require('./object')

function TopObjectHandle(schema, typeSchema, obj, parent, id){
	_.assertLength(arguments, 5);
	_.assertObject(obj);
	
	if(!typeSchema.isView){
		_.assertInt(id)
	}else{
		_.assertString(id)
	}
	
	//if(!(parent instanceof SyncApi)) _.errout('ERROR: ' + parent.toString());
	
	this.schema = schema;
	this.typeSchema = typeSchema;
	this.obj = obj;
	this.parent = parent;
	this.cachedProperties = {};
	
	this.objectId = id;
	this.objectTypeCode = typeSchema.code;

}

TopObjectHandle.prototype.setPropertyToNew = ObjectHandle.prototype.setPropertyToNew

TopObjectHandle.prototype.prepare = function prepare(){
	if(this.prepared) return;
	this.prepared = true;
	var s = this;

	//console.log('TopObjectHandle prepare')
	
	var keys = Object.keys(s.typeSchema.properties);
	keys.forEach(function(name){
		//console.log('preparing: ' + name)
		var p = s.typeSchema.properties[name];
		var v = s.property(name);
		v.prepare();
		s[name] = v;
		
	});
}

TopObjectHandle.prototype.properties = ObjectHandle.prototype.properties;

TopObjectHandle.prototype.propertyIsPrimitive = ObjectHandle.prototype.propertyIsPrimitive

TopObjectHandle.prototype.removeParent = function(){}
TopObjectHandle.prototype._typeCode = function(){return this.objectTypeCode;}
TopObjectHandle.prototype.getPath = function(){return [];}
TopObjectHandle.prototype.type = function(){return this.typeSchema.name;}
TopObjectHandle.prototype.id = function(){
	return this.getObjectId();
}
TopObjectHandle.prototype.getObjectTypeCode = function(){
	return this.objectTypeCode;
}
TopObjectHandle.prototype.getObjectId = function(){
	return this.objectId;
}
TopObjectHandle.prototype.propertyTypes = ObjectHandle.prototype.propertyTypes;
TopObjectHandle.prototype.property = ObjectHandle.prototype.property;
TopObjectHandle.prototype.toJson = ObjectHandle.prototype.toJson;

TopObjectHandle.prototype.hasProperty = ObjectHandle.prototype.hasProperty;
TopObjectHandle.prototype.has = ObjectHandle.prototype.has;

TopObjectHandle.prototype.delayRefresh = function(){
	this.refreshDelayed = true;
}

TopObjectHandle.prototype.registerSourceParent = function(sourceParent){
	if(this.sourceParents === undefined) this.sourceParents = [];
	if(this.sourceParents.indexOf(sourceParent) === -1){
		this.sourceParents.push(sourceParent);
		//console.log('registered source parent for ' + this.typeSchema.name + ' ' + this.objectId);
	}
}
TopObjectHandle.prototype.basicDoRefresh = u.doRefresh//ObjectHandle.prototype.doRefresh;
//_.assertFunction(TopObjectHandle.prototype.basicDoRefresh)

TopObjectHandle.prototype.doRefresh = function(already, sourceOfRefresh, e){
	var cbs = [];
	var cba = this.basicDoRefresh(already, sourceOfRefresh, e);
	cbs.push(cba);
	//console.log('TopObjectHandle doRefresh calling source parents: ' + this.sourceParents.length);
	for(var i=0;i<this.sourceParents.length;++i){
		var sp = this.sourceParents[i];
		var cb = sp.doRefresh(already, false, e)
		cbs.push(cb);
	}
	return function(){
		for(var i=0;i<cbs.length;++i){
			cbs[i]();
		}
	}
}

TopObjectHandle.prototype.setObjectToJson = function(typeName, id, json){
	//var typeCode = this.schema[typeName].code;
	var obj = jsonutil.convertJsonToObject(this.schema, typeName, json);
	
	var edit = {object: obj};

	this.getSh().persistEdit(
		id, 
		[],
		'setObjectToJson',
		edit,
		this.getEditingId());
}

//TODO provide handle with temporary id for objects created this way
TopObjectHandle.prototype.makeObjectFromJson = function(typeName, json,cb){
    var objSchema = this.schema[typeName]
    if(objSchema  === undefined) throw new Error('unknown type: ' + typeName)
	var typeCode = objSchema.code;
	var objJson = jsonutil.convertJsonToObject(this.schema, typeName, json);

	var temporary = u.makeTemporaryId();
	
	var obj = this.createNewExternalObject(typeCode, temporary)
	_.extend(obj, objJson)
	
	
	var edit = {obj: {type: typeCode, object: obj}, temporary: temporary};
	if(cb){
		var uid = (''+Math.random());
		if(this.parent.objectCreationCallbacks === undefined) this.parent.objectCreationCallbacks = {};
		this.parent.objectCreationCallbacks[uid] = cb;
		edit.uid = uid;
		//console.log('waiting for makeObjectFromJson callback')
	}
	this.getSh().persistEdit(
		-1, 
		[], 
		'make',
		edit,
		this.getEditingId());
	
	
	
	var res = this.getObjectApi(temporary, this);
	res.prepare();
	return res;
}
TopObjectHandle.prototype.make = TopObjectHandle.prototype.makeObjectFromJson

module.exports = TopObjectHandle
