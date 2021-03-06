"use strict";

var _ = require('underscorem')
var u = require('./util')
var seedrandom = require('seedrandom')

var api = require('./../sync_api')

var lookup = require('./../lookup')
var editCodes = lookup.codes
var editNames = lookup.names

function MapHandle(typeSchema, obj, part, parent){
	this.part = part;
	this.obj = obj || {};
	this.parent = parent;
	this.schema = typeSchema;
	this.typeSchema = typeSchema
	
	this.log = this.parent.log

	this.keyOp = u.getKeyOperator(this.schema)
	//this.keyReOp = u.getKeyReOperator(this.schema)
	this.checkKeyType = u.makeKeyTypeChecker(this.schema)
	
	if(this.schema.type.value.type === 'primitive'){
		this.putOp = u.getPutOperator(this.schema)
	}

	if(this.isView()){
		this.put = u.viewReadonlyFunction
		this.del = u.viewReadonlyFunction
		this.putNew = u.viewReadonlyFunction
	}
	
	if(typeSchema.type.value.primitive === 'boolean'){//TODO properly speciate api class
		this.toggle = function(key){
			this.put(key, !this.value(key))
		}
		this.toggle = this.toggle.bind(this)
	}
	
}

MapHandle.prototype.getName = function(){return this.typeSchema.name;}

MapHandle.prototype.types = function(){
	var fullSchema = this.getFullSchema();
	var objectSchema = fullSchema[this.schema.type.value.object];
	return u.recursivelyGetLeafTypes(objectSchema, fullSchema);
}

MapHandle.prototype.getImmediateProperty = u.immediatePropertyFunction;

MapHandle.prototype.keys = function(){
	if(this.obj === undefined) return [];
	return Object.keys(this.obj);
}

MapHandle.prototype.each = function(cb){
	var local = this;
	if(this.schema.type.value.type === 'primitive'){
		if(this.schema.type.key.type === 'primitive'){
			Object.keys(this.obj).forEach(function(key){
				var value = local.obj[key];
				cb(key, value);
			})
		}else{
			if(this.schema.type.key.type === 'object'){
				Object.keys(this.obj).forEach(function(key){
					//key = parseInt(key)
					var value = local.obj[key];
					var wrappedKey = local.getObjectApi(key);
					wrappedKey.prepare()
					cb(wrappedKey, value);
				})
			}else{
				_.errout('TODO: ' + JSON.stringify(this.schema.type.key))
			}
		}
	}else if(this.schema.type.value.type === 'set'){
		if(this.schema.type.value.members.type === 'primitive'){
			Object.keys(this.obj).forEach(function(key){
				var value = local.obj[key];
				for(var i=0;i<value.length;++i){
					cb(key, value[i]);
				}
			})
		}else if(this.schema.type.value.members.type === 'object'){
			Object.keys(this.obj).forEach(function(key){
				var value = local.obj[key];

				for(var i=0;i<value.length;++i){
					var id = value[i]
					_.assertString(id)
					var a = local.getObjectApi(id);
					if(a === undefined) _.errout('map object value not found: ' + id)
					a.prepare()
					cb(key, a);
				}
			})
		}else{
			_.errout('TODO: ' + JSON.stringify(local.schema));
		}
	}else{
		if(this.schema.type.key.type === 'object'){
			Object.keys(this.obj).forEach(function(key){
				var idOrValue = local.obj[key];
				
				var k = local.getObjectApi(key);
				k.prepare()

				_.assertDefined(idOrValue)
				if(typeof(idOrValue) === 'number'){
					var a = local.apiCache[idOrValue];
					if(a === undefined) a = local.getObjectApi(idOrValue);
					cb(k, a);
				}else{
					cb(k, idOrValue)
				}
			})
		}else if(this.schema.type.value.type === 'object'){
			Object.keys(this.obj).forEach(function(key){
				var idOrValue = local.obj[key];
				//console.log(key + ' ' + JSON.stringify(Object.keys(local.obj)))
				_.assertDefined(idOrValue)
				if(typeof(idOrValue) === 'number'){
					var a = local.apiCache[idOrValue];
					if(a === undefined) a = local.getObjectApi(id);
					a.prepare()
					cb(key, a);
				}else{
					//_.errout('TODO: ' + JSON.stringify(local.schema));
					idOrValue.prepare()
					cb(key, idOrValue)
				}
			})
		}else{
			Object.keys(this.obj).forEach(function(key){
				var idOrValue = local.obj[key];
				//console.log(key + ' ' + JSON.stringify(Object.keys(local.obj)))
				_.assertDefined(idOrValue)
				if(typeof(idOrValue) === 'number'){
					var a = local.apiCache[idOrValue];
					if(a === undefined) a = local.getObjectApi(id);
					cb(key, a);
				}else{
					//_.errout('TODO: ' + JSON.stringify(local.schema));
					cb(key, idOrValue)
				}
			})
		}		
	}
}

