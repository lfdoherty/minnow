"use strict";

var _ = require('underscorem')

/*

inverse.js always will reply to requests for a given (typeCode, id) in the order they arrive (even if they require async lookups.)

----

The index format looks like:

type->id->propertyType[->key]->type->id

The ->key part only exists if the property type is a map

pretty much every step of that sequence is one->many, except the propertyType->, which *may* be one->one, and the ->key, which *must* be one->one

----

Once DF is implemented, inverse.js may also cache results.

*/
/*
exports.make = function(ap){

	return {
		//the path part will be [propertyType] or [propertyType, key].
		//cb([[typeCode, id, [path]], [typeCode, id, [path]]...])
		getInverse: function(id, cb){
			_.assertLength(arguments, 2);
			var invArr = ap.getInverse(id);
			//Note: for now, invArr will only include 'positive' results - however
			//once we have the DF it may also include 'negative' results - information about which
			//inverse relationships exist in the DFs but were removed since.
			
			var res = [];
			
			//console.log('inverse(' + id + '): ' + invArr.length);
			
			for(var i=0;i<invArr.length;++i){
				var e = invArr[i];
				if(e[0] === true){
					res.push([e[1], e[2]]);
				}else{
					_.errout('TODO');
				}
			}
			
			cb(res);
		},
		
	};
}*/

exports.make = function(broadcaster){

	var map = {}//TODO persist this
	var has = {}//TODO will need to persist ref count
	
	function setBroadcaster(broadcaster){
		broadcaster.output.listenToAll(function(typeCode, id, path, op, edit, syncId, editId){
			if(op === 'setExisting' || op === 'addExisting' || op === 'setObject'){

				if(edit.id === id) return//no need to track self-referencing

				if(has[edit.id] && has[edit.id][id]) return
			
				var m = map[edit.id]
				var h = has[edit.id]
				if(m === undefined){
					m = map[edit.id] = []
					h = has[edit.id] = {}
				}
				console.log('mapping inverse ' + edit.id + ' -> ' + id)
				m.push([typeCode, id])
				h[id] = true
			}
		})
	}
	
	var handle = {
		getInverse: function(id, cb){
			var arr = map[id]
			cb(arr||[])
		},
		setBroadcaster: setBroadcaster
	}
	return handle
}


