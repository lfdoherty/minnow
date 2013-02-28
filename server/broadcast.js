"use strict";

var _ = require('underscorem');

/*

TODO: broadcast syncIds of edits

*/

var log = require('quicklog').make('minnow/broadcast')

var editCodes = require('./tcp_shared').editFp.codes
var editNames = require('./tcp_shared').editFp.names

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
exports.make = function(schema){
	_.assertObject(schema)

	var byType = {};
	var byObject = {};
	var bySet = []
	
	var updateByObject = {}
	var updateBySet = []
	
	var createdByType = {};
	var delByType = {};
	
	var all = []
	
	
	var typeAndSuperTypes = {}
	Object.keys(schema._byCode).forEach(function(codeStr){
		var sch = schema._byCode[codeStr]
		var list = typeAndSuperTypes[sch.code] = [sch.code]
		if(sch.superTypes){
			Object.keys(sch.superTypes).forEach(function(superTypeName){
				//console.log('name: ' + superTypeName)
				var st = schema[superTypeName]
				if(st){
					list.push(st.code)
				}
			})
		}
	})
	
	function notifyByType(t, typeCode, id, path, op, edit, syncId, editId){
		if(t !== undefined){
			for(var i=0;i<t.length;++i){
				var listener = t[i];
				
				//note that subjTypeCode and subjId are for the object of the type this listener is listening to,
				//whereas typeCode and id might be for any object related by an FK
				listener(typeCode, id, path, op, edit, syncId, editId);
			}
		}

	}
	function notifyChanged(state, op, edit, syncId, editId){
		_.assertLength(arguments, 5);
		_.assertObject(state);
		_.assertInt(syncId);
		_.assertInt(editId);

		//_.assertInt(subjTypeCode);
		//_.assertInt(subjId);
		
		//var topId = id
		//var objId = state.object || topId
		//var ns = _.extend({}, state)
		//ns.top = id
		//ns.topTypeCode = typeCode
		//typeCode = 
		_.assertInt(state.objTypeCode)
		_.assertInt(state.object)
		if(op !== editCodes.revert && op !== editCodes.refork){
			_.assertInt(state.property)
		}
		
		typeAndSuperTypes[state.objTypeCode].forEach(function(tc){
			var t = byType[tc];
			//console.log(schema._byCode[typeCode].name + ' ' + schema._byCode[tc].name)
			notifyByType(t, /*typeCode, id,*/ state, op, edit, syncId, editId)
		})
		
		var idKey = state.top
		if(state.top !== state.object) idKey += ':'+state.object
		
		//console.log('notify(' + idKey + '): ' + JSON.stringify(state) + ' ' + editNames[op] + ' ' + JSON.stringify(edit))

		var ob = byObject
		var obj = ob[idKey];
		if(obj !== undefined){
			//console.log('found listeners: ' + obj.length)
			for(var i=0;i<obj.length;++i){
				var listener = obj[i];
				//console.log('listener: ' + listener)
				listener(/*typeCode, id,*/ state, op, edit, syncId, editId);
			}
		}
		
		for(var i=0;i<bySet.length;++i){
			var bh = bySet[i]
			if(bh.has(idKey)){
				bh.listener(/*typeCode, id,*/ state, op, edit, syncId, editId)
			}
		}
	}
	
	//note that the object referred to will always be the most local normalized object (and the path will be relative to that.)
	function objectChanged(state, op, edit, syncId, editId){
		_.assertLength(arguments, 5);
		var already = {}
		internalObjectChanged(state, op, edit, syncId, editId, already)
	}
	function internalObjectChanged(state, op, edit, syncId, editId, already){
		_.assertLength(arguments, 6);
		_.assertInt(editId);
		_.assertInt(syncId);
		_.assertInt(op)
				
		notifyChanged(state, op, edit, syncId, editId);
	}
	
	var setListenerIdCounter = 1
	var setListenerHandles = {}
	
	return {
		input: {
			objectUpdated: function(typeCode, id, op, edit, syncId, editId){
				var ob = updateByObject
				var obj = ob[id];
				//console.log('objectUpdated: ' + id)
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
			objectChanged: function(state, op, edit, syncId, editId){
				_.assertLength(arguments, 5);
				_.assertInt(syncId);
				_.assertInt(editId);
				_.assertInt(op)
				_.assert(state.top > 0)
				_.assertObject(state)
				_.assertInt(state.topTypeCode)
				_.assertInt(state.objTypeCode)
				
				
				for(var i=0;i<all.length;++i){
					var listener = all[i]
					listener(state, op, edit, syncId, editId);
				}
				objectChanged(state, op, edit, syncId, editId);
			},
			objectDeleted: function(typeCode, id, editId){

				typeAndSuperTypes[typeCode].forEach(function(tc){
					var c = delByType[tc];
					if(c !== undefined){
						for(var i=0;i<c.length;++i){
							c[i](typeCode, id, editId);
						}
					}
				})
			},
			objectCreated: function(typeCode, id, editId){
				_.assertLength(arguments, 3);
				_.assertInt(typeCode)

				typeAndSuperTypes[typeCode].forEach(function(tc){
				
					var c = createdByType[tc];
					//console.log('object created: ' + (c === undefined ? 0 : c.length) + '(tc: ' + typeCode + ', id: ' + id + ')');
					if(c !== undefined){
						for(var i=0;i<c.length;++i){
							c[i](typeCode, id, editId);
						}
					}
				})
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
			listenByObject: function(id, listener){
				_.assertLength(arguments, 2)

				//console.log('listening by object: ' + id)

				//if(_.isInt(id)){
					var list = lazyArray(byObject, id)
					list.push(listener);
				/*}else{
					//TODO later rework the way edit updates come in the first place - this is a temporary bridge
					//_.errout('TODO')
					var list = lazyArray(byObject, id+'')
					var innerId = id
					list.push(function(typeCode, id, editPath, op, edit, syncId, editId){
						var found
						//console.log('filtering(' + JSON.stringify(innerId) + '): ' + JSON.stringify(arguments))
						for(var i=0;i<editPath.length;++i){
							var e = editPath[i]
							if(e.op === editCodes.selectObject || e.op === editCodes.reselectObject){
								if(e.edit.id === innerId.inner){
									found = i
									break;
								}
							}
						}
						//console.log('found: ' + found)
						if(found !== undefined && editPath.length > found+1){
							listener(typeCode, id, editPath.slice(found+1), op, edit, syncId, editId)
						}
					});
				}*/
				//console.log('byObject: ' + list.length)
				//console.log(new Error().stack)
			},
			stopListeningByObject: function(id, listener){
				_.assertLength(arguments, 2)
				var objMap = byObject
				
				var listeners = objMap[id];
				if(listeners !== undefined){
					var ci = listeners.indexOf(listener);
					if(ci !== -1){
						listeners.splice(ci, 1);
						return;
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
	if(this.set[id]) return
	
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

