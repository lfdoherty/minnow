"use strict";

var u = require('./util')
var _ = require('underscorem')

var lookup = require('./../lookup')
var editCodes = lookup.codes

function LongHandle(typeSchema, obj, part, parent){
	this.part = part;
	this.obj = obj;
	this.parent = parent;

	if(this.isView()){
		this.set = u.viewReadonlyFunction
	}

}
LongHandle.prototype.value = function(){
	//console.log('returning value: ' + this.obj)
	return this.obj;
}
LongHandle.prototype.getImmediateProperty = u.immediatePropertyFunction;
LongHandle.prototype.adjustPathToSelf = u.adjustPathToPrimitiveSelf
LongHandle.prototype.set = function(v){
	
	if(this.obj === v) return
	
	this.obj = v;
	
	var e = {value: this.obj}
	this.saveEdit(editCodes.setLong, e)
		
	this.emit(e, 'set', v)//()
}
LongHandle.prototype.changeListener = u.primitiveChangeListener;
LongHandle.prototype.toJson = function(){return this.obj}
module.exports = LongHandle
