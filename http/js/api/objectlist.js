"use strict";

var u = require('./util')
var _ = require('underscorem')
module.exports = ObjectListHandle

var jsonutil = require('./../jsonutil')

var TopObjectHandle = require('./topobject')

function stub(){}
function readonlyError(){_.errout('readonly');}

function ObjectListHandle(typeSchema, obj, part, parent, isReadonly){
	
	this.part = part;

	this.obj = u.wrapCollection(this, obj)
	
	this.parent = parent;
	this.schema = typeSchema;

	_.assertNot(obj === null);
	
	this.readonly = isReadonly;
	if(isReadonly){
		this.remove = readonlyError;
		this.add = readonlyError;
		this.replaceNew = readonlyError;
		this.replaceExisting = readonlyError;
		this.shift = readonlyError;
		this.addNew = readonlyError;
		this.addNewExternal = readonlyError;
	}
	this.log = this.parent.log
}

ObjectListHandle.prototype.prepare = stub

ObjectListHandle.prototype.adjustPath = u.adjustObjectCollectionPath

ObjectListHandle.prototype.toJson = function(already){
	var result = [];
	for(var i=0;i<this.obj.length;++i){
		var obj = this.obj[i];
		result.push(obj.toJson(already))
	}
	return result;
}

ObjectListHandle.prototype.count = function(){return this.obj.length;}
ObjectListHandle.prototype.size = ObjectListHandle.prototype.count;
ObjectListHandle.prototype.types = u.genericCollectionTypes

ObjectListHandle.prototype.remove = function(objHandle){

	var id = objHandle._internalId()

	var index = this.obj.indexOf(objHandle)

	if(index !== undefined){

		this.obj.splice(index, 1);

		var e = {}
		this.getSh().persistEdit(
			this.getObjectTypeCode(),
			this.getObjectId(), 
			this.getPath().concat([id]),
			'remove',
			e,
			this.getEditingId());

		this.emit(e, 'remove', objHandle)//()
	}else{
		_.errout('tried to remove object not in collection, id: ' + id);
	}
}
ObjectListHandle.prototype.has = function(desiredId){
	_.assertLength(arguments, 1);
	
	var res = findObj(this.obj, desiredId)	
	return !!res
}


ObjectListHandle.prototype.at = function(index){
	var obj = this.obj[index];
	obj.prepare()
	return obj;
}
ObjectListHandle.prototype.get = function(desiredId){
	_.assertLength(arguments, 1);
	_.assertInt(desiredId)
	
	var res = u.findObj(this.obj, desiredId)
	
	if(res){
		res.prepare()
		return res
	}else{
		//console.log('got ids: ' + JSON.stringify(_.map(this.obj, function(v){return v.id();})))
		//_.errout('object with that id not in list: ' + desiredId)
		//console.log('got: ' + JSON.stringify(this.obj))
		//console.log('got*: ' + JSON.stringify(this.objectApiCache))
	}
}

ObjectListHandle.prototype.each = function(cb, endCb){

	this.obj.forEach(function(obj, index){
		obj.prepare()
		cb(obj, index)
	})
	if(endCb) endCb()
}
ObjectListHandle.prototype.changeListener = function(op, edit, syncId, editId){
	_.assertLength(arguments, 4);

	var local = this;
	
	if(op === 'addedNew'){
		var id = edit.id//edit.obj.object.meta.id
		var temporary = edit.temporary
		if(this.getEditingId() !== syncId){
			_.assertInt(id)

			var res = this.wrapObject(id, edit.typeCode, [], this)
			this.obj.push(res)
			res.prepare()
			return this.emit(edit, 'add', res)
		}
	}else if(op === 'replaceExternalExisting'){
		if(this.getEditingId() !== syncId){

			//var removeId = edit.oldId//path[path.length-1];
			var objHandle = this.getObjectApi(edit.oldId)//u.findObj(this.obj, removeId)
			
			if(!objHandle){
				_.errout('not sure what to do about a replace of something already missing!');
			}else{
		
				var newObj = this.getObjectApi(edit.newId);
				
				doListReplace(this, objHandle, newObj);

				return this.emit(edit, 'replace', objHandle, newObj)
			}
		}
		return stub;
	}else if(op === 'replacedNew'){

		if(this.getEditingId() !== syncId){
			var removeId = edit.oldId//path[path.length-1];
			var objHandle = this.get(removeId);
		
			_.assertObject(objHandle);
	
			var res = this.wrapObject(edit.newId, edit.typeCode, [], this)
			doListReplace(this, objHandle, res);
			res.prepare()
			objHandle.prepare()

			return this.emit(edit, 'replace', objHandle, res)				
		}	
	}else if(op === 'shift'){
		if(this.getEditingId() !== syncId){

			_.assert(this.obj.length >= 1);
			var res = this.obj.shift();

			res.prepare()
			return this.emit(edit, 'shift', res)
		}else{
			return stub;
		}
	}else if(op === 'remove'){
		if(this.getEditingId() !== syncId){
			var res = this.get(edit.id);
			var index = this.obj.indexOf(res)
			if(index === -1){
				console.log('ignoring redundant remove: ' + edit.id);
			}else{
				this.obj.splice(index, 1);

				res.prepare()
				return this.emit(edit, 'remove', res)
			}
		}		
		return stub;
	}else if(op === 'addExisting' || op === 'addExistingViewObject'){
		if(this.getEditingId() !== syncId){
			//_.errout('^TODO implement op: ' + JSON.stringify(edit));
		//	console.log('addExistingEdit: ' + JSON.stringify(edit))
			var addedObj = this.getObjectApi(edit.id)
			this.obj.push(addedObj)
			addedObj.prepare()
			return this.emit(edit, 'add', addedObj)
		}	
		return stub;
	}else if(op === 'replaceInternalExisting' || op === 'replaceExternalExisting'){
		if(this.getEditingId() !== syncId){
			//_.errout('^TODO implement op: ' + op + ' ' + JSON.stringify(edit));
			var removeId = edit.oldId//path[path.length-1];
			var objHandle = this.get(removeId);
		
			_.assertObject(objHandle);
	
			var res = this.getObjectApi(edit.newId)//wrapObject(edit.newId, edit.typeCode, [], this)
			doListReplace(this, objHandle, res);
			res.prepare()
			objHandle.prepare()

			return this.emit(edit, 'replace', objHandle, res)
		}
		return stub;
	}else if(op === 'setObject'){
		if(this.getEditingId() !== syncId){
			_.errout('&TODO implement op: ' + JSON.stringify(edit));
		}	
		return stub;
	}else if(op === 'set'){
		if(this.getEditingId() !== syncId){
			_.errout('*TODO implement op: ' + JSON.stringify(edit));
		}	
		return stub;
	}else{
		_.errout('+TODO implement op: ' + op + ' ' + JSON.stringify(edit));
	}
}


