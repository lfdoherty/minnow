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

function _delayEmit(local, args){
	this.parent._delayEmit(local, args)
}
function emit(e, eventName){

	var args = Array.prototype.slice.call(arguments, 0)

	/*if(this._isPaused()){
		this._delayEmit(this, args)//e, eventName)
	}else{*/
		this._doEmit.apply(this, args)//(e, eventName)
	//}
}
/*function _isPaused(){
	return this.parent._isPaused()
}

SyncApi.prototype._isPaused = function(){
	return this.paused
}

SyncApi.prototype._delayEmit = function(local, args){
	_.assert(this.paused)
	if(this.waitingEvents === undefined) this.waitingEvents = []
	this.waitingEvents.push([local, args])
}*/

function _doEmit(e, eventName){
	var afterCallbacks = []
	
	//console.log('emitting ' + eventName)
	
	var args = Array.prototype.slice.call(arguments, 2)
	
	var t = this
	function callListener(listener){
		var af = listener.apply(t, args)
		if(af) afterCallbacks.push(af)
	}
	
	if(this.onListeners){
		if(this.onListeners[eventName]){
			this.onListeners[eventName].forEach(callListener)
		}
		if(this.onListeners['any']){
			this.onListeners['any'].forEach(callListener)
		}
	}
	if(this.onceListeners){
		if(this.onceListeners[eventName]){
			var arr = this.onceListeners[eventName]
			this.onceListeners[eventName] = undefined
			arr.forEach(callListener)
		}
		if(this.onceListeners['any']){
			var arr = this.onceListeners['any']
			this.onceListeners['any'] = undefined
			arr.forEach(callListener)
		}
	}

	return function(){
		for(var i=0;i<afterCallbacks.length;++i){
			afterCallbacks[i]()
		}
	}
}
function once(eventName, cb){
	if(arguments.length === 1){
		cb = eventName
		eventName = 'any'
	}
	_.assertString(eventName)
	_.assertFunction(cb)
	_.assert(eventName.length > 0)

	if(this.onceListeners === undefined) this.onceListeners = {}
	if(this.onceListeners[eventName] === undefined) this.onceListeners[eventName] = []
	this.onceListeners[eventName].push(cb)
}
function on(eventName, cb){
	if(arguments.length === 1){
		cb = eventName
		eventName = 'any'
	}
	_.assertString(eventName)
	_.assertFunction(cb)
	
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
			this.log('WARNING: off called for eventName: ' + eventName + ', but no listeners have ever been added.')
			return
		}
		var listeners = this.onListeners[eventName]
		var ii = listeners.indexOf(cb)
		if(ii !== -1){
			listeners.splice(cb, 1)
		}else{
			this.log('WARNING: off called for eventName: ' + eventName + ', but listener function not found.')
		}
	}
}

