
var listenerSet = require('./../variable_listeners')

exports.make = function(s, value){
	if(arguments.length === 1){
		return sfgPrimitive.bind(undefined, s)		
	}else{
		if(value === undefined) throw new Error()
		return sfgPrimitive.bind(undefined, s, value)
	}
}

function sfgPrimitive(s, value){
	//s.log('value: ' + JSON.stringify(value))
	var key = JSON.stringify(value)
	
	var listeners = listenerSet()
	
	var handle = {
		name: 'primitive',
		attach: function(listener, editId){
			listeners.add(listener)
			//console.log('emitting value: ' + value)
			listener.set(value, undefined, editId)
		},
		detach: function(listener, editId){
			listeners.remove(listener)
			if(editId){
				listener.set(undefined, value, editId)
			}
		},
		oldest: s.objectState.getCurrentEditId,
		neverGetsOld: true,
		isConstant: true,
		key: key,
		get: function(){return value;}
	}
	return handle
}

