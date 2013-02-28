"use strict";

var u = require('./util')
var _ = require('underscorem')
module.exports = BinaryHandle

function BinaryHandle(typeSchema, obj, part, parent){
	this.part = part;
	this.parent = parent;
	_.assertObject(parent);
	
	if(this.isView()){
		this.truncate = u.viewReadonlyFunction
		this.append = u.viewReadonlyFunction
		this.write = u.viewReadonlyFunction
		this.set = u.viewReadonlyFunction
	}
	
	this.obj = obj;
}

BinaryHandle.prototype.getImmediateProperty = u.immediatePropertyFunction;

BinaryHandle.prototype.value = function(){
	return this.obj;
}
BinaryHandle.prototype.length = function(){
	return this.obj ? this.obj.length : 0;
}

BinaryHandle.prototype.truncate = function(newLength){
	newLength = newLength || 0
	if(this.obj === undefined){
		if(newLength > 0) _.errout('newLength ' + newLength + ' is greater than current length of 0');
		return;
	}
	this.obj = this.obj.slice(0, newLength)
	
	this.getSh().persistEdit(
		this.getObjectId(), 
		this.getPath(), 
		'truncate',
		{newLength: newLength}, 
		this.getEditingId());
		
	this.refresh()();	
}
BinaryHandle.prototype.append = function(buf){
	var objLen = this.obj ? this.obj.length : 0;
	var nb = new Buffer(objLen+buf.length);
	if(this.obj) this.obj.copy(nb);
	buf.copy(nb, objLen);
	this.obj = nb;

	this.getSh().persistEdit(
		this.getObjectId(), 
		this.getPath(), 
		'append',
		{data: buf}, 
		this.getEditingId());
		
	this.refresh()();	
}
BinaryHandle.prototype.write = function(pos, buf){
	_.assertBuffer(buf)
	if(pos+buf.length > this.length()){
		var nb = new Buffer(pos+buf.length);
		if(this.obj) this.obj.copy(nb);
		this.obj = nb;
	}
	//console.log('wrote buffer: ' + buf.length + ' ' + this.obj.length + ' ' + pos);
	buf.copy(this.obj, pos);
	
	this.getSh().persistEdit(
		this.getObjectId(), 
		this.getPath(), 
		'writeData',
		{data: buf, position: pos}, 
		this.getEditingId());
		
	this.refresh()();	
}
BinaryHandle.prototype.set = function(buf){

	this.obj = buf;
	
	this.getSh().persistEdit(
		this.getObjectId(), 
		this.getPath(), 
		'setData',
		{data: this.obj}, 
		this.getEditingId());
		
	this.refresh()();	
}

