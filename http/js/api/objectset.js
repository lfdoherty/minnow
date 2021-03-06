"use strict";

var u = require('./util')
var jsonutil = require('./../jsonutil')
var _ = require('underscorem')

var ObjectHandle = require('./object')
var ObjectListHandle = require('./objectlist')

var seedrandom = require('seedrandom')

var lookup = require('./../lookup')
var editCodes = lookup.codes
var editNames = lookup.names

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

ObjectSetHandle.prototype.getName = function(){return this.schema.name;}

ObjectSetHandle.prototype._forceRemove = function(id, editId){
	//_.errout('TODO')
	var res = this.get(id);
	var index = this.obj.indexOf(res)
	if(index === -1){
		console.log('WARNING: ignored invalid forceRemove: ' + id + ' ' + editId)
		return
	}
	this.obj.splice(index, 1)
	
	this.emit(undefined, 'remove', res, editId)
}
ObjectSetHandle.prototype._forceAdd = function(res, editId){
	//_.errout('TODO')
	var already = this.get(res._internalId());
	if(already){
		console.log('WARNING: ignored invalid forceAdd: ' + res.id + ' ' + editId)
		return
	}
	
	/*var index = this.obj.indexOf(res)
	if(index === -1){
		return
	}*/
	this.obj.push(res)//splice(index, 1)
	
	this.emit(undefined, 'add', res, editId)
}

ObjectSetHandle.prototype.getImmediateProperty = u.immediatePropertyFunction;

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

ObjectSetHandle.prototype.clear = function(){
	this.parent.clearProperty(this.schema.name)
}

ObjectSetHandle.prototype.get = function(desiredId){
	_.assertLength(arguments, 1);
	_.assertString(desiredId)
	
	var a = u.findObj(this.obj, desiredId)
	if(!a) return;
	a.prepare()
	return a;
}

ObjectSetHandle.prototype.each = function(cb, endCb){
	//_.each(this.obj, function(obj){
	this.obj.forEach(function(obj){
		if(!obj.isDestroyed()){
			obj.prepare()
			cb(obj)
		}
	})
	if(endCb) endCb()
}

ObjectSetHandle.prototype._rewriteObjectApiCache = function(oldKey, newKey){
	
}

ObjectSetHandle.prototype.adjustPath = u.adjustObjectCollectionPath

ObjectSetHandle.prototype.remove = ObjectListHandle.prototype.remove
ObjectSetHandle.prototype.adjustInto = ObjectListHandle.prototype.adjustInto

function stub(){}
ObjectSetHandle.prototype.changeListener = function(subObj, key, op, edit, syncId, editId){
	_.assertLength(arguments, 6);
	_.assertInt(op)
	
	//console.log("GOT OP: " + editNames[op])
	
	if(op === editCodes.addExisting){
		var addedObj = this.getObjectApi(edit.id)
		if(addedObj === undefined) _.errout('cannot find added object: ' + edit.id)
		if(this.obj.indexOf(addedObj) !== -1){
			//console.log('ignoring redundant add: ' + edit.id)
			return
		}
		this.obj.push(addedObj);
		return this.emit(edit, 'add', addedObj)
	}else if(op === editCodes.addedNew){
		var id = edit.id//edit.obj.object.meta.id
		//var temporary = edit.temporary

		_.assertString(id)

		var res = this.wrapObject(id, edit.typeCode, [], this)
		if(res === undefined) _.errout('failed to wrap object: ' + id)
		this.obj.push(res)
		res.prepare()
		return this.emit(edit, 'add', res, editId)
	}/*else if(op === editCodes.addedNew){
		//var id = edit.id//edit.obj.object.meta.id
		//var temporary = edit.temporary

		//_.assertInt(id)
		//_.assertInt(edit.temporary)

		var res = this.wrapObject(edit.id, edit.typeCode, [], this)
		if(res === undefined) _.errout('failed to wrap object: ' + edit.id)
		this.obj.push(res)
		res.prepare()
		return this.emit(edit, 'add', res, editId)
	}*/if(op === editCodes.remove){
		_.assertString(subObj)
		var res = this.get(subObj);
		var index = this.obj.indexOf(res)
		if(index === -1){
			console.log('ignoring redundant remove: ' + subObj);
		}else{
			this.obj.splice(index, 1);

			res.prepare()
			//console.log('removed: ' + res)
			return this.emit(edit, 'remove', res)
		}
	}else{
		_.errout('+TODO implement op: ' + editNames[op] + ' ' + JSON.stringify(edit) + ' ' + JSON.stringify(this.schema));
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

	if(objHandle.isInner()){
		_.errout('cannot add inner object to a collection: ' + objHandle.id())
	}
	
	var id = objHandle._internalId()
	//this.log('id: ' + id)
	_.assertString(id)
	//_.assert(id > 0 || id < -1)
	var ee = {id: id, typeCode: objHandle.typeSchema.code}
	
	this.saveEdit(editCodes.addExisting, ee);
	
	this.obj.push(objHandle);

	this.emit(ee, 'add', objHandle)
}

ObjectSetHandle.prototype.addNew = function(typeName, json){

	//if(arguments.length === 1){
		if(_.isObject(typeName)){
			//cb = json
			json = typeName
			typeName = undefined
		}
	//}
	json = json || {}
	
	var type = u.getOnlyPossibleType(this, typeName);	
	
	//var temporary = this.makeTemporaryId()
	var id = seedrandom.uid()

	var local = this
	var n = this._makeAndSaveNew(json, type, id, undefined, function(fc){
		var edit = {typeCode: type.code, id: id, following: fc}
		local.saveEdit(editCodes.addedNew, edit)
	})
	
	if(n === undefined) _.errout('failed to addNew')
		
	this.emit({}, 'add', n)
	this.obj.push(n)

	return n
}


