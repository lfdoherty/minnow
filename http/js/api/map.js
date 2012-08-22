
var _ = require('underscorem')
var u = require('./util')

var api = require('./../sync_api')


function MapHandle(typeSchema, obj, part, parent){
	this.part = part;
	this.obj = obj || {};
	this.parent = parent;
	this.schema = typeSchema;
	
	this.log = this.parent.log

	this.keyOp = u.getKeyOperator(this.schema)
	
	if(this.schema.type.value.type === 'primitive'){
		this.putOp = u.getPutOperator(this.schema)
	}
}

MapHandle.prototype.types = function(){
	var fullSchema = this.getFullSchema();
	var objectSchema = fullSchema[this.schema.type.value.object];
	return u.recursivelyGetLeafTypes(objectSchema, fullSchema);
}

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
					key = parseInt(key)
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
					_.assertInt(id)
					var a
					if(a === undefined) a = local.getObjectApi(id);
					a.prepare()
					cb(key, a);
				}
			})
		}else{
			_.errout('TODO: ' + JSON.stringify(local.schema));
		}
	}else{
		Object.keys(this.obj).forEach(function(key){
			var idOrValue = local.obj[key];
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

MapHandle.prototype.adjustPath = function adjustMapPath(key){
	this.log('adjust map path ' + key)
	console.log('adjust map path ' + key)
	_.assertDefined(key)
	var remainingCurrentPath = this.parent.adjustPath(this.part)
	if(remainingCurrentPath.length === 0){
		this.log('zero')
		console.log('zero')
		this.persistEdit(this.keyOp, {key: key})
		return []
	}else if(remainingCurrentPath[0] !== key){
		this.log('different')
		console.log('different')
		if(remainingCurrentPath.length > 1){
			if(remainingCurrentPath.length < 6){
				this.log('primitive ascending ' + remainingCurrentPath[0])
				this.persistEdit('ascend'+(remainingCurrentPath.length-1), {})
			}else{
				this.persistEdit('ascend', {many: remainingCurrentPath.length-1})
			}
		}else{
			this.log('reselecting')
			console.log('reselecting')
		}
		this.persistEdit('re'+this.keyOp, {key: key})
		return []
	}else{
		this.log('same')
		return remainingCurrentPath.slice(1)
	}
}
MapHandle.prototype.del = function(key){

	this.adjustPath(key)
	var e = {key: key};
	this.persistEdit('del', {})
	delete this.obj[key]
		
	this.emit(e, 'del', key)()
}

MapHandle.prototype.put = function(newKey, newValue){
	if(this.schema.type.value.type === 'object') _.errout('cannot put - values are not primitive (TODO support putting objects)');


	this.adjustPath(newKey)
	var e = {value: newValue, key: newKey};
	this.persistEdit(this.putOp, e)
	this.obj[newKey] = newValue
		
	this.emit(e, 'put', newKey, newValue)()
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
	
	this.adjustPath(newKey)
	var e = {typeCode: type.code};
	this.persistEdit('putNew', e)

	var n = this._makeAndSaveNew(json, type)
	this.obj[newKey] = n
		
	this.emit(e, 'put', newKey, n)()
}

MapHandle.prototype.has = function(desiredKey){
	_.assertLength(arguments, 1);
	if(this.obj === undefined) return false;
	return this.obj[desiredKey] !== undefined;
}

MapHandle.prototype.get = function(desiredKey){
	_.assertLength(arguments, 1);
	
	if(this.obj === undefined) return;

	var idOrValue = this.obj[desiredKey];
	if(idOrValue === undefined) return;
	
	if(this.schema.type.value.type === 'object'){
		if(_.isInteger(idOrValue)){
			var a = this.getObjectApi(idOrValue, this);
			return a;
		}else{
			//_.assertDefined(idOrValue)
			//var a = this.wrapObject(idOrValue, [], this);
			//return a;
			idOrValue.prepare()
			return idOrValue
		}
	}else if(this.schema.type.value.type === 'primitive'){
		//TODO should provide a handler with operations like 'set'
		//return idOrValue;

		var c = api.getClassForType(this.schema.type.value, this.schema.isView);
		n = new c(undefined, idOrValue, desiredKey, this, this.schema.isView);
		n.prepare()
		return n
	}else{
		_.errout('TODO: ' + JSON.stringify(this.schema));
	}
}
MapHandle.prototype.value = function(desiredKey){
	_.assertLength(arguments, 1);

	if(this.obj === undefined) return;

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

MapHandle.prototype.toJson = function(){
	var result = {};
	if(this.schema.type.value.type === 'primitive'){
		result = JSON.parse(JSON.stringify(this.obj));
	}else if(this.schema.type.value.type === 'set'){
		if(this.schema.type.value.members.type === 'primitive'){
			this.each(function(key, value){
				if(result[key] === undefined) result[key] = []
				result[key].push(value);
			});
		}else{
			this.each(function(key, value){
				if(result[key] === undefined) result[key] = []
				result[key].push(value.toJson());
			});
		}
	}else{
		this.each(function(key, value){
			result[key] = value.toJson();
		});
	}
	return result;
}
var stub = function(){}
MapHandle.prototype.changeListener = function(op, edit, syncId){

	if(syncId === this.getEditingId()){
		return stub;//TODO deal with local/global priority
	}

	_.errout('-TODO implement op: ' + JSON.stringify(edit));
}
MapHandle.prototype.changeListenerElevated = function(key, op, edit, syncId){

	if(syncId === this.getEditingId()){
		return stub;//TODO deal with local/global priority
	}

	if(op.indexOf('putAddExisting') === 0){
		//_.errout('TODO')
		if(this.obj[key] === undefined) this.obj[key] = []
		this.obj[key].push(edit.id)
		return this.emit(edit, 'putAdd')
	}else if(op.indexOf('putAdd') === 0){
		if(this.obj[key] === undefined) this.obj[key] = []
		this.obj[key].push(edit.value)
		this.log('key: ' + key)
		return this.emit(edit, 'put')
	}else if(op === 'didPutNew'){
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
			_.assertInt(id)

			var res = this.wrapObject(id, edit.typeCode, [key], this)
			this.obj[key] = res
			res.prepare()
			return this.emit(edit, 'put')
		}
	}else if(op.indexOf('put') === 0){
		this.obj[key] = edit.value;
		this.log('key: ' + key)
		return this.emit(edit, 'put')
	}else if(op === 'del'){
		delete this.obj[key]
		return this.emit(edit, 'del')
	}else{
		_.errout('-TODO implement op: ' + JSON.stringify(edit));
	}
}

module.exports = MapHandle
