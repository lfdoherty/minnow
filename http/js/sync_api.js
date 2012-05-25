"use strict";

/*

This implements the object/view API for minnow.

*/

var u = require('./api/util')

var makeSyncApi;

var _ = require('underscorem');
var jsonutil = require('./jsonutil')

function setPropertyValue(obj, code, value){
	obj[code] = value;
}

function refresh(e){
	return this.doRefresh({}, true, e);
}
function emit(e, eventName){
	var afterCallbacks = []
		
	var args = Array.prototype.slice.call(arguments, 2)
	
	if(this.onListeners && this.onListeners[eventName]){
		this.onListeners[eventName].forEach(function(cb){
			var af = cb.apply(undefined, args)
			if(af) afterCallbacks.push(af)
		})
	}

	var fullRefresh = this.doRefresh({}, true, e);
	if(fullRefresh) afterCallbacks.push(fullRefresh)	

	return function(){
		for(var i=0;i<afterCallbacks.length;++i){
			afterCallbacks[i]()
		}
	}
}
function on(eventName, cb){
	if(this.onListeners === undefined) this.onListeners = {}
	if(this.onListeners[eventName] === undefined) this.onListeners[eventName] = []
	this.onListeners[eventName].push(cb)
}
function off(eventName, cb){
	if(arguments.length === 0){
		this.onListeners = undefined
	}else if(arguments.length === 1){
		this.onListeners[eventName] = undefined
	}else{
		if(this.onListeners === undefined){
			console.log('WARNING: off called for eventName: ' + eventName + ', but no listeners have ever been added.')
			return
		}
		var listeners = this.onListeners[eventName]
		var ii = listeners.indexOf(cb)
		if(ii !== -1){
			listeners.splice(cb, 1)
		}else{
			console.log('WARNING: off called for eventName: ' + eventName + ', but listener function not found.')
		}
	}
}

function removeListener(listenerName){

	if(this.refreshListeners === undefined || this.refreshListeners[listenerName] === undefined){
		console.log('WARNING: no refresh listener by name: ' + listenerName);
	}else{
		delete this.refreshListeners[listenerName];
	}
	
	return true;
}
function listenForRefresh(listenerName, listener){
	if(arguments.length === 1){
		listener = listenerName
		listenerName = Math.random()+'_refresh_handle';
	}else{
		if(arguments.length !== 2){
			throw new Error('wrong number of arguments for onChange([listenerName], listener)')
		}
	}
	_.assertString(listenerName);
	_.assertFunction(listener);
	//console.log('listening for refresh: ' + this.constructor);
	if(this.refreshListeners === undefined) this.refreshListeners = {};
	this.refreshListeners[listenerName] = listener;
}

function addRefreshFunctions(classPrototype){
	if(classPrototype.refresh === undefined) classPrototype.refresh = refresh;
	if(classPrototype.on === undefined) classPrototype.on = on;
	if(classPrototype.off === undefined) classPrototype.off = off;
	if(classPrototype.emit === undefined) classPrototype.emit = emit;
	if(classPrototype.doRefresh === undefined) classPrototype.doRefresh = u.doRefresh;
	if(classPrototype.listenForRefresh === undefined){
		classPrototype.listenForRefresh = listenForRefresh;
		classPrototype.onChange = listenForRefresh;
	}
	if(classPrototype.removeListener === undefined) classPrototype.removeListener = removeListener;
}

function removeParent(p){
	_.assert(this.parent === p);
	this.parent = undefined;
}

function addToApiCache(id, obj){
	_.assertLength(arguments, 2);
	_.assert(_.isInteger(id) || _.isString(id));
	_.assertObject(obj);
	this.apiCache[id] = obj;
}

function clearApiCache(id){
	_.assertLength(arguments, 1);
	_.assert(_.isInteger(id) || _.isString(id));
	delete this.apiCache[id];
}
function getFromApiCache(id){
	_.assertLength(arguments, 1);
	_.assert(_.isInteger(id) || _.isString(id));
	return this.apiCache[id];
}

function propertyUidFunction(){
	return this.parent.uid() + '-' + this.part[0];
}
function prepareStub(){
}

