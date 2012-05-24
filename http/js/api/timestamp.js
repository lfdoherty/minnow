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
	sh.setContext(this.getEditingId(), this.getPath());
	this.obj = v;
	sh.setTimestamp(this.obj);
	this.refresh()();
}
TimestampHandle.prototype.setNow = function(){
	this.obj = Date.now();

	this.getSh().persistEdit(
		this.getObjectId(), 
		this.getPath(),
		'set',
		{value: this.obj}, 
		this.getEditingId());
		
	this.refresh()();
}
TimestampHandle.prototype.value = function(){
	return this.obj;
}
TimestampHandle.prototype.toJson = function(){
	return this.obj;
}

module.exports = TimestampHandle
