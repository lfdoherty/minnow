
var u = require('./util')
var _ = require('underscorem')
module.exports = PrimitiveListHandle

var stub = function(){}

function PrimitiveListHandle(typeSchema, obj, part, parent, isReadonly){
	
	this.part = part;
	this.obj = obj || [];
	this.parent = parent;
	this.schema = typeSchema;

	this.assertMemberType = u.getPrimitiveCollectionAssertion('list', typeSchema)

	this.readonly = isReadonly;
	if(isReadonly){
		this.remove = readonlyError;
		this.add = readonlyError;
		this.shift = readonlyError;
	}
}
PrimitiveListHandle.prototype.prepare = stub

PrimitiveListHandle.prototype.toJson = function(){return [].concat(this.obj);}
PrimitiveListHandle.prototype.count = function(){return this.obj.length;}
PrimitiveListHandle.prototype.size = PrimitiveListHandle.prototype.count

PrimitiveListHandle.prototype.add = function(value){
	this.assertMemberType(value)

	if(this.obj.indexOf(value) !== -1){
		_.errout('already has value (lists may not contain duplicates): ' + value)
	}
		
	this.obj.push(value);
	
	var e = {value: value}
	this.saveEdit('add', e);
		
	//this.refresh()();
	this.emit(e, 'add', value)()
}
PrimitiveListHandle.prototype.push = PrimitiveListHandle.prototype.add

PrimitiveListHandle.prototype.remove = function(value){
	this.assertMemberType(value)
	
	var index = this.obj.indexOf(value);
	if(index !== undefined){

		this.obj.splice(index, 1);

		var e = {value: value}
		this.saveEdit('removePrimitive', e);
		
		//this.refresh()();
		this.emit(e, 'remove', value)()
	}else{
		_.errout('tried to remove object not in collection, id: ' + id);
	}
}

PrimitiveListHandle.prototype.shift = function(){

	if(this.obj.length < 1) _.errout('cannot shift empty list')
	
	var e = {}
	this.saveEdit('shift', e);

	var v = this.obj.shift();
		
	//this.refresh()();
	this.emit(e, 'shift', v)()
	return v;
}

PrimitiveListHandle.prototype.has = function(value){
	_.assertLength(arguments, 1);
	return this.obj.indexOf(value) !== -1
}


PrimitiveListHandle.prototype.each = function(cb, endCb){
	this.obj.forEach(cb)
	if(endCb) endCb();
}
PrimitiveListHandle.prototype.changeListener = function(path, op, edit, syncId){
	_.assertLength(arguments, 4);

	if(path.length > 0) _.errout('invalid path, cannot descend into primitive list: ' + JSON.stringify(path))
		
	if(op === 'add'){
		if(this.getEditingId() !== syncId){
			
			this.obj.push(edit.value);
			
//			return this.refresh();
			return this.emit(edit, 'add')
		}else{
			return stub;
		}
	}else if(op === 'shift'){
		if(this.getEditingId() !== syncId){

			_.assert(this.obj.length >= 1);
			this.obj.shift();

			//return this.refresh();
			return this.emit(edit, 'shift')
			
		}else{
			return stub;
		}
	}else if(op === 'removePrimitive'){
		if(this.getEditingId() !== syncId){
			var index = this.obj.indexOf(edit.value);
			if(index === -1){
				console.log('ignoring invalid remove: ' + edit.value);
			}else{
				this.obj.splice(index, 1);
				
//				return this.refresh();
				return this.emit(edit, 'remove')
			}
		}		
		return stub;
	}else{
		_.errout('+TODO implement op: ' + JSON.stringify(edit));
	}
}