function saveEdit(op, edit){
	this.getSh().persistEdit(
		this.getObjectId(), 
		this.getPath(),
		op,
		edit,
		this.getEditingId());
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

	if(classPrototype.saveEdit === undefined) classPrototype.saveEdit = saveEdit;
}


function getEditingId(){
	var eId = this.parent.getEditingId();
	//console.log('rec editingId: ' + eId);
	return eId;
}


function getObjectApi(idOrViewKey, sourceParent){
	return this.parent.getObjectApi(idOrViewKey, sourceParent);
}

function createNewExternalObject(typeCode, temporaryId){
	_.assertDefined(this.parent);
	return this.parent.createNewExternalObject(typeCode, temporaryId);
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
	this.snap = {latestVersionId: snap.latestVersionId, objects: {}};

	this.cachedProperties = {};
	
	this.changeListener = SyncApi.prototype.changeListener.bind(this);
	_.assertFunction(this.changeListener);

	var typeSchema = schema._byCode[typeCode];
	if(typeSchema.isView) typeSchema = typeSchema.schema;
	
	//console.log(typeCode + ' ' + id);
	console.log('snap: ' + JSON.stringify(snap))
	_.assertObject(snap.objects)

	var objs = snap.objects;
	//_.assertArray(objs)
	for(var i=0;i<objs.length;++i){
		var obj = objs[i];
		this.snap.objects[obj.object.meta.id] = obj.object
	}
    console.log('getting view object, id(' + id + ')')
	_.assertDefined(this.snap.objects[id]);
	
	this.objectApiCache = {};
	this.id = id;
	this.typeCode = typeCode;
	this.typeSchema = typeSchema;
}
SyncApi.prototype.getSh = function(){return this.sh;}
SyncApi.prototype.getRoot = function(){
	if(this.root === undefined){
		//console.log('getting root');
		this.root = this.getObjectApi(this.id, this);
		//console.log(JSON.stringify(this.root.obj))
		this.root.prepare();
	}
	return this.root;
}
SyncApi.prototype.changeListener = function(id, path, op, edit, syncId, editId){
	_.assertLength(arguments, 6);
	//_.assertInt(syncId);
	_.assertString(op);
	_.assertInt(syncId);
	_.assert(_.isInt(id) || _.isString(id));
	_.assert(_.isInteger(syncId) || syncId === undefined);

	//console.log('SyncApi changeListener: ' + op + ' ' + JSON.stringify(edit).slice(0,1000))
	
	if(path.length === 0){
		if(op === 'objectSnap'){
			//_.assertDefined(edit.id);
			//_.assertDefined(edit.value);
			//
			console.log('edit: ' + JSON.stringify(edit))
			var obj = edit.value.object
			var realId = obj.meta.id
			if(this.snap.objects[realId]){
				//TODO replacing is an error except during setup
				var cur = this.snap.objects[realId]
				if(cur.meta.editId >= obj.meta.editId){
					console.log('already has and up to date: ' + realId + ' (' + cur.meta.editId + '>=' + obj.meta.editId + ')');
					return function(){}
				}else{
					console.log('already has ' + realId+', replacing');
				}
				//return function(){}
			}else{
				console.log('got new object ' + edit.type + ' ' + realId);
			}
			
			this.snap.objects[realId] = obj
		}else if(op === 'setObjectToJson'){
		
			if(this.snap.objects[id]){
				console.log('replacing ' + id);
			}
			
			this.snap.objects[id] = edit.object;
			
			var api = this.getObjectApi(id, this);
			_.each(edit.object, function(value, pcStr){
				var pc = parseInt(pcStr);
				if(pc !== 0){
					api.obj[pc] = value;
				}
			});
			api.cachedProperties = {};
			api.prepared = false;
			var typeCode = api.getObjectTypeCode();
			var objSchema = this.schema._byCode[typeCode];
			_.each(objSchema.properties, function(p){
				delete api[p.name]
			});
			
		
			api.prepare();
			api.refresh()();
		}else if(op === 'make'){
			
			if(edit.temporary){
				var meta = edit.obj.object.meta
				_.assert(meta.id >= 0)
				this.reifyExternalObject(meta.typeCode, edit.temporary, meta.id);
			}
			
			if(this.objectCreationCallbacks && this.objectCreationCallbacks[edit.uid]){
				var cbb = this.objectCreationCallbacks[edit.uid]
				if(cbb){
					//console.log('edit: ' + JSON.stringify(edit))
					cbb(edit.obj.object.meta.id);
				}
			}
		}else{
			_.errout('TODO implement top-level op: ' + JSON.stringify(edit));
		}
		return function(){}
	}else{
		//console.log(path);
		_.assertInt(path[0]);
		
		if(this.snap.objects[id] === undefined){
			console.log('ignoring edit for object not known to view: ' + id)
			return function(){}
		}
		
		var objApi = this.getObjectApi(id, this);
		
		var typeCode = objApi.getObjectTypeCode();
		var st = this.schema._byCode[typeCode];
		//if(st.isView) st = st.schema;
		if(st.propertiesByCode[path[0]] === undefined){
			_.errout('type ' + st.name + ' has no property with code ' + path[0]);
		}
		var propertyName = st.propertiesByCode[path[0]].name;
		_.assertString(propertyName);
		
		if(op === 'setObject' && path.length === 1){
			setPropertyValue(objApi.obj, path[0], edit.id);
			delete objApi.cachedProperties[propertyName]
			delete objApi[propertyName];
			objApi[propertyName] = objApi.property(propertyName);
			//console.log('set object!!!!!!!!!!!!1');
			if(this.root){
				return this.root.refresh(edit);
			}
			return this.refresh(edit);
		}else{
			var v = objApi.property(propertyName);
			_.assertObject(v);
			_.assertString(op)
			return v.changeListener(path.slice(1), op, edit, syncId);	
		}
	}
}
function getFullSchema(){ return this.parent.getFullSchema();}
SyncApi.prototype.getFullSchema = function(){return this.schema;}
SyncApi.prototype.setEditingId = function(editingId){
	this.editingId = editingId;
}
SyncApi.prototype.createNewExternalObject = function(typeCode, temporaryId){
	//console.log('created external object ' + typeCode + ' ' + temporaryId)
	return this.snap.objects[temporaryId] = {meta: {id: temporaryId, typeCode: typeCode, editId: -1}};
}
SyncApi.prototype.reifyExternalObject = function(typeCode, temporaryId, realId){
	console.log('reifying id ' + temporaryId + ' -> ' + realId)
	
	var obj = this.snap.objects[temporaryId]
	delete this.snap.objects[temporaryId]
	this.snap.objects[realId] = obj

	console.log('*snap: ' + JSON.stringify(this.snap))
	
	var typeList = this.snap.objects
	typeList[realId] = typeList[temporaryId];
	delete typeList[temporaryId];
	var oldCacheKey = temporaryId;
	var newCacheKey = realId;
	if(this.objectApiCache[oldCacheKey]){
		this.objectApiCache[newCacheKey] = this.objectApiCache[oldCacheKey];
		delete this.objectApiCache[oldCacheKey];
		var objApi = this.objectApiCache[newCacheKey];
		objApi.objectId = realId;
		objApi.obj.meta.id = realId;
		
	}
}