MapHandle.prototype.adjustPathLocal = function adjustMapPath(key){

	_.assertDefined(key)

	
	this.adjustTopObjectToOwn()
	this.adjustCurrentObject(this.getImmediateObject())
	this.adjustCurrentProperty(this.part)
	this.adjustCurrentKey(key, this.keyOp)
}
MapHandle.prototype.del = function(key){

	if(key._internalId){
		key = key._internalId()
	}
	
	this.adjustPathLocal(key)
	var e = {key: key};
	this.persistEdit(editCodes.delKey, {})
	delete this.obj[key]
		
	this.emit(e, 'del', key)//()
}

MapHandle.prototype.put = function(newKeyObj, newValue){
	
	var newKey
	if(newKeyObj._internalId){
		newKey = newKeyObj._internalId()
		//_.assert(newKey !== -1)
	}else{
		newKey = newKeyObj
	}
	
	_.assertPrimitive(newKey)

	this.checkKeyType(newKey)

	if(this.obj[newKey] === newValue) return


	//if(this.schema.type.key.type === 'object'){
	//	_.assert(newKey !== -1)
	//}
	
	this.adjustPathLocal(newKey)
	
	if(this.schema.type.value.type === 'object'){
		//_.errout('cannot put - values are not primitive (TODO support putting objects)');
		_.assertString(newValue.objectId)
		
		var e = {id: newValue.objectId};
		this.persistEdit(editCodes.putExisting, e)
		this.obj[newKey] = newValue
		
	}else{
		var e = {value: newValue}
		this.persistEdit(this.putOp, e)
		this.obj[newKey] = newValue
	}		
	this.emit(e, 'put', newKeyObj, newValue)
}

MapHandle.prototype._rewriteObjectApiCache = function(oldKey, newKey){
	
}

MapHandle.prototype.putNew = function(newKey, newTypeName, json){
	if(this.schema.type.value.type !== 'object') _.errout('cannot putNew - values are not objects');

	if(arguments.length === 2){
		if(_.isObject(newTypeName)){
			json = newTypeName
			newTypeName = undefined
		}
	}
	json = json || {}
	
	var type = u.getOnlyPossibleType(this, newTypeName);
	
	this.adjustPathLocal(newKey)
	//var temporary = this.makeTemporaryId()
	var id = seedrandom.uid()
	var e = {typeCode: type.code, id: id};
	this.persistEdit(editCodes.didPutNew, e)

	var n = this._makeAndSaveNew(json, type, id)
	this.obj[newKey] = n
	
	//n.prepare()
		
	this.emit(e, 'put', newKey, n)
	return n
}

MapHandle.prototype.has = function(desiredKey){
	_.assertLength(arguments, 1);
	if(this.obj === undefined) return false;
	return this.obj[desiredKey] !== undefined;
}
/*
MapHandle.prototype.values = function(){
	_.assertLength(arguments, 0)
	var keys = Object.keys(this.obj)
	var values = []
	for(var i=0;i<keys.length;++i){
		var k = keys[i]
		var v = this.obj[k]
		if(values.indexOf(v) === -1){
			values.push(v)
		}
	}
	return values
}*/

