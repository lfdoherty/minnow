var u = require('./util')
var _ = require('underscorem')

function LongHandle(typeSchema, obj, part, parent){
	this.part = part;
	this.obj = obj;
	this.parent = parent;
}
LongHandle.prototype.value = function(){
	return this.obj;
}
LongHandle.prototype.set = function(v){
	
	this.obj = v;
	
	//console.log('path: ' + JSON.stringify(this.getPath()));
	this.getSh().persistEdit(
		this.getObjectId(), 
		this.getPath(),
		'set',
		{value: this.obj}, 
		this.getEditingId());
		
	this.refresh()();
}
LongHandle.prototype.changeListener = u.primitiveChangeListener;

module.exports = LongHandle