function removeListener(listenerName){

	if(this.refreshListeners === undefined || this.refreshListeners[listenerName] === undefined){
		this.log('WARNING: no refresh listener by name: ' + listenerName);
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
	if(classPrototype.on === undefined) classPrototype.on = on;
	if(classPrototype.once === undefined) classPrototype.once = once;
	if(classPrototype.off === undefined) classPrototype.off = off;
	if(classPrototype.emit === undefined) classPrototype.emit = emit;
	if(classPrototype._doEmit === undefined) classPrototype._doEmit = _doEmit
	//if(classPrototype._delayEmit === undefined) classPrototype._delayEmit = _delayEmit
	//if(classPrototype._isPaused === undefined) classPrototype._isPaused = _isPaused
}

function removeParent(p){
	_.assert(this.parent === p);
	this.parent = undefined;
}

function prepareStub(){
}

function persistEdit(op, edit){
	_.assertLength(arguments, 2)
	_.assertString(op)
	_.assertObject(edit)
	return this.parent.persistEdit(op, edit)
}

function adjustPathToSelf(){
	var remaining = this.parent.adjustPath(_.isArray(this.part) ? this.part[0] : this.part)
	//console.log('adjusted path to self: ' + JSON.stringify(remaining))
	if(remaining.length > 0){
		if(remaining.length === 1){
			this.persistEdit('ascend1', {})
		}else if(remaining.length === 2){
			this.persistEdit('ascend2', {})
		}else if(remaining.length === 3){
			this.persistEdit('ascend3', {})
		}else if(remaining.length === 4){
			this.persistEdit('ascend4', {})
		}else if(remaining.length === 5){
			this.persistEdit('ascend5', {})
		}else{
			this.persistEdit('ascend', {many: remaining.length})
		}
	}
}
function saveEdit(op, edit){
	this.adjustPathToSelf()
	this.persistEdit(op, edit)
}

function makeTemporaryId(){
	return this.parent.makeTemporaryId()
}

function _makeAndSaveNew(json, type){

	var temporary = this.makeTemporaryId();
	var edits = jsonutil.convertJsonToEdits(this.getFullSchema(), type.name, json, this.makeTemporaryId.bind(this));

	if(edits.length > 0){
		//this.adjustPath(temporary)
		this.parent.adjustPath(this.part)
		this.persistEdit('selectObject', {id: temporary})
		for(var i=0;i<edits.length;++i){
			var e = edits[i]
			this.persistEdit(e.op, e.edit)
		}
	}
	
	var n = new ObjectHandle(type, edits, temporary, [temporary], this);
	if(this.objectApiCache === undefined) this.objectApiCache = {}
	this.objectApiCache[temporary] = n;
	
	n.prepare()
	
	return n
}

function log(){
	this.parent.log.apply(this.parent, arguments)
}

function isView(){
	if(this.objectId && _.isString(this.objectId)) return true
	return this.parent.isView()
}

function versions(){
	var versions =  this.parent._getVersions([].concat(this.part))
	//if(versions.length === 0 || versions[0] > -1) versions.unshift(-1)
	return versions
}

function revert(editId){
	this.adjustPathToSelf()
	this.persistEdit('revert', {version: editId})
	//_.errout('TODO')
}

function _getVersions(path){
	var fp = [this.part].concat(path)//_.isArray(this.part) ? path.concthis.part[0] : this.part
	return this.parent._getVersions(fp)
}
/*
function getVersionTimestamps(versions, cb){
	_.assertArray(versions)
	_.assertFunction(cb)
	this.parent.getVersionTimestamps(versions, cb)
}*/

function getLastEditor(){
	return this.parent.getLastEditor()
}

function addCommonFunctions(classPrototype){
	addRefreshFunctions(classPrototype);
	if(classPrototype.getEditingId === undefined) classPrototype.getEditingId = getEditingId;
	if(classPrototype.getObjectApi === undefined) classPrototype.getObjectApi = getObjectApi;
	if(classPrototype.wrapObject === undefined) classPrototype.wrapObject = wrapObject;
	if(classPrototype.getFullSchema === undefined) classPrototype.getFullSchema = getFullSchema;
	if(classPrototype.removeParent === undefined) classPrototype.removeParent = removeParent;

	if(classPrototype.createNewExternalObject === undefined) classPrototype.createNewExternalObject = createNewExternalObject;
	if(classPrototype.reifyExternalObject === undefined) classPrototype.reifyExternalObject = reifyExternalObject;
	
	if(classPrototype.prepare === undefined) classPrototype.prepare = prepareStub;

	if(classPrototype.persistEdit === undefined) classPrototype.persistEdit = persistEdit;
	if(classPrototype.saveEdit === undefined) classPrototype.saveEdit = saveEdit;
	if(classPrototype.adjustPathToSelf === undefined) classPrototype.adjustPathToSelf = adjustPathToSelf;

	if(classPrototype.makeTemporaryId === undefined) classPrototype.makeTemporaryId = makeTemporaryId;
	if(classPrototype._makeAndSaveNew === undefined) classPrototype._makeAndSaveNew = _makeAndSaveNew;
	if(classPrototype.isView === undefined) classPrototype.isView = isView

	if(classPrototype.log === undefined) classPrototype.log = log

	if(classPrototype.versions === undefined) classPrototype.versions = versions
	if(classPrototype.revert === undefined) classPrototype.revert = revert
	if(classPrototype._getVersions === undefined) classPrototype._getVersions = _getVersions
	//if(classPrototype.getVersionTimestamps === undefined) classPrototype.getVersionTimestamps = getVersionTimestamps
	if(classPrototype.getLastEditor === undefined) classPrototype.getLastEditor = getLastEditor
}


function getEditingId(){
	var eId = this.parent.getEditingId();
	//console.log('rec editingId: ' + eId);
	return eId;
}


function getObjectApi(idOrViewKey, sourceParent){
	_.assertDefined(idOrViewKey)
	return this.parent.getObjectApi(idOrViewKey, sourceParent);
}

function createNewExternalObject(typeCode, obj, forget, cb){
	_.assertLength(arguments, 4)
	_.assertDefined(this.parent);
	return this.parent.createNewExternalObject(typeCode, obj, forget, cb);
}
function reifyExternalObject(typeCode, temporaryId, realId){
	_.assertDefined(this.parent);
	this.parent.reifyExternalObject(typeCode, temporaryId, realId);
}


function getPath(){
	return this.parent.getPath().concat(this.part);
}

function SyncApi(schema, sh, logger){
	_.assertObject(schema);
	_.assertFunction(logger)
	
	this.log = logger;
	
	this.temporaryIdCounter = -1;

	this.sh = sh;
	this.schema = schema;

	this.snap = {latestVersionId: -1, objects: {}};

	this.cachedProperties = {};
	
	this.changeListener = SyncApi.prototype.changeListener.bind(this);
	_.assertFunction(this.changeListener);

	this.objectApiCache = {};
	
	this.uid = Math.random()
	
	this.latestVersionId = -1
	//this.log('made SyncApi ' + this.uid)
}

SyncApi.prototype.makeTemporaryId = function(){
	--this.temporaryIdCounter;
	return this.temporaryIdCounter
}

SyncApi.prototype.getTopObject = function(id){
	_.assertInt(id)
	var handle = this.getObjectApi(id, this);
	handle.prepare();
	return handle;
}

SyncApi.prototype.getView = function(viewId){
	var view = this.getObjectApi(viewId, this);
	view.prepare();
	return view;
}

SyncApi.prototype.hasView = function(viewId){
	//var view = this.getObjectApi(viewId, this);
	//view.prepare();
	//return view;
	return this.objectApiCache[viewId] !== undefined
}

SyncApi.prototype.objectListener = function(id, edits){
	//console.log('working: ' + id + ' ' + JSON.stringify(edits))
	if(this.objectApiCache[id] !== undefined && _.isInt(id)){
		return
		//_.errout('TODO:')
	}
	var typeCode = edits[1].edit.typeCode
	var id = edits[1].edit.id
	var t = this.schema._byCode[typeCode];
	_.assertObject(t)
	if(this.objectApiCache[id] !== undefined){
		if(this.objectApiCache[id].prepared){
			_.errout('already prepared object being overwritten: ' + id)
		}
		console.log('WARNING: redundant update?: ' + id)
		return
	}
	_.assertUndefined(this.objectApiCache[id])
	var n = new TopObjectHandle(this.schema, t, edits, this, id);
	this.objectApiCache[id] = n;
	//n.pathEdits = undefined
}
SyncApi.prototype.addSnapshot = function(snap, typeCode, id){
	var objs = snap.objects;
	var local = this
	_.each(objs, function(obj, idStr){
		
		var cur = local.snap.objects[idStr]
		if(cur){
			if(cur.length >= obj.length){
				return
			}
			local.snap.objects[idStr] = cur.concat(obj.slice(cur.length))
		}else{
			local.snap.objects[idStr] = obj
		}
	})
}

SyncApi.prototype.persistEdit = function(typeCode, id, op, edit){
	//console.log('id: ' + id + ' for ' + op)
	//console.log(new Error().stack)
	//console.log('persistEdit: ' + JSON.stringify([typeCode, id, op, edit]))

	if(this.currentObjectId !== id){
		
		if(this.currentObjectId !== undefined){
			var handle = this.objectApiCache[this.currentObjectId]
			 if(handle){
				handle.currentPath = undefined
				//console.log('reset path: '+ this.currentObjectId)
			}else{
				//console.log('no handle: ' + this.currentObjectId)
			}
		}

		//console.log('selecting top object: ' + id + ' ' + op + ' ' + this.currentObjectId)
		
		this.currentObjectId = id

		//_.assert(this.objectApiCache[this.currentObjectId] === undefined)
		//console.log('current path: ' + JSON.stringify(this.objectApiCache[this.currentObjectId].currentPath))

		_.assert(id !== 0)
		_.assertInt(id)
		this.sh.persistEdit('selectTopObject', {id: id})
	}
	this.sh.persistEdit(op, edit)
}

SyncApi.prototype.getVersionTimestamps = function(versions, cb){
	this.sh.getVersionTimestamps(versions, cb)
}

SyncApi.prototype.onEdit = function(listener){
	if(this.changeListeners === undefined) this.changeListeners = []
	this.changeListeners.push(listener)
}

var DESTROYED_LOCALLY = {}
var DESTROYED_REMOTELY = {}
SyncApi.prototype._destroyed = function(objHandle){
	var id = objHandle._internalId()
	delete this.objectApiCache[id]
	delete this.snap.objects[id]
	this.currentTopObject = DESTROYED_LOCALLY
}

SyncApi.prototype.changeListener = function(op, edit, editId){
	_.assertLength(arguments, 3);
	_.assertString(op);
	_.assertInt(editId);

	if(op === 'destroy' && this.currentSyncId === this.getEditingId()){
		return
	}

	if(this.currentTopObject && op !== 'selectTopObject' && op !== 'selectTopViewObject' && op !== 'setSyncId'){
		if(this.currentTopObject === DESTROYED_REMOTELY){
			_.errout('could not execute edit, server error, object already destroyed removely: ' + op + ' ' + JSON.stringify(edit) + ' ' + this.currentSyncId + ' ' + editId)
		}else if(this.currentTopObject === DESTROYED_LOCALLY){
			this.log.warn('WARNING: could not execute edit, object already destroyed locally: ' + op, edit, this.currentSyncId, editId)
			return
		}
	}

	//this.log.info(this.uid+' SyncApi changeListener: ' + op + ' ', arguments)
	//console.log('*** ' + op + ': SyncApi changeListener: ' + JSON.stringify(edit) + ' - ' + this.currentSyncId + ' - ' + editId)

	//var hereKey = op+editId+JSON.stringify(edit)
	//if(this.lastKey === hereKey){
		//throw new Error('repeat: ' + hereKey)
	//}
	//this.lastKey = hereKey

	if(editId > -1){
		if(editId > this.latestVersionId) this.latestVersionId = editId
		if(editId < this.latestVersionId) throw new Error('edits arriving out of order: ' + editId + ' < ' +  this.latestVersionId)
	}
	
	//this.editsHappened.push({op: op, edit: edit, editId: editId})

	var local = this
	function makeViewObject(typeCode, id){
		//console.log('typeCode: ' + typeCode)
		var t = local.schema._byCode[typeCode];
		_.assertObject(t)
		var n = new TopObjectHandle(local.schema, t, [], local, id);
		_.assertUndefined(local.objectApiCache[id])
		local.objectApiCache[id] = n;
	}
	
	if(op === 'madeViewObject'){
		//if(this.currentTopObject) this.currentTopObject.pathEdits = undefined
		var n = makeViewObject(edit.typeCode, edit.id)
		this.currentTopObject = n
		return
	}else if(op === 'selectTopObject'){
		//if(this.currentTopObject) this.currentTopObject.pathEdits = undefined
		try{
			this.currentTopObject = this.getObjectApi(edit.id)
			//this.currentTopObject.pathEdits = undefined
		}catch(e){
			console.log('WARNING: might be ok if destroyed locally, but cannot find top object: ' + edit.id)
			this.currentTopObject = undefined
		}
		return
	}else if(op === 'selectTopViewObject'){
		//if(this.currentTopObject) this.currentTopObject.pathEdits = undefined
		this.currentTopObject = this.getObjectApi(edit.id)
		this.currentTopObject.pathEdits = undefined
		//console.log('pe: ' + JSON.stringify(this.currentTopObject.pathEdits))
		//_.assertUndefined(this.currentTopObject.pathEdits)
		//this.currentTopObject.pathEdits = undefined
		return
	}else if(op === 'setSyncId'){
		this.currentSyncId = edit.syncId
		return
	}

	if(this.currentTopObject === undefined){
		this.log.warn('might be ok if destroyed locally, but could not find top object')
		return
	}
	
	if(op === 'destroy'){
		var id = this.currentTopObject.id()
		delete this.objectApiCache[id]
		delete this.snap.objects[id]
		this.currentTopObject._destroy()
		this.currentTopObject = DESTROYED_REMOTELY
		//console.log('destroyed current object')
	}else{
		_.assertInt(this.currentSyncId)
		_.assertEqual(this.currentTopObject.parent, this)
		this.currentTopObject.changeListener(op, edit, this.currentSyncId, editId)
	}
}
function getFullSchema(){
	return this.parent.getFullSchema();
}
SyncApi.prototype.getFullSchema = function(){return this.schema;}
SyncApi.prototype.setEditingId = function(editingId){
	this.editingId = editingId;
}
SyncApi.prototype.createNewExternalObject = function(typeName, obj, forget, cb){
	_.assertLength(arguments, 4)
	_.assertString(typeName)

	var temporary = this.makeTemporaryId()
	
	var edits = this.sh.make(typeName, obj, forget, cb, temporary)

	var oldHandle = this.objectApiCache[this.currentObjectId]
	if(oldHandle){
		oldHandle.currentPath = undefined
	}
	
	this.currentObjectId = temporary//TODO only if !forget?
	
	if(!forget){
		var t = this.schema[typeName]
		var n = new TopObjectHandle(this.schema, t, edits, this, temporary);
		this.objectApiCache[temporary] = n;
		return n
	}
}
SyncApi.prototype.reifyExternalObject = function(temporaryId, realId){
	_.assertLength(arguments, 2)
	//this.log('reifying id ' + temporaryId + ' -> ' + realId)
	//console.log('reifying id ' + temporaryId + ' -> ' + realId + ' for ' + this.getEditingId())

	_.assert(temporaryId < 0)
	
	var oldCacheKey = temporaryId;
	var newCacheKey = realId;
	if(this.currentObjectId === temporaryId){
		this.currentObjectId = realId
	}
	if(this.objectApiCache[oldCacheKey]){
		var objApi = this.objectApiCache[newCacheKey] = this.objectApiCache[oldCacheKey];
		delete this.objectApiCache[oldCacheKey];
		objApi.objectId = realId;
		objApi.emit({}, 'reify', realId, temporaryId)//()
		//console.log('reified specific object')
	}
	/*
	if(this.objectCreationCallbacks && this.objectCreationCallbacks[temporaryId]){
		var cbb = this.objectCreationCallbacks[temporaryId]
		if(cbb){
			cbb(realId);
			delete this.objectCreationCallbacks[temporaryId]
		}
	}*/
}

/*
SyncApi.prototype.pause = function(){
	this.paused = true
	console.log('paused')
}
SyncApi.prototype.resume = function(){
	console.log('beginning resume')
	if(this.waitingEvents){
		for(var i=0;i<this.waitingEvents.length;++i){
			var e = this.waitingEvents[i]
			_doEmit.apply(e[0],e[1])
		}
	}
	this.paused = false
	this.waitingEvents = []
	console.log('resumed')
}*/

SyncApi.prototype.getObjectApi = function getObjectApi(idOrViewKey){

	var n = this.objectApiCache[idOrViewKey];
	if(n !== undefined){
		return n
	}
	var obj = this.snap.objects[idOrViewKey];
	if(obj === undefined){

		if(_.isString(idOrViewKey)){
			if(idOrViewKey === '') _.errout('cannot get the null view id')
			var typeCode = parseInt(idOrViewKey.substr(0, idOrViewKey.indexOf(':')))//TODO hacky!
			var t = this.schema._byCode[typeCode];
			_.assertObject(t)
			var n = new TopObjectHandle(this.schema, t, [], this, idOrViewKey);
			this.objectApiCache[idOrViewKey] = n;
			return n
		}

		console.log('snap: ' + JSON.stringify(this.snap).slice(0,5000))
		//console.log('edits: ' + JSON.stringify(this.editsHappened, null, 2))
		console.log('cache: ' + JSON.stringify(Object.keys(this.objectApiCache)))
		console.log(this.editingId + ' no object in snapshot with id: ' + idOrViewKey);
		return
	}
	//console.log(idOrViewKey+': ' + JSON.stringify(obj).slice(0,500))
	_.assert(obj.length > 0)
	
	if(obj[0].op === 'destroy'){
		return
	}

	var typeCode = obj[0].op === 'madeViewObject' ? obj[0].edit.typeCode : obj[1].edit.typeCode//first edit is a made op
	var t = this.schema._byCode[typeCode];

	if(t === undefined) _.errout('cannot find object type: ' + typeCode);
	
	n = new TopObjectHandle(this.schema, t, obj, this, idOrViewKey);
	this.objectApiCache[idOrViewKey] = n;

	return n
}
SyncApi.prototype.wrapObject = function(id, typeCode, part, sourceParent){
	_.assertLength(arguments, 4);
	_.assertInt(id)
	_.assertInt(typeCode)
	_.assertFunction(sourceParent.adjustPath)
	
	var t = this.schema._byCode[typeCode];
	//console.log('typeCode: ' + typeCode)
	_.assertDefined(t)
	return new ObjectHandle(t, [], id, part, sourceParent);
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

function wrapObject(id, typeCode, part, sourceParent){
	return this.parent.wrapObject(id, typeCode, part, sourceParent);
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
var RealHandle = require('./api/real')
var BooleanHandle = require('./api/boolean')
addCommonFunctions(TimestampHandle.prototype);
addCommonFunctions(LongHandle.prototype);
addCommonFunctions(RealHandle.prototype);
addCommonFunctions(BooleanHandle.prototype);

var ObjectHandle = require('./api/object')
addCommonFunctions(ObjectHandle.prototype);

var TopObjectHandle = require('./api/topobject')
addCommonFunctions(TopObjectHandle.prototype);

function getClassForType(type, isView){
	_.assertLength(arguments, 2)
	_.assertNot(_.isObject(type.type))

	if(type.type === 'primitive'){
		if(type.primitive === 'string') return StringHandle;
		else if(type.primitive === 'int') return IntHandle;
		else if(type.primitive === 'long') return LongHandle;
		else if(type.primitive === 'real') return RealHandle;
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

exports.make = function(typeSchema, sh, logger){
	_.assertLength(arguments, 3);
	_.assertObject(typeSchema);
	_.assertObject(sh);
	_.assertFunction(logger);
	_.assertFunction(logger.info)
	_.assertFunction(logger.warn)
	_.assertFunction(logger.err)
	
	return new SyncApi(typeSchema, sh, logger);
}

