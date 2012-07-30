
var u = require('./util')
var _ = require('underscorem')

var api = require('./../sync_api')

var jsonutil = require('./../jsonutil')

var topObject = require('./topobject')

function ObjectHandle(typeSchema, edits, objId, part, parent, isReadonlyIfEmpty){
	_.assertFunction(parent.adjustPath)
	
	_.assertNot(objId !== -1 && parent.isView())
	/*
	if(edits !== undefined) _.assertArray(edits)
	_.assertObject(parent);
	_.assert(_.isInteger(objId) || _.isString(objId));
	
	_.assert(objId !== 0)
	
	if(_.isInteger(objId) && objId === -1){
		_.assert(edits === undefined && isReadonlyIfEmpty)
	}else{
		_.assertArray(edits)
	}
	
	_.assertDefined(typeSchema)
	_.assertDefined(typeSchema.properties);
	 */
	if(!typeSchema.isView){
		_.assertInt(objId);
	}
	
	this.edits = edits
	this.part = part;//TODO make part a single value rather than a list?
	this.typeSchema = typeSchema;
	this.obj = {};
	this.parent = parent;
	
	this.objectId = objId;
	
	if(isReadonlyIfEmpty && edits === undefined){
		this.isReadonlyAndEmpty = true;
		this.property = emptyReadonlyObject
		this.setProperty = emptyReadonlyObject
		this.add = emptyReadonlyObject
		this.del = emptyReadonlyObject
	}else{
		//this.log('not readonlyandempty')
	}
	
	/*if(this.parent._internalId){
		if(this.parent._internalId() === '200:["winne@sfu.ca"]'){
			
			_.errout('WTF')
		}
	}*/
}

ObjectHandle.prototype.types = u.genericObjectTypes

