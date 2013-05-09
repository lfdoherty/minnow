"use strict";

var u = require('./util')
var _ = require('underscorem')

var lookup = require('./../lookup')
var editCodes = lookup.codes

function IntHandle(typeSchema, obj, part, parent){
	//_.assertInt(part)
	
	this.part = part;
	this.obj = obj;
	this.parent = parent;

	if(this.isView()){
		this.set = u.viewReadonlyFunction
	}
	this.schema = typeSchema
}

IntHandle.prototype.getName = function(){return this.schema.name;}

IntHandle.prototype.value = function(){
	return this.obj;
}
IntHandle.prototype.getImmediateProperty = u.immediatePropertyFunction;
IntHandle.prototype.changeListener = u.primitiveChangeListener;
IntHandle.prototype.adjustPathToSelf = u.adjustPathToPrimitiveSelf
IntHandle.prototype.set = function(v){

	if(this.obj === v) return
	
	this.obj = v;

	var e = {value: this.obj}
	this.saveEdit(editCodes.setInt, e);
		
	this.emit(e, 'set', v)//()
}
IntHandle.prototype.toJson = function(){return this.obj}
module.exports = IntHandle
