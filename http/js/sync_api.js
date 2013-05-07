"use strict";

/*

This implements the object/view API for minnow.

*/

var u = require('./api/util')

var makeSyncApi;

var _ = require('underscorem');
var jsonutil = require('./jsonutil')

/*
function setPropertyValue(obj, code, value){
	obj[code] = value;
}
*/

var lookup = require('./lookup')

var editCodes = lookup.codes
var editNames = lookup.names
_.assertObject(editCodes)
_.assertObject(editNames)

function emit(e, eventName){
	var afterCallbacks = []

	var args
	var emitArguments = arguments
	
	var t = this
	function callListener(listener){
		if(args === undefined) args = Array.prototype.slice.call(emitArguments)//, 2)
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
function onAny(cb){
	_.assertFunction(cb)	
	if(this.onListeners === undefined) this.onListeners = {}
	if(this.onListeners.any === undefined) this.onListeners.any = []
	if(this.onListeners.any.indexOf(cb) !== -1){
		//console.log('WARNING: on called for already-added listener')
		return
	}
	this.onListeners.any.push(cb)
}

function off(eventName, cb){
	if(arguments.length === 0){
		this.onListeners = undefined
	}else if(arguments.length === 1){
		this.onListeners[eventName] = undefined
	}else{
		if(this.onListeners === undefined){
			//this.log('WARNING: off called for eventName: ' + eventName + ', but no listeners have ever been added.')
			return
		}
		var listeners = this.onListeners[eventName]
		var ii = listeners.indexOf(cb)
		if(ii !== -1){
			listeners.splice(cb, 1)
		}else{
			//this.log('WARNING: off called for eventName: ' + eventName + ', but listener function not found.')
		}
	}
}

function offAny(cb){
	if(arguments.length === 0){
		this.onListeners = undefined
	}else{
		if(this.onListeners === undefined){
			//this.log('WARNING: offAny called, but no listeners have ever been added.')
			return
		}
		var listeners = this.onListeners.any
		var ii = listeners.indexOf(cb)
		if(ii !== -1){
			listeners.splice(cb, 1)
		}else{
			//this.log('WARNING: offAny called, but listener function not found.')
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

	if(classPrototype.onAny === undefined) classPrototype.onAny = onAny
	if(classPrototype.offAny === undefined) classPrototype.offAny = offAny
}

function removeParent(p){
	_.assert(this.parent === p);
	this.parent = undefined;
}

function prepareStub(){
}

function persistEdit(op, edit){
	_.assertLength(arguments, 2)
	_.assertInt(op)
	_.assertObject(edit)
	return this.parent.persistEdit(op, edit)
}

function getImmediateObject(){
	return this.parent.getImmediateObject()
}
function getImmediateProperty(){
	return this.parent.getImmediateObject()
}
function getImmediateKey(){
	if(this.parent.put){
		return this.part
	}else{
		return this.parent.getImmediateKey()
	}
}
function adjustCurrentObject(id){
	this.parent.adjustCurrentObject(id)
}
function adjustCurrentSubObject(id){
	this.parent.adjustCurrentSubObject(id)
}
function adjustCurrentProperty(typeCode){
	this.parent.adjustCurrentProperty(typeCode)
}
function adjustCurrentKey(key, keyOp){
	this.parent.adjustCurrentKey(key, keyOp)
}
function adjustTopObjectToOwn(){
	this.parent.adjustTopObjectToOwn()
}
function adjustPathToSelf(){
	/*var remaining = this.parent.adjustPath(_.isArray(this.part) ? this.part[0] : this.part)
	//console.log('adjusted path to self: ' + JSON.stringify(remaining))
	if(remaining.length > 0){
		if(remaining.length === 1){
			this.persistEdit(editCodes.ascend1, {})
		}else if(remaining.length === 2){
			this.persistEdit(editCodes.ascend2, {})
		}else if(remaining.length === 3){
			this.persistEdit(editCodes.ascend3, {})
		}else if(remaining.length === 4){
			this.persistEdit(editCodes.ascend4, {})
		}else if(remaining.length === 5){
			this.persistEdit(editCodes.ascend5, {})
		}else{
			this.persistEdit(editCodes.ascend, {many: remaining.length})
		}
	}*/
	this.adjustTopObjectToOwn()
	this.adjustCurrentObject(this.getImmediateObject())
	this.adjustCurrentProperty(this.getImmediateProperty())
}
function saveEdit(op, edit){
	this.adjustPathToSelf()
	this.persistEdit(op, edit)
}

function makeTemporaryId(){
	return this.parent.makeTemporaryId()
}

function _makeAndSaveNew(json, type, source){

	/*var temporary = this.makeTemporaryId();
	var edits = jsonutil.convertJsonToEdits(this.getFullSchema(), type.name, json, this.makeTemporaryId.bind(this));

	if(edits.length > 0){
		//this.adjustPath(temporary)
		//this.parent.adjustPath(this.part)
		this.adjustCurrentProperty(this.part)
		this.adjustCurrentObject(temporary)
		//this.persistEdit(editCodes.selectObject, {id: temporary})
		for(var i=0;i<edits.length;++i){
			var e = edits[i]
			this.persistEdit(e.op, e.edit)
		}
	}
	
	var n = new ObjectHandle(type, edits, temporary, [temporary], this);
	if(this.objectApiCache === undefined) this.objectApiCache = {}
	this.objectApiCache[temporary] = n;
	
	this.saveTemporaryForLookup(temporary, n, this)
	
	//console.log('made and saved new: '+ temporary)
	
	n.prepare()
	
	return n*/
	return this.parent._makeAndSaveNew(json, type, source||this)
}

SyncApi.prototype.saveTemporaryForLookup = function(temporary, n, local){
	//_.assertObject(local.objectApiCache)
	if(this.temporaryCache === undefined) this.temporaryCache = {}
	this.temporaryCache[temporary] = {n: n, local: local}
	//console.log('saving temporary for lookup: ' + temporary)
}

function log(){
	this.parent.log.apply(this.parent, arguments)
}

function isView(){
	if(this.objectId && _.isString(this.objectId)) return true
	return this.parent.isView()
}

function reifyParentEdits(temporaryId, realId){
	this.parent.reifyParentEdits(temporaryId, realId)
}

function getTopParent(){
	return this.parent.getTopParent()
}


function versions(){
	var versions =  this.parent._getVersions(this)
	return versions
}
function versionsSelf(){
	var versions = this.parent._getVersionsSelf(this)
	return versions
}

function _getVersions(source){
	return this.parent._getVersions(source)
}
function _getVersionsSelf(source){
	return this.parent._getVersionsSelf(source)
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

function saveTemporaryForLookup(temporary, n, obj){
	return this.parent.saveTemporaryForLookup(temporary, n, obj)
}

function toString(){
	return JSON.stringify(this.toJson(), null, 2)
}

function wasEdited(){
	return !!this._wasEdited
}

function setLocalMode(v){
	this.parent.setLocalMode(v)
}
function getLocalMode(){
	return this.parent.getLocalMode()
}

function getTopId(){return this.parent.getTopId();}

function getById(id){
	_.assertInt(id)
	_.assert(id > 0)
	return this.getObjectApi(id)
}

function getParent(){
	return this.parent
}

function addCommonFunctions(classPrototype){
	addRefreshFunctions(classPrototype);
	if(classPrototype.getEditingId === undefined) classPrototype.getEditingId = getEditingId;
	if(classPrototype.getObjectApi === undefined) classPrototype.getObjectApi = getObjectApi;
	if(classPrototype.getById === undefined) classPrototype.getById = getById;
	if(classPrototype.wrapObject === undefined) classPrototype.wrapObject = wrapObject;
	if(classPrototype.getFullSchema === undefined) classPrototype.getFullSchema = getFullSchema;
	//if(classPrototype.removeParent === undefined) classPrototype.removeParent = removeParent;

	if(classPrototype.getParent === undefined) classPrototype.getParent = getParent;

	if(classPrototype.createNewExternalObject === undefined) classPrototype.createNewExternalObject = createNewExternalObject;
	if(classPrototype.copyExternalObject === undefined) classPrototype.copyExternalObject = copyExternalObject;
	
	if(classPrototype.reifyExternalObject === undefined) classPrototype.reifyExternalObject = reifyExternalObject;
	
	if(classPrototype.prepare === undefined) classPrototype.prepare = prepareStub;
	if(classPrototype.prepareHistorically === undefined) classPrototype.prepareHistorically = prepareStub;

	if(classPrototype.persistEdit === undefined) classPrototype.persistEdit = persistEdit;
	if(classPrototype.saveEdit === undefined) classPrototype.saveEdit = saveEdit;
	if(classPrototype.adjustPathToSelf === undefined) classPrototype.adjustPathToSelf = adjustPathToSelf;

	if(classPrototype.makeTemporaryId === undefined) classPrototype.makeTemporaryId = makeTemporaryId;
	if(classPrototype._makeAndSaveNew === undefined) classPrototype._makeAndSaveNew = _makeAndSaveNew;
	if(classPrototype.isView === undefined) classPrototype.isView = isView

	if(classPrototype.log === undefined) classPrototype.log = log

	if(classPrototype.versions === undefined) classPrototype.versions = versions
	if(classPrototype.versionsSelf === undefined) classPrototype.versionsSelf = versionsSelf
	//if(classPrototype.revert === undefined) classPrototype.revert = revert
	if(classPrototype._getVersions === undefined) classPrototype._getVersions = _getVersions
	if(classPrototype._getVersionsSelf === undefined) classPrototype._getVersionsSelf = _getVersionsSelf
	//if(classPrototype.getVersionTimestamps === undefined) classPrototype.getVersionTimestamps = getVersionTimestamps
	if(classPrototype.getLastEditor === undefined) classPrototype.getLastEditor = getLastEditor
	if(classPrototype.saveTemporaryForLookup === undefined) classPrototype.saveTemporaryForLookup = saveTemporaryForLookup

	if(classPrototype.wasEdited === undefined) classPrototype.wasEdited = wasEdited

	classPrototype.toString = toString

	if(classPrototype.setLocalMode === undefined) classPrototype.setLocalMode = setLocalMode
	if(classPrototype.getLocalMode === undefined) classPrototype.getLocalMode = getLocalMode

	if(classPrototype.getTopId === undefined) classPrototype.getTopId = getTopId
	if(classPrototype.reifyParentEdits === undefined) classPrototype.reifyParentEdits = reifyParentEdits
	if(classPrototype.getTopParent === undefined) classPrototype.getTopParent = getTopParent
	if(classPrototype.getHistoricalKey === undefined) classPrototype.getHistoricalKey = getHistoricalKey


	if(classPrototype.adjustCurrentProperty === undefined) classPrototype.adjustCurrentProperty = adjustCurrentProperty
	if(classPrototype.adjustCurrentObject === undefined) classPrototype.adjustCurrentObject = adjustCurrentObject
	if(classPrototype.adjustCurrentSubObject === undefined) classPrototype.adjustCurrentSubObject = adjustCurrentSubObject
	if(classPrototype.adjustCurrentKey === undefined) classPrototype.adjustCurrentKey = adjustCurrentKey
	
	if(classPrototype.getImmediateObject === undefined) classPrototype.getImmediateObject = getImmediateObject
	if(classPrototype.getImmediateProperty === undefined) classPrototype.getImmediateProperty = getImmediateProperty
	if(classPrototype.getImmediateKey === undefined) classPrototype.getImmediateKey = getImmediateKey
	
	if(classPrototype.adjustTopObjectToOwn === undefined) classPrototype.adjustTopObjectToOwn = adjustTopObjectToOwn
}


function getEditingId(){
	var eId = this.parent.getEditingId();
	//console.log('rec editingId: ' + eId);
	return eId;
}

function getHistoricalKey(){
	return this.parent.getHistoricalKey();
}


function getObjectApi(idOrViewKey, historicalKey){
	_.assertDefined(idOrViewKey)
	return this.parent.getObjectApi(idOrViewKey, historicalKey || this.parent.getHistoricalKey());
}

function createNewExternalObject(typeCode, obj, forget, cb){
	_.assertLength(arguments, 4)
	_.assertDefined(this.parent);
	return this.parent.createNewExternalObject(typeCode, obj, forget, cb);
}
function copyExternalObject( obj, forget, cb){
	_.assertLength(arguments, 3)
	_.assertDefined(this.parent);
	return this.parent.copyExternalObject( obj, forget, cb);
}
function reifyExternalObject(typeCode, temporaryId, realId){
	_.assertDefined(this.parent);
	this.parent.reifyExternalObject(typeCode, temporaryId, realId);
}

/*
function getPath(){
	return this.parent.getPath().concat(this.part);
}*/

function SyncApi(schema, sh, logger){
	_.assertObject(schema);
	_.assertFunction(logger)
	
	this.log = logger;
	
	this.temporaryIdCounter = -1;

	this.sh = sh;
	//_.assertFunction(sh.makeFork)
	this.schema = schema;

	this.snap = {latestVersionId: -1, objects: {}, historicalViewObjects: {}};

	this.cachedProperties = {};
	
	this.changeListener = SyncApi.prototype.changeListener.bind(this);
	_.assertFunction(this.changeListener);

	this.objectApiCache = {};
	this.historicalObjectCache = {}
	
	this.uid = Math.random()
	
	this.latestVersionId = -1
	//this.log('made SyncApi ' + this.uid)
}

SyncApi.prototype.setLocalMode = function(v){
	this.localMode = v
}
SyncApi.prototype.getLocalMode = function(){
	return this.localMode
}

SyncApi.prototype.makeTemporaryId = function(){
	--this.temporaryIdCounter;
	//console.log('made temporary: ' + this.temporaryIdCounter)
	//console.log(new Error().stack)
	return this.temporaryIdCounter
}

SyncApi.prototype.getTopObject = function(id){
	_.assertInt(id)
	var handle = this.getObjectApi(id, this);
	handle.prepare();
	return handle;
}

SyncApi.prototype.getView = function(viewId, historicalKey){
	//_.assertLength(arguments, 2)
	//console.log('historicalKey: ' + historicalKey)
	var view = this.getObjectApi(viewId, historicalKey);
	if(historicalKey){
		
		//var currentVersion = 0//TODO start at main view creation
		var hoc = this.historicalObjectCache[historicalKey]
		if(hoc === undefined) hoc = this.historicalObjectCache[historicalKey] = {cache: {}, list: [], currentEditId: 0}
		
		var local = this
		view.advanceToEnd = function(){
			
			while(true){//TODO optimize this eventually
				var could = false
				var smallestNext = 4294967295
				var list = hoc.list
				for(var i=0;i<list.length;++i){
					var obj = list[i]
					var next = obj.advanceTo(hoc.currentEditId)
					if(next && next < smallestNext){
						smallestNext = next
					}
				}
				if(smallestNext === 4294967295) break;//we're done
				hoc.currentEditId = smallestNext
			}
			return hoc.currentEditId
		}
		view.advance = function(){
			//for(var j=0;j<2;++j){//TODO optimize this eventually
			
			var smallestNext = 4294967295
			var list = hoc.list
			for(var i=0;i<list.length;++i){
				var obj = list[i]
				//console.log('advancing: ' + i)
				var next = obj.nextVersion(hoc.currentEditId)
				if(next && next < smallestNext){
					smallestNext = next
				}
			}
			if(smallestNext === 4294967295) return;//we're done
			
			for(var i=0;i<list.length;++i){
				var obj = list[i]
				//console.log('advancing: ' + i)
				obj.advanceTo(smallestNext)
			}
			hoc.currentEditId = smallestNext//currentVersion = smallestNext
			return hoc.currentEditId
		}
		view.isAtEnd = function(){
			//var start = currentVersion
			//for(var j=0;j<2;++j){//TODO optimize this eventually
			var could = false
			var smallestNext = 4294967295
			var list = hoc.list
			//console.log('list: ' + JSON.stringify(_.map(list, function(v){
			//	return v.id()
			//})))
			for(var i=0;i<list.length;++i){
				var obj = list[i]
				var next = obj.nextVersion(hoc.currentEditId)
				//console.log('*next: ' + next + ' ' + hoc.currentEditId)
				if(next && next < smallestNext){
					smallestNext = next
					//console.log('found next: ' + next)
				}
			}
			//console.lo
			var atEnd = smallestNext === 4294967295
			return atEnd
		}
		view.setToVersion = function(version){
			_.errout('TODO')
		}
		
		view.prepareHistorically(0)//TODO begin at point where view was created
	}else{
		view.prepare();
	}
	return view;
}

SyncApi.prototype.hasView = function(viewId){
	return this.objectApiCache[viewId] !== undefined
}

SyncApi.prototype.objectListener = function(id, edits){
	//console.log((!!this.objectApiCache[id]) + ' ' + this.getEditingId() + ' working: ' + id + ' ' + JSON.stringify(edits) + ' ' + JSON.stringify(Object.keys(this.objectApiCache)))
	
	if(_.isInt(id)){
		this.snap.objects[id] = edits		
	}
	
	if(this.objectApiCache[id] !== undefined && _.isInt(id)){
		var obj = this.objectApiCache[id]
		var curSyncId = -1

		for(var i=0;i<edits.length;++i){
			var e = edits[i]
			if(e.op === editCodes.setSyncId){
				curSyncId = e.edit.syncId
			}else{
				//console.log('e; ' + JSON.stringify(e))
				obj.changeListener(undefined, undefined, e.op, e.edit, curSyncId, e.editId)
			}
		}
		return
	}


	if(edits[0].op === editCodes.madeViewObject){
		var typeCode = edits[0].edit.typeCode
		//var id = edits[0].edit.id
	}else{
		var typeCode = edits[1].edit.typeCode
		//var id = edits[1].edit.id
	}
	var t = this.schema._byCode[typeCode];
	//console.log('typeCode: ' + typeCode)
	_.assertObject(t)
	if(this.objectApiCache[id] !== undefined){
		if(this.objectApiCache[id].prepared){
			_.errout('already prepared object being overwritten: ' + id)
		}
		//console.log('WARNING: redundant update?: ' + id)
		_.errout('HERE: ' + id + ' ' + JSON.stringify(this.objectApiCache[id].edits) + ' ' + JSON.stringify(edits))
		return
	}
	_.assertUndefined(this.objectApiCache[id])
	var n = new TopObjectHandle(this.schema, t, edits, this, id);
	this.objectApiCache[id] = n;
}

SyncApi.prototype.addSnapshot = function(snap, historicalKey){
	var objs = snap.objects;
	var local = this

	Object.keys(objs).forEach(function(idStr){
		var obj = objs[idStr]
		
		var m = local.snap.objects
		
		if(historicalKey && idStr.indexOf(':') !== -1){
			m = local.snap.historicalViewObjects
		}
		
		var cur = m[idStr]
		if(cur){
			if(cur.length >= obj.length){
				return
			}
			m[idStr] = cur.concat(obj.slice(cur.length))
		}else{
			m[idStr] = obj
		}
	})
}

SyncApi.prototype.resetTopObjectInputState = function(){
	if(this.currentObjectId !== undefined){
		var handle = this.objectApiCache[this.currentObjectId]
		 if(handle){
			//handle.currentPath = undefined
			handle._resetInputState()
			//console.log('reset object state: ' + handle.id())
			//console.log('reset path: '+ this.currentObjectId)
		}else{
			//console.log('no handle: ' + this.currentObjectId)
		}
	}
}

SyncApi.prototype.resetTopObjectOutputState = function(){
	if(this.currentObjectId !== undefined){
		var handle = this.objectApiCache[this.currentObjectId]
		 if(handle){
			//handle.currentPath = undefined
			handle._resetOutputState()
			//console.log('reset object state: ' + handle.id())
			//console.log('reset path: '+ this.currentObjectId)
		}else{
			//console.log('no handle: ' + this.currentObjectId)
		}
	}
}

SyncApi.prototype.adjustTopObjectTo = function(id){
	if(this.currentObjectId !== id){
		
		this.resetTopObjectOutputState()

		//console.log('&&&&& selecting top object: ' + id + ' <- ' + this.currentObjectId)
		//console.log(new Error().stack)
		this.currentObjectId = id
		
		this.resetTopObjectOutputState()

		//_.assert(this.objectApiCache[this.currentObjectId] === undefined)
		//console.log('current path: ' + JSON.stringify(this.objectApiCache[this.currentObjectId].currentPath))

		_.assert(id !== 0)
		_.assertInt(id)
		this.sh.persistEdit(editCodes.selectTopObject, {id: id})
	}
}

SyncApi.prototype.persistEdit = function(typeCode, id, op, edit){
	//console.log('id: ' + id + ' for ' + op)
	//console.log(new Error().stack)
	//console.log('persistEdit: ' + JSON.stringify([typeCode, id, op, edit]))
	
	if(this.localMode){
		return
	}

	if(this.currentObjectId !== id){
		_.errout('TODO: adjust better')
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
	//console.log(
	//this.currentTopObject = DESTROYED_LOCALLY
}



SyncApi.prototype.changeListener = function(op, edit, editId){
	_.assertLength(arguments, 3);
	_.assertInt(op);
	_.assertInt(editId);

	console.log(this.getEditingId()+' *** ' + editNames[op] + ': SyncApi changeListener: ' + JSON.stringify(edit) + ' ~ ' + this.currentSyncId + ' ~ ' + editId)

	if(op === editCodes.destroy && this.currentSyncId === this.getEditingId()){
		return
	}

	if(this.currentTopObject && op !== editCodes.selectTopObject && op !== editCodes.selectTopViewObject && op !== editCodes.setSyncId){
		if(this.currentTopObject === DESTROYED_REMOTELY){
			_.errout('could not execute edit, server error, object already destroyed removely: ' + op + ' ' + JSON.stringify(edit) + ' ' + this.currentSyncId + ' ' + editId)
		}else if(this.currentTopObject === DESTROYED_LOCALLY){
			//console.log('here**: ')
			this.log.warn('WARNING: could not execute edit, object already destroyed locally: ' + op, edit, this.currentSyncId, editId)
			return
		}
	}

	//this.log.info(this.uid+' SyncApi changeListener: ' + op + ' ', arguments)

	//var hereKey = op+editId+JSON.stringify(edit)
	//if(this.lastKey === hereKey){
		//throw new Error('repeat: ' + hereKey)
	//}
	//this.lastKey = hereKey

	if(editId > -1){
		if(editId > this.latestVersionId) this.latestVersionId = editId
		//if(editId < this.latestVersionId) throw new Error('edits arriving out of order: ' + editId + ' < ' +  this.latestVersionId)
	}
	
	//this.editsHappened.push({op: op, edit: edit, editId: editId})

	var local = this
	function makeViewObject(typeCode, id){
		//console.log('typeCode: ' + typeCode)
		var t = local.schema._byCode[typeCode];
		_.assertObject(t)
		var n = new TopObjectHandle(local.schema, t, [], local, id);
		if(local.objectApiCache[id]) _.errout('already got view object being made: ' + id)
		//_.assertUndefined(local.objectApiCache[id])
		local.objectApiCache[id] = n;
	}
	
	//console.log('here')
	
	if(op === editCodes.madeViewObject){
		//if(this.currentTopObject) this.currentTopObject.pathEdits = undefined
		var n = makeViewObject(edit.typeCode, edit.id)
		this.currentTopObject = edit.id//n
		return
	}else if(op === editCodes.selectTopObject){
		//if(this.currentTopObject) this.currentTopObject.pathEdits = undefined
		try{
			this.currentTopObject = edit.id//this.getObjectApi(edit.id)
			//console.log('selecting top object: ' + edit.id)
			//this.currentTopObject.pathEdits = undefined
		}catch(e){
			console.log('WARNING: might be ok if destroyed locally, but cannot find top object:' + edit.id)
			this.currentTopObject = undefined
		}
		return
	}else if(op === editCodes.selectTopViewObject){
		//if(this.currentTopObject) this.currentTopObject.pathEdits = undefined
		//console.log('selecting top view object: ' + edit.id)
		this.currentTopObject = edit.id//this.getObjectApi(edit.id)
		//this.currentTopObject.pathEdits = undefined
		//console.log('pe: ' + JSON.stringify(this.currentTopObject.pathEdits))
		//_.assertUndefined(this.currentTopObject.pathEdits)
		//this.currentTopObject.pathEdits = undefined
		return
	}else if(op === editCodes.setSyncId){
		this.currentSyncId = edit.syncId
		return
	}

	if(this.currentTopObject === undefined){
		this.log.warn('no top object yet for: ' + JSON.stringify([editNames[op], edit, editId]))
		return
	}
	
	var currentTopObjects = this.getAllObjects(this.currentTopObject)
	var local = this
	if(local.snap.historicalViewObjects[this.currentTopObject]){
		local.snap.historicalViewObjects[this.currentTopObject].push({op: op, edit: edit, editId: editId})
	}else{
		if(currentTopObjects.length === 0){
			this.log.warn('top object instances not found: ' + local.currentTopObject)
		}
	}
	
	//console.log('current: ' + currentTopObjects.length)
	
	currentTopObjects.forEach(function(currentTopObject){
		if(op === editCodes.destroy){
			var id = currentTopObject.id()
			delete local.objectApiCache[id]
			delete local.snap.objects[id]
			currentTopObject._destroy()
			currentTopObject = DESTROYED_REMOTELY
			console.log('destroyed current object')
		}else{
			_.assertInt(local.currentSyncId)
			if(currentTopObject.parent !== local){
				_.errout('current top object parent is wrong: ' + currentTopObject.parent)
			}
			_.assertEqual(currentTopObject.parent, local)
			currentTopObject.changeListener(undefined, undefined, op, edit, local.currentSyncId, editId)
		}
	})
}
function getFullSchema(){
	return this.parent.getFullSchema();
}
SyncApi.prototype.getFullSchema = function(){return this.schema;}
SyncApi.prototype.setEditingId = function(editingId){
	this.editingId = editingId;
}
/*
SyncApi.prototype.createFork = function(source, cb){
	_.assertLength(arguments, 2)
	_.assertObject(source)

	var temporary = this.makeTemporaryId()
	
	var edits = this.sh.makeFork(source, cb, temporary)
	
//	console.log('edits: ' + JSON.stringify(edits))

	var oldHandle = this.objectApiCache[this.currentObjectId]
	if(oldHandle){
		oldHandle.currentPath = undefined
	}
	
	this.currentObjectId = temporary//TODO only if !forget?

	var forget = false//TODO forgettable forks?
		
	if(!forget){
		var t = source.typeSchema//this.schema[typeName]
		var n = new TopObjectHandle(this.schema, t, edits, this, temporary, source);
		//source.maintainFork(n) //TODO
		//console.log('created temporary lookup: ' + temporary)
		this.objectApiCache[temporary] = n;
		return n
	}
}*/

SyncApi.prototype.copyExternalObject = function(obj, forget, cb){
	_.assertLength(arguments, 3)
	_.assertObject(obj)
	_.assertBoolean(forget)

	var typeName = obj.type()
	
	var temporary = this.makeTemporaryId()
	
	var edits = this.sh.copy(obj, forget, cb, temporary)
	
	edits = [{op: editCodes.made, edit: {typeCode: this.schema[typeName].code, temporary: temporary}, editId: -2}].concat(edits)

	var oldHandle = this.objectApiCache[this.currentObjectId]
	if(oldHandle){
		oldHandle.currentPath = undefined
	}
	
	this.currentObjectId = temporary//TODO only if !forget?
	
	//console.log(new Error().stack)
	
	if(!forget){
		var t = this.schema[typeName]
		var n = new TopObjectHandle(this.schema, t, edits, this, temporary);
		//console.log('created temporary lookup: ' + temporary)
		this.objectApiCache[temporary] = n;
		return n
	}else{
		//console.log('forgetting')
	}
}

SyncApi.prototype.createNewExternalObject = function(typeName, obj, forget, cb){
	_.assertLength(arguments, 4)
	_.assertString(typeName)
	_.assertObject(obj)

	var temporary = this.makeTemporaryId()
	
	var edits = this.sh.make(typeName, obj, forget, cb, temporary)
	
	edits = [{op: editCodes.made, edit: {typeCode: this.schema[typeName].code, temporary: temporary}, editId: -2}].concat(edits)

	var oldHandle = this.objectApiCache[this.currentObjectId]
	if(oldHandle){
		oldHandle.currentPath = undefined
	}
	
	this.currentObjectId = temporary//TODO only if !forget?
	
	//console.log(new Error().stack)
	
	if(!forget){
		var t = this.schema[typeName]
		var n = new TopObjectHandle(this.schema, t, edits, this, temporary);
		//console.log('created temporary lookup: ' + temporary)
		this.objectApiCache[temporary] = n;
		return n
	}else{
		//console.log('forgetting')
	}
}

SyncApi.prototype._rewriteObjectApiCache = function(oldKey, newKey){
	var n = this.objectApiCache[oldKey]
	delete this.objectApiCache[oldKey]
	this.objectApiCache[newKey] = n
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
		//delete this.objectApiCache[oldCacheKey];
		if(objApi.currentObject === objApi.objectId){
			objApi.currentObject = realId
		}
		if(objApi.inputObject === objApi.objectId){
			objApi.inputObject = realId
		}
		objApi.objectId = realId;
		objApi.emit({}, 'reify', realId, temporaryId)//()
		//console.log('reified specific object')
	}else{
		if(this.temporaryCache && this.temporaryCache[oldCacheKey]){
			var e = this.temporaryCache[oldCacheKey]
			delete this.temporaryCache[oldCacheKey]
			e.local._rewriteObjectApiCache(oldCacheKey, realId)
			//delete e.local.objectApiCache[oldCacheKey]
			//e.local.objectApiCache[realId] = e.n
			e.n.objectId = realId
			e.n.reifyParentEdits(temporaryId, realId)
			//console.log('reified temporary: ' + e.n)
		}else{
			console.log(JSON.stringify(Object.keys(this.objectApiCache)))
			console.log('ERROR: failed to reify: ' + temporaryId + ' -> ' + realId)
			console.log(new Error().stack)
		}
	}
	
	var local = this
	var keys = Object.keys(this.objectApiCache)
	for(var i=0;i<keys.length;++i){
		var key = keys[i]
		var n = local.objectApiCache[key]
		//console.log('reifying: ' + n)
		if(!n._destroyed){
			n.reifyParentEdits(temporaryId, realId)
		}else{
			console.log('WARNING: destroyed object still in objectApiCache')
		}
	}//
}

SyncApi.prototype.reifyObject = SyncApi.prototype.reifyExternalObject

//retries all historical and non-historical instances of the given object
SyncApi.prototype.getAllObjects = function getObjectApi(idOrViewKey){
	var n
	
	var results = []

	var foundInCache = false	
	var local = this
	Object.keys(this.historicalObjectCache).forEach(function(historicalKey){
		if(local.historicalObjectCache[historicalKey] === undefined) local.historicalObjectCache[historicalKey] = {cache: {}, list: [], currentEditId: 0}
		
		var hoc = local.historicalObjectCache[historicalKey]
		n = hoc.cache[idOrViewKey]
		
		if(n){
			results.push(n)
			foundInCache = true
		}
	})	
	
	n = this.objectApiCache[idOrViewKey];
	if(n !== undefined){
		results.push(n)
		return results
	}
	var obj = this.snap.objects[idOrViewKey];

	if(obj === undefined){

		console.log('snap: ' + JSON.stringify(this.snap).slice(0,5000))
		console.log('edits: ' + JSON.stringify(this.editsHappened, null, 2))
		console.log('cache: ' + JSON.stringify(Object.keys(this.objectApiCache)))
		console.log(this.editingId + ' no object in snapshot with id: ' + idOrViewKey);
		return results
	}

	//console.log(idOrViewKey+': ' + JSON.stringify(obj).slice(0,500))
	_.assert(obj.length > 0)
	
	if(obj[0].op === editCodes.destroy){
		return results
	}
	//console.log(JSON.stringify(obj))
	var typeCode = (obj[0].op === editCodes.madeViewObject ? obj[0].edit.typeCode : obj[1].edit.typeCode)//first edit is a made op
	var t = this.schema._byCode[typeCode];

	if(t === undefined) _.errout('cannot find object type: ' + typeCode);
	
	n = new TopObjectHandle(this.schema, t, obj, this, idOrViewKey);
	this.objectApiCache[idOrViewKey] = n;

	results.push(n)
	return results
}

SyncApi.prototype.getObjectApi = function getObjectApi(idOrViewKey, historicalKey){

	//console.log('getting object ' + idOrViewKey + ' ' + historicalKey)
	
	var n
	
	if(historicalKey){

		if(this.historicalObjectCache[historicalKey] === undefined) this.historicalObjectCache[historicalKey] = {cache: {}, list: [], currentEditId: 0}
		
		var hoc = this.historicalObjectCache[historicalKey]
		n = hoc.cache[idOrViewKey]
		
		if(n) return n
		
		if(_.isString(idOrViewKey)){
			var obj = this.snap.historicalViewObjects[idOrViewKey];
			if(obj){
				//_.errout('TODO')
				var typeCode = (obj[0].op === editCodes.madeViewObject ? obj[0].edit.typeCode : obj[1].edit.typeCode)//first edit is a made op
				var t = this.schema._byCode[typeCode];

				if(t === undefined) _.errout('cannot find object type: ' + typeCode);

				n = new TopObjectHandle(this.schema, t, obj, this, idOrViewKey);
				n.makeHistorical(historicalKey)
				hoc.cache[idOrViewKey] = n;
				hoc.list.push(n)
				
				//return n
			}
			
			if(!n){
				if(idOrViewKey === '') _.errout('cannot get the null view id')
				var typeCode = parseInt(idOrViewKey.substr(0, idOrViewKey.indexOf(':')))//TODO hacky!
				var t = this.schema._byCode[typeCode];
				_.assertObject(t)
				n = new TopObjectHandle(this.schema, t, [], this, idOrViewKey);
				n.makeHistorical(historicalKey)
				hoc.cache[idOrViewKey] = n;
				hoc.list.push(n)
			}
			
		}else{
//			_.errout('TODO - retrieve from historicalObjectCache or use snap')
			var obj = this.snap.objects[idOrViewKey];
			if(obj){
				//_.errout('TODO')
				var typeCode = (obj[0].op === editCodes.madeViewObject ? obj[0].edit.typeCode : obj[1].edit.typeCode)//first edit is a made op
				var t = this.schema._byCode[typeCode];

				if(t === undefined) _.errout('cannot find object type: ' + typeCode);

				n = new TopObjectHandle(this.schema, t, obj, this, idOrViewKey);
				n.makeHistorical(historicalKey)
				n.prepareHistorically(hoc.currentEditId)
				hoc.cache[idOrViewKey] = n;
				hoc.list.push(n)
			}
		}
		
		//console.log('historical: ' + idOrViewKey + ' ' + historicalKey)
		return n
	}
	
	n = this.objectApiCache[idOrViewKey];
	if(n !== undefined){
		return n
	}
	var obj = this.snap.objects[idOrViewKey];

	if(obj === undefined){

		console.log('snap: ' + JSON.stringify(this.snap).slice(0,5000))
		console.log('edits: ' + JSON.stringify(this.editsHappened, null, 2))
		console.log('cache: ' + JSON.stringify(Object.keys(this.objectApiCache)))
		console.log(this.editingId + ' no object in snapshot with id: ' + idOrViewKey);
		return
	}

	//console.log(idOrViewKey+': ' + JSON.stringify(obj).slice(0,500))
	_.assert(obj.length > 0)
	
	if(obj[0].op === editCodes.destroy){
		return
	}
	//console.log(JSON.stringify(obj))
	var typeCode = (obj[0].op === editCodes.madeViewObject ? obj[0].edit.typeCode : obj[1].edit.typeCode)//first edit is a made op
	var t = this.schema._byCode[typeCode];

	if(t === undefined) _.errout('cannot find object type: ' + typeCode);
	
	n = new TopObjectHandle(this.schema, t, obj, this, idOrViewKey);
	this.objectApiCache[idOrViewKey] = n;

	return n
}
SyncApi.prototype.wrapObject = function(id, typeCode, part, sourceParent){
	_.errout('TOO FAR')
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

