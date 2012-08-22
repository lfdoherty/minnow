
var u = require('./util')
var _ = require('underscorem')
module.exports = PrimitiveListHandle

var stub = function(){}
function readonlyError(){_.errout('readonly');}

function PrimitiveListHandle(typeSchema, obj, part, parent, isReadonly){
	
	this.part = part;
	this.obj = [].concat(obj || []);
	this.parent = parent;
	this.schema = typeSchema;

	this.assertMemberType = u.getPrimitiveCollectionAssertion('list', typeSchema)

	this.readonly = isReadonly;
	if(isReadonly){
		this.remove = readonlyError;
		this.add = readonlyError;
		this.shift = readonlyError;
	}
	this.latestVersionId = -1
	this.log('setting up primitive list: ' + JSON.stringify(obj))
	
	this.addOp = u.getAddOperator(typeSchema)
	this.removeOp = u.getRemoveOperator(typeSchema)
	
	////this.obj.forEach(function(r){
	//	_.assert(r != null)
	//})
}
PrimitiveListHandle.prototype.prepare = stub


PrimitiveListHandle.prototype.toJson = function(){
	_.assertDefined(this.obj)
	var res = [].concat(this.obj);
	//res.forEach(function(r){
	//	_.assert(r != null)
	//})
	return res
}
PrimitiveListHandle.prototype.count = function(){return this.obj.length;}
PrimitiveListHandle.prototype.size = PrimitiveListHandle.prototype.count

PrimitiveListHandle.prototype.add = function(value){
	this.assertMemberType(value)

	if(this.obj.indexOf(value) !== -1){
		_.errout('already has value (lists may not contain duplicates): ' + value)
	}
	
	_.assertPrimitive(value)//TODO test based on actual specific type
	this.obj.push(value);
	
	var e = {value: value}
	this.saveEdit(this.addOp, e);
		
	this.emit(e, 'add', value)()
}
PrimitiveListHandle.prototype.push = PrimitiveListHandle.prototype.add

PrimitiveListHandle.prototype.remove = function(value){
	this.assertMemberType(value)
	
	var index = this.obj.indexOf(value);
	if(index !== undefined){

		this.obj.splice(index, 1);

		var e = {value: value}
		this.saveEdit(this.removeOp, e);
		
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
PrimitiveListHandle.prototype.changeListener = function(op, edit, syncId, editId){
	_.assertLength(arguments, 4);

	if(this.latestVersionId < editId) this.latestVersionId = editId
		
	if(op.indexOf('add') === 0){
		if(this.getEditingId() !== syncId){
			this.log('pushing ' + edit.value + ' onto ' + JSON.stringify(this.obj) + ' ' + JSON.stringify([edit, editId]) + ' ' + this.getEditingId() + ' ' + syncId)
			//console.log(JSON.stringify([op, edit, syncId, editId]))
			_.assertPrimitive(edit.value)
			_.assert(edit.value != null)
			this.obj.push(edit.value);
			
			return this.emit(edit, 'add')
		}else{
			return stub;
		}
	}else if(op === 'shift'){
		if(this.getEditingId() !== syncId){

			_.assert(this.obj.length >= 1);
			this.obj.shift();

			return this.emit(edit, 'shift')
			
		}else{
			return stub;
		}
	}else if(op.indexOf('remove') === 0){
		if(this.getEditingId() !== syncId){
			var index = this.obj.indexOf(edit.value);
			if(index === -1){
				this.log('ignoring invalid remove: ' + edit.value);
			}else{
				this.obj.splice(index, 1);
				
				return this.emit(edit, 'remove')
			}
		}		
		return stub;
	}else{
		_.errout('+TODO implement op: ' + JSON.stringify(edit));
	}
}

