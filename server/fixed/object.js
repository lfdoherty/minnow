
var listenerSet = require('./../variable_listeners')

var _ = require('underscorem')

exports.make = function(s){
	var f = sfgObject.bind(undefined, s)
	return f
}

function sfgObject(s, id, editId, context){
	_.assertLength(arguments, 4)
	if(!_.isInt(id)) _.errout('invalid id: ' + id)
	_.assertInt(id)
	_.assertDefined(context)
	_.assertString(context.name)
	_.assertFunction(context.descend)

	//if(!s.objectState.isTopLevelObject(id)){
	//	throw new Error('invalid id: ' + id)
	//}

	if(!_.isFunction(context.getType))_.errout('no getType: ' + context.name)
	_.assertFunction(context.getType)
	
	var key = id+''
	
	var listeners = listenerSet()
	
	s.broadcaster.listenForDeleted(function(typeCode, delId, editId){
		if(id === delId){
			console.log('WARNING: TODO: destroy dependent view, is no longer valid, param id was destroyed: ' + id)
		}
	})
	
	var handle = {
		name: 'object-fixed',
		attach: function(listener, editId){
			_.assertFunction(listener.set)
			_.assertInt(editId)
			listeners.add(listener)

			listener.set(id, undefined, editId)
		},
		detach: function(listener, editId){
			_.assertFunction(listener.set)
			listeners.remove(listener)
			if(editId){
				listener.set(undefined, id, editId)
			}
		},
		oldest: s.objectState.getCurrentEditId,
		key: key,
		wrapAsSet: function(idToWrap){
			_.assertEqual(idToWrap, id)
			return handle
		},
		descend: function(path, editId, cb){
			//s.objectState.streamProperty(path, editId, cb)
			s.log('context: ' + context.name)
			//console.log('context: ' + context.name)
			context.descend(path, editId, cb)
		},
		getType: context.getType
	}
	return handle
}

