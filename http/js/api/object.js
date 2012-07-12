
var u = require('./util')
var _ = require('underscorem')

var api = require('./../sync_api')

function ObjectHandle(typeSchema, obj, objId, part, parent, isReadonlyIfEmpty){
	//_.assertLength(arguments, 5);
	_.assertFunction(parent.adjustPath)
	
	_.assertArray(part);
	_.assertObject(parent);
	_.assert(_.isInteger(objId) || _.isString(objId));
	//_.assertObject(obj);
	
	_.assertDefined(typeSchema)
	_.assertDefined(typeSchema.properties);
	 
	//_.assertNot(_.isArray(obj));
	
	if(!typeSchema.isView){
		_.assertInt(objId);
	}
	
	this.edits = obj
	//this.schema = schema;
	this.part = part;
	this.typeSchema = typeSchema;
	this.obj = {};
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
		//console.log('not readonlyandempty')
	}
}

ObjectHandle.prototype.adjustPath = function(source){
	_.assertFunction(this.parent.adjustPath)
	var remainingCurrentPath = this.parent.adjustPath(this.objectId)
	console.log('adjusting path: ' + JSON.stringify(remainingCurrentPath) + ' -> +' + source)
	if(remainingCurrentPath.length === 0){
		this.persistEdit('selectProperty', {typeCode: source})
		return []
	}else if(remainingCurrentPath[0] !== source){
		if(remainingCurrentPath.length > 1){
			if(remainingCurrentPath.length < 6){
				console.log('ascending due to remainingCurrentPath ' + remainingCurrentPath[0] + ' ' + source)
				this.persistEdit('ascend'+(remainingCurrentPath.length-1), {})
			}else{
				this.persistEdit('ascend', {many: remainingCurrentPath.length-1})
			}
		}
		this.persistEdit('reselectProperty', {typeCode: source})
		return []
	}else{
		return remainingCurrentPath.slice(1)
	}
}

ObjectHandle.prototype.isDefined = function(){
	return !this.isReadonlyAndEmpty
}

function emptyReadonlyObject(){
	_.errout('object is empty and readonly');
}

function emptyReadonlyObjectProperty(){
	_.errout('this object is undefined, you cannot modify its properties');
}

ObjectHandle.prototype.isInner = function(){return true;}

ObjectHandle.prototype.reify = function(id){
	_.assertInt(id)
	console.log('reified: ' + this.objectId + ' -> ' + id)
	_.assert(this.objectId < 0)
	this.objectId = id
}

