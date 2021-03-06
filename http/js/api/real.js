"use strict";

var u = require('./util')
var _ = require('underscorem')

function RealHandle(typeSchema, obj, part, parent){
	this.part = part;
	this.obj = obj;
	this.parent = parent;

	if(this.isView()){
		this.set = u.viewReadonlyFunction
	}
	this.schema = typeSchema
}

RealHandle.prototype.getName = function(){return this.schema.name;}

RealHandle.prototype.getImmediateProperty = u.immediatePropertyFunction;

RealHandle.prototype.value = function(){
	return this.obj;
}
RealHandle.prototype.set = function(v){
	
	this.obj = v;
	
	var e = {value: this.obj}
	this.saveEdit('set', e)
		
	this.emit(e, 'set', v)//()
}
RealHandle.prototype.changeListener = u.primitiveChangeListener;
RealHandle.prototype.toJson = function(){return this.obj}
module.exports = RealHandle
