"use strict";

var u = require('./util')
var _ = require('underscorem')
module.exports = ObjectListHandle

var jsonutil = require('./../jsonutil')

var TopObjectHandle = require('./topobject')

var lookup = require('./../lookup')
var editCodes = lookup.codes
var editNames = lookup.names

function stub(){}
function readonlyError(){_.errout('readonly');}

function ObjectListHandle(typeSchema, obj, part, parent, isReadonly){
	
	this.part = part;

	this.obj = u.wrapCollection(this, obj)
	
	this.parent = parent;
	this.schema = typeSchema;

	_.assertNot(obj === null);
	
	this.readonly = isReadonly;
	if(this.isView()){
		this.remove = readonlyError;
		this.add = readonlyError;
		this.unshift = readonlyError;
		this.replaceNew = readonlyError;
		this.replaceExisting = readonlyError;
		this.shift = readonlyError;
		this.addNew = readonlyError;
		this.addNewExternal = readonlyError;
	}
	this.log = this.parent.log
}

ObjectListHandle.prototype.prepare = stub

//ObjectListHandle.prototype.adjustPath = u.adjustObjectCollectionPath

ObjectListHandle.prototype.getImmediateProperty = u.immediatePropertyFunction;

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

/*
ObjectListHandle.prototype.adjustInto = function(id){
	var remainingCurrentPath = this.parent.adjustPath(this.part)
	if(remainingCurrentPath && remainingCurrentPath.length > 1){
		this.persistEdit(editCodes.ascend, {many: remainingCurrentPath.length-1})
	}
	if(!remainingCurrentPath || remainingCurrentPath.length === 0){
		this.persistEdit(editCodes.selectObject, {id: id})
	}else if(remainingCurrentPath[0] !== id){
		this.persistEdit(editCodes.reselectObject, {id: id})
	}
}*/

ObjectListHandle.prototype.positionOf = function(objHandle){
	return this.obj.indexOf(objHandle)
}
ObjectListHandle.prototype.remove = function(objHandle){

	//console.log('**removing')

	var id = objHandle._internalId()

	var index = this.obj.indexOf(objHandle)

	if(index !== -1){

		this.obj.splice(index, 1);

		var e = {}

		//this.adjustInto(id)
		this.adjustCurrentObject(this.getImmediateObject())
		this.adjustCurrentProperty(this.schema.code)
		this.adjustCurrentSubObject(id)
		//console.log('persisting remove')
		this.persistEdit(editCodes.remove, e)

		this.emit(e, 'remove', objHandle)
	}else{
		_.errout('tried to remove object not in collection, id: ' + id);
	}
}

ObjectListHandle.prototype.contains = function(desiredHandle){
	return this.obj.indexOf(desiredHandle) !== -1
}

//TODO
/*
ObjectListHandle.prototype.removeAt = function(index, many){
	
	if(arguments.length === 1) many = 1
	
	_.assertInt(index)
	_.assertInt(many)
	if(index > this.obj.length) _.errout('index of out bounds: ' + index + ' > ' + this.obj.length)
	if(index < 0) _.errout('negative index: ' + index)
	if(many === 0) return
	if(many < 0) _.errout('negative number to remove: ' + many)

	this.obj.splice(index, many);

	var e = {index: index, many: many}
	this.getSh().persistEdit(//TODO just saveEdit?
		this.getObjectTypeCode(),
		this.getObjectId(), 
		this.getPath(),
		editCodes.removeAt,
		e,
		this.getEditingId());

	this.emit(e, 'remove', index)
}*/