function doListReplace(list, objHandle, newObj){
	_.assertLength(arguments, 3)
	_.assertObject(objHandle)
	
	var id = objHandle._internalId()

	var index = list.obj.indexOf(objHandle)
	
	if(index === undefined){
		console.log(JSON.stringify(list.obj))
		console.log('WARNING: tried to remove object not in collection (might have been locally removed), id: ' + id);
		return false
	}

	objHandle.removeParent(list);
	
	list.obj.splice(index, 1, newObj);
	
	return true
}

//TODO differentiate between replaceInternal and replaceExternal
ObjectListHandle.prototype.replaceNew = function(objHandle, typeName, json){

	if(arguments.length === 2){
		if(_.isObject(typeName)){
			json = typeName
			typeName = undefined;
		}
	}
	_.assertObject(objHandle)

	this.obj.splice(this.obj.indexOf(objHandle), 1)

	var id = objHandle._internalId()
	var type = u.getOnlyPossibleType(this, typeName);

	var e = {typeCode: type.code, id: id}
	
	//console.log('doing replaceNew')
	if(objHandle.isInner()){
		this.saveEdit('replaceInternalNew', e)
	}else{
		this.saveEdit('replaceExternalNew', e)

	}
	
	var n = this._makeAndSaveNew(json, type)
	_.assertObject(n)

	this.obj.push(n)

	this.emit(e, 'replace', objHandle, n)//()
}

//TODO differentiate between replaceInternal and replaceExternal
ObjectListHandle.prototype.replaceExisting = function(oldObjHandle, newObjHandle){
	_.assertLength(arguments, 2);
	
	if(!(newObjHandle instanceof TopObjectHandle)) _.errout('TODO implement hoist to top: ' + newObjHandle.constructor);
	
	if(this.obj === undefined){
		_.errout('cannot replaceExisting on empty list');
	}
	
	var oldId = oldObjHandle._internalId()

	var index = this.obj.indexOf(oldObjHandle)

	if(index === undefined){
		_.errout('object to replace not found');
	}
	
	var id = newObjHandle._internalId()
	
	this.obj[index] = newObjHandle
	
	var e = {oldId: oldId, newId: id, newType: newObjHandle.typeSchema.code}

	if(oldObjHandle.isInner()){
		this.saveEdit('replaceInternalExisting', e)
	}else{
		this.saveEdit('replaceExternalExisting', e)

	}	

	this.emit(e, 'replace', oldObjHandle, newObjHandle)//()
}

ObjectListHandle.prototype.shift = function(){

	if(this.obj.length === 0) _.errout('cannot shift empty list')
	
	var e = {}
	this.saveEdit('shift', e);

	var v = this.obj.shift();
		
	this.emit(e, 'shift', v)//()
	return v;
}

ObjectListHandle.prototype.addNew = function(typeName, json){

	if(arguments.length === 1){
		if(_.isObject(typeName)){
			json = typeName
			typeName = undefined;
		}
	}
	
	json = json || {}

	
	var type = u.getOnlyPossibleType(this, typeName);
	
	this.saveEdit('addNew', {typeCode: type.code})

	var n = this._makeAndSaveNew(json, type)
	_.assertObject(n)
	
	this.emit({}, 'add', n)//()
	this.obj.push(n)

	return n
}

ObjectListHandle.prototype.add = function(objHandle){
	_.assertLength(arguments, 1);
	
	if(objHandle.isInner()) _.errout('TODO implement hoist to top');
	
	var e = {id: objHandle._internalId(), typeCode: objHandle.typeSchema.code}
	
	this.saveEdit('addExisting',e);
	
	this.obj.push(objHandle);
		
	this.emit(e, 'add', objHandle)//()
	
}


