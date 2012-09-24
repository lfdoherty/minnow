"use strict";

/*

Note that this is a set of objects (view or not) that is a property of a view - not necessarily a set of objects which ARE views.
*/

var u = require('./util')
var _ = require('underscorem')
var jsonutil = require('./../jsonutil')

var ObjectSetHandle = require('./objectset')


function ViewObjectSetHandle(typeSchema, obj, part, parent){
	this.part = part;
	this.parent = parent;
	this.schema = typeSchema;

	this.log = this.parent.log
	
	//console.log('obj: ' + JSON.stringify(obj))
	this.obj = u.wrapCollection(this, obj)
	
	var local = this
	this.delListener = function(){
		var i = local.obj.indexOf(this)
		local.obj.splice(i, 1)
		//console.log('removed deleted object from viewobjectset: ' + this.objectId)
		local.emit({}, 'remove', this)
	}
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
	//console.log(JSON.stringify([op, edit, syncId, editId]))
	if(op === 'addExistingViewObject' || op === 'addExisting'){
		//_.assertString(edit.id)
		var addedObjHandle = this.getObjectApi(edit.id);
		if(addedObjHandle === undefined){
			this.log.warn('object not found, may have been del\'ed: ' + edit.id)
		}else{
			this.obj.push(addedObjHandle)
			addedObjHandle.prepare()
			
			addedObjHandle.on('del', this.delListener)
			return this.emit(edit, 'add', addedObjHandle)
		}
	}else if(op === 'removeViewObject' || op === 'remove'){//TODO why do we need to support remove here?
	//	_.assertString(edit.id)
		//console.log('REMOVING')
		//try{
		var objHandle = this.getObjectApi(edit.id);
		if(objHandle === undefined){
			this.log.warn('object not found, may have been del\'ed: ' + edit.id)
			return
		}
		/*}catch(e){
			this.log.info('WARNING: might be ok (if already destroyed locally), but could not find object: ' + edit.id)
			return
		}*/
		this.obj.splice(this.obj.indexOf(objHandle), 1)

		objHandle.off('del', this.delListener)

		return this.emit(edit, 'remove', objHandle)
	}else{
		_.errout('@TODO implement op: ' + op + ' ' + JSON.stringify(edit));
	}
}

module.exports = ViewObjectSetHandle
