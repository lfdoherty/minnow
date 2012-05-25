
var u = require('./util')
var _ = require('underscorem')

function StringHandle(typeSchema, obj, part, parent){
	this.part = part;
	this.parent = parent;
	
	if(obj === undefined){
		_.each(typeSchema.tags, function(value, tag){
			if(tag.indexOf('default:') === 0){
				var defStr = tag.substr(tag.indexOf(':')+1);
				defStr = JSON.parse(defStr);
				obj = defStr;
			}
		});
	}
	this.obj = obj;
}
StringHandle.prototype.set = function(str){
	
	if(this.obj === str) return;
	
	this.obj = str;
	
	//console.log('path: ' + JSON.stringify(this.getPath()));
	var e = {value: this.obj}
	
	this.getSh().persistEdit(
		this.getObjectId(), 
		this.getPath(),
		'set',
		e, 
		this.getEditingId());
		
	//this.refresh()();
	this.emit(e, 'set', str)()
}
StringHandle.prototype.value = function(){
	return this.obj === undefined ? '' : this.obj;
}
StringHandle.prototype.toJson = function(){
	return this.obj;
}

StringHandle.prototype.changeListener = u.primitiveChangeListener;

module.exports = StringHandle
