"use strict";

/*

Note that this is a set of objects (view or not) that is a property of a view - not necessarily a set of objects which ARE views.
*/

var lookup = require('./../lookup')
var editCodes = lookup.codes

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

ViewObjectSetHandle.prototype.getImmediateProperty = function(){
	_.errout('logic error?')
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

		this.emit(undefined, 'add', objHandle)//()
	}
}

ViewObjectSetHandle.prototype.changeListenerElevated = ObjectSetHandle.prototype.changeListenerElevated

//TODO detect when set should have seen an add edit from addNewFromJson's make, and check that it actually did happen
//if it doesn't that's a client error
ViewObjectSetHandle.prototype.changeListener = function(subObj, key, op, edit, syncId, editId){
	_.assertInt(op)
	//console.log('ERERER: ' + JSON.stringify([op, edit, syncId, editId]))
	if(op === editCodes.addExistingViewObject || op === editCodes.addExisting){
		//_.assertString(edit.id)
		var addedObjHandle = this.getObjectApi(edit.id);
		if(addedObjHandle === undefined){
			console.log('object not found, may have been del\'ed: ' + edit.id)
		}else{
			//console.log('added object: ' + edit.id)
			if(this.obj.indexOf(addedObjHandle) !== -1){
				console.log('ERROR: duplicate add: ' + JSON.stringify(addedObjHandle.toJson()))
				return
			}
			this.obj.push(addedObjHandle)
			//this.rand = Math.random()
			addedObjHandle.prepare()
			
			if(!addedObjHandle.isDestroyed()){
				addedObjHandle.on('del', this.delListener)
			}
			return this.emit(edit, 'add', addedObjHandle)
		}
	}else if(op === editCodes.addExistingInner){
		var addedObjHandle = this.getObjectApi(edit.inner)
		if(addedObjHandle === undefined){
			console.log('object not found, may have been del\'ed: ' + edit.id)
		}else{
			//console.log('added object: ' + edit.id)
			if(this.obj.indexOf(addedObjHandle) !== -1){
				console.log('ERROR: duplicate add: ' + JSON.stringify(addedObjHandle.toJson()))
				return
			}
			this.obj.push(addedObjHandle)
			//this.rand = Math.random()
			addedObjHandle.prepare()
			
			if(!addedObjHandle.isDestroyed()){
				addedObjHandle.on('del', this.delListener)
			}
			return this.emit(edit, 'add', addedObjHandle)
		}
	}else if(op === editCodes.removeViewObject || op === editCodes.remove){//TODO why do we need to support remove here?
	//	_.assertString(edit.id)
		//console.log('REMOVING')
		//try{
		//_.assertDefined(subObj)//?
		//_.errout('subObj: ' + subObj)
		//console.log('R: ' + (op === editCodes.removeViewObject))
		if(op === editCodes.remove) _.assertString(subObj)
		if(op === editCodes.removeViewObject) _.assertString(subObj)
		
		var index;
		
		for(var i=0;i<this.obj.length;++i){
			var a = this.obj[i]
			if(a.objectId === subObj){
				index = i
				break
			}
		}
		
		/*var objHandle = this.getObjectApi(subObj);
		if(objHandle === undefined){
			console.log('object not found, may have been del\'ed: ' + edit.id)
			return
		}*/
		if(index === -1){
			console.log('object not found: ' + subObj)
			return
		}
		/*}catch(e){
			this.log.info('WARNING: might be ok (if already destroyed locally), but could not find object: ' + edit.id)
			return
		}*/
		//var index = this.obj.indexOf(objHandle)
		this.obj.splice(index, 1)
		//console.log('removed: ' + index)

		var objHandle = this.getObjectApi(subObj);
		if(objHandle === undefined){
			console.log('object not found, may have been del\'ed: ' + edit.id)
			return
		}
		objHandle.off('del', this.delListener)
		return this.emit(edit, 'remove', objHandle)

	}else{
		_.errout('@TODO implement op: ' + op + ' ' + JSON.stringify(edit));
	}
}

module.exports = ViewObjectSetHandle
