var u = require('./util')
var _ = require('underscorem')

var jsonutil = require('./../jsonutil')

var ObjectHandle = require('./object')

function TopObjectHandle(schema, typeSchema, obj, parent, id){
	//_.assertLength(arguments, 5);
	_.assertObject(obj);
	
	if(!typeSchema.isView){
		_.assertInt(id)
	}else{
		_.assertString(id)
	}
	
	this.schema = schema;
	this.typeSchema = typeSchema;

	this.obj = {}
	this.edits = obj
	
	this.parent = parent;
	this.cachedProperties = {};
	
	this.objectId = id;
	this.objectTypeCode = typeSchema.code;

	this.currentHandle = this
	_.assertObject(this.currentHandle)
	
	this.lastEditId = -1
	
	//console.log('got edits: ' + JSON.stringify(obj))
	/this.edits.forEach(function(e){
		_.assertInt(e.editId)
	})
}

TopObjectHandle.prototype.isDefined = function(){return true;}

TopObjectHandle.prototype.setPropertyToNew = ObjectHandle.prototype.setPropertyToNew

TopObjectHandle.prototype.prepare = function prepare(){
	if(this.prepared) return;
	this.prepared = true;
	var s = this;

	//this.currentHandle = this
	//_.assertObject(this.currentHandle)

	//apply edits
	var currentSyncId=-1
	console.log(this.objectId + ' preparing topobject with edits: ' + JSON.stringify(this.edits).slice(0,500))
	this.edits.forEach(function(e){
		//_.assertInt(e.editId)
		if(e.op === 'setSyncId'){
			currentSyncId = e.edit.syncId
		}else if(e.op === 'madeViewObject'){
			console.log('ignoring view object creation')
		}else if(e.op === 'made'){
			console.log('ignoring object creation')
		}else{
			s.changeListener(e.op, e.edit, currentSyncId, e.editId)
			s.lastEditId = e.editId
		}
	})
	
	var keys = Object.keys(s.typeSchema.properties);
	keys.forEach(function(name){
		console.log('preparing: ' + name)
		var p = s.typeSchema.properties[name];
		var v = s.property(name);
		v.prepare();
		s[name] = v;
		
	});
}

TopObjectHandle.prototype.isInner = function(){return false;}

TopObjectHandle.prototype.properties = ObjectHandle.prototype.properties;

TopObjectHandle.prototype.propertyIsPrimitive = ObjectHandle.prototype.propertyIsPrimitive

