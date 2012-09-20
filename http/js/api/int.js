"use strict";

var u = require('./util')
var _ = require('underscorem')

function IntHandle(typeSchema, obj, part, parent){
	//_.assertInt(part)
	
	this.part = part;
	this.obj = obj;
	this.parent = parent;
}
IntHandle.prototype.value = function(){
	return this.obj;
}
IntHandle.prototype.changeListener = u.primitiveChangeListener;
IntHandle.prototype.set = function(v){

	if(this.obj === v) return
	
	this.obj = v;

	var e = {value: this.obj}
	this.saveEdit('setInt', e);
		
	this.emit(e, 'set', v)()
}
IntHandle.prototype.toJson = function(){return this.obj}
module.exports = IntHandle