ObjectHandle.prototype.prepare = function(){
	if(this.prepared) return;
	this.prepared = true;
	var s = this;
	//console.log('preparing object: ' + this.typeSchema.name + ' ' + JSON.stringify(this.typeSchema))
	_.each(this.typeSchema.properties, function(p, name){
		if(p.type.type !== 'object' || s.hasProperty(name)){
			if(s.isReadonlyAndEmpty){
				//console.log('defining getter')
				s.__defineGetter__(name, emptyReadonlyObjectProperty);
			}else{
				var v = s.property(name);
				s[name] = v;
				//console.log('prepared: ' + name)
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
		//console.log('appended own id: ' + this.objectId);
	}
	//console.log('object returned path: ' + JSON.stringify(res));
	return res;
}
ObjectHandle.prototype._typeCode = function(){return this.typeSchema.code;}
ObjectHandle.prototype.type = function(){return this.typeSchema.name;}
ObjectHandle.prototype.id = function(){
	_.assertPrimitive(this.objectId);
	_.assertDefined(this.objectId);
	return this.objectId;
}
ObjectHandle.prototype._internalId = function(){
	return this.objectId;
}

ObjectHandle.prototype.propertyIsPrimitive = function(propertyName){
	var pt = this.typeSchema.properties[propertyName];
	return pt.type.type === 'primitive';
}
ObjectHandle.prototype.propertyTypes = function(propertyName){
	var pt = this.typeSchema.properties[propertyName];
	//console.log(JSON.stringify(pt));
	
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

ObjectHandle.prototype.changeListenerElevated = function(descentCode, op, edit, syncId, editId){
	if(op === 'setObject' || op === 'setViewObject'){
		_.assertInt(descentCode)
		var ps = this.typeSchema.propertiesByCode[descentCode];
		_.assertObject(ps)
		if(op === 'setObject'){
			_.assertEqual(ps.type.type, 'object')
		}
		var pv = this.cachedProperties[ps.name]
		if(pv && pv.objectId === edit.id){
			//already done
			console.log('setObject redundant (local view object?), skipping')
		}else{
			console.log('set to: ' + edit.id + ' ' + descentCode + ' ' + this.objectId + ' ' + ps.name)
			var setObj = this.getObjectApi(edit.id)

			this.obj[descentCode] = setObj;
			if(this.prepared){
				setObj.prepare()
				this[ps.name] = setObj
			}
			this.emit(edit, 'set', setObj)			
		}
	}else{
		_.errout('TODO: ' + op)
	}
}

ObjectHandle.prototype.changeListener = function(op, edit, syncId){
	//console.log('%%%' + JSON.stringify(path) + ' ' + this.typeSchema.name);
	//var ps = this.typeSchema.propertiesByCode[path[0]];
	//_.assertObject(ps);
	
	if(op === 'setObject') _.errout('HMM')
	else if(op === 'setViewObject') _.errout('HMM')
	else{
		console.log('TODO: ' + op)
		console.log(new Error().stack)
		//process.exit(0)
		_.errout('TODO: ' + op)
	}
	/*
		setPropertyValue(this.obj, path[0], edit.value);
		return this.refresh(edit);
	}else{
		var ap = this.property(ps.name);
		var res;
		_.assertObject(ap);
		//if(ps.type.type === 'object'){
		//	res = ap.changeListener(path.slice(1), op, edit, syncId);
		//}else{
		console.log('descending into object: ' + JSON.stringify(edit))
		res = ap.changeListener(path.slice(1), op, edit, syncId);
		//}
		_.assertFunction(res);
		return res;
	}	*/
}

ObjectHandle.prototype.setPropertyToNew = function(propertyName, newType){
	var pt = this.typeSchema.properties[propertyName];
	_.assertDefined(pt);
	_.assert(pt.type.type === 'object');
	
	_.assert(arguments.length >= 1)
	_.assert(arguments.length <= 2)
	
	if(newType) _.assertString(newType)
	
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
	console.log('set property to new: ' + pt.code)
	
	if(this.typeSchema.isView){
		_.errout('invalid operation: cannot create an inner object for a view object')
	}

	var remaining = this.parent.adjustPath(this.part)
	if(remaining.length === 0){
		this.persistEdit('selectProperty', {typeCode: pt.code})
	}else if(remaining[0] !== pt.code){
		if(remaining.length > 1) this.ascendBy(remaining.length-1)
		this.persistEdit('reselectProperty', {typeCode: pt.code})
	}
	this.persistEdit('setToNew', {newType: objectSchema.code, temporary: temporary})


	delete this.cachedProperties[propertyName]
	this[propertyName] = this.property(propertyName);

	return this[propertyName];
}

ObjectHandle.prototype.setProperty = function(propertyName, newValue){
	_.assertLength(arguments, 2)
	
	if(this.typeSchema.isView){//TODO verify from eventual server->client update
		console.log('is view, just setting')
		this.cachedProperties[propertyName] = newValue;
		return
	}
	
	var pt = this.typeSchema.properties[propertyName];
	_.assertDefined(pt);
	
	if(pt.type.type === 'object'){
	
		_.assertObject(newValue)

		var n = newValue

		this.cachedProperties[propertyName] = n;
		
		var e = {id: n._internalId(), typeCode: newValue.typeSchema.code}
		
		this.adjustPath(pt.code)
		this.persistEdit('setObject', e)
		
		this.emit(e, 'setProperty', propertyName, n)()
	}else{
		_.errout('TODO: ' + pt.type.type);
	}
}



ObjectHandle.prototype.hasProperty = function(propertyName){
	if(this.obj === undefined) return false;
	var pt = this.typeSchema.properties[propertyName];
	if(pt.type.type === 'set' || pt.type.type === 'list' || pt.type.type === 'map') return true
	if(pt === undefined) _.errout('not a valid property(' + propertyName + ') for this type: ' + this.typeSchema.code)
	_.assertDefined(pt);
	if(pt.type.type === 'object' && pt.tags['always_local']) return true;
	var pv = this.obj[pt.code]//getPropertyValue(this.obj, pt.code);
	//console.log('has ' + this.obj[pt.code] + ' ' + pt.code + ' ' + this.objectId)
	if(pv && pv.isReadonlyAndEmpty){
		return false
	}
	
	if(this.isReadonlyAndEmpty) return
	
	var n = this.cachedProperties[propertyName];
	if(n && !n.isReadonlyAndEmpty && n.value){
		if(n.value() !== undefined) return true//TODO do something better about updating object properties in the parent?
	}
	return pv !== undefined;
}
ObjectHandle.prototype.has = ObjectHandle.prototype.hasProperty

ObjectHandle.prototype.propertyByCode = function property(propertyCode){
	console.log('getting property: ' + propertyCode)
	//console.log(JSON.stringify(this.typeSchema.propertiesByCode))
	var propertyName = this.typeSchema.propertiesByCode[propertyCode].name
	return this.property(propertyName)
}

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
		var pv = this.obj[pt.code]
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
					console.log('made empty readonly object ' + pt.code + ' ' + pv)
					n = new ObjectHandle(fullSchema[types[0]], undefined, -1, [pt.code], this, true);
				}
			}else{
				if(pt.tags && pt.tags.lazy){
					_.errout('TODO FIXME')				
					var objSchema = fullSchema._byCode[pv.meta.typeCode];
					n = new ObjectHandle(objSchema, pv, -1, [pt.code], this);
				}else{
					if(_.isInteger(pv) || _.isString(pv)){
						n = this.getObjectApi(pv, this);
					}else{
						_.assertDefined(pv.objectId)
						return pv
					}
				}
			}
			n.prepare();
		}else if(pt.type.type === 'view'){
			//_.assertLength(pv, 2);
			if(pv){
				if(_.isObject(pv)){
					pv.prepare()
					return pv;
				}
				_.assertInt(pv);
				//_.assertString(pv[1]);
				n = this.getObjectApi(pv, this);
			}else{
				var fullSchema = this.getFullSchema();
				n = new ObjectHandle(fullSchema[pt.type.view], undefined, -1, [pt.code], this, true);
			}
		}else{
			var c = api.getClassForType(pt.type, this.typeSchema.isView);
			n = new c(pt, pv, pt.code, this, this.typeSchema.isView);
		}
		this.cachedProperties[propertyName] = n;
	}
	return n;
}
ObjectHandle.prototype.toJson = function toJson(already){

	if(this.obj === undefined) return undefined;
	
	var obj = {};

	var local = this;
	
	already = already||{}
	if(already[this.objectId]){
		return 'CIRCULAR REFERENCE'
	}
	already[this.objectId] = true
	Object.keys(this.typeSchema.properties).forEach(function propertyToJson(name){
		var p = local.typeSchema.properties[name];
		if(local.hasProperty(p.name)){
			obj[p.name] = local.property(p.name).toJson(already)
		}
	})
	obj.id = this.objectId

	obj.type = this.typeSchema.name;
	return obj;
}

ObjectHandle.prototype.uid = function(){
	var res = this.parent.uid() + '-' + this.typeSchema.code;
	if(this.objectId !== -1) res += ':' + this.objectId;
	return res;
}


module.exports = ObjectHandle

