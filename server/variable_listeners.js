"use strict";

var _ = require('underscorem')

module.exports = function(){
	return new VariableListeners()
}

function VariableListeners(){
	this.listeners = []
}

VariableListeners.prototype.add = function(listener){
	_.assertObject(listener)
	_.assert(this.listeners.indexOf(listener) === -1)
	if(listener instanceof VariableListeners) _.errout('err')
	this.listeners.push(listener)
}
VariableListeners.prototype.remove = function(listener){
	_.assertObject(listener)
	var i = this.listeners.indexOf(listener)
	_.assert(i !== -1)
	this.listeners.splice(i, 1)
}
VariableListeners.prototype.emitAdd = function(value, editId){
	//if(this.listeners.length === 0) console.log('no this.listeners')
	for(var i=0;i<this.listeners.length;++i){
		var listener = this.listeners[i]
		//console.log('calling listener add: ' + listener.add)
		listener.add(value, editId)
	}
}
VariableListeners.prototype.emitRemove = function(value, editId){
	for(var i=0;i<this.listeners.length;++i){
		var listener = this.listeners[i]
		listener.remove(value, editId)
	}
}
VariableListeners.prototype.emitSet = function(value, oldValue, editId){
	for(var i=0;i<this.listeners.length;++i){
		var listener = this.listeners[i]
		listener.set(value, oldValue, editId)
	}
}
VariableListeners.prototype.emitPut = function(key, value, oldValue, editId){
	_.assertLength(arguments, 4)
	_.assertInt(editId)
	//if(this.listeners.length === 0) console.log('no this.listeners')
	for(var i=0;i<this.listeners.length;++i){
		var listener = this.listeners[i]
		listener.put(key, value, oldValue, editId)
	}
},
VariableListeners.prototype.emitPutAdd = function(key, value, editId){
	_.assertLength(arguments, 3)
	_.assertInt(editId)
	//if(this.listeners.length === 0) console.log('no this.listeners')
	for(var i=0;i<this.listeners.length;++i){
		var listener = this.listeners[i]
		listener.putAdd(key, value, editId)
	}
}
VariableListeners.prototype.emitDel = function(key, editId){
	_.assertLength(arguments, 2)
	_.assertInt(editId)
	//if(this.listeners.length === 0) console.log('no this.listeners')
	for(var i=0;i<this.listeners.length;++i){
		var listener = this.listeners[i]
		listener.del(key, editId)
	}
}
VariableListeners.prototype.emitObjectChange = function(subjTypeCode, subjId, typeCode, id, path, op, edit, syncId, editId){
	_.assertLength(arguments, 9)
	_.assert(this instanceof VariableListeners)
	for(var i=0;i<this.listeners.length;++i){
		var listener = this.listeners[i]
		listener.objectChange(subjTypeCode, subjId, typeCode, id, path, op, edit, syncId, editId)
	}
}
VariableListeners.prototype.emitChanged = function(editId){
	_.assertLength(arguments, 1)
	_.assertInt(editId)
	for(var i=0;i<this.listeners.length;++i){
		var listener = this.listeners[i]
		listener.changed(editId)
	}
}
VariableListeners.prototype.many = function(){
	return this.listeners.length;
}

