"use strict";

var u = require('./util')
var _ = require('underscorem')

function BooleanHandle(typeSchema, obj, part, parent){
	
	this.part = part;
	this.parent = parent;
	_.assertObject(parent);
	
	if(obj === undefined){
		if(typeSchema.tags && typeSchema.tags['default:false']) obj = false;
		else if(typeSchema.tags && typeSchema.tags['default:false']) obj = true;
	}

	this.obj = obj;
}
BooleanHandle.prototype.value = function(){
	return this.obj;
}
BooleanHandle.prototype.changeListener = u.primitiveChangeListener;
BooleanHandle.prototype.set = function(v){
	this.obj = v;

	var e = {value: this.obj}
	this.saveEdit('setBoolean', e);
		
	this.emit(e, 'set', v)()
}

BooleanHandle.prototype.toggle = function(){
	this.set(!this.value())
}

BooleanHandle.prototype.toJson = function(){
	return !!this.obj;
}

module.exports = BooleanHandle
