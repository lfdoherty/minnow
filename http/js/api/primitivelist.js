"use strict";

var u = require('./util')
var _ = require('underscorem')
module.exports = PrimitiveListHandle

var stub = function(){}
function readonlyError(){_.errout('readonly');}

var lookup = require('./../lookup')
var editCodes = lookup.codes

function PrimitiveListHandle(typeSchema, obj, part, parent, isReadonly){
	
	this.part = part;
	this.obj = [].concat(obj || []);
	this.parent = parent;
	this.schema = typeSchema;

	this.assertMemberType = u.getPrimitiveCollectionAssertion('list', typeSchema)

	this.readonly = isReadonly;
	if(isReadonly){
		this.remove = readonlyError;
		this.add = readonlyError;
		this.shift = readonlyError;
	}
	this.latestVersionId = -1
	//this.log('setting up primitive list: ' + JSON.stringify(obj))
	
	this.addOp = u.getAddOperator(typeSchema)
	this.removeOp = u.getRemoveOperator(typeSchema)
	this.setAtOp = u.getSetAtOperator(typeSchema)
	
	if(this.isView()){
		this.set = u.viewReadonlyFunction
		this.add = u.viewReadonlyFunction
		this.remove = u.viewReadonlyFunction
		this.shift = u.viewReadonlyFunction
	}

	////this.obj.forEach(function(r){
	//	_.assert(r != null)
	//})
}
PrimitiveListHandle.prototype.prepare = stub


PrimitiveListHandle.prototype.toJson = function(){
	_.assertDefined(this.obj)
	var res = [].concat(this.obj);
	//res.forEach(function(r){
	//	_.assert(r != null)
	//})
	return res
}
PrimitiveListHandle.prototype.count = function(){return this.obj.length;}
PrimitiveListHandle.prototype.size = PrimitiveListHandle.prototype.count

PrimitiveListHandle.prototype.set = function(arr){
	var local = this
	var toRemove = []
	var changed = false
	this.obj.forEach(function(v){
		if(arr.indexOf(v) === -1){
			toRemove.push(v)
			changed = true
		}
	})
	toRemove.forEach(function(v){
		local.remove(v)
	})
	arr.forEach(function(v){
		if(local.obj.indexOf(v) === -1){
			local.add(v)
			changed = true
		}
	})
	return changed
}
PrimitiveListHandle.prototype.add = function(value){
	this.assertMemberType(value)

	if(this.obj.indexOf(value) !== -1){
		_.errout('already has value (lists may not contain duplicates): ' + value)
	}
	
	_.assertPrimitive(value)//TODO test based on actual specific type
	this.obj.push(value);
	
	var e = {value: value}
	this.saveEdit(this.addOp, e);
		
	this.emit(e, 'add', value)//()
}
PrimitiveListHandle.prototype.push = PrimitiveListHandle.prototype.add

PrimitiveListHandle.prototype.remove = function(value){
	this.assertMemberType(value)
	
	var index = this.obj.indexOf(value);
	if(index !== undefined){

		this.obj.splice(index, 1);

		var e = {value: value}
		this.saveEdit(this.removeOp, e);
		
		this.emit(e, 'remove', value)//()
	}else{
		_.errout('tried to remove object not in collection, id: ' + id);
	}
}

PrimitiveListHandle.prototype.setAt = function(index, value){
	this.assertMemberType(value)
	_.assertInt(index)
	if(index >= this.obj.length) _.errout('invalid index out of range: ' + index + ' >= ' + this.obj.length)
	if(index < 0) _.errout('index must be positive, not: ' + index)
	
	this.obj[index] = value
	
	var e = {value: value, index: index}
	this.saveEdit(this.setAtOp, e);
		
	this.emit(e, 'setAt', index, value)
}

PrimitiveListHandle.prototype.shift = function(){

	if(this.obj.length < 1) _.errout('cannot shift empty list')
	
	var e = {}
	this.saveEdit(editCodes.shift, e);

	var v = this.obj.shift();
		
	this.emit(e, 'shift', v)//()
	return v;
}

PrimitiveListHandle.prototype.has = function(value){
	_.assertLength(arguments, 1);
	return this.obj.indexOf(value) !== -1
}


PrimitiveListHandle.prototype.each = function(cb, endCb){
	this.obj.forEach(cb)
	if(endCb) endCb();
}
PrimitiveListHandle.prototype.changeListener = function(op, edit, syncId, editId){
	_.assertLength(arguments, 4);

	if(this.latestVersionId < editId) this.latestVersionId = editId
		
	if(lookup.isPrimitiveAddCode[op]){//op.indexOf('add') === 0){
		if(this.getEditingId() !== syncId){
			//this.log('pushing ' + edit.value + ' onto ' + JSON.stringify(this.obj) + ' ' + JSON.stringify([edit, editId]) + ' ' + this.getEditingId() + ' ' + syncId)
			//console.log(JSON.stringify([op, edit, syncId, editId]))
			_.assertPrimitive(edit.value)
			_.assert(edit.value != null)
			this.obj.push(edit.value);
			
			return this.emit(edit, 'add', edit.value, editId)
		}else{
			return stub;
		}
	}else if(op === editCodes.shift){
		if(this.getEditingId() !== syncId){

			_.assert(this.obj.length >= 1);
			var shifted = this.obj.shift();

			return this.emit(edit, 'shift', shifted, editId)
			
		}else{
			return stub;
		}
	}else if(lookup.isPrimitiveRemoveCode[op]){//op.indexOf('remove') === 0){
		if(this.getEditingId() !== syncId){
			var index = this.obj.indexOf(edit.value);
			if(index === -1){
				this.log('ignoring invalid remove: ' + edit.value);
			}else{
				this.obj.splice(index, 1);
				
				return this.emit(edit, 'remove', edit.value, editId)
			}
		}		
		return stub;
	}else if(lookup.isSetAt[op]){
		//_.errout('todo setAt')
		if(this.obj.length <= edit.index){
			console.log('WARNING ignored setAt with out-of-bounds index: ' + JSON.stringify(edit))
		}
		this.obj[edit.index] = edit.value
	}else{
		_.errout('+TODO implement op: ' + JSON.stringify(edit));
	}
}

