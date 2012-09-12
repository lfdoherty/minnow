
var u = require('./util')
var jsonutil = require('./../jsonutil')
var _ = require('underscorem')

var ObjectHandle = require('./object')

module.exports = ObjectSetHandle

function ObjectSetHandle(typeSchema, obj, part, parent){
	this.part = part;
	this.parent = parent;
	this.schema = typeSchema;

	this.log = this.parent.log
	
	this.obj = u.wrapCollection(this, obj)
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

ObjectSetHandle.prototype.adjustPath = u.adjustObjectCollectionPath

ObjectSetHandle.prototype.remove = function(objHandle){

	//if(objHandle.isInner()){
		var index = this.obj.indexOf(objHandle)
		if(index === -1){
			this.log('WARNING: ignoring remove of object not in set')
			return;
		}

		this.obj.splice(index, 1);

		var e = {}
		/*this.getSh().persistEdit(
			this.getObjectTypeCode(),
			this.getObjectId(), 
			this.getPath().concat([objHandle._internalId()]),
			'remove',
			e,
			this.getEditingId());*/
		this.saveEdit('remove', {id: objHandle._internalId()})
	
		this.emit(e, 'remove', objHandle)()
	/*}else{
		var index = this.obj.indexOf(objHandle)
		if(index === -1){
			console.log('WARNING: ignoring remove of object not in set')
			return;
		}

		this.obj.splice(index, 1);

		var e = {id: objHandle._internalId()}
		this.saveEdit('remove', e)
	}*/
}
function stub(){}
ObjectSetHandle.prototype.changeListener = function(op, edit, syncId, editId){
	_.assertLength(arguments, 4);
	//if(path.length > 0) _.errout('TODO implement');
	this.log('object set handle changeListener')
	_.assertString(op)
/*
	if(path.length === 1 && op === 'remove'){
		if(this.getEditingId() !== syncId){
			console.log('removing inner object ^^^^^^^^^^^^^^^^6: ' + path[0])
			var removedObj = u.findObj(this.obj, path[0])//this.getObjectApi(path[0])
			_.assertDefined(removedObj)
			this.obj.splice(this.obj.indexOf(removedObj), 1);
			return this.emit(edit, 'remove', removedObj)
		}else{
			return stub;
		}
	}

	if(path.length > 0){
	
		var a = this.get(path[0]);

		if(a === undefined){
			console.log('WARNING: did not descend into object in set - might already have been removed')
			return;
		}

		_.assertObject(a);	
		return a.changeListener(path.slice(1), op, edit, syncId);
	}*/
	
	if(op === 'addExisting'){
		//console.log('added to set: ' + edit.id);
		if(this.getEditingId() !== syncId){
			var addedObj = this.getObjectApi(edit.id)
			this.obj.push(addedObj);
			return this.emit(edit, 'add', addedObj)
		}
	}/*else if(op === 'addNew'){
		_.errout('TODO reimplement')
		var temporary = edit.temporary
		if(this.getEditingId() === syncId){
			var objHandle = this.get(temporary);
			if(objHandle === undefined){
				console.log('WARNING: did not reify new inner object created via add - might already have been removed')
				return;
			}
			objHandle.reify(edit.obj.object.meta.id)
			return
		}else{
			//_.assertInt(id)
			var newObj = edit.obj.object

			var res = this.wrapObject(newObj, [], this)
			this.obj.push(res)
			res.prepare()
			return this.emit(edit, 'add', res)
		}
	}*/else if(op === 'addedNew'){
		var id = edit.id//edit.obj.object.meta.id
		var temporary = edit.temporary
		if(this.getEditingId() === syncId){
			var objHandle = this.get(temporary);
			if(objHandle === undefined){
				this.log('warning: object not found in list: ' + temporary + ', might ok if it has been replaced')
				return;
			}
			objHandle.reify(id)
			return
		}else{
			_.assertInt(id)

			var res = this.wrapObject(id, edit.typeCode, [], this)
			this.obj.push(res)
			res.prepare()
			return this.emit(edit, 'add', res, editId)
		}
	}else if(op === 'remove'){
		if(this.getEditingId() === syncId){
			return stub;
		}
		var removedObj = u.findObj(this.obj, edit.id)//this.getObjectApi(edit.id)
		var i = this.obj.indexOf(removedObj)
		_.assert(i >= 0)
		this.obj.splice(i, 1);
		this.log('new length: ' + this.obj.length)
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
	
	this.saveEdit('addExisting', ee);
	
	this.obj.push(objHandle);

	this.emit(ee, 'add', objHandle)()
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
	
	this.saveEdit('addNew', {typeCode: type.code})

	var n = this._makeAndSaveNew(json, type)
	
	this.emit({}, 'add', n)()
	this.obj.push(n)

	return n
	/*
	var res = //this.createNewExternalObject(type.code, temporary, edits, forg)
	
		res.prepare();

		if(cb){
			if(this.parent.objectCreationCallbacks === undefined) this.parent.objectCreationCallbacks = {};
			this.parent.objectCreationCallbacks[temporary] = cb;
		}

		return res;*/
	/*
	obj.meta = {typeCode: type.code, id: temporaryId, editId: -10}
	
	var ee = {temporary: temporaryId, newType: type.code, obj: {type: type.code, object: obj}};
	
	this.saveEdit('addNewInternal',	ee);
	
	var res = this.wrapObject(obj, [], this)

	this.obj.push(res);	

	this.emit(ee, 'add', res)()
	return res*/
}


