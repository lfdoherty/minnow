
var listenerSet = require('./../variable_listeners')

var _ = require('underscorem')

exports.make = function(s){
	var f = sfgObject.bind(undefined, s)
	/*f.getDescender = function(){
		return function(id, propertyCode, editId, cb){
			s.objectState.streamProperty(id, propertyCode, editId, cb)
		}
	}*/
	return f
}

function sfgObject(s, id, editId, context){
	_.assertLength(arguments, 4)
	_.assertInt(id)
	_.assertDefined(context)
	
	var key = id+''
	
	var listeners = listenerSet()
	
	var handle = {
		attach: function(listener, editId){
			_.assertInt(editId)
			listeners.add(listener)

			listener.set(id, undefined, editId)
		},
		detach: function(listener, editId){
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
			context.descend(path, editId, cb)
		}
	}
	return handle
}

