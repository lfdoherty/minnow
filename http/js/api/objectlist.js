
var u = require('./util')
var _ = require('underscorem')
module.exports = ObjectListHandle

var jsonutil = require('./../jsonutil')

var TopObjectHandle = require('./topobject')

function stub(){}

function ObjectListHandle(typeSchema, obj, part, parent, isReadonly){
	
	this.part = part;
	this.obj = obj || [];
	_.assertArray(this.obj)
	
	this.parent = parent;
	this.schema = typeSchema;

	this.apiCache = {};

	//this.memberTypeCode = typeSchema.code;
	
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
}

ObjectListHandle.prototype.prepare = stub

ObjectListHandle.prototype.toJson = function(){
	var result = [];
	for(var i=0;i<this.obj.length;++i){
		var objOrId = this.obj[i];
		if(_.isInteger(objOrId)){
			var a = u.getObject(this, objOrId);
			result.push(a.toJson());
		}else{
			_.errout('TODO');
		}
	}
	return result;
}

ObjectListHandle.prototype.get = u.genericCollectionGet//?//SetHandle.prototype.get;
ObjectListHandle.prototype.count = function(){return this.obj.length;}
ObjectListHandle.prototype.size = ObjectListHandle.prototype.count;
ObjectListHandle.prototype.types = u.genericCollectionTypes//?//SetHandle.prototype.types;

ObjectListHandle.prototype.remove = function(objHandle){

	var id = objHandle.id();

	var index = findListElement(this.obj, id);

	if(index !== undefined){

		this.obj.splice(index, 1);
		this.clearApiCache(id);

		var e = {}
		this.getSh().persistEdit(
			this.getObjectId(), 
			this.getPath().concat([id]),
			'remove',
			e,
			this.getEditingId());
		
		//this.refresh()();
		this.emit(e, 'remove')()
	}else{
		_.errout('tried to remove object not in collection, id: ' + id);
	}
}
ObjectListHandle.prototype.has = function(desiredId){
	_.assertLength(arguments, 1);
	
	var a = this.getFromApiCache(desiredId);
	if(a) return a;

	var index = findListElement(this.obj, desiredId);
	return index !== undefined;
}

ObjectListHandle.prototype.get = function(desiredId){
	_.assertLength(arguments, 1);

	var a = this.getFromApiCache(desiredId);
	if(a) return a;

	var index = findListElement(this.obj, desiredId);
	if(index === undefined){
		_.errout('unknown id: ' + desiredId);
	}

	var e = this.obj[index];
		
	if(_.isInteger(e)){
		a = this.getObjectApi(desiredId);
		this.addToApiCache(desiredId, a);
	}else{
		a = this.wrapObject(e, [], this);
		this.addToApiCache(desiredId, a);
	}
	return a;
	
}

