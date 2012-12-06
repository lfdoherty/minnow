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

		var remainingCurrentPath = this.parent.adjustPath(this.part)
		console.log('remainingCurrentPath: ' + JSON.stringify(remainingCurrentPath))
		if(remainingCurrentPath && remainingCurrentPath.length > 1){
			this.persistEdit(editCodes.ascend, {many: remainingCurrentPath.length-1})
		}
		if(!remainingCurrentPath || remainingCurrentPath.length === 0){
			this.persistEdit(editCodes.selectObject, {id: id})
		}else if(remainingCurrentPath[0] !== id){
			console.log('reselecting')
			this.persistEdit(editCodes.reselectObject, {id: id})
		}else{
			console.log('same')
		}
		
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

ObjectListHandle.prototype._rewriteObjectApiCache = function(oldKey, newKey){
	
}

//ObjectListHandle.prototype.changeListener = function(op, edit, syncId, editId){
ObjectListHandle.prototype.changeListenerElevated = function(descendId, op, edit, syncId, editId){
	if(op === editCodes.remove){
		var res = this.get(descendId);
		var index = this.obj.indexOf(res)
		if(index === -1){
			console.log('ignoring redundant remove: ' + edit.id);
		}else{
			this.obj.splice(index, 1);

			res.prepare()
			return this.emit(edit, 'remove', res)
		}
	}else{
		_.errout('+TODO implement op: ' + editNames[op] + ' ' + JSON.stringify(edit) + ' ' + JSON.stringify(this.schema));
	}
}

