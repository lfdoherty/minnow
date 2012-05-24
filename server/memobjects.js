
var _ = require('underscorem')

/*
	TODO: implement efficient invariant-object return
*/

function deepFreeze(o){
	if(typeof(o) !== 'object') return;
	
	Object.freeze(o)

	Object.keys(o).forEach(function(key){
		deepFreeze(o[key])
	})
}

exports.make = function(startIdCount){

	var idCounter = startIdCount || 0;
	
	var objs = {};

	var friz = {};
	function frozen(id){
		var f = friz[id];
		if(f) return f;
		var obj = objs[id];
		if(obj === undefined) return;
		f = friz[id] = JSON.parse(JSON.stringify(obj));
		deepFreeze(f);
		return f;
	}
	
	var handle = {
		make: function(initialState){
			_.assertObject(initialState);
			++idCounter;
			objs[idCounter] = JSON.parse(JSON.stringify(initialState));
			return idCounter;
		},
		get: function(id){
			return frozen(id)//TODO use binary representations of objects as the 'frozen' copies
		},
		has: function(id){
			return objs[id] !== undefined;
		},
		select: function(f){//TODO optimize this with id sets for each type
			var res = [];

			Object.keys(objs).forEach(function(idKey){
				var obj = objs[idKey];
				if(f(obj)){
					res.push(frozen(idKey));
				}
			})
			return res;
		},
		change: function(id, cb){
			var obj = objs[id];
			if(obj === undefined) _.errout('unknown object id: ' + id);
			cb(obj);
			objs[id] = obj//JSON.parse(JSON.stringify(obj));//TODO how do we ensure, synchronously, that the object in memobjects cannot be further changed
			delete friz[id];
		},
		cache: function(id, obj){
			objs[id] = obj//JSON.parse(JSON.stringify(obj));
		}
	};
	
	return handle;
}
