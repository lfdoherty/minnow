"use strict";

var _ = require('underscorem')

module.exports = listenerSet

function listenerSet(){
	var listeners = []
	
	return {
		add: function(listener){
			_.assertObject(listener)
			_.assert(listeners.indexOf(listener) === -1)
			listeners.push(listener)
		},	
		remove: function(listener){
			_.assertObject(listener)
			var i = listeners.indexOf(listener)
			_.assert(i !== -1)
			listeners.splice(i, 1)
		},
		emitAdd: function(value, editId){
			//if(listeners.length === 0) console.log('no listeners')
			for(var i=0;i<listeners.length;++i){
				var listener = listeners[i]
				//console.log('calling listener add: ' + listener.add)
				listener.add(value, editId)
			}
		},
		emitRemove: function(value, editId){
			for(var i=0;i<listeners.length;++i){
				var listener = listeners[i]
				listener.remove(value, editId)
			}
		},
		emitSet: function(value, oldValue, editId){
			for(var i=0;i<listeners.length;++i){
				var listener = listeners[i]
				listener.set(value, oldValue, editId)
			}
		},
		emitPut: function(key, value, oldValue, editId){
			_.assertLength(arguments, 4)
			_.assertInt(editId)
			//if(listeners.length === 0) console.log('no listeners')
			for(var i=0;i<listeners.length;++i){
				var listener = listeners[i]
				listener.put(key, value, oldValue, editId)
			}
		},
		emitPutAdd: function(key, value, editId){
			_.assertLength(arguments, 3)
			_.assertInt(editId)
			//if(listeners.length === 0) console.log('no listeners')
			for(var i=0;i<listeners.length;++i){
				var listener = listeners[i]
				listener.putAdd(key, value, editId)
			}
		},
		emitDel: function(key, editId){
			_.assertLength(arguments, 2)
			_.assertInt(editId)
			if(listeners.length === 0) console.log('no listeners')
			for(var i=0;i<listeners.length;++i){
				var listener = listeners[i]
				listener.del(key, editId)
			}
		},
		/*emitShould: function(id, flag, editId){
			_.assertLength(arguments, 3)
			for(var i=0;i<listeners.length;++i){
				var listener = listeners[i]
				listener.shouldHaveObject(id, flag, editId)
			}
		},*/
		emitObjectChange: function(subjTypeCode, subjId, typeCode, id, path, op, edit, syncId, editId){
			_.assertLength(arguments, 9)
			for(var i=0;i<listeners.length;++i){
				var listener = listeners[i]
				listener.objectChange(subjTypeCode, subjId, typeCode, id, path, op, edit, syncId, editId)
			}
		},
		emitChanged: function(editId){
			_.assertLength(arguments, 1)
			_.assertInt(editId)
			for(var i=0;i<listeners.length;++i){
				var listener = listeners[i]
				listener.changed(editId)
			}
		},
		many: function(){return listeners.length;}
	}
}
