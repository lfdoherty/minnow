"use strict";

var _ = require('underscorem');

/*

TODO: broadcast syncIds of edits

*/


function lazyObj(obj, prop){
	if(obj[prop] === undefined) return obj[prop] = {};
	return obj[prop];
}

function lazyArray(obj, prop){
	if(obj[prop] === undefined) return obj[prop] = [];
	return obj[prop];
}

function removeTypeListener(typeCode, listener, typeMap){
	var arr = typeMap[typeCode];
	if(arr === undefined){
		console.log('WARNING: tried to remove type listener by unknown type: ' + typeCode);
	}else{
		var ci = arr.indexOf(listener);
		if(ci === -1){
			console.log('WARNING: tried to remove unknown type listener');
			arr.splice(ci, 1);
		}
	}
}
exports.make = function(inv){

	var byType = {};
	var byObject = {};

	var createdByType = {};
	var delByType = {};

	var realObjKey = {};
	
	function notifyChanged(subjTypeCode, subjId, typeCode, id, path, edit, syncId, editId){
		_.assertLength(arguments, 8);
		_.assertArray(path);
		_.assertInt(syncId);
		_.assertInt(editId);

		console.log('notifyChanged: ' + JSON.stringify([subjTypeCode, subjId, typeCode, id, path, edit, syncId, editId]));
		
		var key = typeCode + ':' + id;
		if(realObjKey[editId] !== undefined && realObjKey[editId] !== key) _.errout('db code error: ' + realObjKey[editId] + ' ' + key + ' ' + editId);
		realObjKey[editId] = key;
		
		
		var t = byType[subjTypeCode];
		if(t !== undefined){
			console.log('notifying ' + t.length + ' type listeners');
			for(var i=0;i<t.length;++t){
				var listener = t[i];
				
				//note that subjTypeCode and subjId are for the object of the type this listener is listening to,
				//whereas typeCode and id might be for any object related by an FK
				listener(subjTypeCode, subjId, typeCode, id, path, edit, syncId, editId);
			}
		}
		var ob = byObject[subjTypeCode];
		if(ob !== undefined){
			var obj = ob[subjId];
			if(obj !== undefined){
				console.log('notifying ' + obj.length + ' object listeners');
				for(var i=0;i<obj.length;++i){
					var listener = obj[i];
					listener(typeCode, id, path, edit, syncId, editId);
				}
			}
		}
	}
	
	//note that the object referred to will always be the most local normalized object (and the path will be relative to that.)
	function objectChanged(destTypeCode, destId, typeCode, id, path, edit, syncId, editId){
		_.assertLength(arguments, 8);
		_.assertInt(editId);
		_.assertInt(syncId);
		
		notifyChanged(destTypeCode, destId, typeCode, id, path, edit, syncId, editId);
		
		//TODO: what about cyclic dependencies?
		inv.getInverse(destTypeCode, destId, function(invArr){
			for(var i=0;i<invArr.length;++i){
				var e = invArr[i];
				console.log('inv e: ' + JSON.stringify(e));
				objectChanged(e[0], e[1], typeCode, id, path, edit, syncId, editId);
			}
		});
	}
	
	return {
		input: {
			objectChanged: function(typeCode, id, path, edit, syncId, editId){
				_.assertLength(arguments, 6);
				_.assertInt(syncId);
				_.assertInt(editId);
				
				objectChanged(typeCode, id, typeCode, id, path, edit, syncId, editId);
			},
			objectDeleted: function(typeCode, id){
				var c = delByType[typeCode];
				if(c !== undefined){
					for(var i=0;i<c.length;++i){
						c[i](typeCode, id);
					}
				}
			},
			objectCreated: function(typeCode, id, editId){
				_.assertLength(arguments, 3);
				var c = createdByType[typeCode];
				//console.log('object created: ' + (c === undefined ? 0 : c.length) + '(tc: ' + typeCode + ', id: ' + id + ')');
				if(c !== undefined){
					for(var i=0;i<c.length;++i){
						c[i](typeCode, id, editId);
					}
				}
			}
		},
		output: {
			//reports any edits that happen to an object of the given type (including to other normalized objects by FK)
			//useful in cases where it is inefficient to listen to each related object individually
			//i.e. the number of listeners is likely to be considerably smaller than the total number of objects being listened to
			//cb(typeCode, id, path, edit)
			listenByType: function(typeCode, listener){
				lazyArray(byType, typeCode).push(listener);
			},
			stopListeningByType: function(typeCode, listener){
				removeTypeListener(typeCode, listener, byType);
			},
			
			//reports any edits that happen to the given object (including to other normalized objects by FK)
			//cb(typeCode, id, path, edit)
			listenByObject: function(typeCode, id, listener){
				lazyArray(lazyObj(byObject, typeCode), id).push(listener);
			},
			stopListeningByObject: function(typeCode, id, listener){
				var objMap = byObject[typeCode];
				if(objMap !== undefined){
					var listeners = objMap[id];
					if(listeners !== undefined){
						var ci = listeners.indexOf(listener);
						if(ci !== -1){
							listeners.splice(ci, 1);
							return;
						}
					}
				}
				console.log('WARNING: tried to remove non-existent object listener: ' + typeCode + ', ' + id);
			},
			
			//cb(typeCode, id)
			listenForNew: function(typeCode, listener){
				var c = createdByType[typeCode];
				if(c === undefined) c = createdByType[typeCode] = [];
				c.push(listener);
			},
			stopListeningForNew: function(typeCode, listener){
				removeTypeListener(typeCode, listener, createdByType);
			},
			
			//cb(typeCode, id)
			listenForDeleted: function(typeCode, listener){
				var c = delByType[typeCode];
				if(c === undefined) c = delByType[typeCode] = [];
				c.push(listener);
			},
			stopListeningForDeleted: function(typeCode, listener){
				removeTypeListener(typeCode, listener, delByType);
			}
		}
	};
}