TopObjectHandle.prototype.removeParent = function(){}
TopObjectHandle.prototype._typeCode = function(){return this.objectTypeCode;}
TopObjectHandle.prototype.getPath = function(){return [];}
TopObjectHandle.prototype.type = function(){return this.typeSchema.name;}
TopObjectHandle.prototype.id = function(){
	if(this.objectId < 0) throw new Error('cannot get id of locally-created object yet - you need to provide a callback to your make(...) call to be notified when the id becomes available.')
	return this.objectId;
}
TopObjectHandle.prototype._internalId = function(){
	return this.objectId;
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

TopObjectHandle.prototype.hasProperty = ObjectHandle.prototype.hasProperty;
TopObjectHandle.prototype.has = ObjectHandle.prototype.has;

TopObjectHandle.prototype.setProperty = ObjectHandle.prototype.setProperty

TopObjectHandle.prototype.delayRefresh = function(){
	this.refreshDelayed = true;
}

TopObjectHandle.prototype.adjustPath = function(source){
	_.assertLength(arguments, 1)
	_.assert(source > 0)
	
	var currentPath = this.currentPath
	if(currentPath === undefined) currentPath = this.currentPath = []
	console.log('adjust top path: ' + JSON.stringify(currentPath) + ' -> ' + source)
	
	if(currentPath.length === 0){
		_.assertInt(source)
		this.persistEdit('selectProperty', {typeCode: source})
		return []
	}else if(currentPath[0] !== source){
		if(currentPath.length > 1) this.reduceBy(currentPath.length-1)
		this.persistEdit('reselectProperty', {typeCode: source})
		return []
	}else{
		return this.currentPath.slice(1)
	}
}
TopObjectHandle.prototype.persistEdit = function(op, edit){
	if(op === 'reset'){
		this.currentPath = []
	}else if(op === 'selectProperty'){
		this.currentPath.push(edit.typeCode)
	}else if(op === 'reselectProperty'){
		this.currentPath[this.currentPath.length-1] = edit.typeCode
	}else if(op === 'selectObject'){
		this.currentPath.push(edit.id)
	}else if(op === 'reselectObject'){
		this.currentPath[this.currentPath.length-1] = edit.id
	}else if(op === 'selectStringKey' || op === 'selectLongKey' || op === 'selectIntKey' || op === 'selectBooleanKey'){
		this.currentPath.push(edit.key)
	}else if(op === 'reselectStringKey' || op === 'reselectLongKey' || op === 'reselectIntKey' || op === 'reselectBooleanKey'){
		this.currentPath[this.currentPath.length-1] = edit.key
	}else if(op === 'ascend1'){
		this.currentPath.pop()
	}else if(op === 'ascend2'){
		this.currentPath.pop()
		this.currentPath.pop()
	}else if(op === 'ascend3'){
		this.currentPath.pop()
		this.currentPath = this.currentPath.slice(0, this.currentPath.length-3)
	}else if(op === 'ascend4'){
		this.currentPath = this.currentPath.slice(0, this.currentPath.length-4)
	}else if(op === 'ascend5'){
		this.currentPath = this.currentPath.slice(0, this.currentPath.length-5)
	}else if(op === 'ascend'){
		this.currentPath = this.currentPath.slice(0, this.currentPath.length-edit.many)
	}else{
		console.log('here: ' + op)
	}
	this.parent.persistEdit(this.getObjectTypeCode(), this.getObjectId(), op, edit)
}

TopObjectHandle.prototype.getCurrentPath = function(){
	if(this.currentPath === undefined) this.currentPath = []
	return this.currentPath
}
TopObjectHandle.prototype.saveEdit = function(op, edit){
	this.persistEdit(op, edit)
}
/*
//this.getSh().persistEdit(
	this.parent.saveEdit(op, edit){
		this.getObjectTypeCode(),
		this.getObjectId(), 
		this.getPath(),
		op,
		edit,
		this.getEditingId());
*/
TopObjectHandle.prototype.registerSourceParent = function(sourceParent){
	if(this.sourceParents === undefined) this.sourceParents = [];
	if(this.sourceParents.indexOf(sourceParent) === -1){
		this.sourceParents.push(sourceParent);
		//console.log('registered source parent for ' + this.typeSchema.name + ' ' + this.objectId);
	}
}
TopObjectHandle.prototype.basicDoRefresh = u.doRefresh

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

TopObjectHandle.prototype.setObjectToJson = function(typeName, id, json){

	var obj = jsonutil.convertJsonToObject(this.schema, typeName, json);
	
	var edit = {object: obj};

	this.getSh().persistEdit(
		id, 
		[],
		'setObjectToJson',
		edit,
		this.getEditingId());
}

//TODO provide handle with temporary id for objects created this way
TopObjectHandle.prototype.make = function(typeName, json,cb){
	if(_.isObject(typeName)){
		cb = json
		json = typeName
		typeName = undefined
	}
	if(json !== undefined && !_.isObject(json)){
		cb = json
		json = undefined
	}
	if(json === undefined) json = {}
	
	var forget = false;
	if(cb === true){
		cb = undefined
		forget = true
	}
	
    var objSchema = this.schema[typeName]
    if(objSchema  === undefined) throw new Error('unknown type: ' + typeName)
	var typeCode = objSchema.code;
	var objEdits = jsonutil.convertJsonToEdits(this.schema, typeName, json);
	
	if(forget){
		//var obj = json
		//obj.meta = {id: 0, typeCode: typeCode, editId: -1};
		//var edit = {obj: {type: typeCode, object: obj}, forget: true};

		this.createNewExternalObject(typeCode, temporary, objEdits, forget)
	}else{
		var temporary = this.makeTemporaryId()//u.makeTemporaryId();//TODO should be unique to the sync handle for parallelism with the server-side handle


		var res = this.createNewExternalObject(typeCode, temporary, objEdits, forget)
	
		res.prepare();

		if(cb){
			if(this.parent.objectCreationCallbacks === undefined) this.parent.objectCreationCallbacks = {};
			this.parent.objectCreationCallbacks[temporary] = cb;
		}

		return res;
	}
}
TopObjectHandle.prototype.changeListenerElevated = ObjectHandle.prototype.changeListenerElevated

TopObjectHandle.prototype.changeListener = function(op, edit, syncId, editId){
	_.assertString(op)
	_.assertObject(edit)
	_.assertInt(syncId)
	_.assertInt(editId)

	this.prepare()//TODO optimize by appending edit if not prepared, applying if prepared?
	
	//_.assertObject(this.currentHandle)

	//console.log('top object (' + this.objectId + ' ' + this.typeSchema.code + ' ' + this.lastEditId + ') change: ' + JSON.stringify([op, edit, syncId, editId]))
	//console.log(JSON.stringify(this.pathEdits))
	if(this.lastEditId !== undefined && editId < this.lastEditId){
		_.errout('invalid old edit received: ' + editId + ' < ' + this.lastEditId)
	}

	this.lastEditId = editId
	
	if(this.path === undefined){
		this.path = []
		this.pathEdits = []
	}
	
	if(op === 'reset'){
		this.path = []
		this.pathEdits = []
	}else if(op === 'selectProperty'){
		this.path.push(edit.typeCode)
		this.pathEdits.push({op: op, edit: edit})
	}else if(op === 'reselectProperty'){
		this.path[this.path.length-1] = edit.typeCode
		this.pathEdits[this.path.length-1] = {op: op, edit: edit}
	}else if(op === 'selectObject'){
		this.path.push(edit.id)
		this.pathEdits.push({op: op, edit: edit})
	}else if(op === 'reselectObject'){
		this.path[this.path.length-1] = edit.id
		this.pathEdits[this.path.length-1] = {op: op, edit: edit}
	}else if(op.indexOf('select') === 0 && op.indexOf('Key') === op.length-3){
		this.path.push(edit.key)
		this.pathEdits.push({op: op, edit: edit})		
	}else if(op.indexOf('reselect') === 0 && op.indexOf('Key') === op.length-3){
		this.path[this.path.length-1] = edit.key
		this.pathEdits[this.path.length-1] = {op: op, edit: edit}
	}else if(op === 'ascend1'){
		this.path.pop()
		this.pathEdits.pop()
	}else if(op === 'ascend2'){
		this.path = this.path.slice(0, this.path.length-2)
		this.pathEdits = this.pathEdits.slice(0, this.pathEdits.length-2)
	}else if(op === 'ascend3'){
		this.path = this.path.slice(0, this.path.length-3)
		this.pathEdits = this.pathEdits.slice(0, this.pathEdits.length-3)
	}else if(op === 'ascend4'){
		this.path = this.path.slice(0, this.path.length-4)
		this.pathEdits = this.pathEdits.slice(0, this.pathEdits.length-4)
	}else if(op === 'ascend5'){
		this.path = this.path.slice(0, this.path.length-5)
		this.pathEdits = this.pathEdits.slice(0, this.pathEdits.length-5)
	}else if(op === 'made'){
	}else{
		if(op === 'setObject' || op === 'setViewObject' || op.indexOf('put') === 0 || op === 'removeExisting' || op === 'del'){
			_.assert(this.path.length > 0)
			var lastCode = this.path[this.path.length-1]
			//console.log('here: ' + this.currentHandle.constructor)
			var ch = descend(this, this.pathEdits.slice(0, this.pathEdits.length-1))
			
			//console.log(JSON.stringify(this.pathEdits))
			//console.log('calling elevated change listener')
			ch.changeListenerElevated(lastCode, op, edit, syncId, editId)
		}else{
			var currentHandle = descend(this, this.pathEdits)
			if(currentHandle === undefined){
				console.log('WARNING: cannot complete edit: ' + op + ' ' + JSON.stringify(edit))
				return
			}
			if(currentHandle === this){
				_.errout('TODO: ' + op)
			}else{
				//console.log('calling change listener')
				currentHandle.changeListener(op, edit, syncId, editId)
			}
		}
	}
	//_.assertObject(this.currentHandle)
}
TopObjectHandle.prototype.propertyByCode = ObjectHandle.prototype.propertyByCode
function descend(start, pathEdits){
	var ch = start
	//console.log(JSON.stringify(pathEdits))
	for(var i=0;i<pathEdits.length;++i){
		var pe = pathEdits[i]
		if(pe.op === 'selectProperty' || pe.op === 'reselectProperty'){
			ch = ch.propertyByCode(pe.edit.typeCode)
		}else if(pe.op === 'selectObject' || pe.op === 'reselectObject'){
			_.assert(pe.edit.id > 0)
			ch = ch.get(pe.edit.id)
			if(ch === undefined){
				console.log('WARNING: might be ok, but cannot descend into path due to id not found: ' + JSON.stringify(pathEdits.slice(0,i+1)))
				return
			}
			//console.log('id: ' + pe.edit.id)
			_.assertDefined(ch)
		}else if(pe.op.indexOf('Key') === pe.op.length-3){
			ch = ch.get(pe.edit.key)
		}else{
			_.errout('TODO: ' + JSON.stringify(pathEdits))
		}
	}
	return ch
}

module.exports = TopObjectHandle