MapHandle.prototype.getObjectValue = function(id){
	_.assert(this.schema.type.value.type === 'object')
	var keys = Object.keys(this.obj)
	for(var i=0;i<keys.length;++i){
		var key = keys[i]
		var value = this.obj[key]
		if(value.objectId === id){
			return value
		}
	}
}
MapHandle.prototype.get = function(desiredKey){
	_.assertLength(arguments, 1);
	
	if(this.obj === undefined) return;

	if(desiredKey._internalId){
		desiredKey = desiredKey._internalId()
	}

	var idOrValue = this.obj[desiredKey];
	if(idOrValue === undefined) return;
	
	if(this.schema.type.value.type === 'object'){
		if(_.isInteger(idOrValue)){
			var a = this.getObjectApi(idOrValue, this);
			a.prepare()
			return a;
		}else{
			idOrValue.prepare()
			return idOrValue
		}
	}else if(this.schema.type.value.type === 'view'){
		idOrValue.prepare()
		return idOrValue
	}else if(this.schema.type.value.type === 'primitive' || this.schema.type.value.type === 'set'){
		
		if(!this.valueCache){
			this.valueCache = {}
		}
		var n = this.valueCache[desiredKey]
		if(n){
			return n
		}
		
		var c = api.getClassForType(this.schema.type.value, this.schema.isView);
		var n = new c(undefined, idOrValue, desiredKey, this, this.schema.isView);
		n.prepare()
		this.valueCache[desiredKey] = n
		return n
	}else{
		_.errout('TODO: ' + JSON.stringify(this.schema));
	}
}
MapHandle.prototype.value = function(desiredKey){
	_.assertLength(arguments, 1);

	if(this.obj === undefined) return;

	if(desiredKey._internalId){
		desiredKey = desiredKey._internalId()
	}
	
	var idOrValue = this.obj[desiredKey];
	if(idOrValue === undefined) return;
	
	var local = this
	
	if(this.schema.type.value.type === 'object'){
		//var a = this.apiCache[idOrValue];
		if(_.isInteger(idOrValue)){
			var a = this.getObjectApi(idOrValue, this);
			return a;
		}else{
			_.assertDefined(idOrValue)
			var a = this.wrapObject(idOrValue, [], this);
			return a;
		}
	}else if(this.schema.type.value.type === 'primitive'){
		//TODO should provide a handler with operations like 'set'
		return idOrValue;
	}else if(this.schema.type.value.type === 'set'){
		if(this.schema.type.value.members.type === 'primitive'){
			return idOrValue
		}else{
			//_.errout('TODO: ' + JSON.stringify(this.schema));
			var result = []
			_.each(idOrValue, function(id){
				var a = local.getObjectApi(id, local)
				result.push(a)
			})
			return result
		}
	}else{
		_.errout('TODO: ' + JSON.stringify(this.schema));
	}
}
MapHandle.prototype.size = function(){
	return Object.keys(this.obj).length;
}
MapHandle.prototype.count = MapHandle.prototype.size

MapHandle.prototype.clear = function(){
	this.parent.clearProperty(this.schema.name)
}

