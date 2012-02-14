"use strict";

var _ = require('underscorem');

//TODO queue repeated requests for the same
function wrap(schema, handle){

	var cache = {};
	var waiting = {};
	_.each(schema._byCode, function(objSchema){
		cache[objSchema.code] = {};
		waiting[objSchema.code] = {};
	});

	function gotObject(typeCode, id, obj){
		var ws = waiting[typeCode][id];
		if(ws !== undefined){
			//if(obj === undefined) _.errout('caching undefined');
			cache[typeCode][id] = obj;
			for(var i=0;i<ws.length;++i){
				ws[i](typeCode, id, obj);
			}
			delete waiting[typeCode][id];
		}
	}

	var oldGetObject = handle.getObject
	handle.getObject = function(typeCode, id, cb){
		if(cache[typeCode].hasOwnProperty(id)){
			var obj = cache[typeCode][id];
			cb(obj);
		}else{
			var ws = waiting[typeCode][id];
			if(ws === undefined){
				ws = waiting[typeCode][id] = [];
			}
			
			ws.push(function(typeCode, id, obj){cb(obj);});
			
			oldGetObject(typeCode, id, function(obj){
				gotObject(typeCode, id, obj);
			});
		}
	}

	var oldGetObjects = handle.getObjects
	handle.getObjects = function(typeCode, ids, cb){
		_.assertArray(ids);
		var still = [];
		var objs = {};
		var w = waiting[typeCode];
		var manyWaiting = 0;
		function partialFunc(typeCode, id, obj){
			--manyWaiting;
			if(obj !== undefined){
				objs[id] = obj;
			}
			if(manyWaiting === 0){
				cb(objs);
			}
		}
		for(var i=0;i<ids.length;++i){
			var id = ids[i];
			var obj = cache[typeCode][id];
			if(cache[typeCode].hasOwnProperty(id)){
				var obj = cache[typeCode][id];
				if(obj !== undefined){
					_.assertObject(obj);
					objs[id] = obj;
				}
			}else{
				if(w[id] === undefined){
					w[id] = [];
					still.push(id);
				}
				w[id].push(partialFunc);
				++manyWaiting;
			}
		}
		if(manyWaiting === 0){
			cb(objs);
		}else{
			oldGetObjects(typeCode, still, function(gotObjs){
				for(var i=0;i<still.length;++i){
					var id = still[i];
					var obj = gotObjs[id];
					gotObject(typeCode, id, obj);
				}
			});
		}
	}


	var allCache = [];
	var getting = {};
	var oldGetAllObjects = handle.getAllObjects
	handle.getAllObjects = function(typeCode, cb){
		var result = allCache[typeCode];
		if(result !== undefined){
			cb(result);
		}else{
			if(getting[typeCode]){
				getting[typeCode].push(cb);
			}else{
				getting[typeCode] = [cb];
				oldGetAllObjects(typeCode, function(objs){
					if(_.size(objs) < 100){
						allCache[typeCode] = objs;
					}
					var listeners = getting[typeCode];
					for(var i=0;i<listeners.length;++i){
						var listener = listeners[i];
						listener(objs);
					}
					delete getting[typeCode];
				});
			}
		}
	}

}

exports.wrap = wrap;
