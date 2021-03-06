"use strict";

var _ = require('underscorem');
var sys = require('sys'),
	Buffer = require('buffer').Buffer,
	bin = require('./bin'),
	fs = require('fs');


function W(){

	this.position = 0;

	this.b = new Buffer(1024*1024);
	this.bytesSinceFlush = 0;
	
	this.countStack = [];
	this.countValueStack = [];
	this.countPos = -1;
	this.lengthStack = [];
	this.lenPos = -1;
	
	var local = this;
	
	this.blockStart = 0;
}

W.prototype.takeBlock = function(){	
	
	var result = this.b.slice(this.blockStart, this.position);
	this.blockStart = this.position;
	return result;
}


W.prototype.prepareFor = function(manyBytes){
	if(this.b.length - this.position < manyBytes){

		var used = (this.b.length-this.blockStart);
		
		var nb = new Buffer(Math.max(
			(manyBytes+used)*2, 
			Math.ceil(this.b.length*0.95), 
			1*1024*1024
			));
			
		this.b.copy(nb, 0, this.blockStart);
		this.b = nb;

		this.position -= this.blockStart;
		this.blockStart = 0;
	}
}
W.prototype.putShortString = function(str){
	var len = Buffer.byteLength(str);
	if(len > 255) _.errout('short string is too long: ' + len);
	
	this.prepareFor(len+1);
	this.putByte(len);
	this.b.write(str, this.position, 'utf8');
	this.position += len;
	return len+1;
}
W.prototype.putString = function(str){
	var len = Buffer.byteLength(str);
	this.prepareFor(len+4);
	this.putInt(len);
	this.b.write(str, this.position, 'utf8');
	this.position += len;
	return len+4;
}
W.prototype.putBuffer = function(buf, len){
	if(len === undefined) len = buf.length;
	this.prepareFor(len+4);
	this.putInt(len);
	buf.copy(this.b, this.position, 0, len);
	this.position += len;
}
W.prototype.putBufferDirectly = function(buf, off, len){

	_.assertInt(off);
	_.assertInt(len);

	this.prepareFor(len+4);
	this.putInt(len);
	buf.copy(this.b, this.position, off, off+len);
	this.position += len;
}
W.prototype.putData = function(buf, length){
	if(length === undefined) length = buf.length;
	this.prepareFor(length);
	buf.copy(this.b, this.position, 0, length);
	this.position += length;
}

W.prototype.putByte = function(v){
	this.prepareFor(1);
	this.b[this.position] = v;
	++this.position;
}
W.prototype.putBoolean = function(v){
	this.prepareFor(1);
	bin.writeBoolean(this.b, this.position, v);
	this.position += 1;
}
W.prototype.putInt = function(v){
	this.prepareFor(4);
	bin.writeInt(this.b, this.position, v);
	this.position += 4;
}
W.prototype.putLong = function(v){
	this.prepareFor(8);
	bin.writeLong(this.b, this.position, v);
	this.position += 8;
}

W.prototype.startCount = function(){
	this.prepareFor(4);

	++this.countPos;
	this.countStack[this.countPos] = this.position;
	this.countValueStack[this.countPos] = 0;

	this.position += 4;
}
W.prototype.countUp = function(){
	++this.countValueStack[this.countValueStack.length-1];
}
W.prototype.endCount = function(){

	var pos = this.countStack[this.countPos];
	var c = this.countValueStack[this.countPos];

	--this.countPos;
	bin.writeInt(this.b, pos, c);
}

W.prototype.startLength = function(){
	this.prepareFor(4);

	++this.lenPos;
	this.lengthStack[this.lenPos] = this.position;

	this.position += 4;
}
W.prototype.endLength = function(){

	var writePos = this.lengthStack[this.lenPos];
	--this.lenPos;

	var len = (this.position - writePos) - 4;
	bin.writeInt(this.b, writePos, len);
}

exports.W = W;
