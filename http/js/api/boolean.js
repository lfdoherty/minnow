var u = require('./util')
var _ = require('underscorem')

function BooleanHandle(typeSchema, obj, part, parent){
	
	this.part = part;
	this.parent = parent;
	_.assertObject(parent);
	
	if(obj === undefined){
		if(typeSchema.tags['default:false']) obj = false;
		else if(typeSchema.tags['default:false']) obj = true;
	}

	this.obj = obj;
}
BooleanHandle.prototype.value = function(){
	return this.obj;
}
BooleanHandle.prototype.changeListener = u.primitiveChangeListener;
BooleanHandle.prototype.set = function(v){
	this.obj = v;

	this.getSh().persistEdit(
		this.getObjectId(), 
		this.getPath(),
		'set',
		{value: this.obj}, 
		this.getEditingId());
		
	this.refresh()();

}

module.exports = BooleanHandle
