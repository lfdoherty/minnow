"use strict";

var listenerSet = require('./../variable_listeners')

var _ = require('underscorem')

exports.make = function(s, self, setExpr, typeBindings){
	var idExpr = self(setExpr.params[0], typeBindings)
	var f = sfgObject.bind(undefined, s, idExpr)

	f.wrapAsSet = function(idToWrap){
		_.errout('TODO')
	}
	return f
}

function sfgObject(s, idExpr, bindings, editId){
	
	var idVariable = idExpr(bindings, editId)
	console.log(JSON.stringify(Object.keys(idVariable))+' %%%%%%%%')
	
	var key = idVariable.key
	
	var listeners = listenerSet()
	
	var id;
	idVariable.attach({
		set: function(newId, oldId, editId){
			id = newId
			//TODO listen to changes to the object
			console.log('got id')
			console.log(new Error().stack)
			listeners.emitSet(id)
		}
	})
	console.log('TODO LISTEN FOR CHANGES %%%%%%%%%%%%%%%%%5: ' + id)
	
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
		key: key
	}
	return handle
}