ObjectListHandle.prototype.has = function(desiredId){
	_.assertLength(arguments, 1);
	
	if(desiredId._internalId){
		//TODO check type is valid
		desiredId = desiredId._internalId()
	}
	var res = u.findObj(this.obj, desiredId)	
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

ObjectListHandle.prototype._rewriteObjectApiCache = function(oldKey, newKey){
	
}

//ObjectListHandle.prototype.changeListener = function(op, edit, syncId, editId){
/*ObjectListHandle.prototype.changeListenerElevated = function(descendId, op, edit, syncId, editId){
	
}*/

ObjectListHandle.prototype.changeListener = function(subObj, key, op, edit, syncId, editId){
	_.assertLength(arguments, 6);

	var local = this;
	
	if(op === editCodes.addedNew){
		var id = edit.id
		var temporary = edit.temporary

		_.assertInt(id)

		var res = this.wrapObject(id, edit.typeCode, [], this)
		
		this.obj.push(res)
		res.prepare()
		//console.log('object list added new to : ' + this.parent.type() + ' ' + this.parent.id())
		return this.emit(edit, 'add', res)

	}else if(op === editCodes.unshiftedNew){
		var id = edit.id
		var temporary = edit.temporary

		_.assertInt(id)

		var res = this.wrapObject(id, edit.typeCode, [], this)
		
		this.obj.unshift(res)
		res.prepare()
		return this.emit(edit, 'add', res)

	}else if(op === editCodes.addNew){
		var temporary = edit.temporary

		var res = this.wrapObject(temporary, edit.typeCode, [], this)
		this.saveTemporaryForLookup(temporary, res, this)
		this.obj.push(res)
		res.prepare()
		return this.emit(edit, 'add', res)
	}else if(op === editCodes.unshiftNew){
		var temporary = edit.temporary

		var res = this.wrapObject(temporary, edit.typeCode, [], this)
		this.saveTemporaryForLookup(temporary, res, this)
		this.obj.unshift(res)
		res.prepare()
		return this.emit(edit, 'add', res)
	}if(op === editCodes.addedNewAt){
		var id = edit.id
		var temporary = edit.temporary

		_.assertInt(id)

		var res = this.wrapObject(id, edit.typeCode, [], this)

		this.obj.splice(edit.index, 0, res)
		res.prepare()
		return this.emit(edit, 'add', res, edit.index)

	}else if(op === editCodes.addNewAt){
		var temporary = edit.temporary

		var res = this.wrapObject(temporary, edit.typeCode, [], this)
		this.saveTemporaryForLookup(temporary, res, this)

		this.obj.splice(edit.index, 0, res)
		res.prepare()
		return this.emit(edit, 'add', res, edit.index)
	}else if(op === editCodes.replaceExternalExisting){

		var objHandle = this.getObjectApi(edit.oldId)
		
		if(!objHandle){
			_.errout('not sure what to do about a replace of something already missing!');
		}else{
	
			var newObj = this.getObjectApi(edit.newId);
			
			doListReplace(this, objHandle, newObj);

			return this.emit(edit, 'replace', objHandle, newObj)
		}
	}else if(op === editCodes.replacedNew){

		var removeId = edit.oldId
		var objHandle = this.get(removeId);
	
		_.assertObject(objHandle);
		
		var res = this.wrapObject(edit.newId, edit.typeCode, [], this)
		doListReplace(this, objHandle, res);
		res.prepare()
		objHandle.prepare()

		return this.emit(edit, 'replace', objHandle, res)				
	}else if(op === editCodes.shift){
		_.assert(this.obj.length >= 1);
		var res = this.obj.shift();

		res.prepare()
		return this.emit(edit, 'shift', res)
	}else if(op === editCodes.remove){
		//_.errout('should be in elevated change listener!')

		var res = this.get(subObj);
		var index = this.obj.indexOf(res)
		if(index === -1){
			console.log('ignoring redundant remove: ' + edit.id);
		}else{
			this.obj.splice(index, 1);

			res.prepare()
			return this.emit(edit, 'remove', res)
		}
	}else if(op === editCodes.addExisting || op === editCodes.addExistingViewObject){
		var addedObj = this.getObjectApi(edit.id)
		_.assertDefined(addedObj)
		
		if(this.obj.indexOf(addedObj) !== -1) return
		
		this.obj.push(addedObj)
		addedObj.prepare()
		return this.emit(edit, 'add', addedObj)
	}else if(op === editCodes.unshiftExisting){
		var addedObj = this.getObjectApi(edit.id)
		//_.assertDefined(addedObj)
		if(addedObj === undefined) _.errout('cannot find: ' + edit.id)
		
		if(this.obj.indexOf(addedObj) !== -1) return
		
		this.obj.unshift(addedObj)
		addedObj.prepare()
		return this.emit(edit, 'add', addedObj)
	}else if(op === editCodes.replaceInternalExisting || op === editCodes.replaceExternalExisting){
		var removeId = edit.oldId
		var objHandle = this.get(removeId);
	
		_.assertObject(objHandle);

		var res = this.getObjectApi(edit.newId)
		doListReplace(this, objHandle, res);
		res.prepare()
		objHandle.prepare()

		return this.emit(edit, 'replace', objHandle, res)
	}else if(op === editCodes.setObject){
		_.errout('&TODO implement op: ' + JSON.stringify(edit));
	}else if(op === editCodes.set){
		_.errout('*TODO implement op: ' + JSON.stringify(edit));
	}if(op === editCodes.remove){
		var res = this.get(subObj);
		var index = this.obj.indexOf(res)
		if(index === -1){
			//console.log('ignoring redundant remove: ' + edit.id);
		}else{
			this.obj.splice(index, 1);

			res.prepare()
			return this.emit(edit, 'remove', res)
		}
	}else if(op === editCodes.addAfter){
		var objHandle = this.getObjectApi(edit.id)
		if(objHandle === undefined){
			_.errout('cannot find added object: ' + edit.id)
		}
		
		if(this.obj.indexOf(objHandle) !== -1){
			//console.log('ignoring redundant add: ' + edit.id)
			return
		}
		
		var beforeHandle = this.get(subObj);
		if(beforeHandle === undefined){
			//console.log('cannot find before(' + descendId+'), falling back to append-add')
			this.obj.push(objHandle)
			objHandle.prepare()
	
			this.emit(edit, 'add', objHandle)
		}else{
			var index = this.obj.indexOf(beforeHandle)
			this.obj.splice(index+1, 0, objHandle)
			objHandle.prepare()
			beforeHandle.prepare()
	
			this.emit(edit, 'addAfter', objHandle, beforeHandle)
		}
	}else if(op === editCodes.addedNewAfter){
		if(edit.temporary !== 0){
			var temporary = edit.temporary
			var objHandle = this.wrapObject(temporary, edit.typeCode, [], this)
			this.saveTemporaryForLookup(temporary, objHandle, this)
		}else{
			var objHandle = this.wrapObject(edit.id, edit.typeCode, [], this)
		}
		
		var beforeHandle = this.get(subObj);
		if(beforeHandle === undefined){
			//console.log('cannot find before(' + descendId+'), falling back to append-add')
			this.obj.push(objHandle)
			objHandle.prepare()
	
			this.emit(edit, 'add', objHandle)
		}else{
			var index = this.obj.indexOf(beforeHandle)
			this.obj.splice(index+1, 0, objHandle)
			objHandle.prepare()
			beforeHandle.prepare()
	
			this.emit(edit, 'addAfter', objHandle, beforeHandle)
		}
	}else if(op === editCodes.moveToAfter){
		var before = this.get(subObj);
		var objHandle = this.get(edit.id);
		var index = this.obj.indexOf(objHandle)
		var beforeIndex = this.obj.indexOf(before)
		if(index !== -1 && beforeIndex !== -1){
			this.obj.splice(index, 1)
			this.obj.splice(beforeIndex+1, 0, objHandle)
			
			objHandle.prepare()
	
			this.emit(edit, 'move', res)
		}
		
	}else if(op === editCodes.moveToFront){
		var res = this.get(subObj);
		var index = this.obj.indexOf(res)
		if(index !== -1){
			this.obj.splice(index, 1)
			this.obj.unshift(res)
			
			res.prepare()
	
			this.emit(edit, 'move', res)
		}
	}else if(op === editCodes.moveToBack){
		var res = this.get(subObj);
		var index = this.obj.indexOf(res)
		if(index !== -1){
			this.obj.splice(index, 1)
			this.obj.push(res)
			
			res.prepare()
	
			this.emit(edit, 'move', res)
		}
	}else{
		_.errout('+TODO implement op: ' + editNames[op] + ' ' + JSON.stringify(edit) + ' ' + JSON.stringify(this.schema));
	}
}


function doListReplace(list, objHandle, newObj){
	_.assertLength(arguments, 3)
	_.assertObject(objHandle)
	_.assertObject(newObj)
	
	var id = objHandle._internalId()

	var index = list.obj.indexOf(objHandle)
	
	if(index === undefined){
		console.log(JSON.stringify(list.obj))
		console.log('WARNING: tried to remove object not in collection (might have been locally removed), id: ' + id);
		return false
	}

	//objHandle.removeParent(list);
	
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
		this.saveEdit(editCodes.replaceInternalNew, e)
	}else{
		this.saveEdit(editCodes.replaceExternalNew, e)

	}
	
	var n = this._makeAndSaveNew(json, type)
	_.assertObject(n)

	this.obj.push(n)

	this.emit(e, 'replace', objHandle, n)
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
		this.saveEdit(editCodes.replaceInternalExisting, e)
	}else{
		this.saveEdit(editCodes.replaceExternalExisting, e)

	}	

	this.emit(e, 'replace', oldObjHandle, newObjHandle)
}

