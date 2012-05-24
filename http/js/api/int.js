
var u = require('./util')
var _ = require('underscorem')

function IntHandle(typeSchema, obj, part, parent){
	this.part = part;
	this.obj = obj;
	this.parent = parent;
}
IntHandle.prototype.value = function(){
	return this.obj;
}
IntHandle.prototype.changeListener = u.primitiveChangeListener;
IntHandle.prototype.set = function(v){
	this.obj = v;

	this.getSh().persistEdit(
		this.getObjectId(), 
		this.getPath(), 
		'set',
		{value: this.obj}, 
		this.getEditingId());
		
	this.refresh()();

}

module.exports = IntHandle

