"use strict";

var u = require('./util')
var jsonutil = require('./../jsonutil')
var _ = require('underscorem')

var ObjectHandle = require('./object')
var ObjectListHandle = require('./objectlist')

var lookup = require('./../lookup')
var editCodes = lookup.codes

module.exports = ObjectSetHandle

function ObjectSetHandle(typeSchema, obj, part, parent){
	this.part = part;
	this.parent = parent;
	this.schema = typeSchema;

	this.log = this.parent.log
	
	this.obj = u.wrapCollection(this, obj)

	if(this.isView()){
		this.add = u.viewReadonlyFunction
		this.addNew = u.viewReadonlyFunction
		this.remove = u.viewReadonlyFunction
	}
}

ObjectSetHandle.prototype.count = function(){return this.obj.length;}
ObjectSetHandle.prototype.size = ObjectSetHandle.prototype.count

ObjectSetHandle.prototype.eachJson = function(cb, endCb){
	var json = this.toJson();
	_.each(json, function(v){
		cb(v);
	});
	if(endCb) endCb();
}
ObjectSetHandle.prototype.contains = function(desiredHandle){
	//console.log('obj: ' + JSON.stringify(this.obj))
	return this.obj.indexOf(desiredHandle) !== -1
}
ObjectSetHandle.prototype.has = ObjectSetHandle.prototype.contains

ObjectSetHandle.prototype.get = function(desiredId){
	_.assertLength(arguments, 1);
	_.assertInt(desiredId)
	
	var a = u.findObj(this.obj, desiredId)
	if(!a) return;
	a.prepare()
	return a;
}

ObjectSetHandle.prototype.each = function(cb, endCb){
	_.each(this.obj, function(obj){
		obj.prepare()
		cb(obj)
	})
	if(endCb) endCb()
}

ObjectSetHandle.prototype._rewriteObjectApiCache = function(oldKey, newKey){
	
}

ObjectSetHandle.prototype.adjustPath = u.adjustObjectCollectionPath

ObjectSetHandle.prototype.changeListenerElevated = function(descendId, op, edit, syncId, editId){
	if(op === editCodes.remove){
		var res = this.get(descendId);
		var index = this.obj.indexOf(res)
		if(index === -1){
			console.log('ignoring redundant remove: ' + edit.id);
		}else{
			this.obj.splice(index, 1);

			res.prepare()
			console.log('removed: ' + res)
			return this.emit(edit, 'remove', res)
		}
	}else{
		_.errout('+TODO implement op: ' + editNames[op] + ' ' + JSON.stringify(edit) + ' ' + JSON.stringify(this.schema));
	}
}

ObjectSetHandle.prototype.remove = ObjectListHandle.prototype.remove
ObjectSetHandle.prototype.adjustInto = ObjectListHandle.prototype.adjustInto

function stub(){}
ObjectSetHandle.prototype.changeListener = function(op, edit, syncId, editId){
	_.assertLength(arguments, 4);
	_.assertInt(op)
	
	if(op === editCodes.addExisting){
		var addedObj = this.getObjectApi(edit.id)
		if(addedObj === undefined) _.errout('cannot find added object: ' + edit.id)
		if(this.obj.indexOf(addedObj) !== -1){
			console.log('ignoring redundant add: ' + edit.id)
			return
		}
		this.obj.push(addedObj);
		return this.emit(edit, 'add', addedObj)
	}else if(op === editCodes.addedNew){
		var id = edit.id//edit.obj.object.meta.id
		var temporary = edit.temporary

		_.assertInt(id)

		var res = this.wrapObject(id, edit.typeCode, [], this)
		this.obj.push(res)
		res.prepare()
		return this.emit(edit, 'add', res, editId)
	}else if(op === editCodes.remove){

		var removedObj = u.findObj(this.obj, edit.id)
		var i = this.obj.indexOf(removedObj)
		_.assert(i >= 0)
		this.obj.splice(i, 1);
		//this.log('new length: ' + this.obj.length)
		return this.emit(edit, 'remove', removedObj, editId)		
	}else{
		_.errout('@TODO implement op: ' + op + ' ' + JSON.stringify(edit));
	}
}

function convertToJson(type, obj, objSchema, local){
	_.errout('TODO');
	
}

ObjectSetHandle.prototype.toJson = function(already){
	var result = []
	//console.log(this + '.toJson(): ' + JSON.stringify(this.obj))
	for(var i=0;i<this.obj.length;++i){
		var obj = this.obj[i]
		result.push(obj.toJson(already))
	}
	return result
}

ObjectSetHandle.prototype.types = u.genericCollectionTypes

ObjectSetHandle.prototype.add = function(objHandle){
	_.assertObject(objHandle)
	
	if(objHandle.isReadonlyAndEmpty){
		_.errout('cannot add placeholder empty object to a collection')
	}
	
	if(this.obj.indexOf(objHandle) !== -1){
		this.log('WARNING: ignoring redundant add: object already in object set')
		return;
	}
	
	var id = objHandle._internalId()
	//this.log('id: ' + id)
	_.assertInt(id)
	_.assert(id > 0 || id < -1)
	var ee = {id: id, typeCode: objHandle.typeSchema.code}
	
	this.saveEdit(editCodes.addExisting, ee);
	
	this.obj.push(objHandle);

	this.emit(ee, 'add', objHandle)
}

ObjectSetHandle.prototype.addNew = function(typeName, json){

	if(arguments.length === 1){
		if(_.isObject(typeName)){
			json = typeName
			typeName = undefined
		}
	}
	json = json || {}
	
	var type = u.getOnlyPossibleType(this, typeName);	
	
	this.saveEdit(editCodes.addNew, {typeCode: type.code})

	var n = this._makeAndSaveNew(json, type)
	
	this.emit({}, 'add', n)
	this.obj.push(n)

	return n
}


