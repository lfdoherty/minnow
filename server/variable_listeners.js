"use strict";

var _ = require('underscorem')

module.exports = function(){
	return new VariableListeners()
}

function VariableListeners(){
	this.listeners = []
	this.cachedViewIncludes = {}
}

VariableListeners.prototype.add = function(listener){
	_.assertObject(listener)
	_.assertFunction(listener.includeView)
	_.assertFunction(listener.removeView)
	
	_.assert(this.listeners.indexOf(listener) === -1)
	if(listener instanceof VariableListeners) _.errout('err')
	this.listeners.push(listener)

	var cvi = this.cachedViewIncludes
	Object.keys(cvi).forEach(function(key){
		var e = cvi[key]
		listener.includeView(key, e.handle, e.editId)
	})

	//console.log('adding listener ' + this.rr)
	//console.log(new Error().stack)
	

}
VariableListeners.prototype.remove = function(listener){
	_.assertObject(listener)

	//console.log('removing listener ' + this.rr)
	//console.log(new Error().stack)
	
	var i = this.listeners.indexOf(listener)
	if(i === -1){
		_.errout('WARNING: removing listener we do not have: ' + listener)
	}
	//_.assert(i !== -1)
	this.listeners.splice(i, 1)
	
	var cvi = this.cachedViewIncludes
	Object.keys(cvi).forEach(function(key){
		var e = cvi[key]
		listener.removeView(key, e.handle, e.editId)
	})
}
VariableListeners.prototype.emitIncludeView = function(viewId, handle, editId){
	//if(this.listeners.length === 0) _.errout('no this.listeners')
	_.assertUndefined(this.cachedViewIncludes[viewId])
	this.cachedViewIncludes[viewId] = {handle: handle, editId: editId}
	for(var i=0;i<this.listeners.length;++i){
		var listener = this.listeners[i]
		//console.log('calling listener add: ' + listener.add)
		listener.includeView(viewId, handle, editId)
	}
}
VariableListeners.prototype.emitRemoveView = function(viewId, handle, editId){
	//if(this.listeners.length === 0) console.log('no this.listeners')
	_.assertDefined(this.cachedViewIncludes[viewId])
	delete this.cachedViewIncludes[viewId]
	for(var i=0;i<this.listeners.length;++i){
		var listener = this.listeners[i]
		//console.log('calling listener add: ' + listener.add)
		listener.removeView(viewId, handle, editId)
	}
}
VariableListeners.prototype.emitAdd = function(value, editId){
	/*if(this.listeners.length === 0){
		console.log('no this.listeners')
	}else{
		console.log('got add')
	}*/
	for(var i=0;i<this.listeners.length;++i){
		var listener = this.listeners[i]
		//console.log('calling listener add: ' + listener.add)
		listener.add(value, editId)
	}
}
VariableListeners.prototype.emitRemove = function(value, editId){
	/*if(this.listeners.length === 0){
		console.log('no this.listeners ' + this.rr)
		console.log(new Error().stack)
	}else{
		console.log('got remove')
	}*/
	for(var i=0;i<this.listeners.length;++i){
		var listener = this.listeners[i]
		listener.remove(value, editId)
	}
}
VariableListeners.prototype.emitSet = function(value, oldValue, editId){
	//console.log('listeners: ' + this.listeners.length)
	var list = [].concat(this.listeners)
	for(var i=0;i<list.length;++i){
		var listener = list[i]
		//console.log('listener: ' + listener.set)
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
VariableListeners.prototype.emitPutRemove = function(key, value, editId){
	_.assertLength(arguments, 3)
	_.assertInt(editId)
	//if(this.listeners.length === 0) console.log('no this.listeners')
	for(var i=0;i<this.listeners.length;++i){
		var listener = this.listeners[i]
		listener.putRemove(key, value, editId)
	}
}
VariableListeners.prototype.emitDel = function(key, editId){
	_.assertLength(arguments, 2)
	_.assertInt(editId)
	//if(this.listeners.length === 0) console.log('no this.listeners')
	//console.log('emitting del: ' + this.listeners.length)
	for(var i=0;i<this.listeners.length;++i){
		var listener = this.listeners[i]
		listener.del(key, editId)
	}
}
VariableListeners.prototype.emitObjectChange = function(typeCode, id, path, op, edit, syncId, editId){
	_.assertLength(arguments, 7)
	_.assert(this instanceof VariableListeners)
	//console.log('emitting object changes: ' + this.listeners.length)
	for(var i=0;i<this.listeners.length;++i){
		var listener = this.listeners[i]
		listener.objectChange(typeCode, id, path, op, edit, syncId, editId)
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

