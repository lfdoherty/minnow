
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

function sfgSet(s, values, bindings, editId){
	//s.log('value: ' + JSON.stringify(value))
	var key = JSON.stringify(values)+''
	
	var listeners = listenerSet()
	
	var handle = {
		name: 'fixed-set',
		attach: function(listener, editId){
			listeners.add(listener)
			values.forEach(function(v){
				listener.add(v, editId)
			})
		},
		detach: function(listener, editId){
			listeners.remove(listener)
			if(editId){
				values.forEach(function(v){
					listener.remove(v, editId)
				})
			}
		},
		oldest: s.objectState.getCurrentEditId,
		neverGetsOld: true,
		key: key,
		descend: function(path, editId, cb){
			//context.descend(path, editId, cb)
			_.errout('TODO')
		}
	}
	return handle
}

