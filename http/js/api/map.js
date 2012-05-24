
var _ = require('underscorem')

function MapHandle(typeSchema, obj, part, parent){
	this.part = part;
	this.obj = obj || {};
	this.parent = parent;
	this.schema = typeSchema;
}

MapHandle.prototype.types = function(){
	var fullSchema = this.getFullSchema();
	var objectSchema = fullSchema[this.schema.type.value.object];
	return recursivelyGetLeafTypes(objectSchema, fullSchema);
}

MapHandle.prototype.keys = function(){
	if(this.obj === undefined) return [];
	return Object.keys(this.obj);
}

MapHandle.prototype.each = function(cb){
	if(this.schema.type.value.type === 'primitive'){
		var local = this;
		Object.keys(this.obj).forEach(function(key){
			var value = local.obj[key];
			cb(key, value);
		})
	}else{
		var local = this;
		Object.keys(this.obj).forEach(function(key){
			var idOrValue = local.obj[key];
			if(typeof(idOrValue) === 'number'){
				var a = this.apiCache[idOrValue];
				if(a === undefined) a = this.getObjectApi(id);
				cb(key, a);
			}else{
				_.errout('TODO');
			}
		})
		
	}
}

MapHandle.prototype.putNew = function(newKey, newTypeName, external){
	if(this.schema.type.value.type !== 'object') _.errout('cannot putNew - values are not objects');

	var type = getOnlyPossibleType(this, newTypeName);
	
	var temporaryId = u.makeTemporaryId();
	
	var e = {newType: type.code, key: newKey, external: external, temporary: temporaryId};
	this.getSh().persistEdit(
		this.getObjectId(), 
		this.getPath(),
		'putNew',
		e,
		this.getEditingId());

	//if(this.obj === undefined) this.obj = {};
	
	if(external){
		this.createNewExternalObject(type.code, temporaryId);
		this.obj[newKey] = temporaryId//.push(temporaryId);
	}else{
		console.log('not external')
		this.obj[newKey] = {meta: {id: temporaryId, typeCode: type.code}};
	}
		
	this.refresh()();
	//console.log('finished refresh after addNew');

	var res = this.getObjectApi(temporaryId, this);
	res.prepare();
	return res;	
	
}
MapHandle.prototype.has = function(desiredKey){
	_.assertLength(arguments, 1);
	if(this.obj === undefined) return false;
	return this.obj[desiredKey] !== undefined;
}

MapHandle.prototype.value = function(desiredKey){
	_.assertLength(arguments, 1);

	if(this.obj === undefined) return;

	var idOrValue = this.obj[desiredKey];
	if(idOrValue === undefined) return;
	
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
		return idOrValue;
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
	}else{
		this.each(function(key, value){
			result[key] = value.toJson();
		});
	}
	return result;
}
MapHandle.prototype.changeListener = function(path, op, edit, syncId){

	if(syncId === this.getEditingId()){
		return stub;//TODO deal with local/global priority
	}

	if(op === 'put'){
		this.obj[edit.key] = edit.value;
	}else{
		_.errout('-TODO implement op: ' + JSON.stringify(edit));
	}

	return this.refresh();
}
module.exports = MapHandle