ObjectListHandle.prototype.shift = function(){

	if(this.obj.length === 0) _.errout('cannot shift empty list')
	
	var e = {}
	this.saveEdit(editCodes.shift, e);

	var v = this.obj.shift();
		
	this.emit(e, 'shift', v)
	return v;
}

ObjectListHandle.prototype.addNewAfter = function(beforeHandle, typeName, json){
	var index = this.obj.indexOf(beforeHandle)
	if(index === -1) _.errout('before is not a member of the list: ' + beforeHandle)
	if(json) _.assertObject(json)
		
	json = json || {}
	
	var type = u.getOnlyPossibleType(this, typeName);
	
	//this.adjustInto(beforeHandle._internalId())
	this.adjustCurrentObject(this.getImmediateObject())
	this.adjustCurrentProperty(this.schema.code)
	this.adjustCurrentSubObject(beforeHandle._internalId())
		
	var e = {typeCode: type.code}
	this.persistEdit(editCodes.addNewAfter, e)

	var n = this._makeAndSaveNew(json, type)
	_.assertObject(n)
	
	this.obj.splice(index+1, 0, n)
	this.emit(e, 'add', n, index+1)

	return n	
}

ObjectListHandle.prototype.addAfter = function(beforeHandle, objHandle){
	var index = this.obj.indexOf(beforeHandle)
	if(index === -1) _.errout('before is not a member of the list: ' + beforeHandle)
	
	if(objHandle.isInner()){
		_.errout('cannot add inner object to a collection: ' + objHandle.id())
	}
	
	if(this.obj.indexOf(objHandle) !== -1){
		this.remove(objHandle)
		index = this.obj.indexOf(beforeHandle)
	}
		
	var id = objHandle._internalId()
	
	//this.adjustInto(beforeHandle._internalId())
	this.adjustCurrentObject(this.getImmediateObject())
	this.adjustCurrentProperty(this.schema.code)
	this.adjustCurrentSubObject(beforeHandle._internalId())
		
	var e = {id: id}
	this.persistEdit(editCodes.addAfter, e)

	this.obj.splice(index+1, 0, objHandle)
	this.emit(e, 'add', objHandle, index+1)
}
ObjectListHandle.prototype.addNewAt = function(index, typeName, json){

	_.assertInt(index)
	if(index > this.obj.length) _.errout('index of out bounds: ' + index + ' > ' + this.obj.length)
	if(index < 0) _.errout('negative index: ' + index)

	if(arguments.length === 2){
		if(_.isObject(typeName)){
			json = typeName
			typeName = undefined;
		}
	}
	
	json = json || {}
	
	var type = u.getOnlyPossibleType(this, typeName);
	

	var n = this._makeAndSaveNew(json, type)
	_.assertObject(n)

	this.saveEdit(editCodes.addNewAt, {typeCode: type.code, index: index, temporary: n._internalId()})
	
	this.emit({}, 'add', n, index)
	//this.obj.push(n)
	this.obj.splice(index, 0, n)

	return n
}

