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
/*
function refresh(e){
	return this.doRefresh({}, true, e);
}*/
function emit(e, eventName){
	var afterCallbacks = []
		
	var args = Array.prototype.slice.call(arguments, 2)
	
	function callListener(listener){
		var af = listener.apply(undefined, args)
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
		eventName = ''
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
	//if(classPrototype.refresh === undefined) classPrototype.refresh = refresh;
	if(classPrototype.on === undefined) classPrototype.on = on;
	if(classPrototype.once === undefined) classPrototype.once = once;
	if(classPrototype.off === undefined) classPrototype.off = off;
	if(classPrototype.emit === undefined) classPrototype.emit = emit;
	/*if(classPrototype.doRefresh === undefined) classPrototype.doRefresh = u.doRefresh;
	if(classPrototype.listenForRefresh === undefined){
		classPrototype.listenForRefresh = listenForRefresh;
		classPrototype.onChange = listenForRefresh;
	}
	if(classPrototype.removeListener === undefined) classPrototype.removeListener = removeListener;
	*/
}

function removeParent(p){
	_.assert(this.parent === p);
	this.parent = undefined;
}
/*
function addToApiCache(id, obj){
	_.assertLength(arguments, 2);
	
	if(!(_.isInteger(id) || _.isString(id))){
		_.errout('not an id: ' + id)
	}
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
	if(!(_.isInteger(id) || _.isString(id))){
		_.errout('not an id: ' + id)
	}
	//_.assert(_.isInteger(id) || _.isString(id));
	return this.apiCache[id];
}
*/
function propertyUidFunction(){
	return this.parent.uid() + '-' + this.part[0];
}
function prepareStub(){
}
/*
function getCurrentPath(){
	return this.parent.getCurrentPath()
}*/
function persistEdit(op, edit){
	_.assertLength(arguments, 2)
	_.assertString(op)
	_.assertObject(edit)
	return this.parent.persistEdit(op, edit)
}

function saveEdit(op, edit){
	var remaining = this.parent.adjustPath(this.part)
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
	this.persistEdit(op, edit)
}
/*
function ascendBy(many){
	if(many <= 5){
		this.persistEdit('ascend5', {})
	}else{
		this.persistEdit('ascend', {many: many})
	}
}*/

function makeTemporaryId(){
	return this.parent.makeTemporaryId()
}

function _makeAndSaveNew(json, type){

	var temporary = this.makeTemporaryId();
	var edits = jsonutil.convertJsonToEdits(this.getFullSchema(), type.name, json);

	if(edits.length > 0){
		this.adjustPath(temporary)
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

function addCommonFunctions(classPrototype){
	addRefreshFunctions(classPrototype);
	if(classPrototype.getEditingId === undefined) classPrototype.getEditingId = getEditingId;
	//if(classPrototype.getObjectTypeCode === undefined) classPrototype.getObjectTypeCode = getObjectTypeCode;
	//if(classPrototype.getObjectId === undefined) classPrototype.getObjectId = getObjectId;
	if(classPrototype.getObjectApi === undefined) classPrototype.getObjectApi = getObjectApi;
	if(classPrototype.wrapObject === undefined) classPrototype.wrapObject = wrapObject;
	if(classPrototype.getFullSchema === undefined) classPrototype.getFullSchema = getFullSchema;
	//if(classPrototype.getPath === undefined) classPrototype.getPath = getPath;
	//if(classPrototype.getSh === undefined) classPrototype.getSh = getSh;
	if(classPrototype.removeParent === undefined) classPrototype.removeParent = removeParent;

	if(classPrototype.createNewExternalObject === undefined) classPrototype.createNewExternalObject = createNewExternalObject;
	if(classPrototype.reifyExternalObject === undefined) classPrototype.reifyExternalObject = reifyExternalObject;
	
	if(classPrototype.uid === undefined) classPrototype.uid = propertyUidFunction;
	if(classPrototype.prepare === undefined) classPrototype.prepare = prepareStub;

	//if(classPrototype.getCurrentPath === undefined) classPrototype.getCurrentPath = getCurrentPath;
	if(classPrototype.persistEdit === undefined) classPrototype.persistEdit = persistEdit;
	if(classPrototype.saveEdit === undefined) classPrototype.saveEdit = saveEdit;
	//if(classPrototype.ascendBy === undefined) classPrototype.ascendBy = ascendBy;
	//if(classPrototype._internalSaveEdit === undefined) classPrototype._internalSaveEdit = _internalSaveEdit;

	if(classPrototype.makeTemporaryId === undefined) classPrototype.makeTemporaryId = makeTemporaryId;
	if(classPrototype._makeAndSaveNew === undefined) classPrototype._makeAndSaveNew = _makeAndSaveNew;
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

function createNewExternalObject(typeCode, temporaryId, obj, forget){
	_.assertLength(arguments, 4)
	_.assertDefined(this.parent);
	return this.parent.createNewExternalObject(typeCode, temporaryId, obj, forget);
}
function reifyExternalObject(typeCode, temporaryId, realId){
	_.assertDefined(this.parent);
	this.parent.reifyExternalObject(typeCode, temporaryId, realId);
}


function getPath(){
	return this.parent.getPath().concat(this.part);
}
/*
function getSh(){
	return this.parent.getSh();
}*/

function SyncApi(schema, sh){
	_.assertObject(schema);
	
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
	console.log('made SyncApi ' + this.uid)
	
	this.editsHappened = []//for debugging
}

SyncApi.prototype.makeTemporaryId = function(){
	--this.temporaryIdCounter;
	return this.temporaryIdCounter
}

SyncApi.prototype.getView = function(viewId){
	var view = this.getObjectApi(viewId, this);
	view.prepare();
	return view;
}

SyncApi.prototype.objectListener = function(id, edits){
	console.log('working: ' + id + ' ' + JSON.stringify(edits))
	if(this.objectApiCache[id] !== undefined){
		return
		//_.errout('TODO:')
	}
	var typeCode = edits[1].edit.typeCode
	var id = edits[1].edit.id
	var t = this.schema._byCode[typeCode];
	_.assertObject(t)
	if(this.objectApiCache[id] !== undefined){
		console.log('WARNING: redundant update')
		return
	}
	_.assertUndefined(this.objectApiCache[id])
	var n = new TopObjectHandle(this.schema, t, edits, this, id);
	this.objectApiCache[id] = n;
	//this.currentTopObject = n
	/*var currentSyncId
	edits.forEach(function(e){
		if(e.op === 'setSyncId'){
			currentSyncId = e.edit.syncId
		}else{
			n.changeListener(e.op, e.edit, currentSyncId, e.editId)
		}
	})*/
	//n.lastEditId = edits[0].editId + 1
}
SyncApi.prototype.addSnapshot = function(snap, typeCode, id){
	//console.log(this.uid + ' adding snapshot: ' + JSON.stringify(snap))
	var objs = snap.objects;
	//_.assertArray(objs)
	//for(var i=0;i<objs.length;++i){
	var local = this
	_.each(objs, function(obj, idStr){
		//var obj = objs[i];
		//var id = obj.object.meta.id
		/*var cur = this.snap.objects[id]
		if(cur && cur.meta.editId > obj.object.meta.editId){
			continue
		}else{
			if(cur) console.log(cur.meta.editId + ' ' + obj.object.meta.editId)
		}
		this.snap.objects[id] = obj.object*/
		
		var cur = local.snap.objects[idStr]
		if(cur){
			if(cur.length >= obj.length){
				//throw new Error('already got: ' + idStr)
				return
			}
			local.snap.objects[idStr] = cur.concat(obj.slice(cur.length))
		}else{
			local.snap.objects[idStr] = obj
		}
	})
	//console.log(JSON.stringify(this.snap))
}

SyncApi.prototype.persistEdit = function(typeCode, id, op, edit){
	console.log('id: ' + id + ' for ' + op)
	if(this.currentObjectId !== id){
		
		this.currentObjectId = id
		_.assert(id !== 0)
		_.assertInt(id)
		this.sh.persistEdit('selectTopObject', {id: id})
	}
	this.sh.persistEdit(op, edit)
}

//SyncApi.prototype.getSh = function(){return this.sh;}


SyncApi.prototype.onEdit = function(listener){
	if(this.changeListeners === undefined) this.changeListeners = []
	this.changeListeners.push(listener)
}

SyncApi.prototype.changeListener = function(op, edit, editId){
	_.assertLength(arguments, 3);
	//_.assertInt(syncId);
	_.assertString(op);
	_.assertInt(editId);
	//_.assert(_.isInt(id) || _.isString(id));
	//_.assert(_.isInteger(syncId) || syncId === undefined);
	

	console.log(this.uid+' SyncApi changeListener: ' + op + ' ' + JSON.stringify(arguments).slice(0,1000))
	//console.log(op + ':' + JSON.stringify(edit) + ' - ' + this.currentSyncId + ' - ' + editId)

	var hereKey = op+editId
	if(this.lastKey === hereKey){
		throw new Error('repeat')
	}
	this.lastKey = hereKey

	if(editId > -1){
		if(editId > this.latestVersionId) this.latestVersionId = editId
		if(editId < this.latestVersionId) throw new Error('edits arriving out of order: ' + editId + ' < ' +  this.latestVersionId)
	}
	
	this.editsHappened.push({op: op, edit: edit, editId: editId})

	var local = this
	function makeViewObject(typeCode, id){
		//console.log('typeCode: ' + typeCode)
		var t = local.schema._byCode[typeCode];
		_.assertObject(t)
		var n = new TopObjectHandle(local.schema, t, [], local, id);
		_.assertUndefined(local.objectApiCache[id])
		local.objectApiCache[id] = n;
	}
	
	if(op === 'selectTopViewObject' && this.objectApiCache[edit.id] === undefined){
		var typeCode = parseInt(edit.id.substr(0, edit.id.indexOf(':')))//TODO hacky!
		makeViewObject(typeCode, edit.id)
	} else if(op === 'addExistingViewObject' && this.objectApiCache[edit.id] === undefined){
		var typeCode = parseInt(edit.id.substr(0, edit.id.indexOf(':')))//TODO hacky!
		makeViewObject(typeCode, edit.id)
	}else if(op === 'setViewObject'){
		var typeCode = parseInt(edit.id.substr(0, edit.id.indexOf(':')))//TODO hacky!
		makeViewObject(typeCode, edit.id)
	}
	
	if(op === 'madeViewObject'){
		/*var t = this.schema._byCode[edit.typeCode];
		_.assertObject(t)
		var n = new TopObjectHandle(this.schema, t, [], this, edit.id);
		_.assertUndefined(this.objectApiCache[edit.id])
		this.objectApiCache[edit.id] = n;
		this.currentTopObject = n*/
		var n = makeViewObject(edit.typeCode, edit.id)
		this.currentTopObject = n
	}else if(op === 'selectTopObject'){
		this.currentTopObject = this.getObjectApi(edit.id)
	}else if(op === 'selectTopViewObject'){
		this.currentTopObject = this.getObjectApi(edit.id)
	}else if(op === 'setSyncId'){
		this.currentSyncId = edit.syncId
	}else{
		_.assertInt(this.currentSyncId)
		try{
			this.currentTopObject.changeListener(op, edit, this.currentSyncId, editId)
		}catch(e){
			console.log(JSON.stringify(this.snap))
			console.log(JSON.stringify(this.editsHappened, null, 2).slice(0,1000))
			throw e
		}
	}
	
	/*if(this.changeListeners){
		this.changeListeners.forEach(function(c){c(id, path, op, edit, syncId, editId);})
	}*/
	
	/*
	if(path.length === 0){
		if(op === 'objectSnap'){
			//_.assertDefined(edit.id);
			//_.assertDefined(edit.value);
			//
			//console.log('edit: ' + JSON.stringify(edit))
			var obj = edit.value.object
			var realId = obj.meta.id
			if(this.snap.objects[realId]){
				//TODO replacing is an error except during setup
				var cur = this.snap.objects[realId]
				if(cur.meta.editId >= obj.meta.editId){
					//console.log('already has and up to date: ' + realId + ' (' + cur.meta.editId + '>=' + obj.meta.editId + ')');
					return function(){}
				}else{
					//console.log('already has ' + realId+', replacing');
				}
				//return function(){}
			}else{
				//console.log('got new object ' + realId);
			}
			_.assertDefined(obj)
			this.snap.objects[realId] = obj
		}else if(op === 'setObjectToJson'){
		
			if(this.snap.objects[id]){
				//console.log('replacing ' + id);
			}
			
			this.snap.objects[id] = edit.object;
			_.assertDefined(this.snap.objects[id])
			
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
		}else if(op === 'makeViewObject'){
			//console.log('created view object: ' + edit.id)
			if(this.snap.objects[edit.id] === undefined){
				this.snap.objects[edit.id] = {meta: {id: edit.id, typeCode: edit.typeCode, editId: editId}}
			}
		}else{
			_.errout('TODO implement top-level op: ' + JSON.stringify(edit));
		}
		return function(){}
	}else{
		//console.log(path);
		_.assertInt(path[0]);
		
		if(this.snap.objects[id] === undefined){
			console.log(JSON.stringify(Object.keys(this.snap.objects)))
			console.log('ignoring edit for object not known to view: ' + id + ' ' + this.snap.objects[id])
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
			//if(this.root){
			//	return this.root.refresh(edit);
			//}
			//return this.refresh(edit);
			return this.emit(edit, 'setProperty', propertyName)
		}else{
			var v = objApi.property(propertyName);
			_.assertObject(v);
			_.assertString(op)
			//console.log(JSON.stringify(objApi.toJson()))
			//console.log('descending into top-level object(' + id + '): ' + JSON.stringify(path) + ' ' + JSON.stringify(edit))
			//console.log(v)
			var res = v.changeListener(path.slice(1), op, edit, syncId, editId);	
			//console.log(JSON.stringify(objApi.toJson()))
			return res
		}
	}*/
}
function getFullSchema(){ return this.parent.getFullSchema();}
SyncApi.prototype.getFullSchema = function(){return this.schema;}
SyncApi.prototype.setEditingId = function(editingId){
	this.editingId = editingId;
}
SyncApi.prototype.createNewExternalObject = function(typeCode, temporaryId, obj, forget){
	_.assertLength(arguments, 4)
	//console.log('created external object ' + typeCode + ' ' + temporaryId)
	//return this.snap.objects[temporaryId] = {meta: {id: temporaryId, typeCode: typeCode, editId: -1}};

	this.sh.persistEdit('make', {typeCode: typeCode, forget: forget, temporary: temporaryId})
	this.currentObjectId = temporaryId

	//_.errout('TODO: include all obj edits')
	if(obj.length > 0){
		//this.sh.persistEdit('selectTopObject', {id: temporaryId})//TODO is this implicit?
		var sh = this.sh
		obj.forEach(function(edit){
			sh.persistEdit(edit.op, edit.edit)
		})
	}
	
	var t = this.schema._byCode[typeCode];
	var n = new TopObjectHandle(this.schema, t, obj, this, temporaryId);
	this.objectApiCache[temporaryId] = n;

	return n

}
SyncApi.prototype.reifyExternalObject = function(temporaryId, realId){
	_.assertLength(arguments, 2)
	console.log('reifying id ' + temporaryId + ' -> ' + realId)
	//console.log(JSON.stringify(this.snap.objects))
	//var obj = this.getObjectApi(temporaryId)
	
	
	_.assert(temporaryId < 0)
	//
	//var typeList = this.snap.objects
	//typeList[realId] = typeList[temporaryId];
	//delete typeList[temporaryId];
	//_.assertDefined(typeList[realId])
	
	var oldCacheKey = temporaryId;
	var newCacheKey = realId;
	if(this.objectApiCache[oldCacheKey]){
		var objApi = this.objectApiCache[newCacheKey] = this.objectApiCache[oldCacheKey];
		delete this.objectApiCache[oldCacheKey];
		objApi.objectId = realId;
		//objApi.obj.meta.id = realId;
		//console.log('emitted reify')
		objApi.emit({}, 'reify', realId, temporaryId)()
	}
	
	if(this.objectCreationCallbacks && this.objectCreationCallbacks[temporaryId]){
		var cbb = this.objectCreationCallbacks[temporaryId]
		if(cbb){
			//console.log('edit: ' + JSON.stringify(edit))
			cbb(realId);
		}
	}
}

SyncApi.prototype.getObjectApi = function getObjectApi(idOrViewKey){//, sourceParent){

	//_.assertInt(typeCode);
	//_.assertDefined(sourceParent);	

	var n = this.objectApiCache[idOrViewKey];
	if(n !== undefined){
		return n
	}
	var obj = this.snap.objects[idOrViewKey];
	if(obj === undefined){
		console.log('snap: ' + JSON.stringify(this.snap))//JSON.stringify(typeList))
		console.log('edits: ' + JSON.stringify(this.editsHappened, null, 2))
		console.log('cache: ' + JSON.stringify(Object.keys(this.objectApiCache)))
		_.errout(this.editingId + ' no object in snapshot with id: ' + idOrViewKey);
	}
	console.log(idOrViewKey+': ' + JSON.stringify(obj).slice(0,500))
	_.assert(obj.length > 0)

	var typeCode = obj[0].op === 'madeViewObject' ? obj[0].edit.typeCode : obj[1].edit.typeCode//first edit is a made op
	var t = this.schema._byCode[typeCode];

	if(t === undefined) _.errout('cannot find object type: ' + typeCode);
	
	n = new TopObjectHandle(this.schema, t, obj, this, idOrViewKey);
	this.objectApiCache[idOrViewKey] = n;

	return n
	/*if(n){
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
	
	//if(!t.superTypes.invariant) n.registerSourceParent(sourceParent);
	
	return n;*/
}
SyncApi.prototype.wrapObject = function(id, typeCode, part, sourceParent){
	_.assertLength(arguments, 4);
	_.assertInt(id)
	_.assertArray(part);
	_.assertInt(typeCode)

	_.assertFunction(sourceParent.adjustPath)
	
	var t = this.schema._byCode[typeCode];
	console.log('typeCode: ' + typeCode)
	_.assertDefined(t)
	return new ObjectHandle(t, {}, id, part, sourceParent);
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

function wrapObject(id, obj, part, sourceParent){
	return this.parent.wrapObject(id, obj, part, sourceParent);
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
	//var type = typeSchema.type;
	//console.log(type);
	//console.log(typeSchema);
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

exports.make = function(typeSchema, sh/*, snap, typeCode, id*/){
	_.assertLength(arguments, 2);
	_.assertObject(typeSchema);
	_.assertObject(sh);
	//_.assertObject(snap);

	return new SyncApi(typeSchema, sh/*, snap, typeCode, id*/);
}