SyncApi.prototype.getObjectApi = function getObjectApi(idOrViewKey, sourceParent){

	//_.assertInt(typeCode);
	_.assertDefined(sourceParent);	

	//var cacheKey = idOrViewKey;
	var n = this.objectApiCache[idOrViewKey];

	if(n){
		return n;
	}

	var typeList = this.snap.objects//[typeCode];

	//console.log('snap: ' + JSON.stringify(this.snap))
	
	if(typeList === undefined) _.errout('looking for a type of object the snapshot has none of: ' + typeCode);
	var obj = typeList[idOrViewKey];
	//console.log('snap: ' + JSON.stringify(typeList))
	if(obj === undefined){
		console.log('snap: ' + JSON.stringify(typeList))
		_.errout('no object in snapshot with id: ' + idOrViewKey);
	}

	var typeCode = obj.meta.typeCode
	var t = this.schema._byCode[typeCode];

	if(t === undefined) _.errout('cannot find object type: ' + typeCode);

	n = new TopObjectHandle(this.schema, t, obj, this, idOrViewKey);
	this.objectApiCache[idOrViewKey] = n;
	
	if(!t.superTypes.invariant) n.registerSourceParent(sourceParent);
	
	return n;
}
SyncApi.prototype.wrapObject = function(obj, part, sourceParent){
	_.assertLength(arguments, 3);
	_.assertArray(part);
	var typeCode = obj.meta.typeCode
	_.assertInt(typeCode)
	var t = this.schema._byCode[typeCode];
	_.assertDefined(t)
	//if(t.isView) t = t.schema;
	return new ObjectHandle(t, obj || {}, obj.meta.id, part, sourceParent);
}
SyncApi.prototype.getEditingId = function(){
	_.assertInt(this.editingId);
	//console.log('editingId: ' + this.editingId);
	return this.editingId;
}