ObjectListHandle.prototype.changeListener = function(op, edit, syncId, editId){
	_.assertLength(arguments, 4);

	var local = this;
	
	if(op === editCodes.addedNew){
		var id = edit.id
		var temporary = edit.temporary

		_.assertInt(id)

		var res = this.wrapObject(id, edit.typeCode, [], this)
		this.obj.push(res)
		res.prepare()
		return this.emit(edit, 'add', res)

	}else if(op === editCodes.addNew){
		var temporary = edit.temporary

		var res = this.wrapObject(temporary, edit.typeCode, [], this)
		this.saveTemporaryForLookup(temporary, res, this)
		this.obj.push(res)
		res.prepare()
		return this.emit(edit, 'add', res)
	}if(op === editCodes.addedNewAt){
		var id = edit.id
		var temporary = edit.temporary

		_.assertInt(id)

		var res = this.wrapObject(id, edit.typeCode, [], this)
		//this.obj.push(res)
		this.obj.splice(edit.index, 0, res)
		res.prepare()
		return this.emit(edit, 'add', res, edit.index)

	}else if(op === editCodes.addNewAt){
		var temporary = edit.temporary

		var res = this.wrapObject(temporary, edit.typeCode, [], this)
		this.saveTemporaryForLookup(temporary, res, this)
		//this.obj.push(res)
		this.obj.splice(edit.index, 0, res)
		res.prepare()
		return this.emit(edit, 'add', res, edit.index)
	}else if(op === editCodes.replaceExternalExisting){
		//if(this.getEditingId() !== syncId){

			//var removeId = edit.oldId//path[path.length-1];
			var objHandle = this.getObjectApi(edit.oldId)//u.findObj(this.obj, removeId)
			
			if(!objHandle){
				_.errout('not sure what to do about a replace of something already missing!');
			}else{
		
				var newObj = this.getObjectApi(edit.newId);
				
				doListReplace(this, objHandle, newObj);

				return this.emit(edit, 'replace', objHandle, newObj)
			}
		//}
		//return stub;
	}else if(op === editCodes.replacedNew){

		//if(this.getEditingId() !== syncId){
			var removeId = edit.oldId//path[path.length-1];
			var objHandle = this.get(removeId);
		
			_.assertObject(objHandle);
	
			var res = this.wrapObject(edit.newId, edit.typeCode, [], this)
			doListReplace(this, objHandle, res);
			res.prepare()
			objHandle.prepare()

			return this.emit(edit, 'replace', objHandle, res)				
		//}	
	}else if(op === editCodes.shift){
		//if(this.getEditingId() !== syncId){

			_.assert(this.obj.length >= 1);
			var res = this.obj.shift();

			res.prepare()
			return this.emit(edit, 'shift', res)
		/*}else{
			return stub;
		}*/
	}else if(op === editCodes.remove){
		_.errout('should be in elevated change listener!')
		//if(this.getEditingId() !== syncId){
			var res = this.get(edit.id);
			var index = this.obj.indexOf(res)
			if(index === -1){
				console.log('ignoring redundant remove: ' + edit.id);
			}else{
				this.obj.splice(index, 1);

				res.prepare()
				return this.emit(edit, 'remove', res)
			}
		//}		
		//return stub;
	}else if(op === editCodes.addExisting || op === editCodes.addExistingViewObject){
	//	if(this.getEditingId() !== syncId){
			//_.errout('^TODO implement op: ' + JSON.stringify(edit));
		//	console.log('addExistingEdit: ' + JSON.stringify(edit))
			var addedObj = this.getObjectApi(edit.id)
			_.assertDefined(addedObj)
			this.obj.push(addedObj)
			addedObj.prepare()
			return this.emit(edit, 'add', addedObj)
		//}	
	//	return stub;
	}else if(op === editCodes.replaceInternalExisting || op === editCodes.replaceExternalExisting){
		//if(this.getEditingId() !== syncId){
			//_.errout('^TODO implement op: ' + op + ' ' + JSON.stringify(edit));
			var removeId = edit.oldId//path[path.length-1];
			var objHandle = this.get(removeId);
		
			_.assertObject(objHandle);
	
			var res = this.getObjectApi(edit.newId)//wrapObject(edit.newId, edit.typeCode, [], this)
			doListReplace(this, objHandle, res);
			res.prepare()
			objHandle.prepare()

			return this.emit(edit, 'replace', objHandle, res)
		//}
		//return stub;
	}else if(op === editCodes.setObject){
		//if(this.getEditingId() !== syncId){
			_.errout('&TODO implement op: ' + JSON.stringify(edit));
		//}	
		//return stub;
	}else if(op === editCodes.set){
		//if(this.getEditingId() !== syncId){
			_.errout('*TODO implement op: ' + JSON.stringify(edit));
		//}	
		//return stub;
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
		this.saveEdit(editCodes.replaceInternalNew, e)
	}else{
		this.saveEdit(editCodes.replaceExternalNew, e)

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
		this.saveEdit(editCodes.replaceInternalExisting, e)
	}else{
		this.saveEdit(editCodes.replaceExternalExisting, e)

	}	

	this.emit(e, 'replace', oldObjHandle, newObjHandle)//()
}

ObjectListHandle.prototype.shift = function(){

	if(this.obj.length === 0) _.errout('cannot shift empty list')
	
	var e = {}
	this.saveEdit(editCodes.shift, e);

	var v = this.obj.shift();
		
	this.emit(e, 'shift', v)//()
	return v;
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
	
	this.saveEdit(editCodes.addNewAt, {typeCode: type.code, index: index})

	var n = this._makeAndSaveNew(json, type)
	_.assertObject(n)
	
	this.emit({}, 'add', n, index)
	//this.obj.push(n)
	this.obj.splice(index, 0, n)

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
	
	this.emit({}, 'add', n)
	this.obj.push(n)

	return n
}

ObjectListHandle.prototype.add = function(objHandle){
	_.assertLength(arguments, 1);
	
	if(!_.isObject(objHandle)) _.errout('add param 0 must be a minnow object, is a: ' + typeof(objHandle))
	
	if(objHandle.isInner()) _.errout('TODO implement hoist to top');
	
	var e = {id: objHandle._internalId(), typeCode: objHandle.typeSchema.code}
	
	this.saveEdit(editCodes.addExisting,e);
	
	this.obj.push(objHandle);
		
	this.emit(e, 'add', objHandle)//()
	
}


