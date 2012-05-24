
var u = require('./util')
var _ = require('underscorem')

var api = require('./../sync_api')
function ObjectHandle(typeSchema, obj, objId, part, parent, isReadonlyIfEmpty){
	//_.assertLength(arguments, 5);
	_.assertArray(part);
	_.assertObject(parent);
	_.assert(_.isInteger(objId) || _.isString(objId));
	//_.assertObject(obj);
	
	_.assertDefined(typeSchema)
	_.assertDefined(typeSchema.properties);
	
	_.assertNot(_.isArray(obj));
	
	if(!typeSchema.isView){
		_.assertInt(objId);
	}
	
	//this.schema = schema;
	this.part = part;
	this.typeSchema = typeSchema;
	this.obj = obj;
	this.parent = parent;
	
	this.objectId = objId;
	this.cachedProperties = {};
	
	//console.log('making object');
	//console.log(new Error().stack);
	//console.log(JSON.stringify(obj));
	if(isReadonlyIfEmpty && obj === undefined){
		this.isReadonlyAndEmpty = true;
		//console.log('isReadonlyAndEmpty *************************************');
		//this.prepare = emptyReadonlyObject
		this.property = emptyReadonlyObject
		this.setProperty = emptyReadonlyObject
		this.add = emptyReadonlyObject
	}else{
		console.log('not readonlyandempty')
	}
}

function emptyReadonlyObject(){
	_.errout('object is empty and readonly');
}

function emptyReadonlyObjectProperty(){
	_.errout('this object is undefined, you cannot modify its properties');
}


ObjectHandle.prototype.prepare = function(){
	if(this.prepared) return;
	this.prepared = true;
	var s = this;
	_.each(this.typeSchema.properties, function(p, name){
		if(p.type.type !== 'object' || s.hasProperty(name)){
			if(s.isReadonlyAndEmpty){
				s.__defineGetter__(name, emptyReadonlyObjectProperty);
			}else{
				var v = s.property(name);
				s[name] = v;
				v.prepare();
			}
		}
	});
}

function getProperties(){
	var local = this;
	var properties = [];
	_.each(this.typeSchema.properties, function(p, name){
		if(local.hasProperty(name)){
			properties.push(name);
		}
	});
	return properties;
}

function getBaseType(objSchema){
	while(objSchema.superType){
		objSchema = objSchema.superType;
	}
	return objSchema;
}

function getTypeAndSubtypeCodes(schema, name){
	var objSchema = schema[name];
	var res = [objSchema.code];
	_.each(objType.subTypes, function(v, subType){
		res = res.concat(getTypeAndSubtypeCodes(schema, subType));
	});
	return res;
}

function recursivelyGetLeafTypes(objType, schema){
	if(_.size(objType.subTypes) === 0){
		return [objType.name];
	}
	
	var res = [];
	//if(!objType.superTypes.abstract) res.push(objType.name)
	_.each(objType.subTypes, function(v, subType){
		res = res.concat(recursivelyGetLeafTypes(schema[subType], schema));
	});
	return res;
}
ObjectHandle.prototype.getPath = function(){
	//console.log('adding part: ' + this.part + ' and id ' + this.objectId + ', parent: ' + JSON.stringify(this.parent.getPath()));
	var res = this.parent.getPath().concat(this.part);
	//res = res.concat([this.typeSchema.code]);
	if(this.objectId !== -1){
		res = res.concat([this.objectId]);
		console.log('appended own id: ' + this.objectId);
	}
	console.log('object returned path: ' + JSON.stringify(res));
	return res;
}
ObjectHandle.prototype._typeCode = function(){return this.typeSchema.code;}
ObjectHandle.prototype.type = function(){return this.typeSchema.name;}
ObjectHandle.prototype.id = function(){
	_.assertPrimitive(this.objectId);
	_.assertDefined(this.objectId);
	return this.objectId;
}
ObjectHandle.prototype.propertyIsPrimitive = function(propertyName){
	var pt = this.typeSchema.properties[propertyName];
	return pt.type.type === 'primitive';
}
ObjectHandle.prototype.propertyTypes = function(propertyName){
	var pt = this.typeSchema.properties[propertyName];
	console.log(JSON.stringify(pt));
	
	if(pt.type.type === 'set'){
		if(pt.type.members.type === 'object'){
			var objectName = pt.type.members.object;
			return recursivelyGetLeafTypes(this.schema[objectName], this.schema);
		}else{
			_.errout('TODO: ' + pt.type.members.type);
		}
	}else{
		_.errout('TODO: ' + JSON.stringify(pt));
	}
}
ObjectHandle.prototype.properties = getProperties;

