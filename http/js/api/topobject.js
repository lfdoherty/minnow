var u = require('./util')
var _ = require('underscorem')

var jsonutil = require('./../jsonutil')

var ObjectHandle = require('./object')

function TopObjectHandle(schema, typeSchema, obj, parent, id){
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
	
	this.objectId = id;
	this.objectTypeCode = typeSchema.code;

	this.currentHandle = this
	_.assertObject(this.currentHandle)
	
	this.lastEditId = -1
	
	this.edits.forEach(function(e){
		_.assertInt(e.editId)
	})
}

TopObjectHandle.prototype.replaceObjectHandle = ObjectHandle.prototype.replaceObjectHandle

TopObjectHandle.prototype.isDefined = function(){return true;}

//TopObjectHandle.prototype.setPropertyToNew = ObjectHandle.prototype.setPropertyToNew

TopObjectHandle.prototype.getTopObject = function(){return this;}

TopObjectHandle.prototype.prepare = function prepare(){
	if(this.prepared) return;
	this.prepared = true;
	var s = this;

	//apply edits
	var currentSyncId=-1
	this.log(this.objectId + ' preparing topobject with edits: ' + JSON.stringify(this.edits).slice(0,5000))
	this.edits.forEach(function(e){
		//_.assertInt(e.editId)
		if(e.op === 'setSyncId'){
			currentSyncId = e.edit.syncId
		}else if(e.op === 'madeViewObject'){
			s.log('ignoring view object creation')
		}else if(e.op === 'made'){
			s.log('ignoring object creation')
		}else{
			s.changeListener(e.op, e.edit, currentSyncId, e.editId)
			s.lastEditId = e.editId
		}
	})
	
	var keys = Object.keys(s.typeSchema.properties);
	keys.forEach(function(name){
		//this.log('preparing: ' + name)
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

//TopObjectHandle.prototype.setProperty = ObjectHandle.prototype.setProperty

TopObjectHandle.prototype.delayRefresh = function(){
	this.refreshDelayed = true;
}

TopObjectHandle.prototype.adjustPath = function(source){
	_.assertLength(arguments, 1)
	_.assertInt(source)
	_.assert(source > 0)
	
	var currentPath = this.currentPath
	if(currentPath === undefined) currentPath = this.currentPath = []
	this.log('adjust top path: ' + JSON.stringify(currentPath) + ' -> ' + source)
	
	if(currentPath.length === 0){
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
	this.log('here: ' + this.getObjectId())
	_.assertInt(this.getObjectId())
	
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
		//this.log('here: ' + op)
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

TopObjectHandle.prototype.registerSourceParent = function(sourceParent){
	if(this.sourceParents === undefined) this.sourceParents = [];
	if(this.sourceParents.indexOf(sourceParent) === -1){
		this.sourceParents.push(sourceParent);
		//this.log('registered source parent for ' + this.typeSchema.name + ' ' + this.objectId);
	}
}
//TopObjectHandle.prototype.basicDoRefresh = u.doRefresh

TopObjectHandle.prototype.doRefresh = function(already, sourceOfRefresh, e){
	var cbs = [];
	var cba = this.basicDoRefresh(already, sourceOfRefresh, e);
	cbs.push(cba);
	//this.log('TopObjectHandle doRefresh calling source parents: ' + this.sourceParents.length);
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
		this.createNewExternalObject(typeCode, temporary, objEdits, forget)
	}else{
		var temporary = this.makeTemporaryId()//TODO should be unique to the sync handle for parallelism with the server-side handle


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

function maintainPath(local, op, edit, syncId, editId){

	if(local.lastEditId !== undefined && editId < local.lastEditId && editId >= 0){
		_.errout('invalid old edit received: ' + editId + ' < ' + local.lastEditId)
	}

	local.lastEditId = editId
	
	if(local.path === undefined){
		local.path = []
		local.pathEdits = []
	}
	
	if(op === 'reset'){
		local.path = []
		local.pathEdits = []
	}else if(op === 'selectProperty'){
		local.path.push(edit.typeCode)
		local.pathEdits.push({op: op, edit: edit})
	}else if(op === 'reselectProperty'){
		_.assert(local.path.length > 0)
		local.path[local.path.length-1] = edit.typeCode
		local.pathEdits[local.path.length-1] = {op: op, edit: edit}
	}else if(op === 'selectObject'){
		local.path.push(edit.id)
		local.pathEdits.push({op: op, edit: edit})
	}else if(op === 'reselectObject'){
		_.assert(local.path.length > 0)
		local.path[local.path.length-1] = edit.id
		local.pathEdits[local.path.length-1] = {op: op, edit: edit}
	}else if(op.indexOf('select') === 0 && op.indexOf('Key') === op.length-3){
		local.path.push(edit.key)
		local.pathEdits.push({op: op, edit: edit})		
	}else if(op.indexOf('reselect') === 0 && op.indexOf('Key') === op.length-3){
		local.path[local.path.length-1] = edit.key
		local.pathEdits[local.path.length-1] = {op: op, edit: edit}
	}else if(op === 'ascend1'){
		local.path.pop()
		local.pathEdits.pop()
	}else if(op === 'ascend2'){
		local.path = local.path.slice(0, local.path.length-2)
		local.pathEdits = local.pathEdits.slice(0, local.pathEdits.length-2)
	}else if(op === 'ascend3'){
		local.path = local.path.slice(0, local.path.length-3)
		local.pathEdits = local.pathEdits.slice(0, local.pathEdits.length-3)
	}else if(op === 'ascend4'){
		local.path = local.path.slice(0, local.path.length-4)
		local.pathEdits = local.pathEdits.slice(0, local.pathEdits.length-4)
	}else if(op === 'ascend5'){
		local.path = local.path.slice(0, local.path.length-5)
		local.pathEdits = local.pathEdits.slice(0, local.pathEdits.length-5)
	}else if(op === 'made'){
	}else if(op === 'wasSetToNew' && local.path.length === 1){
		//_.errout('TODO')
		var code = local.path[0]
		var property = local.typeSchema.propertiesByCode[code]
		var objSchema = local.schema[property.type.object]
		_.assertInt(this._internalId())
		local[property.name] = new ObjectHandle(objSchema, [], edit.id, [code], local);
	}else{
		if(op === 'setObject' || op === 'setViewObject' || op.indexOf('put') === 0 || op === 'removeExisting' || op === 'del'){
			_.assert(local.path.length > 0)
			var lastCode = local.path[local.path.length-1]
			//this.log('here: ' + local.currentHandle.constructor)
			var ch = descend(local, local.pathEdits.slice(0, local.pathEdits.length-1))
			
			//this.log(JSON.stringify(local.pathEdits))
			local.log('calling elevated change listener ' + lastCode + ' ' + op + ' ' + JSON.stringify(edit))
			ch.changeListenerElevated(lastCode, op, edit, syncId, editId)
		}else{
			var currentHandle = descend(local, local.pathEdits)
			if(currentHandle === undefined){
				local.log('WARNING: cannot complete edit: ' + op + ' ' + JSON.stringify(edit))
				return
			}
			if(currentHandle === local){
				local.log(JSON.stringify(this.edits, null, 2))
				_.errout('TODO: ' + op + ' ' + JSON.stringify(local.pathEdits))
			}else{
				//this.log('calling change listener')
				currentHandle.changeListener(op, edit, syncId, editId)
			}
		}
	}
	local.log(local.objectId + ' maintained: ' + JSON.stringify([op, edit, syncId, editId]))
	local.log('new path: ' + JSON.stringify(local.pathEdits))
}
exports.maintainPath = maintainPath

TopObjectHandle.prototype.changeListener = function(op, edit, syncId, editId){
	_.assertString(op)
	_.assertObject(edit)
	_.assertInt(syncId)
	_.assertInt(editId)

	this.prepare()//TODO optimize by appending edit if not prepared, applying if prepared?
	
	maintainPath(this, op, edit, syncId, editId)
}
TopObjectHandle.prototype.propertyByCode = ObjectHandle.prototype.propertyByCode
function descend(start, pathEdits){
	var ch = start
	//this.log(JSON.stringify(pathEdits))
	for(var i=0;i<pathEdits.length;++i){
		var pe = pathEdits[i]
		if(pe.op === 'selectProperty' || pe.op === 'reselectProperty'){
			ch = ch.propertyByCode(pe.edit.typeCode)
		}else if(pe.op === 'selectObject' || pe.op === 'reselectObject'){
			_.assert(pe.edit.id > 0)
			if(ch.get){//map descent
				ch = ch.get(pe.edit.id)
				if(ch === undefined){
					this.log('WARNING: might be ok, but cannot descend into path due to id not found: ' + JSON.stringify(pathEdits.slice(0,i+1)))
					return
				}
			}else{
				//we don't actually do anything except check that the object property's object hasn't changed
				if(ch.objectId !== pe.edit.id){
					this.log('WARNING: might be ok, but cannot descend into path due to id not found: ' + JSON.stringify(pathEdits.slice(0,i+1)))
					return
				}
			}
			//this.log('id: ' + pe.edit.id)
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