MapHandle.prototype.toJson = function(){
	var result = {};
	if(this.schema.type.value.type === 'primitive'){
		result = JSON.parse(JSON.stringify(this.obj));
	}else if(this.schema.type.value.type === 'set'){
		if(this.schema.type.value.members.type === 'primitive'){
			this.each(function(key, value){
				if(key.id){
					key = key._internalId()//id()
				}
				if(result[key] === undefined) result[key] = []
				result[key].push(value);
			});
		}else{
			this.each(function(key, value){
				if(key.id){
					key = key._internalId()
				}
				if(result[key] === undefined) result[key] = []
				result[key].push(value.toJson());
			});
		}
	}else{
		this.each(function(key, value){
			if(key.id){
				key = key._internalId()
			}
			//console.log(key + '->'+value)
			result[key] = value.toJson();
		});
	}
	return result;
}
var stub = function(){}
MapHandle.prototype.changeListener = function(subObj, key, op, edit, syncId, editId){

	//console.log('changeListener: ' + JSON.stringify([op, edit, syncId]))

	/*if(syncId === this.getEditingId()){
		return stub;//TODO deal with local/global priority
	}*/

	if(op === editCodes.putAddExisting){
		//_.errout('TODO')
		if(this.obj[key] === undefined) this.obj[key] = []
		var arr = this.obj[key]
		if(arr.indexOf(edit.id) === -1){//TODO ensure this never happens
			arr.push(edit.id)
			
			var res = this.getObjectApi(edit.id);
			
			if(this.valueCache && this.valueCache[key]){
				this.valueCache[key]._forceAdd(res, editId)
			}
			
			//console.log('put-added: ' + key + ' -> ' + edit.id)
			//console.log('now: ' + JSON.stringify(Object.keys(this.obj)))
			//if(key === '645_90') console.log('now-values: ' + JSON.stringify(this.obj))
			this.emit(edit, 'put-add', key, res, editId)
		}//else{
		//	console.log('already got: ' + key)
		//}
	}else if(lookup.isPutAddCode[op]){//op.indexOf('putAdd') === 0){
		_.assertDefined(key)
		if(this.obj[key] === undefined) this.obj[key] = []
		this.obj[key].push(edit.value)
		//this.log('key: ' + key)
		//console.log('PUT ADD')
		return this.emit(edit, 'put-add', key, edit.value, editId)
	}else if(op === editCodes.putRemoveExisting){
		_.assertDefined(key)
		var list = this.obj[key]
		if(list){
			list.splice(list.indexOf(edit.id), 1)//.push(edit.value)
			//this.log('key: ' + key)
			console.log('put-removed-existing: ' + edit.id)
			//console.log(JSON.stringify(this.obj))
			if(this.valueCache && this.valueCache[key]){
				this.valueCache[key]._forceRemove(edit.id, editId)
			}
			if(list.length === 0){
				delete this.obj[key]
				this.emit(edit, 'del', key, editId)
			}
			this.emit(edit, 'put-remove', key, edit.id, editId)
		}
	}else if(lookup.isPutRemoveCode[op]){//op.indexOf('putRemove') === 0){
		_.assertDefined(key)
		//if(this.obj[key] === undefined) this.obj[key] = []
		var list = this.obj[key]
		if(list){
			list.splice(list.indexOf(edit.value), 1)//.push(edit.value)
			//this.log('key: ' + key)
			//console.log('put-removed: ' + edit.value)
			//console.log(JSON.stringify(this.obj))
			if(list.length === 0){
				delete this.obj[key]
			}
			return this.emit(edit, 'put-remove', key, edit.value, editId)
			if(list.length === 0){
				this.emit(edit, 'del', key, editId)
			}
		}
	}else if(op === editCodes.didPutNew){
		/*this.obj[key] = edit.value;
		this.log('key: ' + key)
		return this.emit(edit, 'put')*/
		//_.errout('TODO')
		var id = edit.id//edit.obj.object.meta.id
		//var temporary = edit.temporary
		if(this.getEditingId() === syncId){
			var objHandle = this.get(key);
			if(objHandle === undefined){
				this.log('warning: object not found in list: ' + temporary + ', might ok if it has been replaced')
				return;
			}
			objHandle.reify(id)
			return
		}else{
			_.assertString(id)

			var res = this.wrapObject(id, edit.typeCode, [id], this)
			var old = this.obj[key]
			this.obj[key] = res
			res.prepare()
			return this.emit(edit, 'put', key, res, old, editId)
		}
	}else if(op === editCodes.putViewObject){
		var id = edit.id
		_.assertString(id)
		_.assertDefined(key)

		var res = this.getObjectApi(id);
		if(!res){
			_.errout('putViewObject with unknown viewObject: ' + id)
		}
		var old = this.obj[key]
		this.obj[key] = res
		res.prepare()
		return this.emit(edit, 'put', key, res, old, editId)
		
	}else if(op === editCodes.putExisting){
		var old = this.obj[key]
		//console.log(op + ' ' + this.keyOp + ' ' + edit.id)
	//	_.assertDefined(edit.value)
		var value = this.obj[key] = this.getObjectApi(edit.id);
		_.assertDefined(value)
		//this.log('key: ' + key)
		if(this.keyOp === editCodes.selectObjectKey){
			var wrappedKey = this.getObjectApi(key);
			wrappedKey.prepare()
			return this.emit(edit, 'put', wrappedKey, value, old, editId)
		}else{
			return this.emit(edit, 'put', key, value, old, editId)
		}
	}else if(lookup.isPutCode[op]){//op.indexOf('put') === 0){
		var old = this.obj[key]
		//console.log(op + ' ' + this.keyOp)
		_.assertDefined(edit.value)
		this.obj[key] = edit.value;
		//this.log('key: ' + key)
		if(this.keyOp === editCodes.selectObjectKey){
			//console.log('key: ' + key)
			var wrappedKey = this.getObjectApi(key);
			_.assertObject(wrappedKey)
			wrappedKey.prepare()
			return this.emit(edit, 'put', wrappedKey, edit.value, old, editId)
		}else{
			return this.emit(edit, 'put', key, edit.value, old, editId)
		}
	}else if(op === editCodes.delKey){
		//console.log('deleted key: ' + key)		
		delete this.obj[key]
		
		if(this.valueCache && this.valueCache[key]){
			delete this.valueCache[key]
		}
		//console.log('now: ' + JSON.stringify(Object.keys(this.obj)))
		return this.emit(edit, 'del', editId)
	}else{
		_.errout('-TODO implement op: ' + JSON.stringify(edit));
	}
	//_.errout('-TODO implement op ' + editNames[op] + ': ' + JSON.stringify(edit));
}
/*
MapHandle.prototype.changeListenerElevated = function(key, op, edit, syncId, editId){
	_.assertInt(editId)
	
	if(syncId === this.getEditingId()){
		return stub;//TODO deal with local/global priority
	}
	
	//console.log('elevated: ' + JSON.stringify([key, op, edit, syncId, editId]))

	
}*/

module.exports = MapHandle