ObjectHandle.prototype.changeListener = function(path, op, edit, syncId){
	console.log(JSON.stringify(path) + ' ' + this.typeSchema.name);
	var ps = this.typeSchema.propertiesByCode[path[0]];
	_.assertObject(ps);
	
	if(op === 'setObject'){
		setPropertyValue(this.obj, path[0], edit.value);
		return this.refresh(edit);
	}else{
		var ap = this.property(ps.name);
		var res;
		_.assertObject(ap);
		if(ps.type.type === 'object'){
			res = ap.changeListener(path.slice(2), op, edit, syncId);
		}else{
			res = ap.changeListener(path.slice(1), op, edit, syncId);
		}
		_.assertFunction(res);
		return res;
	}	
}

ObjectHandle.prototype.setPropertyToNew = function(propertyName, newType, external){
	var pt = this.typeSchema.properties[propertyName];
	_.assertDefined(pt);
	_.assert(pt.type.type === 'object');
	
	_.assert(arguments.length >= 2)
	_.assert(arguments.length <= 3)
	
	if(_.isBoolean(newType) && arguments.length === 2){
		external = newType;
		newType = undefined;
	}

	var fullSchema = this.getFullSchema();
	var objectSchema = fullSchema[pt.type.object];

	var types = recursivelyGetLeafTypes(objectSchema, fullSchema);
	if(newType === undefined){
		_.assertLength(types, 1);
		newType = types[0];
	}else{
		_.assertIn(types, newType);
	}
	objectSchema = fullSchema[newType];

	var res;	
	var temporary = u.makeTemporaryId();
	var newObj;
	if(external){
		console.log('created new external object')
		newObj = this.createNewExternalObject(objectSchema.code, temporary);
		res = this.getObjectApi(temporary, this)	
		this.obj[pt.code] = temporary;
	}else{
		newObj = this.obj[pt.code] = {meta: {id: temporary, typeCode: objectSchema.code}};
	}
	
	if(this.typeSchema.isView){
		_.assert(external)

		this.getSh().persistEdit(
			-1, 
			[], 
			'make',
			{obj: {type: objectSchema.code, object: newObj}, temporary: temporary},
			this.getEditingId());

		//a = this.getObjectApi(id, local);
		//local.addToApiCache(temporary, a);
		
	}else{
		this.getSh().persistEdit(
			this.getObjectId(), 
			this.getPath().concat([pt.code]), 
			'setToNew',
			{newType: objectSchema.code, temporary: temporary, external: !!external},
			this.getEditingId());
	}	

	delete this.cachedProperties[propertyName]
	this[propertyName] = this.property(propertyName);

	return this[propertyName];
}

ObjectHandle.prototype.setProperty = function(propertyName, newValue, newType){

	var pt = this.typeSchema.properties[propertyName];
	_.assertDefined(pt);
	
	
	if(pt.type.type === 'object'){
	
		_.assertInt(newValue);

		var fullSchema = this.getFullSchema();
		var objectSchema = fullSchema[pt.type.object];
		var types = recursivelyGetLeafTypes(objectSchema, fullSchema);
		if(newType === undefined){
			_.assertLength(types, 1);
			newType = types[0];
		}else{
			_.assertIn(types, newType);
		}
		objectSchema = fullSchema[newType];
		
		var n = this.getObjectApi(objectSchema.code, newValue);

		this.cachedProperties[propertyName] = n;
		
		this.getSh().persistEdit(
			this.getObjectId(), 
			this.getPath().concat([pt.code]), 
			'setObject',
			{value: newValue, type: objectSchema.code},
			this.getEditingId());
			
	}else{
		_.errout('TODO: ' + pt.type.type);
	}
}



