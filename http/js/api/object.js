"use strict";

var u = require('./util')
var _ = require('underscorem')

var api = require('./../sync_api')
var jsonutil = require('./../jsonutil')
var topObject = require('./topobject')

var lookup = require('./../lookup')
var editCodes = lookup.codes
var editNames = lookup.names

function ObjectHandle(typeSchema, edits, objId, part, parent, isReadonlyIfEmpty){
	//_.assertFunction(parent.adjustPath)
	
	_.assert(objId !== 0)
	_.assertNot(objId !== -1 && parent.isView())
	//_.assertObject(typeSchema)

	if(typeSchema && !typeSchema.isView){
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
		this.isa = emptyReadonlyObject
	}else{
		//this.log('not readonlyandempty')
	}
	
	if(this.isView()){
		this.clearProperty = u.viewReadonlyFunction
		this.setProperty = u.viewReadonlyFunction
		this.del = u.viewReadonlyFunction
		this.revert = u.viewReadonlyFunction
		//this.set = u.viewReadonlyFunction
	}
	
	this.log = this.parent.log
}

ObjectHandle.prototype.asAt = function(editId){
	//_.errout('TODO')
	/*var allowedEdits = []
	for(var i=0;i<this.edits.length;++i){
		var e = this.edits[i]
		if(e.editId > editId) break
		allowedEdits.push(e)
	}
	console.log('allowed edits: ' + JSON.stringify([allowedEdits, this.edits, editId, this._isAtCopy]))
	var copy = new ObjectHandle(this.typeSchema, allowedEdits, this.objectId, this.part, this.parent)
	copy.prepare()
	copy._isAtCopy = true
	return copy*/
	//_.errout('cannot construct inner object asAt copy independent of its top object container')
	var parent = this.getTopParent()
	var copy = parent.asAt(editId)
	var ourCopy = copy.objectApiCache[this.objectId]
	_.assertDefined(ourCopy)
	return ourCopy
}


ObjectHandle.prototype.types = u.genericObjectTypes

ObjectHandle.prototype.getImmediateProperty = u.immediatePropertyFunction;

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
	//this.log('reified: ' + this.objectId + ' -> ' + id)
	_.assert(this.objectId < 0)
	this.objectId = id
}
ObjectHandle.prototype.isDestroyed = function(){return false}

