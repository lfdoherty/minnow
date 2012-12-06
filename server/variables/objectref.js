"use strict";

var listenerSet = require('./../variable_listeners')

var _ = require('underscorem')

exports.make = function(s, self, setExpr, typeBindings){
	var idExpr = self(setExpr.params[0], typeBindings)
	var f = sfgObject.bind(undefined, s, idExpr)

	f.wrapAsSet = function(idToWrap){
		_.errout('TODO')
	}
	/*f.getDescender = function(){
		return function(id, propertyCode, editId, cb){
			s.objectState.streamProperty(id, propertyCode, editId, cb)
		}
	}*/
	return f
}

function stub(){}

function sfgObject(s, idExpr, bindings, editId){
	
	var idVariable = idExpr(bindings, editId)
	//console.log(JSON.stringify(Object.keys(idVariable))+' %%%%%%%%')
	
	var key = idVariable.key
	
	var listeners = listenerSet()
	
	var id;
	idVariable.attach({
		set: function(newId, oldId, editId){
			id = newId
			//TODO listen to changes to the object
			//s.log('got id')
			//s.log(new Error().stack)
			listeners.emitSet(id)
		},
		includeView: function(){_.errout('TODO');},
		removeView: function(){_.errout('TODO');}
	}, editId)
	//console.log('TODO LISTEN FOR CHANGES %%%%%%%%%%%%%%%%%5: ' + id)
	
	var handle = {
		name: 'object-ref',
		attach: function(listener, editId){
			_.assertInt(editId)
			listeners.add(listener)
			if(id !== undefined){
				listener.set(id, undefined, editId)
			}
		},
		detach: function(listener, editId){
			listeners.remove(listener)
			if(editId && id !== undefined){
				listener.set(undefined, id, editId)
			}
		},
		oldest: s.objectState.getCurrentEditId,
		neverGetsOld: true,
		key: key,
		descend: function(path, editId, cb){
			s.objectState.streamProperty(path, editId, cb)
		}
	}
	return handle
}

