
var listenerSet = require('./../variable_listeners')

var _ = require('underscorem')

exports.make = function(s){
	return sfgObject.bind(undefined, s)
}

function sfgObject(s, id, editId){
	_.assertLength(arguments, 3)
	_.assertInt(id)
	var key = id+''
	
	var listeners = listenerSet()
/*
	s.broadcaster.listenByObject(id, function(subjTypeCode, subjId, typeCode, id, path, op, edit, syncId, editId){
		_.assertInt(editId)
		console.log('fixed object emitting change ' + op + ' ' + editId)
		listeners.emitObjectChange(subjTypeCode, subjId, typeCode, id, path, op, edit, syncId, editId)
	})*/
	
	var handle = {
		attach: function(listener, editId){
			_.assertInt(editId)
			_.assertFunction(listener.shouldHaveObject)
			listeners.add(listener)

			listener.shouldHaveObject(id, true, editId)
			listener.set(id, undefined, editId)
		},
		detach: function(listener, editId){
			listeners.remove(listener)
			if(editId){
				listener.shouldHaveObject(id, true, editId)
				listener.set(undefined, id, editId)
			}
		},
		oldest: s.objectState.getCurrentEditId,
		key: key,
		wrapAsSet: function(idToWrap){
			_.assertEqual(idToWrap, id)
			return handle
		}/*,
		getId: function(){
			//_.errout('TODO')
			return id
		}*/
	}
	return handle
}

