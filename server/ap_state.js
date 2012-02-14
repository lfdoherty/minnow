"use strict";

var _ = require('underscorem');

var objutil = require('./objutil');

function computePathParentType(schema, typeCode, path){
	return computePathType(schema, typeCode, path.slice(0, path.length-1));
}
function computePathType(schema, typeCode, path){
	var sc = schema._byCode[typeCode];
	//console.log('path: ' + JSON.stringify(path));
	for(var i=0;i<path.length;++i){
		var p = path[i];
		sc = sc.propertiesByCode[p];
		
		if(i + 1 === path.length) break;
		
		//console.log(JSON.stringify(sc));
		var type = sc.type.type;
		if(type === 'list' || type === 'set'){
			if(sc.type.members.type === 'primitive'){
				_.assert(i+1 === path.length);
			}else{

				++i;
				var typeCode = path[i];
				
				sc = schema._byCode[typeCode];

				++i//skip id
			}
		}else if(type === 'object'){

			++i;
			var typeCode = path[i];
			
			sc = schema._byCode[typeCode];

			++i//skip id
		}else{
			_.errout('TODO: ' + type);
		}
	}
	return sc;
}

function selectPathParent(schema, typeCode, obj, path){
	
	_.assertLength(arguments, 4);
	return selectPath(schema, typeCode, obj, path.slice(0, path.length-1));
}


function selectPath(schema, typeCode, obj, path){
	_.assertLength(arguments, 4);
	_.assertObject(obj);
	
	//console.log('path: ' + JSON.stringify(path));
	var sc = schema._byCode[typeCode];
	if(path.length === 0) return obj;
	var res = selectPathOnObject(schema, sc, obj, path);
	//console.log('result: ' + JSON.stringify(res));
	return res;
}

function selectPathOnObject(schema, sc, obj, path){
	_.assertObject(sc);
	_.assert(path.length >= 1);
	var i=0;
	var p = path[0];
	var psc = sc.propertiesByCode[p];
	if(psc === undefined) _.errout('cannot find property by code ' + p + ' for type: ' + JSON.stringify(sc));
	
	var sub = obj[p];
	/*for(var j=0;j<obj.length;++j){
		if(p === obj[j][0]){
			sub = obj[j][1];
			break;
		}
	}*/
	
	if(sub === undefined){
		sub = [];
		_.errout('what is this doing?');
		console.log('pushing new: ' + p);
		obj[p] = sub;
	}
	
	if(sub === undefined){
		_.errout('path error, property code not found: ' + p + 
			' (out of ' + JSON.stringify(_.keys(sc.properties)) + ' for ' + sc.name + ')');
	}
	
	if(path.length > 1){
		return selectPathOnProperty(schema, psc, sub, path.slice(1));
	}
	return sub;
}

function selectPathOnProperty(schema, sc, cur, path){
	
	if(sc.type.type === 'set'){
		_.assert(path.length >= 2);
		var typeCode = path[0];
		var id = path[1];
		var arr = cur[typeCode];
		var sub;
		if(arr){
			for(var j=0;j<arr.length;++j){

				var e = cur[j];
				if(_.isInteger(e)){
					if(id === e){
						_.errout('TODO support descent into top-level object');
					}
				}else{
					if(id === e[0][2]){
						sub = e[1];
						if(cur === undefined){
							e.push({});
							sub = e[1];
						}
						break;
					}
				}
			}
		}
		if(sub === undefined){
			console.log('searched: ' + JSON.stringify(cur));
			_.errout('path error, id not found: ' + id);
		}
		
		if(path.length === 2) return sub;
		
		if(sc.type.members.type === 'object'){
			return selectPathOnObject(schema, schema._byCode[typeCode], cur, path.slice(2));
		}else{
			_.errout('TODO primitive sets');
		}
		
	}else if(sc.type.type.indexOf('list') === 0){
		_.assert(path.length >= 2);
		var typeCode = path[0];
		var id = path[1];
		var sub;
		for(var j=0;j<cur.length;++j){

			var e = cur[j];
			//console.log('e: ' + JSON.stringify(e));
			if(_.isInteger(e[1])){
				if(typeCode === e[0] && id === e[1]){
					_.errout('TODO support descent into top-level object');
				}
			}else{
				
				if(typeCode === e[0] && id === e[1][0][2]){
					sub = e[1];
					if(cur === undefined){
						e.push({});
						//console.log('pushing list entry: ' + JSON.stringify(cur));
						sub = e[1];
					}
					break;
				}
			}
		}
		if(sub === undefined){
			//console.log('searched: ' + JSON.stringify(cur));
			_.errout('*path error, id not found: ' + id);
		}
		
		if(path.length === 2) return sub;
		
		if(sc.type.members.type === 'object'){
			return selectPathOnObject(schema, schema._byCode[typeCode], sub, path.slice(2));
		}else{
			_.errout('TODO primitive lists');
		}
	}else if(sc.type.type === 'object'){
		_.assert(path.length >= 1);
		var typeCode = path[0];
		var sc = schema._byCode[typeCode];
		_.assertObject(sc);
		if(path.length > 1){
			return selectPathOnObject(schema, sc, cur, path.slice(1));
		}else{
			return cur;
		}
	}else{
		_.errout('TODO: ' + sc.type.type);
	}
}

