
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

	var key = id+''
	
	var listeners = listenerSet()

	
	var handle = {
		name: 'object-fixed (' + context.name + ')',
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
		neverGetsOld: true,
		isConstant: true,
		key: key,
		wrapAsSet: function(idToWrap){
			_.assertEqual(idToWrap, id)
			return handle
		},
		descend: function(path, editId, cb){
			//console.log('&descend: ' + context.descend + ' ' + context.name)
			return context.descend(path, editId, cb)
		},
		getObjectId: function(){
			return id
		},
		get: function(){
			return id
		}
	}
	return handle
}