function getObjectTypeCode(){
	return this.parent.getObjectTypeCode();
}
function getObjectId(){
	//console.log('passing up(' + this.constructor.name + '): ' + JSON.stringify(Object.keys(this)) + ' ' + this.readonly);
	var id = this.parent.getObjectId();
	//console.log('id: ' + id);
	return id;
}

function wrapObject(obj, part, sourceParent){
	return this.parent.wrapObject(obj, part, sourceParent);
}

var PrimitiveListHandle = require('./api/primitivelist')
addCommonFunctions(PrimitiveListHandle.prototype);

var ObjectListHandle = require('./api/objectlist')
_.assertDefined(ObjectListHandle.prototype)
addCommonFunctions(ObjectListHandle.prototype);

var PrimitiveSetHandle = require('./api/primitiveset')
addCommonFunctions(PrimitiveSetHandle.prototype);

var ObjectSetHandle = require('./api/objectset')
addCommonFunctions(ObjectSetHandle.prototype);
var ViewObjectSetHandle = require('./api/viewobjectset')
addCommonFunctions(ViewObjectSetHandle.prototype);

var MapHandle = require('./api/map')
addCommonFunctions(MapHandle.prototype);

var StringHandle = require('./api/string')
addCommonFunctions(StringHandle.prototype);

var IntHandle = require('./api/int')
addCommonFunctions(IntHandle.prototype);

var BinaryHandle = require('./api/binary')
addCommonFunctions(BinaryHandle.prototype);

var TimestampHandle = require('./api/timestamp')
var LongHandle = require('./api/long')
var BooleanHandle = require('./api/boolean')
addCommonFunctions(TimestampHandle.prototype);
addCommonFunctions(LongHandle.prototype);
addCommonFunctions(BooleanHandle.prototype);

var ObjectHandle = require('./api/object')
addCommonFunctions(ObjectHandle.prototype);

var TopObjectHandle = require('./api/topobject')
addCommonFunctions(TopObjectHandle.prototype);

function getClassForType(typeSchema, isView){
	_.assertLength(arguments, 2)
	
	var type = typeSchema.type;
	//console.log(type);
	//console.log(typeSchema);
	if(type.type === 'primitive'){
		if(type.primitive === 'string') return StringHandle;
		else if(type.primitive === 'int') return IntHandle;
		else if(type.primitive === 'long') return LongHandle;
		else if(type.primitive === 'timestamp') return TimestampHandle;
		else if(type.primitive === 'boolean') return BooleanHandle;
		else if(type.primitive === 'binary') return BinaryHandle;
		else{
			_.errout('unknown primitive type, no class defined: ' + JSON.stringify(type));
		}
	}else if(type.type === 'list'){
		if(type.members.type === 'primitive'){
			return PrimitiveListHandle;
		}else{
			return ObjectListHandle;
		}
	}else if(type.type === 'set'){
		if(type.members.type === 'primitive'){
			return PrimitiveSetHandle;
		}else{
			if(isView){
				return ViewObjectSetHandle;
			}else{
				return ObjectSetHandle;
			}
		}
		//return SetHandle;
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
exports.getClassForType = getClassForType


function stub(){}

addCommonFunctions(SyncApi.prototype);

exports.make = function(typeSchema, sh, snap, typeCode, id){
	_.assertLength(arguments, 5);
	_.assertObject(typeSchema);
	_.assertObject(sh);
	_.assertObject(snap);

	return new SyncApi(typeSchema, sh, snap, typeCode, id);
}

