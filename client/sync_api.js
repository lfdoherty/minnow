"use strict";

var makeSyncApi;

//#requires matterhorn-standard:underscorem
(function(){


if(typeof(exports) !== 'undefined'){
	var _ = require('underscorem');
}else{
	var _ = window._
}

function getPropertyValue(obj, code){
	/*for(var i=0;i<obj.length;++i){
		var e = obj[i];
		if(e[0] === code){
			return e[1];
		}
	}*/
	return obj[code];
}
function setPropertyValue(obj, code, value){
	/*for(var i=0;i<obj.length;++i){
		var e = obj[i];
		if(e[0] === code){
			e[1] = value;
		}
	}*/
	obj[code] = value;
}

function refresh(e){
	//console.log('refresh called: ' + JSON.stringify(this.schema));
	return this.doRefresh({}, true, e);
}

function doRefresh(already, sourceOfRefresh, e){
	if(this.invalidated) _.errout('refresh called on invalid API object');
	
	already = JSON.parse(JSON.stringify(already));
	
	var cbs = [];
	if(this.refreshListeners){
		//console.log('got listeners');

		_.each(this.refreshListeners, function(listener, listenerName){
			if(already[listenerName]) return;
			already[listenerName] = true;
			//console.log('calling ' + listenerName + ' listener');
			var cb = listener(e, sourceOfRefresh);
			if(cb){
				_.assertFunction(cb);
				cbs.push(cb);
			}
		});
	}else{
		//console.log('ignoring refresh, no listeners');
	}

	if(this.parent){
		//console.log('refreshing upwards (' + this.constructor.name + ')');
		var cb = this.parent.doRefresh(already, false, e);
		_.assertFunction(cb);
		cbs = cbs.concat(cb);
	}
	//if(!this.parent && !this.refreshListeners){
	//	console.log('WARNING: refresh encountered neither parents nor listeners');
	//}
	
	return function(){
		for(var i=0;i<cbs.length;++i){
			cbs[i]();
		}
	}
}
function removeListener(listenerName){
	_.assertDefined(this.refreshListeners);
	//var li = this.refreshListeners.indexOf(listener);
	//_.assert(li !== -1);
	//this.refreshListeners.splice(li, 1);
	_.assertDefined(this.refreshListeners[listenerName]);
	delete this.refreshListeners[listenerName];
	
	return true;
}
function listenForRefresh(listenerName, listener){
	_.assertLength(arguments, 2);
	_.assertString(listenerName);
	_.assertFunction(listener);
	//console.log('listening for refresh: ' + this.constructor);
	if(this.refreshListeners === undefined) this.refreshListeners = {};
	this.refreshListeners[listenerName] = listener;
}

function addRefreshFunctions(classPrototype){
	if(classPrototype.refresh === undefined) classPrototype.refresh = refresh;
	if(classPrototype.doRefresh === undefined) classPrototype.doRefresh = doRefresh;
	if(classPrototype.listenForRefresh === undefined) classPrototype.listenForRefresh = listenForRefresh;
	if(classPrototype.removeListener === undefined) classPrototype.removeListener = removeListener;
}

function removeParent(p){
	_.assert(this.parent === p);
	this.parent = undefined;
}

function addToApiCache(typeCode, id, obj){
	_.assertLength(arguments, 3);
	_.assertInt(typeCode);
	_.assert(_.isInteger(id) || _.isString(id));
	_.assertObject(obj);
	this.apiCache[typeCode+':'+id] = obj;
}

function clearApiCache(typeCode, id){
	_.assertLength(arguments, 2);
	_.assertInt(typeCode);
	_.assert(_.isInteger(id) || _.isString(id));
	delete this.apiCache[typeCode+':'+id];
}
function getFromApiCache(typeCode, id){
	_.assertLength(arguments, 2);
	_.assertInt(typeCode);
	_.assert(_.isInteger(id) || _.isString(id));
	return this.apiCache[typeCode+':'+id];
}

function propertyUidFunction(){
	return this.parent.uid() + '-' + this.part[0];
}
function prepareStub(){
}

function addCommonFunctions(classPrototype){
	addRefreshFunctions(classPrototype);
	if(classPrototype.getEditingId === undefined) classPrototype.getEditingId = getEditingId;
	if(classPrototype.getObjectTypeCode === undefined) classPrototype.getObjectTypeCode = getObjectTypeCode;
	if(classPrototype.getObjectId === undefined) classPrototype.getObjectId = getObjectId;
	if(classPrototype.getObjectApi === undefined) classPrototype.getObjectApi = getObjectApi;
	if(classPrototype.wrapObject === undefined) classPrototype.wrapObject = wrapObject;
	if(classPrototype.getFullSchema === undefined) classPrototype.getFullSchema = getFullSchema;
	if(classPrototype.getPath === undefined) classPrototype.getPath = getPath;
	if(classPrototype.getSh === undefined) classPrototype.getSh = getSh;
	if(classPrototype.removeParent === undefined) classPrototype.removeParent = removeParent;

	if(classPrototype.createNewExternalObject === undefined) classPrototype.createNewExternalObject = createNewExternalObject;
	if(classPrototype.reifyExternalObject === undefined) classPrototype.reifyExternalObject = reifyExternalObject;
	
	if(classPrototype.addToApiCache === undefined) classPrototype.addToApiCache = addToApiCache;
	if(classPrototype.clearApiCache === undefined) classPrototype.clearApiCache = clearApiCache;
	if(classPrototype.getFromApiCache === undefined) classPrototype.getFromApiCache = getFromApiCache;
	if(classPrototype.uid === undefined) classPrototype.uid = propertyUidFunction;
	if(classPrototype.prepare === undefined) classPrototype.prepare = prepareStub;
}

function createNewExternalObject(typeCode, temporaryId){
	_.assertDefined(this.parent);
	this.parent.createNewExternalObject(typeCode, temporaryId);
}
function reifyExternalObject(typeCode, temporaryId, realId){
	_.assertDefined(this.parent);
	this.parent.reifyExternalObject(typeCode, temporaryId, realId);
}


function getPath(){
	return this.parent.getPath().concat(this.part);
}

function getSh(){
	return this.parent.getSh();
}

function SyncApi(schema, sh, snap, typeCode, id){
	_.assertInt(typeCode);
	_.assertObject(schema);
	
	this.sh = sh;
	this.schema = schema;
	this.snap = snap;

	this.cachedProperties = {};
	
	this.changeListener = SyncApi.prototype.changeListener.bind(this);
	_.assertFunction(this.changeListener);

	var typeSchema = schema._byCode[typeCode];
	if(typeSchema.isView) typeSchema = typeSchema.schema;
	
	console.log(typeCode + ' ' + id);
	_.assertDefined(snap.objects[typeCode][id]);
	
	this.objectApiCache = {};
	this.id = id;
	this.typeCode = typeCode;
}
SyncApi.prototype.getSh = function(){return this.sh;}
SyncApi.prototype.getRoot = function(){
	if(this.root === undefined){
		//console.log('getting root');
		this.root = this.getObjectApi(this.typeCode, this.id, this);
		this.root.prepare();
	}
	return this.root;
}
SyncApi.prototype.changeListener = function(typeCode, id, path, edit, syncId, editId){
	//_.assertLength(arguments, 6);
	//_.assertInt(syncId);
	_.assert(_.isInteger(syncId) || syncId === undefined);

	
	if(path.length === 0){
		if(edit.op === 'object-snap'){
			_.assertInt(edit.type);
			_.assertDefined(edit.id);
			_.assertDefined(edit.value);
			
			if(this.snap.objects[edit.type] === undefined){
				this.snap.objects[edit.type] = {};
			}
			
			if(this.snap.objects[edit.type][edit.id]){
				console.log('replacing ' + edit.type + ' ' + edit.id);
			}
			
			this.snap.objects[edit.type][edit.id] = edit.value;
		}else{
			_.errout('TODO implement top-level op: ' + JSON.stringify(edit));
		}
		return function(){}
	}else{
		//console.log(path);
		_.assertInt(path[0]);
		
		//console.log(JSON.stringify([typeCode, id, path, edit]));
		//console.log(JSON.stringify(this.schema._byCode[typeCode]));
		var st = this.schema._byCode[typeCode];
		//if(st.isView) st = st.schema;
		if(st.propertiesByCode[path[0]] === undefined){
			_.errout('type ' + st.name + ' has no property with code ' + path[0]);
		}
		var propertyName = st.propertiesByCode[path[0]].name;
		_.assertString(propertyName);
		var v = this.getObjectApi(typeCode, id, this).property(propertyName);
		_.assertObject(v);
		return v.changeListener(path.slice(1), edit, syncId);	
	}
}
function getFullSchema(){ return this.parent.getFullSchema();}
SyncApi.prototype.getFullSchema = function(){return this.schema;}
SyncApi.prototype.setEditingId = function(editingId){
	this.editingId = editingId;
}
SyncApi.prototype.createNewExternalObject = function(typeCode, temporaryId){
	var typeList = this.snap.objects[typeCode];
	if(typeList === undefined) typeList = this.snap.objects[typeCode] = {};
	typeList[temporaryId] = {0: [-1, -14, temporaryId, typeCode]};//TODO remove the -1 (screws up indexes though)
}
SyncApi.prototype.reifyExternalObject = function(typeCode, temporaryId, realId){
	var typeList = this.snap.objects[typeCode];
	_.assertDefined(typeList);
	typeList[realId] = typeList[temporaryId];
	delete typeList[temporaryId];
	var oldCacheKey = typeCode + ':' + temporaryId;
	var newCacheKey = typeCode + ':' + realId;
	if(this.objectApiCache[oldCacheKey]){
		this.objectApiCache[newCacheKey] = this.objectApiCache[oldCacheKey];
		delete this.objectApiCache[oldCacheKey];
		var objApi = this.objectApiCache[newCacheKey];
		objApi.objectId = realId;
		objApi.obj[0][2] = realId;
		
	}
}

SyncApi.prototype.getObjectApi = function(typeCode, idOrViewKey, sourceParent){

	_.assertInt(typeCode);
	_.assertDefined(sourceParent);	

	var cacheKey = typeCode + ':' + idOrViewKey;
	var n = this.objectApiCache[cacheKey];

	if(n){
		return n;
	}

	var t = this.schema._byCode[typeCode];

	if(t === undefined) _.errout('cannot find object type: ' + typeCode);
	var typeList = this.snap.objects[typeCode];
	if(typeList === undefined) _.errout('looking for a type of object the snapshot has none of: ' + typeCode);
	var obj = typeList[idOrViewKey];
	if(obj === undefined) _.errout('there are some objects of type ' + typeCode + ' in the snapshot, but none by id: ' + idOrViewKey);

	n = new TopObjectHandle(this.schema, t, obj, this, idOrViewKey);
	this.objectApiCache[cacheKey] = n;
	
	if(!t.superTypes.invariant) n.registerSourceParent(sourceParent);
	
	return n;
}
SyncApi.prototype.wrapObject = function(typeCode, obj, part, sourceParent){
	_.assertLength(arguments, 4);
	_.assertInt(typeCode);
	_.assertArray(part);
	var t = this.schema._byCode[typeCode];
	//if(t.isView) t = t.schema;
	return new ObjectHandle(t, obj || {}, obj[0][2], part, sourceParent);
}
SyncApi.prototype.getEditingId = function(){
	_.assertInt(this.editingId);
	//console.log('editingId: ' + this.editingId);
	return this.editingId;
}


function ObjectHandle(typeSchema, obj, objId, part, parent){
	_.assertLength(arguments, 5);
	_.assertArray(part);
	_.assertObject(parent);
	_.assert(_.isInteger(objId) || _.isString(objId));
	_.assertObject(obj);
	
	_.assertDefined(typeSchema.properties);
	
	_.assertNot(_.isArray(obj));
	
	//this.schema = schema;
	this.part = part;
	this.typeSchema = typeSchema;
	this.obj = obj;//obj[1] || [];
	this.parent = parent;
	
	this.objectId = objId;//obj[0][2];
	this.cachedProperties = {};

	
}

ObjectHandle.prototype.prepare = function(){
	if(this.prepared) return;
	this.prepared = true;
	var s = this;
	_.each(this.typeSchema.properties, function(p, name){
		if(p.type.type !== 'object' || s.hasProperty(name)){
			var v = s.property(name);
			s[name] = v;
			v.prepare();
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

function recursivelyGetLeafTypes(objType, schema){
	if(_.size(objType.subTypes) === 0){
		return [objType.name];
	}
	
	var res = [];
	_.each(objType.subTypes, function(v, subType){
		res = res.concat(recursivelyGetLeafTypes(schema[subType], schema));
	});
	return res;
}
ObjectHandle.prototype.getPath = function(){
	//console.log('adding part: ' + this.part + ' and id ' + this.objectId + ', parent: ' + JSON.stringify(this.parent.getPath()));
	var res = this.parent.getPath().concat(this.part);
	res = res.concat([this.typeSchema.code]);
	if(this.objectId !== -1) res = res.concat([this.objectId]);
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

ObjectHandle.prototype.changeListener = function(path, edit, syncId){
	var ps = this.typeSchema.propertiesByCode[path[0]];
	_.assertObject(ps);
	
	if(edit.op === 'setObject'){
		setPropertyValue(this.obj, path[0], edit.value);
		return this.refresh(edit);
	}else{
		var ap = this.property(ps.name);
		var res;
		_.assertObject(ap);
		if(ps.type.type === 'object'){
			res = ap.changeListener(path.slice(2), edit, syncId);
		}else{
			res = ap.changeListener(path.slice(1), edit, syncId);
		}
		_.assertFunction(res);
		return res;
	}	
}


//TODO provide ability to set meta-properties
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
			this.getObjectTypeCode(), 
			this.getObjectId(), 
			this.getPath().concat([pt.code]), 
			{op: 'setObject', value: newValue, type: objectSchema.code},
			this.getEditingId());
			
	}else{
		_.errout('TODO: ' + pt.type.type);
	}
}



ObjectHandle.prototype.hasProperty = function(propertyName){
	if(this.obj === undefined) return false;
	var pt = this.typeSchema.properties[propertyName];
	_.assertDefined(pt);
	if(pt.type.type === 'object' && pt.tags['always_local']) return true;
	var pv = getPropertyValue(this.obj, pt.code);
	return pv !== undefined;
}

//TODO invert this per-property for performance and readability improvement
ObjectHandle.prototype.property = function(propertyName){
	var n = this.cachedProperties[propertyName];
	if(n === undefined){
		//console.log('type schema: ' + JSON.stringify(this.typeSchema));
		var pt = this.typeSchema.properties[propertyName];
		//_.assertDefined(pt);
		if(pt === undefined) _.errout('property ' + this.typeSchema.name + '.' + propertyName + ' not recognized');
		_.assertObject(this.obj);
		var pv = getPropertyValue(this.obj, pt.code);
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
					n = new ObjectHandle(fullSchema[types[0]], {}, -1, [pt.code], this);
				}
			}else{
				if(_.isInteger(pv[1]) || _.isString(pv[1])){
					n = this.getObjectApi(pv[0], pv[1], this);
				}else{
				
					if(pv[1][0][0] === -1){
						var objSchema = fullSchema._byCode[pv[1][0][3]];
						n = new ObjectHandle(objSchema, pv[1], pv[1][0][2], [pv[0]], this);
					}else{
						var objSchema = fullSchema._byCode[pv[0]];
						_.assertObject(objSchema);
						n = new ObjectHandle(objSchema, pv[1], -1, [pv[0]], this);
					}
				}
			}
		}else if(pt.type.type === 'view'){
			_.assertLength(pv, 2);
			_.assertInt(pv[0]);
			_.assertString(pv[1]);
			n = this.getObjectApi(pv[0], pv[1], this);
		}else{
			var c = getClassForType(pt);
			n = new c(pt, pv, [pt.code], this);
		}
		this.cachedProperties[propertyName] = n;
	}
	return n;
}
ObjectHandle.prototype.toJson = function(){

	if(this.obj === undefined) return undefined;
	
	var obj = {};

	var local = this;
	
	_.each(this.typeSchema.properties, function(p, name){
		
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

function getObjectApi(typeCode, idOrViewKey, sourceParent){
	//_.assertLength(arguments, 3);
	//_.assertInt(typeCode);
	//_.assertDefined(idOrViewKey);
	//_.assertDefined(sourceParent);
	return this.parent.getObjectApi(typeCode, idOrViewKey, sourceParent);
}



function getEditingId(){
	var eId = this.parent.getEditingId();
	//console.log('rec editingId: ' + eId);
	return eId;
}

function TopObjectHandle(schema, typeSchema, obj, parent, id){
	_.assertLength(arguments, 5);
	_.assertObject(obj);
	
	if(!(parent instanceof SyncApi)) _.errout('ERROR: ' + parent.toString());
	
	this.schema = schema;
	this.typeSchema = typeSchema;
	this.obj = obj;
	this.parent = parent;
	this.cachedProperties = {};
	
	this.objectId = id;
	this.objectTypeCode = typeSchema.code;

}
TopObjectHandle.prototype.prepare = function(){
	if(this.prepared) return;
	this.prepared = true;
	var s = this;
	_.each(s.typeSchema.properties, function(p, name){
		var v = s.property(name);
		v.prepare();
		s[name] = v;
		
	});
}

TopObjectHandle.prototype.properties = getProperties;

TopObjectHandle.prototype.propertyIsPrimitive = ObjectHandle.prototype.propertyIsPrimitive

TopObjectHandle.prototype.removeParent = function(){}
TopObjectHandle.prototype._typeCode = function(){return this.objectTypeCode;}
TopObjectHandle.prototype.getPath = function(){return [];}
TopObjectHandle.prototype.type = function(){return this.typeSchema.name;}
TopObjectHandle.prototype.id = function(){
	return this.getObjectId();
}
TopObjectHandle.prototype.getObjectTypeCode = function(){
	return this.objectTypeCode;
}
TopObjectHandle.prototype.getObjectId = function(){
	return this.objectId;
}
TopObjectHandle.prototype.propertyTypes = ObjectHandle.prototype.propertyTypes;
TopObjectHandle.prototype.property = ObjectHandle.prototype.property;
TopObjectHandle.prototype.toJson = ObjectHandle.prototype.toJson;

TopObjectHandle.prototype.delayRefresh = function(){
	this.refreshDelayed = true;
}
TopObjectHandle.prototype.uid = function(){
	return this.objectTypeCode+':'+this.objectId;
}
TopObjectHandle.prototype.registerSourceParent = function(sourceParent){
	if(this.sourceParents === undefined) this.sourceParents = [];
	if(this.sourceParents.indexOf(sourceParent) === -1){
		this.sourceParents.push(sourceParent);
		//console.log('registered source parent for ' + this.typeSchema.name + ' ' + this.objectId);
	}
}
TopObjectHandle.prototype.basicDoRefresh = doRefresh;
TopObjectHandle.prototype.doRefresh = function(already, sourceOfRefresh, e){
	var cbs = [];
	var cba = this.basicDoRefresh(already, sourceOfRefresh, e);
	cbs.push(cba);
	//console.log('TopObjectHandle doRefresh calling source parents: ' + this.sourceParents.length);
	for(var i=0;i<this.sourceParents.length;++i){
		var sp = this.sourceParents[i];
		var cb = sp.doRefresh(already, false, e)
		cbs.push(cb);
	}
	return function(){
		for(var i=0;i<cbs.length;++i){
			cbs[i]();
		}
	}
}

function getObjectTypeCode(){
	return this.parent.getObjectTypeCode();
}
function getObjectId(){
	return this.parent.getObjectId();
}

function wrapObject(typeName, obj, part, sourceParent){
	return this.parent.wrapObject(typeName, obj, part, sourceParent);
}

function getClassForType(typeSchema){
	var type = typeSchema.type;
	//console.log(type);
	//console.log(typeSchema);
	if(type.type === 'primitive'){
		if(type.primitive === 'string') return StringHandle;
		else if(type.primitive === 'int') return IntHandle;
		else if(type.primitive === 'long') return LongHandle;
		else if(type.primitive === 'timestamp') return TimestampHandle;
		else if(type.primitive === 'boolean') return BooleanHandle;
		else{
			_.errout('unknown primitive type, no class defined: ' + JSON.stringify(type));
		}
	}else if(type.type === 'list'){
		return ListHandle;
	}else if(type.type === 'set'){
		return SetHandle;
	}else if(type.type === 'object'){
		return ObjectHandle;
	}else if(type.type === 'map'){
		return MapHandle;
	}else if(type.type === 'view'){
		_.errout('should not call this for view: views are always TopObjectHandles');
	}else{
		_.errout('unknown type, no class defined: ' + JSON.stringify(type));
	}
}

SetHandle.prototype.count = function(){
	_.assertLength(arguments, 0);
	if(this.obj === undefined) return 0;
	if(this.schema.type.members.type === 'primitive'){
		return this.obj.length;
	}else{
		var c = 0;
		_.each(this.obj, function(arr){
			c += arr.length;
		});
		return c;
	}
}

SetHandle.prototype.eachJson = function(cb, endCb){
	var json = this.toJson();
	_.each(json, function(v){
		cb(v);
	});
	if(endCb) endCb();
}
SetHandle.prototype.contains = function(desiredHandle){
	var desiredId = desiredHandle.id();
	var desiredType = desiredHandle._typeCode();
	
	var arr = this.obj[desiredType];
	if(arr === undefined) return false;
	for(var i=0;i<arr.length;++i){
		var id = arr[i];
		if(_.isInteger(id)){
			if(id === desiredId) return true;
		}else{
			if(id[0][2] === desiredId) return true;
		}
	}
	return false;
}
SetHandle.prototype.get = function(desiredId, desiredType){
	_.assertLength(arguments, 1);
	
	if(this.obj === undefined){
		_.errout('unknown id: ' + desiredId);
	}
	
	if(desiredType === undefined){
		var types = this.types();
		_.assertLength(types, 1);
		desiredType = types[0];
	}
	
	var desiredTypeCode = this.getFullSchema()[desiredType].code;
	
	var a = this.getFromApiCache(desiredTypeCode, desiredId);
	if(a){
		a.prepare();
		return a;
	}
	
	var arr = this.obj[desiredTypeCode];
	if(arr){

		for(var i=0;i<arr.length;++i){
			var idOrObject = arr[i];
			if(_.isInteger(idOrObject)){
				var id = idOrObject;
				if(desiredId === id){
					a = this.getObjectApi(desiredTypeCode, id, this);
					_.assertObject(a);
					this.addToApiCache(desiredTypeCode, id, a);
					a.prepare();
					return a;
				}
			}else{
				var obj = idOrObject;
				var localObjId = obj[0][2];
				if(desiredId === localObjId){

					_.assertEqual(obj[0][3], desiredTypeCode);
					
					a = this.wrapObject(desiredTypeCode, obj, [], this);
					this.addToApiCache(desiredTypeCode, desiredId, a);
					a.prepare();
					return a;
				}
			}
		}
	}
	
	_.errout('unknown id: ' + desiredId);
}

function getObject(local, typeCode, id){

	_.assertInt(typeCode);
	
	var localObjId;
	if(_.isInteger(id)){
		localObjId = id;
	}else{
		localObjId = id[0][2];
	}
	
	var a = local.getFromApiCache(typeCode, localObjId);
	
	if(a === undefined){
		if(_.isInteger(id)){
			a = local.getObjectApi(typeCode, id, local);
		}else{
			a = local.wrapObject(typeCode, id, [], local);
		}
		local.addToApiCache(typeCode, localObjId, a);
	}
	_.assertObject(a);
	return a;
}

SetHandle.prototype.each = function(cb){
	//console.log('in each: ' + JSON.stringify(this.obj));
	//console.log(JSON.stringify(this.schema));
	if(this.schema.type.members.type === 'primitive'){
		_.each(this.obj, cb);
	}else{
		if(this.obj === undefined){
			return;
		}
		var local = this;
		_.each(this.obj, function(arr, typeCodeStr){
			
			for(var i=0;i<arr.length;++i){

				var id = arr[i];
				var typeCode = parseInt(typeCodeStr);
				var a = getObject(local, typeCode, id);
				a.prepare();
				cb(a, i);
			}
		});
	}
}

SetHandle.prototype.all = function(cb){
	var acc = true;
	this.each(function(h){
		var res = cb(h);
		_.assertBoolean(res);
		acc = acc && res;
	});
	return acc;
}

SetHandle.prototype.any = function(cb){
	var acc = false;
	this.each(function(h){
		var res = cb(h);
		_.assertBoolean(res);
		acc = acc || res;
	});
	return acc;
}

SetHandle.prototype.remove = function(objHandle){

	_.errout('TODO fix');

	var id = objHandle.id();
	var typeCode = objHandle._typeCode();
	var found = false;
	for(var i=0;i<this.obj.length;++i){
		var e = this.obj[i];
		if(_.isInteger(e[0])){
			if(e[0] === typeCode && e[1] === id){
				found = true;
				this.obj.splice(i, 1);
				break;
			}
		}else{
			var eId = e[0][2];
			if(id === eId){
				found = true;
				this.obj.splice(i, 1);
				break;
			}
		}
	}	
	
	if(found){
		this.getSh().persistEdit(
			this.getObjectTypeCode(), 
			this.getObjectId(), 
			this.getPath(), 
			{op: 'remove', id: id, type: typeCode},
			this.getEditingId());
			
		this.refresh()();
	}else{
		_.errout('tried to remove object not in collection, id: ' + id);
	}
}

SetHandle.prototype.changeListener = function(path, edit, syncId){
	_.assertLength(arguments, 3);
	if(path.length > 0) _.errout('TODO implement');
	
	if(edit.op === 'addExisting'){
		//console.log('added to set: ' + edit.id);
		var arr = this.obj[edit.type];
		if(arr === undefined) arr = this.obj[edit.type] = [];
		arr.push(edit.id);
		return this.refresh();
	}else{
		_.errout('@TODO implement op: ' + JSON.stringify(edit));
	}
}

function convertToJson(type, obj, objSchema, local){
	_.errout('TODO');
	
}

SetHandle.prototype.toJson = function(){
	
	if(this.schema.type.members.type === 'primitive'){
		if(this.obj !== undefined){
			return [].concat(this.obj);
		}else{
			return [];
		}
		//return JSON.stringify(this.obj);
	}else{
		var result = [];
		var local = this;
		var fullSchema = local.getFullSchema();
		_.each(this.obj, function(arr, typeCodeStr){
			var typeCode = parseInt(typeCodeStr);
			var objSchema = fullSchema._byCode[typeCode];
			if(objSchema.isView) objSchema = objSchema.schema;
			for(var i=0;i<arr.length;++i){
				var objOrId = arr[i];
				//if(_.isInteger(objOrId)){
					var a = getObject(local, typeCode, objOrId);
					result.push(a.toJson());
				//}else{
					//result.push(convertToJson(local.schema.type.members.type, objOrId, objSchema, local));
				//}
			}
		});

		return result;
	}	
}

SetHandle.prototype.types = function(){
	//console.log(JSON.stringify(this.schema));
	var fullSchema = this.getFullSchema();
	var objectSchema = fullSchema[this.schema.type.members.object];
	return recursivelyGetLeafTypes(objectSchema, fullSchema);
}

function SetHandle(typeSchema, obj, part, parent){
	this.part = part;
	this.obj = obj;
	this.parent = parent;
	this.schema = typeSchema;

	this.apiCache = {};

	if(this.schema.type.members.type !== 'primitive'){
		_.assertNot(_.isArray(this.obj));
		if(obj !== undefined) _.assertNot(this.obj[0]);
	}	
	//console.log('made set: ' + (obj ? obj.length : 'undefined'));
	//console.log(new Error().stack);
}

function ListHandle(typeSchema, obj, part, parent){
	this.part = part;
	this.obj = obj;
	this.parent = parent;
	this.schema = typeSchema;

	this.apiCache = {};
	
	_.assertNot(obj === null);
}

ListHandle.prototype.prepare = function(){
}
SetHandle.prototype.prepare = function(){
}

ListHandle.prototype.toJson = SetHandle.prototype.toJson;
ListHandle.prototype.get = SetHandle.prototype.get;
ListHandle.prototype.count = SetHandle.prototype.count;
ListHandle.prototype.types = SetHandle.prototype.types;
ListHandle.prototype.all = SetHandle.prototype.all;
ListHandle.prototype.any = SetHandle.prototype.any;

ListHandle.prototype.remove = function(objHandle){

	if(this.schema.type.members.type === 'primitive'){
		var index = this.obj.indexOf(objHandle);
		if(index !== undefined){
	
			this.obj.splice(index, 1);
	
			this.getSh().persistEdit(
				this.getObjectTypeCode(), 
				this.getObjectId(), 
				this.getPath(), 
				{op: 'removePrimitive', value: objHandle},
				this.getEditingId());
			
			this.refresh()();
		}else{
			_.errout('tried to remove object not in collection, id: ' + id);
		}
	}else{
	
		var id = objHandle.id();
		var typeCode = objHandle._typeCode();

		var index = findListElement(this.obj, typeCode, id);
	
		if(index !== undefined){
	
			this.obj.splice(index, 1);
			this.clearApiCache(typeCode, id);
	
			this.getSh().persistEdit(
				this.getObjectTypeCode(), 
				this.getObjectId(), 
				this.getPath().concat([typeCode, id]), 
				{op: 'remove'},
				this.getEditingId());
			
			this.refresh()();
		}else{
			_.errout('tried to remove object not in collection, id: ' + id);
		}
	}
}
ListHandle.prototype.get = function(desiredId, desiredTypeCode){
	//_.assertLength(arguments, 1);
	_.assert(arguments.length >= 1);
	_.assert(arguments.length <= 2);
	
	if(desiredTypeCode === undefined){
		var types = this.types();
		_.assertLength(types, 1);
		desiredTypeCode = this.getFullSchema()[types[0]];
	}
	
	if(this.obj === undefined){
		_.errout('unknown id: ' + desiredId);
	}
	
	var a = this.getFromApiCache(desiredTypeCode, desiredId);
	if(a) return a;

	var index = findListElement(this.obj, desiredTypeCode, desiredId);
	if(index === undefined){

		_.errout('unknown id: ' + desiredId);
	}

	var e = this.obj[index];
		
	if(_.isInteger(e[1])){
		a = this.getObjectApi(desiredTypeCode, desiredId);
		this.addToApiCache(desiredTypeCode, desiredId, a);
	}else{
		a = this.wrapObject(desiredTypeCode, e[1], [], this);
		this.addToApiCache(desiredTypeCode, desiredId, a);
	}
	return a;
	
}

function objKey(obj){
	return _.isInteger(obj[1]) ? obj[0] + ':' + obj[1] : (obj[1][0][3] + ': ' + obj[1][0][2]);
}

ListHandle.prototype.each = function(cb, endCb){
	if(this.schema.type.members.type === 'primitive'){
		_.each(this.obj, cb);
		if(endCb) endCb();
	}else{
		if(this.obj === undefined){
			if(endCb) endCb();
			return;
		}
		var local = this;

		for(var i=0;i<this.obj.length;++i){

			var id = this.obj[i];
			var typeCode = id[0];
			var actualId =  _.isInteger(id[1]) ? id[1] : id[1][0][2];
			
			_.assertInt(typeCode);
			_.assertInt(actualId);

			var a = local.getFromApiCache(typeCode, actualId);
			
			if(a === undefined){
				if(_.isInteger(id[1])){
					a = local.getObjectApi(typeCode, actualId, local);
				}else{
					var obj = id[1];
					a = local.wrapObject(typeCode, obj, [], local);
				}
				local.addToApiCache(typeCode, actualId, a);
			}
			_.assertObject(a);
			a.prepare();
			cb(a, i);
		}
	}
}
ListHandle.prototype.changeListener = function(path, edit, syncId){
	_.assertLength(arguments, 3);

	if(edit.op === 'replaceNew' || edit.op === 'replaceExisting'){

		if(edit.op === 'replaceExisting'){
			if(this.getEditingId() !== syncId){
				_.errout('^TODO implement op: ' + JSON.stringify(edit));
			}	
			return stub;
		}else{// if(edit.op === 'replaceNew'){
			if(this.getEditingId() === syncId){
				reifyTemporary();
			}else{
				//_.errout('(' + syncId + ' !== ' + this.getEditingId() + ') $TODO implement op: ' + JSON.stringify(edit));
				var removeType = path[path.length-2];
				var removeId = path[path.length-1];
				var index = findListElement(this.obj, removeType, removeId);
				if(index === -1){
					_.errout('not sure what to do about a replace of something already missing!');
				}else{
			
					var objHandle = this.get(removeId, removeType);
				
					_.assertObject(objHandle);
			
					doListReplaceNew(this, objHandle, edit.type, edit.id);

					return this.refresh();
				
				}
			}	
			return this.refresh();
		}
	}

	if(path.length > 0){
	
		_.assert(path.length >= 2);
		
		var a = this.get(path[1], path[0]);
		_.assertObject(a);
		
		
		return a.changeListener(path.slice(2), edit, syncId);
	}	
	
	var local = this;
	
	function reifyTemporary(){
		var realId = edit.id;
		console.log('reifying temporary');
		var did = false;
		
		var index = findListElement(local.obj, edit.type, edit.temporary);
		if(index === undefined){
			_.errout('cannot reify missing object: ' + edit.type + ' ' + edit.id);
		}
		
		var e = local.obj[index];
		if(_.isInteger(e[1])){
			e[1] = edit.id;
			local.parent.reifyExternalObject(edit.type, edit.temporary, edit.id);
		}else{
			_.assertEqual(e[1][0][2], edit.temporary);
			_.assertEqual(e[0], edit.type);
			e[1][0][2] = edit.id;
		}

		console.log('reified temporary id ' + edit.temporary + ' -> ' + edit.id);

		var key = edit.type + ':' + edit.temporary;
		console.log(JSON.stringify(_.keys(local.apiCache)));
		if(local.apiCache[key]){
			var newKey = edit.type + ':' + edit.id;
			_.assert(local.apiCache[newKey] === undefined);
			local.apiCache[newKey] = local.apiCache[key];
			//local.apiCache[key].invalidated = true;
			//_.assertEqual(local.apiCache[key].objectId, edit.id);
			local.apiCache[key].objectId = edit.id;
			delete local.apiCache[key];
			console.log('reified api cache entry');
			//TODO nothing actually happens here !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!1
		}
	}
	
	if(edit.op === 'addNew'){
		//console.log('added to set: ' + edit.id);
		//this.obj.push(edit.id);
		if(this.getEditingId() === syncId){
			reifyTemporary();
			//if(edit.external){
			//	console.log('reifying external addNew');
				//this.parent.reifyExternalObject(edit.type, edit.temporary, edit.id);				
			//}
		}
				
		return this.refresh();
	}else if(edit.op === 'add'){
		if(this.getEditingId() !== syncId){
			_.errout('TODO');
		}else{
			return stub;
		}
	}else if(edit.op === 'remove'){
		if(this.getEditingId() !== syncId){
			var index = findListElement(this.obj, edit.type, edit.id);
			if(index === -1){
				console.log('ignoring redundant remove: ' + edit.type + ' ' + edit.id);
			}else{
				this.obj.splice(index, 1);
				this.clearApiCache(edit.type, edit.id);
				
				return this.refresh();
			}
		}		
		return stub;
	}else if(edit.op === 'removePrimitive'){
		if(this.getEditingId() !== syncId){
			var index = this.obj.indexOf(edit.value);
			if(index === -1){
				console.log('ignoring redundant remove: ' + edit.value);
			}else{
				this.obj.splice(index, 1);
				
				return this.refresh();
			}
		}		
		return stub;
	}else if(edit.op === 'addExisting'){
		if(this.getEditingId() !== syncId){
			_.errout('^TODO implement op: ' + JSON.stringify(edit));
		}	
		return stub;
	}else if(edit.op === 'replaceExisting'){
		if(this.getEditingId() !== syncId){
			_.errout('^TODO implement op: ' + JSON.stringify(edit));
		}	
		return stub;
	}else if(edit.op === 'setObject'){
		if(this.getEditingId() !== syncId){
			_.errout('&TODO implement op: ' + JSON.stringify(edit));
		}	
		return stub;
	}else if(edit.op === 'set'){
		if(this.getEditingId() !== syncId){
			_.errout('*TODO implement op: ' + JSON.stringify(edit));
		}	
		return stub;
	}else{
		_.errout('+TODO implement op: ' + JSON.stringify(edit));
	}
}

/*
//note that ids produced in this way are temporary ids
function findUnusedId(arr){
	var largest = 0;
	_.each(arr, function(obj){
		if(!_.isInteger(obj)){
			var id = obj[0][2];
			largest = Math.max(id, largest);
		}
	});
	
	return largest + 1;
}*/

var temporaryIdCounter = -1;

function findListElement(arr, typeCode, id){
	for(var i=0;i<arr.length;++i){
		var e = arr[i];
		if(e[0] === typeCode){
			if(_.isInteger(e[1])){
				if(e[1] === id){
					return i;
				}
			}else{
				var obj = e[1];
				var eId = obj[0][2];
				if(id === eId){
					return i;
				}
			}
		}
	}
}

function doListReplaceNew(list, objHandle, newTypeCode, newId){

	var id = objHandle.id();
	var oldTypeCode = objHandle._typeCode();
	//_.assert(id >= 0);
	console.log('obj id: ' + id);
	console.log('arr: ' + JSON.stringify(list.obj));
	
	var index = findListElement(list.obj, oldTypeCode, id);
	
	if(index === undefined){
		_.errout('tried to remove object not in collection, id: ' + id);
	}

	objHandle.removeParent(list);
	
	list.obj.splice(index, 1, [newTypeCode, {0: [-1, -13, newId, newTypeCode]}]);
	
	list.clearApiCache(oldTypeCode, id);
}


ListHandle.prototype.replaceNew = function(objHandle, typeName){

	var id = objHandle.id();
	var oldTypeCode = objHandle._typeCode();
	var type = this.getFullSchema()[typeName];

	var temporaryId = --temporaryIdCounter;

	doListReplaceNew(this, objHandle, type.code, temporaryId);

	//_.assert(id >= 0);
	
	this.getSh().persistEdit(
		this.getObjectTypeCode(), 
		this.getObjectId(), 
		this.getPath().concat([oldTypeCode, id]), 
		{op: 'replaceNew', /*removeId: id, removeType: oldTypeCode, */temporary: temporaryId, type: type.code},
		this.getEditingId());
	
	
	this.refresh()();	
}

ListHandle.prototype.replaceExisting = function(oldObjHandle, newObjHandle){
	_.assertLength(arguments, 2);
	
	if(!(newObjHandle instanceof TopObjectHandle)) _.errout('TODO implement hoist to top');
	
	if(this.obj === undefined){
		_.errout('cannot replaceExisting on empty list');
	}
	
	var oldTypeCode = oldObjHandle._typeCode();
	var oldId = oldObjHandle.id();

	var index = findListElement(this.obj, oldTypeCode, oldId);

	this.clearApiCache(oldTypeCode, oldId);
	
	if(index === undefined){
		_.errout('object to replace not found');
	}
	
	var typeCode = newObjHandle._typeCode();
	var id = newObjHandle.id();
	
	this.obj[index] = [typeCode, id];
	
	this.getSh().persistEdit(
		this.getObjectTypeCode(), 
		this.getObjectId(), 
		this.getPath(), 
		{op: 'replaceExisting', 
			oldType: oldTypeCode,
			oldId: oldId,
			type: typeCode,
			id: id
		},
		this.getEditingId());

	this.refresh()();	
}

ListHandle.prototype.add = function(value){
	//console.log(JSON.stringify(this.schema));
	_.assert(this.schema.type.members.type === 'primitive');
	
	this.getSh().persistEdit(
		this.getObjectTypeCode(), 
		this.getObjectId(), 
		this.getPath(), 
		{op: 'add', value: value},
		this.getEditingId());

	if(this.obj === undefined) this.obj = [];
	
	this.obj.push(value);
		
	this.refresh()();
	console.log('after refreshing from list.add');	
}

ListHandle.prototype.addExisting = function(objHandle){
	_.assertLength(arguments, 1);
	
	if(!(objHandle instanceof TopObjectHandle)) _.errout('TODO implement hoist to top');
	
	this.getSh().persistEdit(
		this.getObjectTypeCode(), 
		this.getObjectId(), 
		this.getPath(), 
		{op: 'addExisting', type: objHandle._typeCode(), id: objHandle.id()},
		this.getEditingId());

	if(this.obj === undefined) this.obj = [];
	
	this.obj.push([objHandle._typeCode(), objHandle.id()]);
		
	this.refresh()();	
}

ListHandle.prototype.addNewExternal = function(typeName){
	this.addNew(typeName, external);
}
ListHandle.prototype.addNew = function(typeName, external){

	if(typeName === undefined){
		//there must be a unambiguous type, or that type must be specified
		_.assertLength(this.types(), 1);
		typeName = this.types()[0];
	}
	
	var tt = this.types();
	var found = false;
	for(var i=0;i<tt.length;++i){
		if(tt[i] === typeName){
			found = true;
			break;
		}
	}
	
	_.assert(found);
	
	var type = this.getFullSchema()[typeName];
	_.assertObject(type);
	_.assertInt(type.code);//must not be an abstract type TODO provide better error
	
	var temporaryId = --temporaryIdCounter;
	
	var ee = {op: 'addNew', temporary: temporaryId, type: type.code};
	if(external) ee.external = true;
	
	this.getSh().persistEdit(
		this.getObjectTypeCode(), 
		this.getObjectId(), 
		this.getPath(), 
		ee,
		this.getEditingId());
	
	if(this.obj === undefined) this.obj = [];
	
	if(external){
		this.obj.push([type.code, temporaryId]);
		this.createNewExternalObject(type.code, temporaryId);
	}else{
		this.obj.push([type.code, {0: [-1, -13, temporaryId, type.code]}]);
	}
		
	this.refresh()();
	console.log('finished refresh after addNew');
}


function MapHandle(typeSchema, obj, part, parent){
	this.part = part;
	this.obj = obj;
	this.parent = parent;
	this.schema = typeSchema;
}

MapHandle.prototype.each = function(cb){
	//console.log(JSON.stringify(this.schema.type));
	if(this.schema.type.value.type === 'primitive'){
		for(var i=0;i<this.obj.length;++i){
			var e = this.obj[i];
			cb(e[0], e[1]);
		}
	}else{
		for(var i=0;i<this.obj.length;++i){
			var e = this.obj[i];
			var key = e[0];
			var idOrValue = e[1];
			if(typeof(idOrValue) === 'number'){
				var a = this.apiCache[idOrValue];
				if(a === undefined) a = this.getObjectApi(this.schema.type.members.objectCode, id);
				cb(key, a);
			}else{
				_.errout('TODO');
			}
		}
	}
}
MapHandle.prototype.has = function(desiredKey){
	_.assertLength(arguments, 1);
	
	for(var i=0;i<this.obj.length;++i){
		var e = this.obj[i];
		var key = e[0];
		if(key === desiredKey){
			return true;
		}
	}
	return false;
}
MapHandle.prototype.value = function(desiredKey){
	_.assertLength(arguments, 1);
	
	for(var i=0;i<this.obj.length;++i){
		var e = this.obj[i];
		var key = e[0];
		if(key === desiredKey){
			var idOrValue = e[1];
			if(this.schema.type.value.type === 'object'){
				var a = this.apiCache[idOrValue];
				if(a === undefined) a = this.getObjectApi(this.schema.type.members.objectCode, id);
				return a;
			}else if(this.schema.type.value.type === 'primitive'){
				return idOrValue;
			}else{
				_.errout('TODO: ' + JSON.stringify(this.schema));
			}
			break;
		}
	}
}
MapHandle.prototype.toJson = function(){
	var result = {};
	if(this.schema.type.value.type === 'primitive'){
		for(var i=0;i<this.obj.length;++i){
			var e = this.obj[i];
			result[e[0]] = e[1];
		}
	}else{
		this.each(function(key, value){
			result[key] = value.toJson();
		});
	}
	return result;
}
MapHandle.prototype.changeListener = function(path, edit, syncId){

	if(syncId === this.getEditingId()){
		return stub;//TODO deal with local/global priority
	}

	if(edit.op === 'put'){
		this.obj.push([edit.key, edit.value]);
	}else{
		_.errout('-TODO implement op: ' + JSON.stringify(edit));
	}

	return this.refresh();
}

function stub(){}

function primitiveChangeListener(path, edit, syncId){
	_.assertLength(path, 0);

	if(syncId === this.getEditingId()){
		return stub;//TODO deal with local/global priority
	}
	
	if(edit.op === 'set'){
		this.obj = edit.value;
	}else{
		_.errout('-TODO implement op: ' + JSON.stringify(edit));
	}
	
	return this.refresh();
}
function IntHandle(typeSchema, obj, part, parent){
	this.part = part;
	this.obj = obj;
	//_.assertInt(obj);
	//_.assertDefined(this.obj);
	this.parent = parent;
}
IntHandle.prototype.value = function(){
	//_.assertDefined(this.obj);
	return this.obj;
}
IntHandle.prototype.changeListener = primitiveChangeListener;
IntHandle.prototype.set = function(v){
	this.obj = v;

	this.getSh().persistEdit(
		this.getObjectTypeCode(), 
		this.getObjectId(), 
		this.getPath(), 
		{op: 'set', value: this.obj}, 
		this.getEditingId());
		
	this.refresh()();

}
function BooleanHandle(typeSchema, obj, part, parent){
	
	this.part = part;
	this.parent = parent;
	_.assertObject(parent);
	
	if(obj === undefined){
		if(typeSchema.tags['default:false']) obj = false;
		else if(typeSchema.tags['default:false']) obj = true;
	}

	this.obj = obj;
}
BooleanHandle.prototype.value = function(){
	return this.obj;
}
BooleanHandle.prototype.changeListener = primitiveChangeListener;
BooleanHandle.prototype.set = function(v){
	this.obj = v;

	this.getSh().persistEdit(
		this.getObjectTypeCode(), 
		this.getObjectId(), 
		this.getPath(), 
		{op: 'set', value: this.obj}, 
		this.getEditingId());
		
	this.refresh()();

}
function TimestampHandle(typeSchema, obj, part, parent){
	this.part = part;
	this.obj = obj;
	this.parent = parent;
	_.assertObject(parent);
}

function LongHandle(typeSchema, sh, obj, part, parent){
	this.part = part;
	this.sh = sh;
	this.obj = obj;
	this.parent = parent;
}

TimestampHandle.prototype.changeListener = primitiveChangeListener;

TimestampHandle.prototype.set = function(v){
	var sh = this.getSh();
	sh.setContext(this.getEditingId(), this.getPath());
	this.obj = v;
	sh.setTimestamp(this.obj);
	this.refresh()();
}
TimestampHandle.prototype.setNow = function(){
	//this.sh.setContext(this.getEditingId(), this.path);
	this.obj = Date.now();

	this.getSh().persistEdit(
		this.getObjectTypeCode(), 
		this.getObjectId(), 
		this.getPath(), 
		{op: 'set', value: this.obj}, 
		this.getEditingId());
		
	this.refresh()();
}
TimestampHandle.prototype.value = function(){
	return this.obj;
}
TimestampHandle.prototype.toJson = function(){
	return this.obj;
}

function StringHandle(typeSchema, obj, part, parent){
	this.part = part;
	this.parent = parent;
	
	if(obj === undefined){
		_.each(typeSchema.tags, function(value, tag){
			if(tag.indexOf('default:') === 0){
				var defStr = tag.substr(tag.indexOf(':')+1);
				defStr = JSON.parse(defStr);
				obj = defStr;
			}
		});
	}
	this.obj = obj;
}
StringHandle.prototype.set = function(str){
	
	this.obj = str;
	
	//console.log('path: ' + JSON.stringify(this.getPath()));
	this.getSh().persistEdit(
		this.getObjectTypeCode(), 
		this.getObjectId(), 
		this.getPath(), 
		{op: 'set', value: this.obj}, 
		this.getEditingId());
		
	this.refresh()();
}
StringHandle.prototype.value = function(){
	return this.obj === undefined ? '' : this.obj;
}
StringHandle.prototype.toJson = function(){
	return this.obj;
}

StringHandle.prototype.changeListener = primitiveChangeListener;


addCommonFunctions(StringHandle.prototype);
addCommonFunctions(TimestampHandle.prototype);
addCommonFunctions(LongHandle.prototype);
addCommonFunctions(IntHandle.prototype);
addCommonFunctions(BooleanHandle.prototype);
addCommonFunctions(SetHandle.prototype);
addCommonFunctions(ListHandle.prototype);
addCommonFunctions(SyncApi.prototype);
addCommonFunctions(ObjectHandle.prototype);
addCommonFunctions(TopObjectHandle.prototype);
addCommonFunctions(MapHandle.prototype);

//TODO more handle types

if(typeof(exports) !== 'undefined'){
	exports.make = function(typeSchema, sh, snap, typeCode, id){
		_.assertLength(arguments, 5);
		_.assertObject(typeSchema);
		_.assertObject(sh);
		_.assertObject(snap);
	
		return new SyncApi(typeSchema, sh, snap, typeCode, id);
	}
}else{
	makeSyncApi = function(typeSchema, sh, snap, typeCode, id){
		_.assertLength(arguments, 5);
		_.assertObject(typeSchema);
		_.assertObject(sh);
		_.assertObject(snap);
		
		//console.log('getting sync api');
	
		return new SyncApi(typeSchema, sh, snap, typeCode, id);
	}
}

})();