ObjectHandle.prototype.hasProperty = function(propertyName){
	if(this.obj === undefined) return false;
	var pt = this.typeSchema.properties[propertyName];
	if(pt === undefined) _.errout('not a valid property(' + propertyName + ') for this type: ' + this.typeSchema.code)
	_.assertDefined(pt);
	if(pt.type.type === 'object' && pt.tags['always_local']) return true;
	var pv = this.obj[pt.code]//getPropertyValue(this.obj, pt.code);
	return pv !== undefined;
}
ObjectHandle.prototype.has = ObjectHandle.prototype.hasProperty

//TODO invert this per-property for performance and readability improvement
ObjectHandle.prototype.property = function property(propertyName){
	var n = this.cachedProperties[propertyName];
	if(n === undefined){
		//console.log('initializing property: ' + propertyName);
		//console.log('type schema: ' + JSON.stringify(this.typeSchema));
		var pt = this.typeSchema.properties[propertyName];
		//_.assertDefined(pt);
		if(pt === undefined) _.errout('property ' + this.typeSchema.name + '.' + propertyName + ' not recognized');
		_.assertObject(this.obj);
		var pv = this.obj[pt.code]//getPropertyValue(this.obj, pt.code);
		if(pt.type.type === 'object'){
			var fullSchema = this.getFullSchema();
			if(pv === undefined){
				if(pt.tags.must_already_exist){
					_.errout('cannot create local object due to must_already_exist constraint in schema - must specify property value to a object reference via setProperty');
				}
				
				var objSchema = fullSchema[pt.type.object];
				var types = recursivelyGetLeafTypes(objSchema, fullSchema);
				if(types.length > 1){
					_.errout('need to specify object type - use setPropertyType');
				}else{
					n = new ObjectHandle(fullSchema[types[0]], undefined, -1, [pt.code], this, true);
				}
			}else{
				if(pt.tags && pt.tags.lazy){
					var objSchema = fullSchema._byCode[pv.meta.typeCode];
					n = new ObjectHandle(objSchema, pv, -1, [pt.code], this);
				}else{
					if(_.isInteger(pv) || _.isString(pv)){
						n = this.getObjectApi(pv, this);
					}else{				
						var objSchema = fullSchema._byCode[pv.meta.typeCode];
						n = new ObjectHandle(objSchema, pv, pv.meta.id, [], this);
					}
				}
			}
			n.prepare();
		}else if(pt.type.type === 'view'){
			//_.assertLength(pv, 2);
			_.assertInt(pv);
			//_.assertString(pv[1]);
			n = this.getObjectApi(pv, this);
		}else{
			var c = api.getClassForType(pt, this.typeSchema.isView);
			n = new c(pt, pv, [pt.code], this, this.typeSchema.isView);
		}
		this.cachedProperties[propertyName] = n;
	}
	return n;
}
ObjectHandle.prototype.toJson = function toJson(){

	if(this.obj === undefined) return undefined;
	
	var obj = {};

	var local = this;
	
	//_.each(this.typeSchema.properties, function propertyToJson(p, name){
	Object.keys(this.typeSchema.properties).forEach(function propertyToJson(name){
		var p = local.typeSchema.properties[name];
		
		var v = local.obj[p.code];
		if(v === undefined) return;
		
		if(p.type.type !== 'primitive'){
			if(p.type.type === 'list' && p.type.members.type === 'primitive'){
				//just use the e[1]
			}else{
				v = local.property(p.name).toJson();//TODO optimize
			}
		}
		if(v !== undefined){
			obj[p.name] = v;
		}
		
	})

	obj.type = this.typeSchema.name;
	return obj;
}

ObjectHandle.prototype.uid = function(){
	var res = this.parent.uid() + '-' + this.typeSchema.code;
	if(this.objectId !== -1) res += ':' + this.objectId;
	return res;
}


module.exports = ObjectHandle

