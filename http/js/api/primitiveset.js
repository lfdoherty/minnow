"use strict";

var u = require('./util')
var _ = require('underscorem')
module.exports = PrimitiveSetHandle

function PrimitiveSetHandle(typeSchema, obj, part, parent){
	this.part = part;
	this.obj = obj || [];
	this.parent = parent;
	this.schema = typeSchema;

	this.assertMemberType = u.getPrimitiveCollectionAssertion('list', typeSchema)

}

PrimitiveSetHandle.prototype.count = function(){
	_.assertLength(arguments, 0);
	return this.obj.length;
}
PrimitiveSetHandle.prototype.size = PrimitiveSetHandle.prototype.count

PrimitiveSetHandle.prototype.contains = function(value){
	return this.obj.indexOf(value) !== -1
}
PrimitiveSetHandle.prototype.has = PrimitiveSetHandle.prototype.contains

PrimitiveSetHandle.prototype.each = function(cb){
	this.obj.forEach(cb);
}

var typeSuffix = {
	'int': 'Int',
	string: 'String',
	long: 'Long',
	boolean: 'Boolean'
}

PrimitiveSetHandle.prototype.toggle = function(value){
	_.assertDefined(value)
	
	if(this.obj.indexOf(value) === -1){
		this.add(value)
	}else{
		this.remove(value)
	}
}

PrimitiveSetHandle.prototype.add = function(value){
	this.assertMemberType(value)

	if(this.obj.indexOf(value) !== -1){
		return;
	}
		
	this.obj.push(value);
	
	var e = {value: value}
	var ts = typeSuffix[this.schema.type.members.primitive]
	_.assertString(ts)
	this.saveEdit('add'+ts, e);
		
	this.emit(e, 'add', value)//()
}

PrimitiveSetHandle.prototype.remove = function(value){

	var index = this.obj.indexOf(value)
	if(index === -1) _.errout('tried to remove value not in collection: ' + value);
	
	this.obj.splice(index, 1)
	var e = {value: value}
	var ts = typeSuffix[this.schema.type.members.primitive]
	_.assertString(ts)
	this.saveEdit('remove'+ts, e);
	
	this.emit(e, 'remove', value)//()
}

PrimitiveSetHandle.prototype.changeListener = function(op, edit, syncId, editId){
	_.assertLength(arguments, 4);
	_.assertString(op)

	//console.log('primitive set handle changeListener')

	//if(path.length > 0) _.errout('invalid path, cannot descend into primitive set: ' + JSON.stringify(path))
	
	if(op.indexOf('add') === 0){
		var arr = this.obj
		if(arr === undefined) arr = this.obj = [];
		arr.push(edit.value);

		return this.emit(edit, 'add')
	}else if(op.indexOf('remove') === 0){
		var i = this.obj.indexOf(edit.value)
		this.obj.splice(i, 1)

		return this.emit(edit, 'remove', edit.value)
	}else{
		_.errout('@TODO implement op: ' + op + ' ' + JSON.stringify(edit));
	}
}

PrimitiveSetHandle.prototype.toJson = function(){
	return [].concat(this.obj);
}