ObjectHandle.prototype.adjustPath = function(source){
	_.assertFunction(this.parent.adjustPath)

	_.assertInt(source)
	_.assert(source > 0)
	
	var remainingCurrentPath = this.parent.adjustPath(this.part[0])
	this.log('adjusting path: ' + JSON.stringify(remainingCurrentPath) + ' -> +' + source)
	if(remainingCurrentPath.length === 0){
		this.persistEdit('selectProperty', {typeCode: source})
		return []
	}else if(remainingCurrentPath[0] !== source){
		if(remainingCurrentPath.length > 1){
			if(remainingCurrentPath.length < 6){
				this.log('ascending due to remainingCurrentPath ' + remainingCurrentPath[0] + ' ' + source)
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

ObjectHandle.prototype.adjustPathSelf = function(objId){
	_.assertFunction(this.parent.adjustPath)

	_.assertInt(objId)
	//_.assert(source > 0)
	
	//var remainingCurrentPath = this.parent.adjustPath(this.objectId)
	var remainingCurrentPath = this.parent.adjustPath(this.part[0])
	this.log('adjusting path: ' + JSON.stringify(remainingCurrentPath) + ' -> +' + objId)
	if(remainingCurrentPath.length === 0){
		this.persistEdit('selectObject', {id: objId})
		return []
	}else if(remainingCurrentPath[0] !== source){
		if(remainingCurrentPath.length > 1){
			if(remainingCurrentPath.length < 6){
				this.log('ascending due to remainingCurrentPath ' + remainingCurrentPath[0] + ' ' + objId)
				this.persistEdit('ascend'+(remainingCurrentPath.length-1), {})
			}else{
				this.persistEdit('ascend', {many: remainingCurrentPath.length-1})
			}
		}
		this.persistEdit('reselectObject', {id: objId})
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
	this.log('reified: ' + this.objectId + ' -> ' + id)
	_.assert(this.objectId < 0)
	this.objectId = id
}

ObjectHandle.prototype.prepare = function(){
	if(this.prepared) return;
	this.prepared = true;
	var s = this;	

	//apply edits
	if(this.edits){
		var currentSyncId=-1
		this.log(this.objectId + ' preparing topobject with edits: ' + JSON.stringify(this.edits).slice(0,500))
		var local = this
		this.edits.forEach(function(e, index){
			topObject.maintainPath(local, e.op, e.edit, -1, index)
		})
		local.path = undefined
		local.pathEdits = undefined
		local.lastEditId = undefined
	}
	
	//this.log('preparing object: ' + this.typeSchema.name + ' ' + JSON.stringify(this.typeSchema))
	_.each(this.typeSchema.properties, function(p, name){
		if(p.type.type !== 'object' || s.hasProperty(name)){
			if(s.isReadonlyAndEmpty){
				//this.log('defining getter')
				s.__defineGetter__(name, emptyReadonlyObjectProperty);
			}else{
				var v = s.property(name);
				s[name] = v;
				//this.log('prepared: ' + name)
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
	return rfes;
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
	//this.log('adding part: ' + this.part + ' and id ' + this.objectId + ', parent: ' + JSON.stringify(this.parent.getPath()));
	var res = this.parent.getPath().concat(this.part);
	//res = res.concat([this.typeSchema.code]);
	if(this.objectId !== -1){
		res = res.concat([this.objectId]);
		//this.log('appended own id: ' + this.objectId);
	}
	//this.log('object returned path: ' + JSON.stringify(res));
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
	//this.log(JSON.stringify(pt));
	
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
			if(ps.type.type !== 'object'){
				_.errout('setObject called on non object type, type is: ' + JSON.stringify(ps))
			}
			//_.assertEqual(ps.type.type, 'object')
		}
		var pv = this[ps.name]//.cachedProperties[ps.name]
		if(pv && pv.objectId === edit.id){
			//already done
			this.log('setObject redundant (local view object?), skipping')
		}else{
			this.log('set to: ' + edit.id + ' ' + descentCode + ' ' + this.objectId + ' ' + ps.name)
			var setObj = this.getObjectApi(edit.id)

			this.obj[descentCode] = setObj;
			if(this.prepared){
				setObj.prepare()
				this[ps.name] = setObj
			}
			this.emit(edit, 'set', setObj)			
		}
	}else if(op === 'setToNew'){
		_.errout('TODO setToNew: ' + JSON.stringify(arguments))
	}else{
		_.errout('TODO: ' + op)
	}
}

ObjectHandle.prototype.changeListener = function(op, edit, syncId){
	//this.log('%%%' + JSON.stringify(path) + ' ' + this.typeSchema.name);
	//var ps = this.typeSchema.propertiesByCode[path[0]];
	//_.assertObject(ps);
	
	if(op === 'setObject') _.errout('HMM')
	else if(op === 'setViewObject') _.errout('HMM')
	else{
		this.log('TODO: ' + op)
		this.log(new Error().stack)
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
		this.log('descending into object: ' + JSON.stringify(edit))
		res = ap.changeListener(path.slice(1), op, edit, syncId);
		//}
		_.assertFunction(res);
		return res;
	}	*/
}
/*
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
	this.log('set property to new: ' + pt.code)
	
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
}*/


ObjectHandle.prototype.replaceObjectHandle = function(oldHandle, newHandle, part){
	var property = this.typeSchema.propertiesByCode[part[0]]
	//this.parent.cachedProperties[property.name] = newValue;
	this[property.name] = newHandle
}

ObjectHandle.prototype.set = function(objHandle){
	if(this.parent.typeSchema.isView){//TODO verify from eventual server->client update
		this.log('is view, just setting')
		//this.parent.cachedProperties[propertyName] = newValue;
		this.parent.replaceObjectHandle(this, objHandle, this.part)
		return
	}

	//TODO re-write parent property stuff
	
	var e = {id: objHandle._internalId()}
	
	this.parent.adjustPath(this.part[0])
	this.persistEdit('setObject', e)

	this.parent.replaceObjectHandle(this, objHandle, this.part)
	
	this.emit({}, 'set', objHandle)
	
	this.destroyed = true
	var local = this
	Object.keys(this).forEach(function(key){
		try{
			var value = local[key]
			if(_.isFunction(value)){
				local[key] = function(){_.errout('inner object has been destroyed');}
			}
		}catch(e){
		}
	})


	return objHandle;
}

ObjectHandle.prototype.setNew = function(typeName, json){
	if(_.isObject(typeName)){
		json = typeName
		typeName = undefined
	}
	
	json = json || {}
	var type = u.getOnlyPossibleType(this, typeName);
	
	var remaining = this.parent.adjustPath(this.part[0])
	/*if(remaining.length === 0){
		this.persistEdit('selectProperty', {typeCode: pt.code})
	}else if(remaining[0] !== pt.code){
		if(remaining.length > 1) this.ascendBy(remaining.length-1)
		this.persistEdit('reselectProperty', {typeCode: pt.code})
	}*/
	this.saveEdit('setToNew', {typeCode: type.code})

	//var n = this._makeAndSaveNew(json, type)
	
	var temporary = this.makeTemporaryId();
	var edits = jsonutil.convertJsonToEdits(this.getFullSchema(), type.name, json);

	if(edits.length > 0){
		this.adjustPathSelf(temporary)
		for(var i=0;i<edits.length;++i){
			var e = edits[i]
			this.persistEdit(e.op, e.edit)
		}
	}
	
	var n = new ObjectHandle(type, edits, temporary, [temporary], this);
	if(this.objectApiCache === undefined) this.objectApiCache = {}
	this.objectApiCache[temporary] = n;
	
	n.prepare()

	_.assertObject(n)
	
	
	//_.errout('TODO replace self with non-readonly version')
	/*
	var temporary = this.makeTemporaryId();
	var edits = jsonutil.convertJsonToEdits(this.getFullSchema(), type.name, json);

	if(edits.length > 0){
		this.adjustPath(temporary)
		for(var i=0;i<edits.length;++i){
			var e = edits[i]
			this.persistEdit(e.op, e.edit)
		}
	}
	
	this.edits = edits
	this.obj = {};
	
	this.objectId = temporary

	//the stuff that was readonly
	this.property = ObjectHandle.prototype.property
	this.setProperty = ObjectHandle.prototype.setProperty
	//this.add = ObjectHandle.prototype.property
	
	this.prepare()*/

	this.emit({}, 'set', n)()
	
	//this.parent[
	//TODO rewrite parent property stuff
	return n
	//_.errout('TODO impl')
	/*
	var n = this._makeAndSaveNew(json, type)
	_.assertObject(n)*/
}
/*
ObjectHandle.prototype.setProperty = function(propertyName, newValue){
	_.assertLength(arguments, 2)
	
	if(this.typeSchema.isView){//TODO verify from eventual server->client update
		this.log('is view, just setting')
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


*/
ObjectHandle.prototype.hasProperty = function(propertyName){
	if(this.obj === undefined) return false;
	var pt = this.typeSchema.properties[propertyName];
	if(pt.type.type === 'set' || pt.type.type === 'list' || pt.type.type === 'map') return true
	if(pt === undefined) _.errout('not a valid property(' + propertyName + ') for this type: ' + this.typeSchema.code)
	_.assertDefined(pt);
	if(pt.type.type === 'object' && pt.tags['always_local']) return true;
	var pv = this.obj[pt.code]//getPropertyValue(this.obj, pt.code);
	//this.log('has ' + this.obj[pt.code] + ' ' + pt.code + ' ' + this.objectId)
	if(pv && pv.isReadonlyAndEmpty){
		return false
	}
	
	if(this.isReadonlyAndEmpty) return
	
	var n = this[propertyName]//.cachedProperties[propertyName];
	if(n && !n.isReadonlyAndEmpty && _.isFunction(n.value)){
		if(n.value() !== undefined){
			//this.log('nvalue')
			return true//TODO do something better about updating object properties in the parent?
		}
	}
	return pv !== undefined;
}
ObjectHandle.prototype.has = ObjectHandle.prototype.hasProperty

ObjectHandle.prototype.propertyByCode = function property(propertyCode){
	this.log('getting property: ' + propertyCode)
	//this.log(JSON.stringify(this.typeSchema.propertiesByCode))
	var propertyName = this.typeSchema.propertiesByCode[propertyCode].name
	return this.property(propertyName)
}

//TODO invert this per-property for performance and readability improvement
ObjectHandle.prototype.property = function property(propertyName){
	var n = this[propertyName]//.cachedProperties[propertyName];
	if(n === undefined){
		//this.log('initializing property: ' + propertyName);
		//this.log('type schema: ' + JSON.stringify(this.typeSchema));
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
					this.log('made empty readonly object ' + pt.code + ' ' + pv)
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
				n = new ObjectHandle(fullSchema[pt.type.view], [], -1, [pt.code], this, true);
			}
		}else{
			var c = api.getClassForType(pt.type, this.typeSchema.isView);
			n = new c(pt, pv, pt.code, this, this.typeSchema.isView);
		}
		this[propertyName] = n//.cachedProperties[propertyName] = n;
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
/*
ObjectHandle.prototype.uid = function(){
	var res = this.parent.uid() + '-' + this.typeSchema.code;
	if(this.objectId !== -1) res += ':' + this.objectId;
	return res;
}*/

ObjectHandle.prototype.del = function(){
	if(this.isView()) _.errout('cannot delete view object')
	this.saveEdit('destroy', {})
}

module.exports = ObjectHandle

