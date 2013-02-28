
var listenerSet = require('./../variable_listeners')
var _ = require('underscorem')

exports.make = function(s, value){
	var f;
	if(arguments.length === 1){
		f = sfgSet.bind(undefined, s)		
	}else{
		if(value === undefined) throw new Error('no value for set')
		f = sfgSet.bind(undefined, s, value)
	}
	return f
}

function sfgSet(s, values, bindings, editId){
	//s.log('value: ' + JSON.stringify(value))
	_.assertArray(values)
	
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
		},
		isConstant: true,
		get: function(){return values;}
	}
	return handle
}

