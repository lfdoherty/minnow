
var listenerSet = require('./../variable_listeners')

exports.make = function(s, value){
	var f;
	if(arguments.length === 1){
		f = sfgSet.bind(undefined, s)		
	}else{
		if(value === undefined) throw new Error()
		f = sfgSet.bind(undefined, s, value)
	}
	return f
}

function sfgSet(s, value, bindings, editId){
	//s.log('value: ' + JSON.stringify(value))
	var key = JSON.stringify(value)+''
	
	var listeners = listenerSet()
	
	var handle = {
		name: 'fixed-set',
		attach: function(listener, editId){
			listeners.add(listener)
			//listener.set(value, undefined, editId)
		},
		detach: function(listener, editId){
			listeners.remove(listener)
			/*if(editId){
				listener.set(undefined, value, editId)
			}*/
		},
		oldest: s.objectState.getCurrentEditId,
		key: key
	}
	return handle
}

