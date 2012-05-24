
var u = require('./util')
var jsonutil = require('./../jsonutil')
var _ = require('underscorem')

module.exports = ObjectSetHandle

function ObjectSetHandle(typeSchema, obj, part, parent){
	this.part = part;
	this.obj = obj || [];
	this.parent = parent;
	this.schema = typeSchema;

	this.apiCache = {};
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
	var desiredId = desiredHandle.id();
	
	for(var i=0;i<this.obj.length;++i){
		var id = this.obj[i];
		if(_.isInteger(id)){
			if(id === desiredId) return true;
		}else{
			if(id.meta.id === desiredId) return true;
		}
	}
	return false;
}
ObjectSetHandle.prototype.has = function(desiredId){
	
	if(this.obj === undefined){
		//_.errout('unknown id: ' + desiredId);
		return false;
	}
	
	var a = this.getFromApiCache(desiredId);
	if(a){
		return true;
	}
	
	var arr = this.obj;

	for(var i=0;i<arr.length;++i){
		var idOrObject = arr[i];
		if(_.isInteger(idOrObject)){
			if(desiredId === idOrObject) return true;
		}
	}

	return false;
}
ObjectSetHandle.prototype.get = function(desiredId){
	_.assertLength(arguments, 1);
	
	if(this.obj === undefined){
		_.errout('unknown id: ' + desiredId);
	}
	
	var a = this.getFromApiCache(desiredId);
	if(a){
		a.prepare();
		return a;
	}
	
	var local = this;

	var arr = local.obj;

	for(var i=0;i<arr.length;++i){
		var idOrObject = arr[i];
		if(_.isInteger(idOrObject) || _.isString(idOrObject)){
			var id = idOrObject;
			if(desiredId === id){
				a = local.getObjectApi(id, local);
				_.assertObject(a);
				local.addToApiCache(id, a);
				a.prepare();
				return a;
			}
		}else{
			var obj = idOrObject;
			var localObjId = obj.meta.id
			if(desiredId === localObjId){

				a = local.wrapObject(obj, [], local);
				local.addToApiCache(desiredId, a);
				a.prepare();
				return a;
			}
		}
	}
	
	_.errout('unknown id: ' + desiredId);
}

ObjectSetHandle.prototype.each = function(cb){
	//console.log('in each: ' + JSON.stringify(this.obj));
	//console.log(JSON.stringify(this.schema));
	if(this.schema.type.members.type === 'primitive'){
		_.each(this.obj, cb);
	}else{
		if(this.obj === undefined){
			return;
		}
		var local = this;
		var arr = local.obj;
		
		for(var i=0;i<arr.length;++i){

			var id = arr[i];
			var a = getObject(local, id);
			a.prepare();
			cb(a, i);
		}
	}
}


function getObject(local, id){

	var localObjId;
	if(_.isInteger(id)){
		localObjId = id;
	}else{
		//_.assertObject(id)
		//console.log('obj: ' + JSON.stringify(id))
		localObjId = id.meta.id
	}
	
	var a = local.getFromApiCache(localObjId);
	
	if(a === undefined){
		if(_.isInteger(id)){
			a = local.getObjectApi(id, local);
		}else{
			a = local.wrapObject(id, [], local);
		}
		local.addToApiCache(localObjId, a);
	}
	_.assertObject(a);
	return a;
}


ObjectSetHandle.prototype.remove = function(objHandle){

	var id = objHandle.id();
	var found = false;
	for(var i=0;i<this.obj.length;++i){
		var e = this.obj[i];
		if(_.isInteger(e)){
			if(e === id){
				found = true;
				this.obj.splice(i, 1);
				break;
			}
		}else{
			var eId = e.meta.id
			if(id === eId){
				found = true;
				this.obj.splice(i, 1);
				break;
			}
		}
	}	
	
	if(found){
		this.getSh().persistEdit(
			this.getObjectId(), 
			this.getPath().concat([id]),
			'remove',
			{},
			this.getEditingId());
			
		this.refresh()();
	}else{
		_.errout('tried to remove object not in collection, id: ' + id);
	}
}

ObjectSetHandle.prototype.changeListener = function(path, op, edit, syncId){
	_.assertLength(arguments, 4);
	//if(path.length > 0) _.errout('TODO implement');
	_.assertString(op)

	if(path.length > 0){
	
		var a = this.get(path[0]);
		_.assertObject(a);	
		return a.changeListener(path.slice(1), op, edit, syncId);
	}
	
	if(op === 'addExisting'){
		//console.log('added to set: ' + edit.id);
		if(this.getEditingId() !== syncId){
			var arr = this.obj//[edit.type];
			//if(arr === undefined) arr = this.obj[edit.type] = [];
			arr.push(edit.id);
			return this.refresh();
		}
	}/*else if(op === 'add'){
		var arr = this.obj
		if(arr === undefined) arr = this.obj = [];
		arr.push(edit.value);
		return this.refresh();
	}*/else if(op === 'addNewInternal'){
		if(this.getEditingId() !== syncId){
			var arr = this.obj
			if(arr === undefined) arr = this.obj = [];
			arr.push(edit.obj.object);
			return this.refresh();
		}else{
			u.reifyTemporary(this.obj, edit.temporary, edit.id, this);
		}
	}else{
		_.errout('@TODO implement op: ' + op + ' ' + JSON.stringify(edit));
	}
}

function convertToJson(type, obj, objSchema, local){
	_.errout('TODO');
	
}

ObjectSetHandle.prototype.toJson = function(){
	
	if(this.schema.type.members.type === 'primitive'){
		if(this.obj !== undefined){
			return [].concat(this.obj);
		}else{
			return [];
		}
	}else{
		var result = [];
		var local = this;
		var fullSchema = local.getFullSchema();
		var arr = this.obj;
		for(var i=0;i<arr.length;++i){
			var objOrId = arr[i];
			if(_.isInteger(objOrId)){
				var a = getObject(local, objOrId);
				result.push(a.toJson());
			}else{
				_.errout('TODO');
			}
		}

		return result;
	}	
}

ObjectSetHandle.prototype.types = u.genericCollectionTypes



ObjectSetHandle.prototype.add = function(objHandle){
	_.assertObject(objHandle)
	
	var id = objHandle.id();
	
	var ee = {id: id}
	
	this.saveEdit('addExisting', ee);
	
	this.obj.push(id);

	this.refresh()();
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
	
	var temporaryId = u.makeTemporaryId();
	
	var obj = jsonutil.convertJsonToObject(this.getFullSchema(), type.name, json);
	
	obj.meta = {typeCode: type.code, id: temporaryId, editId: -10}
	
	var ee = {temporary: temporaryId, newType: type.code, obj: {type: type.code, object: obj}};
	
	this.saveEdit('addNewInternal',	ee);
	
	if(this.obj === undefined) this.obj = [];

	//var newObj = {meta: {id: temporaryId, typeCode: type.code}}
	this.obj.push(obj);

	//_.extend(obj, json)
		
	this.refresh()();
	//console.log('finished refresh after addNew');
	
	return this.wrapObject(obj, [], this)
}


