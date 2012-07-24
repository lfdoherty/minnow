
var u = require('./util')
var _ = require('underscorem')
var jsonutil = require('./../jsonutil')

var ObjectSetHandle = require('./objectset')


function ViewObjectSetHandle(typeSchema, obj, part, parent){
	this.part = part;
	this.parent = parent;
	this.schema = typeSchema;

	console.log('obj: ' + JSON.stringify(obj))
	this.obj = u.wrapCollection(this, obj)
}

ViewObjectSetHandle.prototype.count = function(){return this.obj.length;}
ViewObjectSetHandle.prototype.size = ObjectSetHandle.prototype.count

ViewObjectSetHandle.prototype.eachJson = ObjectSetHandle.prototype.eachJson
ViewObjectSetHandle.prototype.contains = ObjectSetHandle.prototype.contains
ViewObjectSetHandle.prototype.has = ObjectSetHandle.prototype.has
ViewObjectSetHandle.prototype.get = ObjectSetHandle.prototype.get

ViewObjectSetHandle.prototype.each = ObjectSetHandle.prototype.each

ViewObjectSetHandle.prototype.remove = function(){
	_.errout('TODO: remove from view set')
}

ViewObjectSetHandle.prototype.toJson = ObjectSetHandle.prototype.toJson

ViewObjectSetHandle.prototype.types = u.genericCollectionTypes

//TODO setup listen for correctness
ViewObjectSetHandle.prototype.add = function(objHandle){
	_.assertObject(objHandle)
	
	if(this.obj.indexOf(objHandle) !== -1){
		console.log('WARNING: ignored redundant add on viewobjectset')
	}else{
		this.obj.push(objHandle);
		if(this.wasAdded === undefined) this.wasAdded = []
		this.wasAdded.push(objHandle)

		this.emit(undefined, 'add', objHandle)()
	}
}

//TODO detect when set should have seen an add edit from addNewFromJson's make, and check that it actually did happen
//if it doesn't that's a client error
ViewObjectSetHandle.prototype.changeListener = function(op, edit, syncId, editId){
	_.assertString(op)

	if(op === 'addExistingViewObject' || op === 'addExisting'){
		//_.assertString(edit.id)
		var addedObjHandle = this.getObjectApi(edit.id);
		//console.log('got obj handle: ' + addedObjHandle.id())
		//console.log(_.map(this.obj, function(v){return v.id();}))
		if(this.obj.indexOf(addedObjHandle) !== -1){
			//_.errout('already have obj handle: ' + syncId + ' ' + this.getEditingId())
			_.assert(this.wasAdded.indexOf(addedObjHandle) !== -1)
		}else{
			//console.log('view adding: ' + JSON.stringify(addedObjHandle.id()))
			this.obj.push(addedObjHandle)
			addedObjHandle.prepare()
			return this.emit(edit, 'add', addedObjHandle)
		}
	}else if(op === 'remove'){
		var objHandle = this.getObjectApi(edit.id);
		this.obj.splice(this.obj.indexOf(objHandle), 1)
		return this.emit(edit, 'remove', objHandle)
	}else{
		_.errout('@TODO implement op: ' + op + ' ' + JSON.stringify(edit));
	}
}

module.exports = ViewObjectSetHandle