ObjectListHandle.prototype.unshiftNew = function(typeName, json){

	if(arguments.length === 1){
		if(_.isObject(typeName)){
			json = typeName
			typeName = undefined;
		}
	}
	
	json = json || {}

	
	var type = u.getOnlyPossibleType(this, typeName);
	
	this.saveEdit(editCodes.unshiftNew, {typeCode: type.code})

	var n = this._makeAndSaveNew(json, type)
	_.assertObject(n)
	
	this.obj.unshift(n)
	this.emit({}, 'add', n)
	
	//console.log('addNew done')

	return n
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
	
	this.saveEdit(editCodes.addNew, {typeCode: type.code})

	var n = this._makeAndSaveNew(json, type)
	_.assertObject(n)
	
	this.obj.push(n)
	this.emit({}, 'add', n)
	
	//console.log('addNew done')

	return n
}

ObjectListHandle.prototype.moveToFront = function(objHandle){
	_.assertLength(arguments, 1);
	
	var id = objHandle._internalId()

	var index = this.obj.indexOf(objHandle)

	if(index !== undefined){

		this.obj.splice(index, 1);
		this.obj.unshift(objHandle)

		this.adjustCurrentObject(this.getImmediateObject())
		this.adjustCurrentProperty(this.schema.code)
		this.adjustCurrentSubObject(id)
		var e = {}
		this.persistEdit(editCodes.moveToFront, e)

		this.emit(e, 'move', objHandle)
	}else{
		_.errout('tried to move object not in collection: ' + objHandle.id());
	}
}