ObjectHandle.prototype.prepare = function(){
	if(this.prepared || !this.typeSchema) return;
	
	this.prepared = true;
	var s = this;	

	//apply edits
	if(this.edits){
		var currentSyncId=-1
		//this.log(this.objectId + ' preparing topobject with edits: ' + JSON.stringify(this.edits).slice(0,500))
		var local = this
		this.edits.forEach(function(e, index){
			topObject.maintainPath(local, e.op, e.edit, -1, index)
		})
		local.path = undefined
		local.pathEdits = undefined
		local.lastEditId = undefined
	}
	
	//this.log('preparing object: ' + this.typeSchema.name + ' ' + JSON.stringify(this.typeSchema))
	//_.each(this.typeSchema.properties, function(p, name){
	var properties = this.typeSchema.properties
	Object.keys(properties).forEach(function(name){
		var p = properties[name]
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

	return objType.subTypes || [objType.name]

	/*if(!objType.subTypes || _.size(objType.subTypes) === 0){
		return [objType.name];
	}
	
	var res = [];
	//if(!objType.superTypes.abstract) res.push(objType.name)
	_.each(objType.subTypes, function(v, subType){
		res = res.concat(recursivelyGetLeafTypes(schema[subType], schema));
	});
	return res;*/
}
/*
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
}*/

ObjectHandle.prototype._typeCode = function(){return this.typeSchema.code;}
ObjectHandle.prototype.type = function(){return this.typeSchema.name;}
ObjectHandle.prototype.innerId = function(){
	_.assertPrimitive(this.objectId);
	_.assertDefined(this.objectId);
	return this.objectId;
}
ObjectHandle.prototype.getImmediateObject = function(){
	return this.objectId
}
ObjectHandle.prototype._internalId = function(){
	return this.objectId;
}
ObjectHandle.prototype.id = function(){
	_.assertPrimitive(this.objectId);
	_.assertDefined(this.objectId);
	return this.parent.getTopId() + '_' + this.objectId;
}
ObjectHandle.prototype.getParent = function(){
	return this.parent
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

ObjectHandle.prototype.isa = function(name){
	return this.typeSchema.name === name || (this.typeSchema.superTypes && this.typeSchema.superTypes[name])
}

ObjectHandle.prototype._rewriteObjectApiCache = function(oldKey, newKey){
	if(!this.objectApiCache) return
	var n = this.objectApiCache[oldKey]
	delete this.objectApiCache[oldKey]
	this.objectApiCache[newKey] = n
}

ObjectHandle.prototype.changeListener = function(subObj, key, op, edit, syncId){
	_.assertInt(op)
	_.assertObject(edit)
	
	//console.log('%%%' + editNames[op] + ' ' + JSON.stringify(edit));
	//var ps = this.typeSchema.propertiesByCode[path[0]];
	//_.assertObject(ps);
	
	if(op === editCodes.setObject) _.errout('HMM')
	else if(op === editCodes.setViewObject) _.errout('HMM')
	else if(op === editCodes.wasSetToNew || op === editCodes.setToNew){
		//_.errout('TODO wasSetToNew')

		//console.log('WAS SET TO NEW')
		//_.errout('TODO')
		if(op === editCodes.setToNew){
			_.assertInt(edit.temporary)
		}

		var type = this.getFullSchema()._byCode[edit.typeCode]
		var temporary = edit.id || edit.temporary
		_.assertInt(temporary)
		var n = new ObjectHandle(type, [], temporary, [temporary], this);
		
		var top = this.getTopParent()
		if(top.objectApiCache === undefined) top.objectApiCache = {}
		top.objectApiCache[temporary] = n;
		
		if(op === editCodes.setToNew){
			this.saveTemporaryForLookup(temporary, n, this)
		}
		
	
		n.prepare()

		_.assertObject(n)

		this.emit({}, 'set', n)//()
		
		this.parent.replaceObjectHandle(this, n, this.part)
	}else{
		//this.log('TODO: ' + op)
		//this.log(new Error().stack)
		//process.exit(0)
		//_.errout('TODO: ' + editNames[op] + ' ' + JSON.stringify(edit))
		console.log('WARNING: ' + editNames[op] + ' ' + JSON.stringify(edit))
	}
}


ObjectHandle.prototype.replaceObjectHandle = function(oldHandle, newHandle, part){
	var property = this.typeSchema.propertiesByCode[part[0]]
	//this.parent.cachedProperties[property.name] = newValue;
	_.assertObject(newHandle)
	this[property.name] = newHandle
}


ObjectHandle.prototype.clearProperty = function(propertyName){
	_.assertLength(arguments, 1)
	
	if(this.typeSchema.isView){//TODO verify from eventual server->client update
		//this.log('is view, just setting')
		this.cachedProperties[propertyName] = undefined
		return
	}
	
	var pt = this.typeSchema.properties[propertyName];
	_.assertDefined(pt);
	
	this[propertyName] = undefined
	
	//this.adjustPath(pt.code)
	this.adjustTopObjectToOwn()
	this.adjustCurrentObject(this.getImmediateObject())
	this.adjustCurrentProperty(pt.code)
	this.persistEdit(editCodes.clearProperty, {})
	
	this.emit({}, 'clearProperty', propertyName)
}

ObjectHandle.prototype.setPropertyToNew = function(propertyName, typeName, json){
	if(_.isObject(typeName)){
		json = typeName
		typeName = undefined
	}

	var pt = this.typeSchema.properties[propertyName];
	_.assertDefined(pt);
		
	json = json || {}
	var type = u.getOnlyPossibleObjectPropertyType(this, pt, typeName);
	
	//var remaining = this.adjustPath(pt.code)
	
	this.adjustTopObjectToOwn()
	this.adjustCurrentObject(this.getImmediateObject())
	this.adjustCurrentProperty(pt.code)

	//console.log('setting to new: ' + this.parent.prepared)
	this.persistEdit(editCodes.setToNew, {typeCode: type.code})

	var temporary = this.makeTemporaryId();
	var edits = jsonutil.convertJsonToEdits(this.getFullSchema(), type.name, json, this.makeTemporaryId.bind(this), temporary);

	if(edits.length > 0){
		//this.adjustPath(temporary)
		this.saveEdit(editCodes.selectObject, {id: temporary})
		for(var i=0;i<edits.length;++i){
			var e = edits[i]
			this.persistEdit(e.op, e.edit)
		}
		//this.saveEdit(editCodes.ascend1, {})
	}
	
	//_.assert(this.part[0] > 0)

	//						typeSchema, edits, objId, part, parent, isReadonlyIfEmpty){
	
	var n = new ObjectHandle(type, edits, temporary, [pt.code], this);
	if(this.objectApiCache === undefined) this.objectApiCache = {}
	this.objectApiCache[temporary] = n;
	
	this.saveTemporaryForLookup(temporary, n, this)
	
	n.prepare()

	_.assertObject(n)

	this.emit({}, 'setProperty', propertyName, n)//()
	
	//TODO rewrite parent property stuff
	//this.parent.replaceObjectHandle(this, n, this.part)
	this[propertyName] = n
	
	return n
	
	/*
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
	*/
}

ObjectHandle.prototype.setProperty = function(propertyName, newValue){
	_.assertLength(arguments, 2)

	var pt = this.typeSchema.properties[propertyName];
	if(pt === undefined) _.errout('unknown property: ' + propertyName)
	_.assertDefined(pt);
	
	if(this.typeSchema.isView){//TODO verify from eventual server->client update
		//this.log('is view, just setting')
		
		if(pt.type.type === 'object'){
			//this.replaceObjectHandle(this, newValue, this.part)
			this[propertyName] = newValue
		}else{

			this.cachedProperties[propertyName] = newValue;
		}
		return
	}
	
	
	if(pt.type.type === 'object'){
	
		_.assertObject(newValue)

		var n = newValue

		//this.cachedProperties[propertyName] = n;
		this[propertyName] = n
		
		var e = {id: n._internalId(), typeCode: newValue.typeSchema.code}
		_.assertInt(e.id)
		if(e.id === -1) _.errout('cannot set object property with a undefined object property - new value is empty')
		if(e.id < 0) _.assert(e.id < -1)
		
		//this.adjustPath(pt.code)
		//this.adjust
		this.adjustTopObjectToOwn()
		this.adjustCurrentObject(this.getImmediateObject())
		this.adjustCurrentProperty(pt.code)//this.getImmediateProperty())
		this.persistEdit(editCodes.setObject, e)
		
		this.emit(e, 'setProperty', propertyName, n)//()
	}else{
		_.errout('TODO: ' + pt.type.type);
	}
}



ObjectHandle.prototype.hasProperty = function(propertyName){
	if(this.obj === undefined) return false;

	if(this.typeSchema === undefined) _.errout('null object has no type')

	if(this.typeSchema.properties === undefined) _.errout('object has no properties, so definitely not a property called: "' + propertyName + '"')
	var pt = this.typeSchema.properties[propertyName];
	if(pt === undefined){
		_.errout('not a valid property for that object: ' + this.typeSchema.name+'.'+propertyName)
	}
	if(pt.type.type === 'set' || pt.type.type === 'list' || pt.type.type === 'map') return true
	if(pt === undefined) _.errout('not a valid property(' + propertyName + ') for this type: ' + this.typeSchema.code)
	_.assertDefined(pt);
	if(pt.type.type === 'object' && pt.tags && pt.tags['always_local']) return true;
	var pv = this[propertyName]//this.obj[pt.code]//getPropertyValue(this.obj, pt.code);
	//this.log('has ' + this.obj[pt.code] + ' ' + pt.code + ' ' + this.objectId)
	if(pv && pv.isReadonlyAndEmpty){
		return false
	}
	
	if(this.isReadonlyAndEmpty) return
	
	var n = this[propertyName]//.cachedProperties[propertyName];
	if(n && !n.isReadonlyAndEmpty && n instanceof ObjectHandle){
		return true
	}
	if(n && !n.isReadonlyAndEmpty && _.isFunction(n.value)){
		if(n.value() !== undefined){
			//this.log('nvalue')
			return true//TODO do something better about updating object properties in the parent?
		}
	}
	var has = pv !== undefined;
	if(has && !n){
		_.errout('has but no n: ' + pv)
	}
	return has
}
ObjectHandle.prototype.has = ObjectHandle.prototype.hasProperty

ObjectHandle.prototype.propertyByCode = function property(propertyCode){
	//this.log('getting property: ' + propertyCode)
	//console.log('getting property: ' + propertyCode)
	//console.log('type: ' + this.typeSchema.name)
	//console.log(JSON.stringify(this.typeSchema.propertiesByCode))
	var p = this.typeSchema.propertiesByCode[propertyCode]
	if(p === undefined){
		//_.errout('cannot find property with code: ' + propertyCode)
		return
	}
	var propertyName = p.name
	var handle = this.property(propertyName)
	_.assertObject(handle)
	return handle
}

//TODO invert this per-property for performance and readability improvement
ObjectHandle.prototype.property = function property(propertyName){
	var n = this[propertyName]//.cachedProperties[propertyName];
	if(n === undefined){
		//console.log('initializing property: ' + propertyName + ' ' + this.rere + ' ' + this.objectId);
		//this.log('type schema: ' + JSON.stringify(this.typeSchema));
		var pt = this.typeSchema.properties[propertyName];
		//_.assertDefined(pt);
		if(pt === undefined) _.errout('property ' + this.typeSchema.name + '.' + propertyName + ' not recognized');
		_.assertObject(this.obj);
		var pv = this.obj[pt.code]
		if(pt.type.type === 'object'){
			var fullSchema = this.getFullSchema();
			if(pv === undefined){
				if(pt.tags && pt.tags.must_already_exist){
					_.errout('cannot create local object due to must_already_exist constraint in schema - must specify property value to a object reference via setProperty');
				}
				
				var objSchema = fullSchema[pt.type.object];
				var types = recursivelyGetLeafTypes(objSchema, fullSchema);
				if(types.length > 1){
					//_.errout('need to specify object type - use setPropertyType');
					n = new ObjectHandle(undefined, undefined, -1, [pt.code], this, true);
				}else{
					//this.log('made empty readonly object ' + pt.code + ' ' + pv)
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
				_.assertObject(n)
			}else{
				var fullSchema = this.getFullSchema();
				n = new ObjectHandle(fullSchema[pt.type.view], [], -1, [pt.code], this, true);
			}
		}else{
			var c = api.getClassForType(pt.type, this.typeSchema.isView);
			n = new c(pt, pv, pt.code, this, this.typeSchema.isView);
		}
		_.assertDefined(n)
		_.assertObject(n)
		this[propertyName] = n//.cachedProperties[propertyName] = n;
	}
	//console.log('getting property ' + propertyName)
	_.assertObject(n)
	
	return n;
}
ObjectHandle.prototype.toJson = function toJson(already){

	if(this.obj === undefined) return
	if(this.isReadonlyAndEmpty) return
	
	var obj = {};

	var local = this;
	
	already = already||{}
	if(already[this.objectId]){
		return 'CIRCULAR REFERENCE'
	}

	var subAlready = {}//_.extend({}, already)	
	Object.keys(already).forEach(function(key){
		subAlready[key] = true
	})
	subAlready[this.objectId] = true
	
	//_.assertObject(this.typeSchema)
	if(this.typeSchema.properties !== undefined){
		//console.log(JSON.stringify(Object.keys(local)))
		Object.keys(this.typeSchema.properties).forEach(function propertyToJson(name){
			var p = local.typeSchema.properties[name];
			//if(local.hasProperty(p.name)){
			if(local[p.name] !== undefined){
				if(typeof(local[p.name].toJson) !== 'function'){
					console.log('ERROR: '+p.name+'.toJson not a function')
					console.log(local[p.name])
					_.errout(JSON.stringify(local[p.name]))
				}
				obj[p.name] = local[p.name].toJson(subAlready)//local.property(p.name).toJson(subAlready)
			}
		})
	}
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
	this.adjustTopObjectToOwn()
	this.saveEdit(editCodes.destroy, {})
}

module.exports = ObjectHandle

