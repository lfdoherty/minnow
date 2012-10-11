"use strict";

var _ = require('underscorem');

/*

TODO: broadcast syncIds of edits

*/

var log = require('quicklog').make('minnow/broadcast')

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
		}else{
			arr.splice(ci, 1);
		}
	}
}
exports.make = function(){

	var byType = {};
	var byObject = {};
	var bySet = []
	
	var updateByObject = {}
	var updateBySet = []
	
	var createdByType = {};
	var delByType = {};
	
	var all = []
	
	function notifyChanged(typeCode, id, path, op, edit, syncId, editId){
		_.assertLength(arguments, 7);
		_.assertArray(path);
		_.assertInt(syncId);
		_.assertInt(editId);

		//_.assertInt(subjTypeCode);
		//_.assertInt(subjId);

		var t = byType[typeCode];
		if(t !== undefined){
			for(var i=0;i<t.length;++i){
				var listener = t[i];
				
				//note that subjTypeCode and subjId are for the object of the type this listener is listening to,
				//whereas typeCode and id might be for any object related by an FK
				listener(typeCode, id, path, op, edit, syncId, editId);
			}
		}
		var ob = byObject
		var obj = ob[id];
		if(obj !== undefined){
			for(var i=0;i<obj.length;++i){
				var listener = obj[i];
				listener(typeCode, id, path, op, edit, syncId, editId);
			}
		}
		
		for(var i=0;i<bySet.length;++i){
			var bh = bySet[i]
			if(bh.has(id)){
				bh.listener(typeCode, id, path, op, edit, syncId, editId)
			}
		}
	}
	
	//note that the object referred to will always be the most local normalized object (and the path will be relative to that.)
	function objectChanged(typeCode, id, path, op, edit, syncId, editId){
		_.assertLength(arguments, 7);
		var already = {}
		internalObjectChanged(typeCode, id, path, op, edit, syncId, editId, already)
	}
	function internalObjectChanged(typeCode, id, path, op, edit, syncId, editId, already){
		_.assertLength(arguments, 8);
		_.assertInt(editId);
		_.assertInt(syncId);
		_.assertString(op)
		
		notifyChanged(typeCode, id, path, op, edit, syncId, editId);
	}
	
	var setListenerIdCounter = 1
	var setListenerHandles = {}
	
	return {
		input: {
			objectUpdated: function(typeCode, id, op, edit, syncId, editId){
				var ob = updateByObject
				var obj = ob[id];
				if(obj !== undefined){
					for(var i=0;i<obj.length;++i){
						var listener = obj[i];
						listener(typeCode, id, op, edit, syncId, editId);
					}
				}
				for(var i=0;i<updateBySet.length;++i){
					var bh = updateBySet[i]
					if(bh.has(id)){
						bh.listener(typeCode, id, op, edit, syncId, editId)
					}
				}
			},
			objectChanged: function(typeCode, id, path, op, edit, syncId, editId){
				_.assertLength(arguments, 7);
				_.assertInt(syncId);
				_.assertInt(editId);
				_.assertString(op)
				_.assertInt(typeCode)
				_.assert(id > 0)
				
				//console.log('broadcasting: ' + JSON.stringify(path))
				//for(var i=0;i<path.length;++i){_.assert(_.isString(path[i]) || path[i] > 0);}
				
				all.forEach(function(listener){
					listener(typeCode, id, path, op, edit, syncId, editId);
				})
				objectChanged(typeCode, id, path, op, edit, syncId, editId);
			},
			objectDeleted: function(typeCode, id, editId){
				var c = delByType[typeCode];
				if(c !== undefined){
					for(var i=0;i<c.length;++i){
						c[i](typeCode, id, editId);
					}
				}
			},
			objectCreated: function(typeCode, id, editId){
				_.assertLength(arguments, 3);
				_.assertInt(typeCode)
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
			listenToAll: function(listener){
				all.push(listener)
			},
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
			listenByObject: function(/*typeCode, */id, listener){
				_.assertLength(arguments, 2)
				var list = lazyArray(byObject, id)
				list.push(listener);
				//console.log('byObject: ' + list.length)
			},
			stopListeningByObject: function(/*typeCode, */id, listener){
				_.assertLength(arguments, 2)
				var objMap = byObject//byObject[typeCode];
				//if(objMap !== undefined){
					var listeners = objMap[id];
					if(listeners !== undefined){
						var ci = listeners.indexOf(listener);
						if(ci !== -1){
							listeners.splice(ci, 1);
							return;
						}
					}
				//}
				console.log('WARNING: tried to remove non-existent object listener: ' + typeCode + ', ' + id);
			},
			
			//cb(typeCode, id)
			listenForNew: function(typeCode, listener){
				var c = createdByType[typeCode];
				if(c === undefined) c = createdByType[typeCode] = [];
				c.push(listener);
			},
			stopListeningForNew: function(typeCode, listener){
				_.assertInt(typeCode)
				_.assertFunction(listener)
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
			},
			
			listenBySet: function(listener){
				var h = new ListenBySetHandle(listener, byObject, bySet)
				return h
			},
			updateBySet: function(listener){
				var h = new ListenBySetHandle(listener, updateByObject, updateBySet)
				listener._setListenerId = setListenerIdCounter
				setListenerHandles[listener._setListenerId] = h
				++setListenerIdCounter
				return h
			},
			stopUpdatingBySet: function(listener){
				if(listener._setListenerId === undefined) _.errout('never started listening in the first place')
				
				var h = setListenerHandles[listener._setListenerId]
				delete setListenerHandles[listener._setListenerId]
				h.destroy()
			}
		}
	};
}

function ListenBySetHandle(listener, byObject, bySet){
	this.listener = listener
	this.byObject = byObject
	this.bySet = bySet
	this.count = 0
	this.set = {}
}

var TransitionToInterceptCount = 5

ListenBySetHandle.prototype.add = function(id){
	if(this.count >= TransitionToInterceptCount){
		if(this.count === TransitionToInterceptCount){
		
			//remove byobject listeners
			var keys = Object.keys(this.set)
			for(var i=0;i<keys.length;++i){
				var id = keys[i]
				var list = this.byObject[id]
				if(list === undefined) _.errout('no list for id: ' + id)
				list.splice(list.indexOf(this.listener), 1)
			}
			
			//add self
			//console.log('adding bySet listener: ' + JSON.stringify(keys))
			this.bySet.push(this)
			++this.count
		}
		
	}else{
		//++this.count
		if(this.byObject[id] === undefined) this.byObject[id] = [this.listener]
		else this.byObject[id].push(this.listener)
		//console.log('registering non-set set listener: ' + this.count + ' ' + this.byObject[id].length)
	}
	++this.count
	//console.log('count: ' + this.count)
	this.set[id] = true
}

ListenBySetHandle.prototype.remove = function(id){
	//--this.count
	delete this.set[id]
}

ListenBySetHandle.prototype.has = function(id){
	return this.set[id]
}
ListenBySetHandle.prototype.destroy = function(){
	if(this.destroyed) _.errout('already destroyed')
	this.destroyed = true
	if(this.count >= TransitionToInterceptCount){
		this.bySet.splice(this.bySet.indexOf(this), 1)
	}else{
		var keys = Object.keys(this.set)
		for(var i=0;i<keys.length;++i){
			var list = this.byObject[keys[i]]
			list.splice(list.indexOf(this.listener), 1)
		}
	}
}

