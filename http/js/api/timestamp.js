"use strict";

var u = require('./util')
var _ = require('underscorem')

function TimestampHandle(typeSchema, obj, part, parent){
	this.part = part;
	this.obj = obj;
	this.parent = parent;
	_.assertObject(parent);
}

TimestampHandle.prototype.changeListener = u.primitiveChangeListener;

TimestampHandle.prototype.set = function(v){
	var sh = this.getSh();
	_.errout('FIXME')
	/*sh.setContext(this.getEditingId(), this.getPath());
	this.obj = v;
	sh.setTimestamp(this.obj);
	
	this.refresh()();*/
	//this.emit(e, 'set', this.obj)()
}
TimestampHandle.prototype.setNow = function(){
	this.obj = Date.now();

	var e = {value: this.obj}
	
	this.saveEdit('setLong', e);
		
	//this.refresh()();
	this.emit(e, 'set', this.obj)//()
}
TimestampHandle.prototype.value = function(){
	return this.obj;
}
TimestampHandle.prototype.toJson = function(){
	return this.obj;
}

module.exports = TimestampHandle
