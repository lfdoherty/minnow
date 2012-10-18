
var listenerSet = require('./../variable_listeners')

exports.make = function(s, value){
	var f;
	if(arguments.length === 1){
		f = sfgMap.bind(undefined, s)		
	}else{
		if(value === undefined) throw new Error()
		f = sfgMap.bind(undefined, s, value)
	}
	return f
}

function sfgMap(s, value, bindings, editId){
	
	_.errout('TODO')
	
	var key = JSON.stringify(value)+''
	
	var listeners = listenerSet()
	
	var handle = {
		name: 'fixed-map',
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