var stub = function(){}
var stubs = {
	inputObject: stub,
	setEntireObject: stub,
	setTypeAndId: stub,
	setId: stub,
	replaceNew: stub,
	replaceExisting: stub,
	descend: stub,
	ascend: stub,
	set: stub,
	remove: stub,
	removePrimitive: stub,
	addNew: stub,
	addExisting: stub,
	add: stub
}

var indexingStub = {
	updateIndexingOnProperty: stub
}

function make(schema, initialEditCount, raf, alreadyCreatedMap){
	
	_.assertLength(arguments, 4);
	
	var indexing = indexingStub;
	
	console.log('ap state already created: ' + JSON.stringify(alreadyCreatedMap));
	
	var ap = stubs
	
	var editCount = 0 || initialEditCount;
	var startingEditCount;
	
	var alreadyCreated = _.extend({}, alreadyCreatedMap);
	
	function incr(obj){
		++editCount;
		_.assert(_.isArray(obj[0]) && obj[0][0] === -1);
		obj[0][1] = editCount;
	}
	
	var state;
	var manyCreated;
	function clearState(){
		startingEditCount = editCount;
		state = {};
		manyCreated = {};
		console.log(JSON.stringify(alreadyCreated));
		_.each(schema._byCode, function(value, typeCode){
			state[typeCode] = {};
			manyCreated[typeCode] = 0;
			if(alreadyCreated[typeCode] === undefined) alreadyCreated[typeCode] = 0;
		});
	}
	clearState();

	var inverses = {};
	_.each(schema, function(ts){
		if(!ts.isView) inverses[ts.code] = {};
	});
	function getTs(tc, id, stc, sid){
		var lk = inverses[tc];
		if(lk[id] === undefined) lk[id] = {};
		var ts = lk[id];
		if(ts[stc] === undefined) ts[stc] = {};
		var c = ts[stc];
		if(c[sid] === undefined) c[sid] = 0;
		return c;
	}
	function recordInverse(tc, id, stc, sid){
		console.log('recorded inverse: ' + JSON.stringify([tc, id, stc, sid]));
		var ts = getTs(tc, id, stc, sid);
		++ts[sid];
	}
	function removeInverse(tc, id, stc, sid){
		console.log('removed inverse: ' + JSON.stringify([tc, id, stc, sid]));
		var ts = getTs(tc, id, stc, sid);
		--ts[sid];
		if(ts[sid] < 0) delete ts[sid];
	}
	
	function extractAndRecordObjectInverseRelationships(typeCode, obj){
		var sc = schema._byCode[typeCode];
		var objId = obj[0][2];
		var propertyCodeKeys = Object.keys(sc.propertiesByCode);
		//for(var i=1;i<obj.length;++i){
		for(var i=0;i<propertyCodeKeys.length;++i){
			//var e = obj[i];
			//var pc = e[0];
			//var vs = e[1];
			//var p = sc.propertiesByCode[pc];
			var key = propertyCodeKeys[i];
			var vs = obj[key];
			if(vs !== undefined){
				var p = sc.propertiesByCode[key];
				if(p.type.type === 'object'){
					if(_.isInteger(vs[1])){
						recordInverse(vs[0], vs[1], typeCode, objId);
					}
				}else if(p.type.type === 'set'){
					_.errout('TODO');
				}else if(p.type.type === 'list'){
					var arr = vs;
					for(var j=0;j<arr.length;++j){
						var a = arr[j];
						if(_.isInteger(a[1])){
							recordInverse(a[0], a[1], typeCode, objId);
						}
					}
				}
			}
		}
	}
	
	function findUnusedId(arr){
		var max = -1;
		for(var i=0;i<arr.length;++i){
			var e = arr[i];
			if(_.isInteger(e[1])){
				_.assertInt(e[0]);
				_.assertInt(e[1]);
				//ignore referential entry
				console.log('ignoring referential entry: ' + JSON.stringify(e));
			}else{
				var obj = e[1];
				var id = obj[0][2];
				//console.log('e: ' + JSON.stringify(e));
				_.assertInt(id);
				max = Math.max(id, max);
			}
		}
		_.assertInt(max);
		_.assert(max >= -1);
		return max + 1;
	}
	
	function getOrMakeCurrentCollection(typeCode){

		var lastCode = currentPath[currentPath.length-1];
		_.assertInt(lastCode);
		var obj = selectPathParent(schema, currentType, currentObject, currentPath);
		if(obj === undefined){
			_.errout('evaluating path: ' + JSON.stringify(currentPath) + 
				' failed against object: ' + JSON.stringify(currentObject));
		}
		_.assertObject(obj);
		var arr = obj[lastCode];
		/*for(var j=0;j<obj.length;++j){
			if(obj[j][0] === lastCode){
				arr = obj[j][1];//.push(v);
				_.assertDefined(arr);
				found = true;
				break;
			}
		}*/
		var t = computePathType(schema, currentType, currentPath);
		_.assertObject(t);
		_.assertNot(t.type.type === 'primitive');
		
		//console.log('TTT: ' + JSON.stringify(t));
		
		if(arr === undefined){
		
			if(t.type.type === 'set'){
				arr = {};
			}else{
				arr = [];
				//console.log('initialized arr');
			}
			obj[lastCode] = arr;
		}
		
		if(t.type.type === 'set' && t.members.type === 'object'){
			//console.log('is set');
			var a = arr[typeCode];
			if(a === undefined) a = arr[typeCode] = [];
			arr = a;
		}
		
		_.assertDefined(arr);
		
		return arr;
	}
	
	function getCurrentCollection(path){
		path = path || currentPath;
		console.log('getCurrentCollection: ' + JSON.stringify(path));
		var lastCode = path[path.length-1];
		_.assertInt(lastCode);
		var obj = selectPathParent(schema, currentType, currentObject, path);
		if(obj === undefined){
			_.errout('evaluating path: ' + JSON.stringify(path) + 
				' failed against object: ' + JSON.stringify(currentObject));
		}
		console.log('obj: ' + JSON.stringify(obj));
		_.assertObject(obj);
		var arr = obj[lastCode];
		console.log('arr: ' + JSON.stringify(arr));
		/*
		for(var j=0;j<obj.length;++j){
			var found = false;
			if(obj[j][0] === lastCode){
				arr = obj[j][1];//.push(v);
				found = true;
				break;
			}
		}*/
		return arr;
	}
	
	function addCurrent(v, typeCode){
		_.assertNot(_.isArray(v));
		var arr = getOrMakeCurrentCollection(typeCode);

		v[0][2] = findUnusedId(arr);
		_.assertInt(v[0][2]);

		var t = computePathType(schema, currentType, currentPath);
		//console.log('v: ' + JSON.stringify(v));
		if(t.type.type === 'list'){
			arr.push([typeCode, v]);
		}else{
			arr.push(v);
		}
		
		
		incr(currentObject);
	}
	function addPrimitive(v){
		
		var arr = getOrMakeCurrentCollection();
		arr.push(v);
		
		incr(currentObject);
	}
	
	//replace is for lists only
	function replaceCurrent(/*id, oldTypeCode, */obj, typeCode, dontIncr){
		_.assert(arguments.length >= 2);
		_.assert(arguments.length <= 3);
		//_.assertInt(id);
		_.assertInt(typeCode);
		//_.assertInt(oldTypeCode);
		//_.assert(oldTypeCode >= 0);
		
		if(dontIncr !== undefined) _.assertBoolean(dontIncr);
		
		var path = currentPath.slice(0, currentPath.length-2);
		var oldTypeCode = currentPath[currentPath.length-2];
		var id = currentPath[currentPath.length-1];
		
		var arr = getCurrentCollection(path);
		if(arr === undefined){
			console.log('WARNING: ignoring invalid replace');//TODO standardize this sort of command-checking
			return;
		}else{
			var found = false;
			//console.log('arr: ' + JSON.stringify(arr));
			//console.log('v: ' + JSON.stringify([id, oldTypeCode, obj, typeCode]));
			
			var index = findElementInList(arr, oldTypeCode, id);
			
			if(index === undefined){
				console.log('*WARNING: ignoring invalid replace');//TODO standardize this sort of command-checking
				return;
			}

			arr.splice(index, 1, [typeCode, obj]);
		}
		
		if(!dontIncr){
			incr(currentObject);
		
			obj[0][2] = findUnusedId(arr);
		}
	}
	
	function findElementInList(arr, typeCode, id){
		console.log('finding ' + typeCode + ' ' + id);
		console.log('in array: ' + JSON.stringify(arr));
		for(var i=0;i<arr.length;++i){
			var e = arr[i];
			if(e[0] === typeCode){
				e = e[1];
				if(_.isInteger(e)){
					if(e === id){
						return i;
					}
				}else{
					if(e[0][2] === id){
						return i;
					}
				}
			}
		}
	}
	

	function removeCurrentPrimitive(value){
		
		var arr = getCurrentCollection();
	
		var t = computePathType(schema, currentType, currentPath);
	
		if(t.type.type === 'list'){

			//console.log('arr: ' + JSON.stringify(arr));
			//console.log('v: ' + JSON.stringify([id, typeCode]));

			if(arr === undefined){
				console.log('WARNING: ignoring invalid remove');//TODO standardize this sort of command-checking
				return;
			}

			var index = arr.indexOf(value);
			
			if(index === -1){
				console.log('*WARNING: ignoring invalid remove');//TODO standardize this sort of command-checking
				return;
			}
			
			arr.splice(index, 1);

		}else{
			_.errout('TODO implement');
		}
		incr(currentObject);
	}
	
	function removeCurrent(){

		var typeCode = currentPath[currentPath.length-2];
		var id = currentPath[currentPath.length-1];
		
		_.assertInt(typeCode);
		
		var path = currentPath.slice(0, currentPath.length-2);
		var arr = getCurrentCollection(path);
	
		var t = computePathType(schema, currentType, path);
	
		if(t.type.type === 'list'){

			//console.log('arr: ' + JSON.stringify(arr));
			//console.log('v: ' + JSON.stringify([id, typeCode]));

			if(arr === undefined){
				console.log('WARNING: ignoring invalid remove');//TODO standardize this sort of command-checking
				return;
			}

			var index = findElementInList(arr, typeCode, id);
			
			if(index === undefined){
				console.log('*WARNING: ignoring invalid remove');//TODO standardize this sort of command-checking
				return;
			}
			
			arr.splice(index, 1);

		}else{
			_.errout('TODO implement');
		}
		incr(currentObject);
	}
	
	function setCurrent(v, typeCode){
		if(typeCode !== undefined) v = [typeCode, v];

		_.assertObject(currentObject);
		_.assertNot(_.isArray(currentObject));

		var lastCode = currentPath[currentPath.length-1];
		_.assertInt(lastCode);
		var obj = selectPathParent(schema, currentType, currentObject, currentPath);
		if(obj === undefined){
			_.errout('evaluating path: ' + JSON.stringify(currentPath) + 
				' failed against object: ' + JSON.stringify(currentObject));
		}
		_.assertObject(obj);
		if(_.isArray(obj)) _.errout('object is array: ' + JSON.stringify(obj));
		_.assertNot(_.isArray(obj));

		var oldValue = obj[lastCode];

		obj[lastCode] = v;
		
		if(currentPath.length === 1){
			_.assert(currentObject === obj);
			indexing.updateIndexingOnProperty(currentType, obj, lastCode, oldValue);
		}
		
		incr(currentObject);
	}
	
	
	var currentType;
	var currentId;
	var currentPath = [];

	var currentObject;
	var currentSchema;

	function refreshSchema(){
		_.errout('TODO');
	}


	function shiftToPath(path){
		var manyShared = 0;
		for(;manyShared<path.length && manyShared<currentPath.length;++manyShared){
			if(path[manyShared] !== currentPath[manyShared]){
				break;
			}
		}
		//console.log('manyShared: ' + manyShared);
		var manyToAscend = currentPath.length - manyShared;
		if(manyToAscend > 0){
			ap.ascend(manyToAscend);
		}
		var remaining = path.slice(manyShared);
		if(remaining.length > 0){
			ap.descend(remaining);
		}
		currentPath = path;
		
		//console.log('shifted to path: ' + JSON.stringify(path));
		
	}

	function refreshIndexing(typeCode, id, obj){
		var keys = Object.keys(obj);
		for(var i=0;i<keys.length;++i){
			var propertyCode = keys[i];
			var pc = parseInt(propertyCode);
			if(pc !== 0){
				indexing.updateIndexingOnProperty(typeCode, obj, pc, undefined);
			}
		}
		
		extractAndRecordObjectInverseRelationships(typeCode, obj);
	}
	
	var internalHandle = {
		setId: function(id){
			ap.setId(id);
			currentId = id;
			currentObject = state[currentType][id];
			_.assertObject(currentObject);
		},
		setTypeAndId: function(typeCode, id){
			ap.setTypeAndId(typeCode, id);
			currentType = typeCode;
			currentId = id;
			currentObject = state[typeCode][id];
			if(currentObject === undefined) _.errout('cannot find object: ' + currentType + ' ' + currentId);
			_.assertObject(currentObject);
		},
		ascend: function(many){
			ap.ascend(many);
			currentPath = currentPath.slice(0, currentPath.length-many);
			//console.log('ascending: ' + many);
		},
		descend: function(path){
			ap.descend(path);
			currentPath = currentPath.concat(path);
			//console.log('descending: ' + JSON.stringify(path));
			//console.log('current: ' + JSON.stringify(currentPath));
		},
		set: function(v){
			ap.set(v);
			setCurrent(v);
		},
		setObject: function(v, typeCode){
			_.assertInt(typeCode);
			ap.set(v);
			console.log('setObject: ' + JSON.stringify([v, typeCode]));
			setCurrent(v, typeCode);
		},
		remove: function(){
			ap.remove();
			
			removeCurrent();
		},
		removePrimitive: function(value){
			ap.removePrimitive(value);
			removeCurrentPrimitive(value);
		},
		add: function(value){
			_.assertDefined(value);
			ap.add(value);
			addPrimitive(value);
		},
		addNew: function(typeCode, external){
			_.assertInt(typeCode);
			external = external || false;
			_.assertBoolean(external);
			
			ap.addNew(typeCode, external);
			if(external){
				var obj = {0: [-1, -10, alreadyCreated[typeCode], typeCode]};
				//incr(obj);

				var id = obj[0][2];
				state[typeCode][id] = obj;

				++alreadyCreated[typeCode];
				++manyCreated[typeCode];
			
				
				var arr = getOrMakeCurrentCollection(typeCode);
				var t = computePathType(schema, currentType, currentPath);
				if(t.type.type === 'set'){
					arr.push(id);
				}else{
					arr.push([typeCode, id]);
				}			
				recordInverse(typeCode, id, currentType, currentId);
				//console.log('added external *** ' + id);
				//console.log(JSON.stringify(arr));
				//console.log(JSON.stringify(currentObject));
				//console.log(JSON.stringify(schema._byCode[currentType]));
				//incr(currentObject);

				++editCount;
				obj[0][1] = editCount;
				currentObject[0][1] = editCount;
				
				return id;
			}else{
			
				var obj = {0: [-1, -11, -1, typeCode]};
				addCurrent(obj, typeCode);
			
				return obj[0][2];
			}
		},
		addExisting: function(typeCode, id){
			_.assertInt(typeCode);
			_.assertInt(id);

			ap.addExisting(typeCode, id);
			
			var arr = getOrMakeCurrentCollection(typeCode);
			var t = computePathType(schema, currentType, currentPath);
			if(t.type.type === 'set'){
				arr.push(id);
			}else{
				arr.push([typeCode, id]);
			}
			incr(currentObject);		
			recordInverse(typeCode, id, currentType, currentId);
		},
		replaceExisting: function(typeCode, id){
			_.assertInt(typeCode);
			_.assertInt(id);
			
			ap.replaceExisting(typeCode, id);

			replaceCurrent(id, typeCode, true);

			var oldTypeCode = currentPath[currentPath.length-2];
			var oldId = currentPath[currentPath.length-1];
			
			removeInverse(oldTypeCode, oldId, currentType, currentId);
			recordInverse(typeCode, id, currentType, currentId);
		},
		replaceNew: function(typeCode){
			_.assertInt(typeCode);
			
			console.log('currentPath: ' + JSON.stringify(currentPath))
			_.assert(currentPath.length > 2);
			
			var oldTypeCode = currentPath[currentPath.length-2];
			var oldId = currentPath[currentPath.length-1];
			
			ap.replaceNew(typeCode);

			var obj = {0: [-1, -11, -1, typeCode]};
			replaceCurrent(obj, typeCode);

			removeInverse(oldTypeCode, oldId, currentType, currentId);
			
			var id = obj[0][2];
			_.assert(id >= 0);
			return id;
		},
		setEntireObject: function(typeCode, id, obj){//sets the current object state to the given one
			_.assertLength(arguments, 3);
			_.assertInt(typeCode);
			_.assertInt(id);
			_.assertObject(obj);
			
			obj = state[typeCode][id] = JSON.parse(JSON.stringify(obj));
			ap.setEntireObject(typeCode, id, obj);
			incr(obj);

			refreshIndexing(typeCode, id, obj);
		},
		makeObject: function(typeCode, obj){
			ap.inputObject(typeCode, obj);
			var id = alreadyCreated[typeCode];
			obj[0] = [-1, -10, id, typeCode];
						
			++alreadyCreated[typeCode];
			++manyCreated[typeCode];
			
			incr(obj);

			state[typeCode][id] = obj;
			
			refreshIndexing(typeCode, id, obj);
			
			return obj[0][2];
		},
		cacheObject: function(typeCode, id, obj){
			state[typeCode][id] = obj;
		}
	};
	
	var broadcaster;

	var temporaryPaths = {};
	
	function translateWithTemporaries(path, syncId){
		var tp = temporaryPaths[syncId];
		var result;
		if(tp === undefined){
			console.log('syncId: ' + syncId);
			result = path;
		}else{
			result = [].concat(path);
		
			//note that this is an iterative process - the fact that early (subpath) temporary ids will be translated
			//before later ones (since they are inserted in order) is important.
			for(var i=0;i<tp.length;++i){
				var tpe = tp[i];
				var tpath = tpe[0];
				if(tpath.length >= result.length){
					continue;
				}else{
					for(var j=0;j<tpath.length;++j){
						if(tpath[j] !== result[j]){
							break;
						}
					}
					if(j === tpath.length){
						if(result[tpath.length] === tpe[1] && result[tpath.length+1] === tpe[2]){
							//matched temporary
							console.log('matched temporary(' + tpe[1] + '): ' + tpe[2] + ' translating to ' + tpe[3]);
							result[tpath.length+1] = tpe[3];
						}
					}
				}
			}
		}
		
		for(var i=0;i<result.length;++i){
			if(result[i] < 0){
				console.log(JSON.stringify(path) + ' -> ' + JSON.stringify(result));
				console.log(JSON.stringify(tp));
				_.errout('failed to fully translate path');
			}
		}
		
		return result;
	}
	
	var buffer = [];
	var retrieved = {};
	var retrieving = {};
	_.each(schema._byCode, function(value, typeCode){
		retrieved[typeCode] = {};
		retrieving[typeCode] = {};
	});
	function processRetrieved(){
		while(buffer.length > 0){
			var typeCode = buffer[0][0];
			var id = buffer[0][1];
			if(retrieved[typeCode][id] !== undefined || state[typeCode][id] !== undefined){
				persistEdit.apply(undefined, buffer[0]);
				delete retrieved[typeCode][id];
				buffer.shift();
			}else{
				break;
			}
		}
	}
	function retrieveFunction(obj){
		var typeCode = obj[0][2];
		console.log('typeCode: ' + typeCode);
		var id = obj[0][1];
		var key = typeCode + ':' + id;
		retrieved[typeCode][id] = obj;
		ap.cacheObject(typeCode, id, obj);
		processRetrieved();
	}
	function persistEditWrapper(typeCode, id, path, edit, syncId){
		if(state[typeCode][id] === undefined && !retrieving[typeCode][id]){
			retrieving[typeCode][id] = true;
			raf.getObject(typeCode, id, retrieveFunction);
			buffer.push([typeCode,id,path,edit,syncId]);
			console.log('*buffering edit: ' + buffer.length);
		}else if(buffer.length > 0){
			buffer.push([typeCode,id,path,edit,syncId]);
			console.log('buffering edit: ' + buffer.length);
		}else{
			persistEdit.call(undefined, typeCode,id,path,edit,syncId);
		}
	}
	
	function persistEdit(typeCode, id, path, edit, syncId){
		_.assertLength(arguments, 5);

		_.assertObject(broadcaster);
		_.assertInt(id);
		_.assertInt(typeCode);
		_.assertInt(syncId);
		
		var oldPath = path;
		path = translateWithTemporaries(path, syncId);
		
		console.log('translated path ' + JSON.stringify(oldPath) + ' -> ' + JSON.stringify(path));
		
		if(currentType !== typeCode){
			internalHandle.setTypeAndId(typeCode, id);
		}else{
			if(currentId !== id){
				internalHandle.setId(id);
			}
		}
		shiftToPath(path);
		
		var editIdBefore = editCount;
		
		var e = JSON.parse(JSON.stringify(edit));
		console.log(JSON.stringify(edit));
		
		if(e.op === 'set'){
			internalHandle.set(e.value);
		}else if(e.op === 'setObject'){
			internalHandle.setObject(e.value, e.type);
		}else if(e.op === 'add'){
			internalHandle.add(e.value);
		}else if(e.op === 'addNew'){
			var id = internalHandle.addNew(e.type, e.external || false);
			var tpa = temporaryPaths[syncId];
			if(tpa === undefined) tpa = temporaryPaths[syncId] = [];
			_.assertInt(e.temporary);
			_.assert(id >= 0);
			tpa.push([path, e.type, e.temporary, id]);//note that we are storing the *translated* path (with any subpath temporary ids already translated.)
			e.id = id;
		}else if(e.op === 'addExisting'){
			internalHandle.addExisting(e.type, e.id);
		}else if(e.op === 'replaceExisting'){
			internalHandle.replaceExisting(e.type, e.id);
		}else if(e.op === 'remove'){
			internalHandle.remove();
		}else if(e.op === 'removePrimitive'){
			internalHandle.removePrimitive(e.value);
		}else if(e.op === 'replaceNew'){
			var id = internalHandle.replaceNew(e.type);
			_.assert(id >= 0);
			var tpa = temporaryPaths[syncId];
			if(tpa === undefined) tpa = temporaryPaths[syncId] = [];
			_.assertInt(e.temporary);
			tpa.push([path.slice(0, path.length-2), e.type, e.temporary, id]);//note that we are storing the *translated* path (with any subpath temporary ids already translated.)
			e.id = id;
		}else{
			_.errout('TODO implement op: ' + e.op);
		}

		var editIdAfter = editCount;
		
		if(editIdAfter === editIdBefore) _.errout('failure to increment edit count for edit: ' + JSON.stringify(e));
		
		//TODO what about the sync source?
		broadcaster.input.objectChanged(currentType, currentId, currentPath, e, syncId, editIdBefore);
	}		
	var externalHandle = {
		setBroadcaster: function(b){broadcaster = b;},
		
		inputObject: function(typeCode, obj, cb){
			var id = internalHandle.makeObject(typeCode, obj);
			broadcaster.input.objectCreated(typeCode, id, obj[0][1]);
			if(cb) cb(id);
		},
		setEntireObject: function(typeCode, id, obj, oldObj){
			_.assertLength(arguments, 4);
			_.assertObject(oldObj);
			
			//var oldObj = state[typeCode][id];
			//if(oldObj === undefined) _.errout('TODO: retrieve object from RAF: ' + typeCode + ' ' + id);

			_.assertEqual(id, oldObj[0][2]);
			
			obj[0] = [].concat(oldObj[0]);
			
			if(oldObj !== undefined){//TODO retrieve object from raf for comparison if necessary?
				if(JSON.stringify(obj) === JSON.stringify(oldObj)){
					//console.log('ignoring non-change');
					return;
				}else{
					console.log('refresh change');
					console.log(JSON.stringify(oldObj));
					console.log(JSON.stringify(obj));
				}
			}

			internalHandle.setEntireObject(typeCode, id, obj);
			//TODO broadcast something
		},
		persistEdit: persistEditWrapper,
		getInverse: function(typeCode, id){
			//TODO when we implement the edits that cause this, implement the lookup/indexing for this
			var lk = inverses[typeCode];
			var ts = lk[id];
			if(ts === undefined) return [];
			else{
				var arr = [];
				_.each(ts, function(byId, tcStr){
					_.each(byId, function(count, idStr){
						arr.push([true, [parseInt(tcStr), parseInt(idStr)]]);
					});
				});
				return arr;
			}
		},
		
		getObjectState: function(typeCode, id){
			_.assertInt(id);
			
			var objs = state[typeCode];
			_.assertObject(objs);
			//if(objs[id] === undefined) _.errout('unknown object: ' + typeCode + ' ' + id + ' ' + JSON.stringify(_.keys(objs)));
			if(objs[id] === undefined) return undefined;
			
			return objs[id];
		},
		getObjects: function(typeCode, ids){
			var objs = externalHandle.getAllObjects(typeCode);
			var list = ids.get();
			var result = {};
			for(var i=0;i<list.length;++i){
				var id = list[i];
				var obj = objs[id]
				if(obj !== undefined){
					result[id] = obj;
				}
			}
			//console.log('ap found: ' + _.size(result));
			return result;
		},
		getAllObjects: function(typeCode){
			//TODO support sub-typing
			
			//TODO create some means of swapping between "debug mode" and "release/performance mode"
			//globally, with load-time hooks to swap in appropriate functions in modules
			
			//This is "debug mode"
			//var obj = _.extend({},(state[typeCode] || {}));
			//Object.freeze(obj);
			//return obj;
			
			//this is "fast mode"
			return state[typeCode] || {};
		},
		objectExists: function(typeCode, id){
			return state[typeCode][id] !== undefined;
		},
		getManyCreatedOfType: function(typeCode){
			return manyCreated[typeCode];
		},
		selectByMultiplePropertyConstraints: function(typeCode, descentPaths, filterFunctions, matchingIdList){
			_.assertLength(arguments, 4);
			_.assertArray(matchingIdList);
			
			var matchingList = [];
			for(var k=0;k<descentPaths.length;++k){

				var descentPath = descentPaths[k];
				var filterFunction = filterFunctions[k];
				var matchingIds = matchingIdList[k];
				
				var start = Date.now();
				//console.log('starting selectByPropertyConstraint in ap');
				var objs = state[typeCode] || {};
				var matching = matchingIds;
				var already = {};
				
				var toRemoveIds = [];
				var toAddIds = [];
				
				var objIds = Object.keys(objs);
				for(var i=0;i<objIds.length;++i){
					var obj = objs[objIds[i]];
					var v = objutil.descendObject(schema, typeCode, obj, descentPath);
					var id = obj[0][2];
					if(filterFunction(v)){
						toAddIds.push(id);
					}else{
						toRemoveIds.push(id);
					}
				}
				
				matching = matching.getRemovedArray(toRemoveIds);
				matching = matching.getAddedArray(toAddIds);
			
				var end = Date.now();
				//console.log('ap selectByMultiplePropertyConstraints took: ' + (end-start) + 'ms for ' + _.size(objs));
			
				matchingList.push(matching);
			}
			return matchingList;
		}
	};
		
	return {
		internal: internalHandle,
		external: externalHandle,
		setAp: function(newAp, resetState){
			ap = newAp;
			if(resetState) clearState();
		},
		clearState: function(){
			console.log('clearing ap-state');
			clearState();
		},
		setIndexing: function(newIndexing){
			indexing = newIndexing;
		},
		getEditCount: function(){
			return editCount;
		},
		getStartingEditCount: function(){
			return startingEditCount;
		}
	}
}

exports.make = make