ObjectListHandle.prototype.moveToBack = function(objHandle){
	_.assertLength(arguments, 1);
	
	var id = objHandle._internalId()

	var index = this.obj.indexOf(objHandle)

	if(index === undefined){
		_.errout('tried to move object not in collection: ' + objHandle.id());
	}
	
	this.obj.splice(index, 1);
	this.obj.push(objHandle)

	this.adjustCurrentObject(this.getImmediateObject())
	this.adjustCurrentProperty(this.schema.code)
	this.adjustCurrentSubObject(id)
	var e = {}
	this.persistEdit(editCodes.moveToBack, e)

	this.emit(e, 'move', objHandle)
}

ObjectListHandle.prototype.moveToAfter = function(beforeHandle, objHandle){
	_.assertLength(arguments, 2);
	
	var id = objHandle._internalId()

	var index = this.obj.indexOf(objHandle)

	var beforeIndex = this.obj.indexOf(beforeHandle)
	if(beforeIndex === -1){
		_.errout('before object not in collections: ' + beforeHandle.id());
	}
	if(index === -1){
		_.errout('tried to move object not in collection: ' + objHandle.id());
	}
		
	this.adjustCurrentObject(this.getImmediateObject())
	this.adjustCurrentProperty(this.schema.code)
	this.adjustCurrentSubObject(beforeHandle._internalId())
	var e = {id: id}
	this.persistEdit(editCodes.moveToAfter, e)

	this.obj.splice(index, 1)
	this.obj.splice(beforeIndex+1, 0, objHandle)
	this.emit(e, 'move', objHandle, index+1)
}

ObjectListHandle.prototype.unshift = function(objHandle){
	_.assertLength(arguments, 1);
	
	if(!_.isObject(objHandle)) _.errout('add param 0 must be a minnow object, is a: ' + typeof(objHandle))
	
	if(objHandle.isInner()) _.errout('TODO implement hoist to top: ' + objHandle);
	
	if(this.obj.indexOf(objHandle) !== -1){
		this.remove(objHandle)
	}
	
	var e = {id: objHandle._internalId(), typeCode: objHandle.typeSchema.code}
	
	this.saveEdit(editCodes.unshiftExisting,e);
	
	this.obj.unshift(objHandle);
		
	this.emit(e, 'add', objHandle)//()
	
}

ObjectListHandle.prototype.add = function(objHandle){
	_.assertLength(arguments, 1);
	
	if(!_.isObject(objHandle)) _.errout('add param 0 must be a minnow object, is a: ' + typeof(objHandle))
	
	if(objHandle.isInner()) _.errout('TODO implement hoist to top: ' + objHandle);
	
	if(this.obj.indexOf(objHandle) !== -1){
		return
	}
	
	var e = {id: objHandle._internalId(), typeCode: objHandle.typeSchema.code}
	
	this.saveEdit(editCodes.addExisting,e);
	
	this.obj.push(objHandle);
		
	this.emit(e, 'add', objHandle)//()
	
}


