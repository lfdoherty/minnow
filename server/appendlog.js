"use strict";

var _ = require('underscorem');

exports.make = function(schema, ap, isNew){
	//_.assertLength(arguments, 2);
	
	var loaded = !!isNew;
	var loading = false;
	return {
		inputObject: function(typeCode, obj){
			if(!loaded) _.errout('not loaded');
			
			_.assertLength(arguments, 2);
			_.assertInt(typeCode);
			
			ap.append(new Buffer(JSON.stringify({op: 'make', type: typeCode, value: obj})));
		},
		setEntireObject: function(typeCode, id, obj){
			ap.append(new Buffer(JSON.stringify({op: 'setEntireObject', type: typeCode, id: id, value: obj})));
		},
		cacheObject: function(typeCode, id, obj){
			ap.append(new Buffer(JSON.stringify({op: 'cache', type: typeCode, id: id, value: obj})));
		},
		setTypeAndId: function(typeCode, id){
			if(!loaded) _.errout('not loaded');
			ap.append(new Buffer(JSON.stringify({op: 'set_type_and_id', type: typeCode, id: id})));
		},
		setId: function(id){
			if(!loaded) _.errout('not loaded');
			ap.append(new Buffer(JSON.stringify({op: 'set_id', id: id})));
		},
		ascend: function(many){
			if(!loaded) _.errout('not loaded');
			ap.append(new Buffer(JSON.stringify({op: 'ascend', many: many})));
		},
		descend: function(path){
			if(!loaded) _.errout('not loaded');
			//console.log('appendlog descending');
			ap.append(new Buffer(JSON.stringify({op: 'descend', path: path})));
		},
		//TODO track sync source
		set: function(value){
			if(!loaded) _.errout('not loaded');
			ap.append(new Buffer(JSON.stringify({op: 'set', value: value})));
		},
		add: function(value){
			if(!loaded) _.errout('not loaded');
			ap.append(new Buffer(JSON.stringify({op: 'add', value: value})));
		},
		addNew: function(type, external){
			if(!loaded) _.errout('not loaded');
			ap.append(new Buffer(JSON.stringify({op: 'addNew', type: type, external: external})));
		},
		addExisting: function(type, id){
			if(!loaded) _.errout('not loaded');
			ap.append(new Buffer(JSON.stringify({op: 'addExisting', type: type, id: id})));
		},
		remove: function(id, type){
			if(!loaded) _.errout('not loaded');
			ap.append(new Buffer(JSON.stringify({op: 'remove', id: id, type: type})));
		},
		removePrimitive: function(value){
			if(!loaded) _.errout('not loaded');
			ap.append(new Buffer(JSON.stringify({op: 'removePrimitive', value: value})));
		},
		replaceNew: function(/*removeId, removeTypeCode,*/typeCode){
			_.assertLength(arguments, 1);
			if(!loaded) _.errout('not loaded');
			ap.append(new Buffer(JSON.stringify(
				{op: 'replaceNew', 
				//removeId: removeId, removeType: removeTypeCode, 
				type: typeCode})));
		},
		replaceExisting: function(/*oldType, oldId, */type, id){
			_.assertLength(arguments, 2);
			if(!loaded) _.errout('not loaded');
			ap.append(new Buffer(JSON.stringify(
				{op: 'replaceExisting', 
				//oldType: oldType, oldId: oldId,
				type: type,
				id: id
				})));
		},
		load: function(h, cb){
			_.assertLength(arguments, 2);
			_.assertFunction(cb);
			
			if(loaded || loading) _.errout('already loaded/loading!');
			
			loading = true;
			//console.log('LOADING');
		
			var manyCommands = 0;
		
			var readAp = ap.read(0);
			readAp.onBlock = function(blob, off, len){
				//console.log('off: ' + off);
				//console.log('len: ' + len);
				var str = blob.toString('utf8', off, off+len);//blob.slice(off, off+len).toString('utf8');
				//console.log('str: ' + str);
				var command = JSON.parse(str);
				if(command.op === 'make'){
					h.makeObject(command.type, command.value);
				}else if(command.op === 'setEntireObject'){
					h.setEntireObject(command.type, command.id, command.value);
				}else if(command.op === 'cache'){
					h.cacheObject(command.type, command.id, command.obj);
				}else if(command.op === 'set_type_and_id'){
					h.setTypeAndId(command.type, command.id);
				}else if(command.op === 'set_id'){
					h.setId(command.id);
				}else if(command.op === 'ascend'){
					h.ascend(command.many);
				}else if(command.op === 'descend'){
					h.descend(command.path);
				}else if(command.op === 'set'){
					h.set(command.value);
				}else if(command.op === 'add'){
					h.add(command.value);
				}else if(command.op === 'addNew'){
					h.addNew(command.type, command.external);
				}else if(command.op === 'addExisting'){
					h.addExisting(command.type, command.id);
				}else if(command.op === 'remove'){
					h.remove();
				}else if(command.op === 'removePrimitive'){
					h.removePrimitive(command.value);
				}else if(command.op === 'replaceNew'){
					h.replaceNew(command.type);
				}else if(command.op === 'replaceExisting'){
					h.replaceNew(command.type, command.id);
				}else{
					_.errout('unknown command op: ' + command.op);
				}
				++manyCommands;
			}
			readAp.onEnd = function(){
				console.log('done loading ' + manyCommands + ' commands.');
				loaded = true;
				cb();
			};
		}
	};
}