ObjectListHandle.prototype.each = function(cb, endCb){

	if(this.obj === undefined){
		if(endCb) endCb();
		return;
	}
	var local = this;

	for(var i=0;i<this.obj.length;++i){

		var id = this.obj[i];
		var actualId =  _.isInteger(id) ? id : id.meta.id
		
		console.log('obj: ' + JSON.stringify(this.obj[i]))
		_.assertInt(actualId);

		var a = local.getFromApiCache(actualId);
		
		if(a === undefined){
			if(_.isInteger(id)){
				a = local.getObjectApi(actualId, local);
			}else{
				var obj = id;
				a = local.wrapObject(obj, [], local);
			}
			local.addToApiCache(actualId, a);
		}
		_.assertObject(a);
		a.prepare();
		cb(a, i);
	}
}
ObjectListHandle.prototype.changeListener = function(path, op, edit, syncId){
	_.assertLength(arguments, 4);

	var local = this;
	
	if(op === 'replaceNew' || op === 'replaceExisting'){

		if(op === 'replaceExisting'){
			if(this.getEditingId() !== syncId){

				var removeId = path[path.length-1];
				var index = u.findListElement(this.obj, removeId);
				if(index === -1){
					_.errout('not sure what to do about a replace of something already missing!');
				}else{
			
					var objHandle = this.get(removeId);
				
					_.assertObject(objHandle);
			
					doListReplace(this, objHandle, edit.newId);

					return this.emit(edit, 'replace')
				}
			}
			return stub;
		}else if(op === 'replaceNew'){
			if(this.getEditingId() === syncId){
				u.reifyTemporary(this.obj, edit.temporary, edit.id, this);
			}else{
				//_.errout('(' + syncId + ' !== ' + this.getEditingId() + ') $TODO implement op: ' + JSON.stringify(edit));
				//var removeType = path[path.length-2];
				var removeId = path[path.length-1];
				var index = u.findListElement(this.obj, removeId);
				if(index === -1){
					_.errout('not sure what to do about a replace of something already missing!');
				}else{
			
					var objHandle = this.get(removeId);
				
					_.assertObject(objHandle);
			
					doListReplace(this, objHandle, edit.obj.object);

					//return this.refresh();
					return this.emit(edit, 'replace')				
				}
			}	
		}else{
			_.errout('^TODO implement op: ' + op + ' ' + JSON.stringify(edit));			
		}
	}

	if(path.length === 1 && this.getEditingId() === syncId && op === 'remove'){
		return stub;	
	}

	if(path.length > 0){
	
		var a = this.get(path[0]);
		_.assertObject(a);	
		
		return a.changeListener(path.slice(1), op, edit, syncId);
	}	
	
	if(op === 'addNewInternal'){

		if(this.getEditingId() === syncId){
			u.reifyTemporary(this.obj, edit.temporary, edit.id, this);
		}else{
			_.assertInt(edit.id)
			var newObj = edit.obj.object//{meta: {typeCode: edit.newType, id: edit.id}}
			this.obj.push(newObj)
			return this.emit(edit, 'add')
		}
				
		//return this.refresh();
		return this.emit(edit, 'add', this.get(edit.id))
	}else if(op === 'add'){
		if(this.getEditingId() !== syncId){
			
			//if(this.obj === undefined) this.obj = []
			_.assertInt(edit.value)
			this.obj.push(edit.value);

			//return this.refresh();
			return this.emit(edit, 'add')			
		}else{
			return stub;
		}
	}else if(op === 'shift'){
		if(this.getEditingId() !== syncId){

			_.assert(this.obj.length >= 1);
			this.obj.shift();

//			return this.emit(edit, 'shift')
			return this.emit(edit, 'shift')
		}else{
			return stub;
		}
	}else if(op === 'remove'){
		if(this.getEditingId() !== syncId){
			var index = findListElement(this.obj, edit.id);
			if(index === -1){
				console.log('ignoring redundant remove: ' + edit.id);
			}else{
				this.obj.splice(index, 1);
				this.clearApiCache(edit.id);
				
				return this.emit(edit, 'remove')
			}
		}		
		return stub;
	}else if(op === 'addExisting'){
		if(this.getEditingId() !== syncId){
			_.errout('^TODO implement op: ' + JSON.stringify(edit));
		}	
		return stub;
	}else if(op === 'replaceExisting'){
		if(this.getEditingId() !== syncId){
			_.errout('^TODO implement op: ' + JSON.stringify(edit));
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
		_.errout('+TODO implement op: ' + JSON.stringify(edit));
	}
}


function doListReplace(list, objHandle, newObj){
	_.assertLength(arguments, 3)
	_.assertObject(objHandle)
	
	var id = objHandle.id();

	var index = u.findListElement(list.obj, id);
	
	if(index === undefined){
		console.log(JSON.stringify(list.obj))
		console.log('WARNING: tried to remove object not in collection (might have been locally removed), id: ' + id);
		return false
	}

	objHandle.removeParent(list);
	
	list.obj.splice(index, 1, newObj);
	
	list.clearApiCache(id);
	
	return true
}


ObjectListHandle.prototype.replaceNew = function(objHandle, typeName, json){

	if(arguments.length === 2){
		if(_.isObject(typeName)){
			json = typeName
			typeName = undefined;
		}
	}
	_.assertObject(objHandle)

	var id = objHandle.id();
	//var oldTypeCode = objHandle._typeCode();
	var type = u.getOnlyPossibleType(this, typeName);//this.getFullSchema()[typeName];
	
	var temporaryId = u.makeTemporaryId();

	var obj = jsonutil.convertJsonToObject(this.getFullSchema(), type.name, json);
	
	obj.meta = {typeCode: type.code, id: temporaryId, editId: -10}
	
	//TODO what is this?
	var did = doListReplace(this, objHandle, obj);
	if(!did){
		//console.log(require('util').inspect(objHandle))
		console.log('json: ' + JSON.stringify(json))
		_.errout('local replaceNew: tried to remove object not in list')
	}

	console.log('replaced ' + id + ' with new(' + temporaryId + '): ' + JSON.stringify(json))
	//var obj = 
	//_.assert(id >= 0);
	
	var e = {temporary: temporaryId, newType: type.code, obj: {type: type.code, object: obj}}
	
	this.getSh().persistEdit(
		this.getObjectId(), 
		this.getPath().concat([id]), 
		'replaceNew',
		e,
		this.getEditingId());
	
	
	this.emit(e, 'replace')()
}

ObjectListHandle.prototype.replaceExisting = function(oldObjHandle, newObjHandle){
	_.assertLength(arguments, 2);
	
	if(!(newObjHandle instanceof TopObjectHandle)) _.errout('TODO implement hoist to top: ' + newObjHandle.constructor);
	
	if(this.obj === undefined){
		_.errout('cannot replaceExisting on empty list');
	}
	
	var oldId = oldObjHandle.id();

	var index = u.findListElement(this.obj, oldId);

	this.clearApiCache(oldId);
	
	if(index === undefined){
		_.errout('object to replace not found');
	}
	
	var id = newObjHandle.id();
	
	this.obj[index] = id;
	
	var e = {newId: id, newType: newObjHandle.typeSchema.code, oldId: oldId}
	
	this.getSh().persistEdit(
		this.getObjectId(), 
		this.getPath().concat([oldId]), 
		'replaceExisting',
		e,
		this.getEditingId());
		
//	this.refresh()();	
	this.emit(e, 'replace')()
}

ObjectListHandle.prototype.shift = function(){

	_.assert(this.schema.type.members.type === 'primitive');//TODO generalize

	if(this.obj === undefined || this.obj.length < 1) _.errout('cannot shift empty list')
	
	var e = {}
	this.saveEdit('shift', e);

	var v = this.obj.shift();
		
	//this.refresh()();
	this.emit(e, 'shift')()
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
	
	var temporaryId = u.makeTemporaryId();
		
	var newObj = jsonutil.convertJsonToObject(this.getFullSchema(), type.name, json);
	newObj.meta = {id: temporaryId, typeCode: type.code, editId: -10}

	var ee = {temporary: temporaryId, obj: {type: type.code, object: newObj}};
	
	this.obj.push(newObj);
	var res = this.wrapObject(newObj, [], this);
	this.addToApiCache(temporaryId, res);
	this.saveEdit('addNewInternal', ee);
		
	//this.refresh()();
	
	res.prepare();

	this.emit(ee, 'add', res)()
	
	return res;
}

ObjectListHandle.prototype.add = function(objHandle){
	_.assertLength(arguments, 1);
	
	if(!(objHandle instanceof TopObjectHandle)) _.errout('TODO implement hoist to top');
	
	var e = {id: objHandle.id()}
	
	this.saveEdit('addExisting',e);

	//if(this.obj === undefined) this.obj = [];
	
	this.obj.push(objHandle.id());
		
	//this.refresh()();	
	this.emit(e, 'add', objHandle)()
	
}


