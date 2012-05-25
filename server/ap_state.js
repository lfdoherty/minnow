"use strict";

var _ = require('underscorem');

var objutil = require('./objutil');

var memobjects = require('./memobjects');

function selectPathParent(schema, obj, path){
	
	_.assertLength(arguments, 3);
	return selectPath(schema, obj, path.slice(0, path.length-1));
}


function selectPath(schema, obj, path){
	_.assertLength(arguments, 3);
	_.assertObject(obj);
	
	//console.log('path: ' + JSON.stringify(path));
	var typeCode = obj.meta.typeCode;
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
	
	//TODO lazy creation should always be supported where the path doesn't enter a collection
	//and the types are unambiguous.
	if(sub === undefined){
		if(psc.tags.lazy){
			var defaultTypeCode = schema[psc.type.object].code;
			_.assertInt(defaultTypeCode);
			sub = {meta: {typeCode: defaultTypeCode}};
			obj[p] = sub;
			console.log('lazily created: ' + JSON.stringify(sub));
		}else{
			console.log('pushing new: ' + p);
			_.errout('what is this doing: ' + obj.meta.typeCode + ' ' + obj.meta.id + '.' + p);
		}
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
	_.assertLength(arguments, 4);
	
	if(sc.type.type === 'set'){
		_.assert(path.length >= 1);
		var id = path[0];
		var arr = cur
		var sub;
		if(arr){
			for(var j=0;j<arr.length;++j){

				var e = cur[j];
				if(_.isInteger(e)){
					if(id === e){
						_.errout('TODO support descent into top-level object');
					}
				}else{
					if(id === e.meta.id){
						sub = e
						if(cur === undefined){
							e.push({});
							sub = e
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
		
		if(path.length === 1) return sub;
		
		if(sc.type.members.type === 'object'){
			var typeCode = sub.meta.typeCode;
			return selectPathOnObject(schema, schema._byCode[typeCode], sub, path.slice(1));
		}else{
			_.errout('TODO primitive sets');
		}
		
	}else if(sc.type.type.indexOf('list') === 0){
		_.assert(path.length >= 1);
		var id = path[0];
		var sub;
		for(var j=0;j<cur.length;++j){

			var e = cur[j];
			//console.log('e: ' + JSON.stringify(e));
			if(_.isInteger(e)){
				if(id === e){
					_.errout('TODO support descent into top-level object');
				}
			}else{
				
				if(id === e.meta.id){
					sub = e;
					if(cur === undefined){
						e.push({});
						sub = e;
					}
					break;
				}
			}
		}
		if(sub === undefined){
			//console.log('searched: ' + JSON.stringify(cur));
			_.errout('*path error, id not found: ' + id);
		}
		
		if(path.length === 1) return sub;
		
		if(sc.type.members.type === 'object'){
			var typeCode = sub.meta.typeCode;
			return selectPathOnObject(schema, schema._byCode[typeCode], sub, path.slice(1));
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

var indexingStub = {
	updateIndexingOnProperty: stub
}

function make(schema, ol){//initialEditCount, initialSyncIdCounter, raf, alreadyCreatedMap){
	
	var initialEditCount = ol.getLatestVersionId()
	
	_.assertLength(arguments, 2);
	
	var typeCodeToBaseMap = {};
	var allTypeCodesMap = {};
	var subTypeCodesMap = {};
	_.each(schema._byCode, function(objSchema){
		if(objSchema.isView) return;
		typeCodeToBaseMap[objSchema.code] = getBaseType(objSchema).code;
		allTypeCodesMap[objSchema.code] = _getAllTypeCodes(objSchema);
		subTypeCodesMap[objSchema.code] = _getSubTypeCodes(objSchema);
	})
	function getBaseTypeCode(typeCode){
		return typeCodeToBaseMap[typeCode];
	}
	function getAllTypeCodes(typeCode){
		return allTypeCodesMap[typeCode];
	}
	function getSubTypeCodes(typeCode){
		return subTypeCodesMap[typeCode];
	}
	
	function getBaseType(objSchema){
		
		while(true){
			var keys = Object.keys(objSchema.superTypes);
			var found = undefined;
			for(var i=0;i<keys.length;++i){
				var sn = keys[i];
				var st = schema[sn];
				if(st){
					found = st;
				}
			}
			if(!found) return objSchema;
			objSchema = found;
		}
	}
	function _getAllTypeCodes(objSchema){
		
		var codes = [];
		while(true){
			codes.push(objSchema.code);
			var keys = Object.keys(objSchema.superTypes);
			var found = undefined;
			for(var i=0;i<keys.length;++i){
				var sn = keys[i];
				var st = schema[sn];
				if(st){
					found = st;
				}
			}
			if(!found) return codes;
			objSchema = found;
		}
	}
	function _getSubTypeCodes(objSchema){
		
		var codes = [];
		while(true){
			codes.push(objSchema.code);
			//console.log(JSON.stringify(objSchema))
			//if(objSchema.subTypes === undefined) return;
			var keys = Object.keys(objSchema.subTypes);
			var found = undefined;
			for(var i=0;i<keys.length;++i){
				var sn = keys[i];
				var st = schema[sn];
				if(st){
					found = st;
				}
			}
			if(!found) return codes;
			objSchema = found;
		}
	}
	
	var indexing = indexingStub;
	
	//console.log('ap state already created: ' + JSON.stringify(alreadyCreatedMap));
	
	var ap;// = stubs
	
	var editCount = 0 || initialEditCount;
	var startingEditCount;
	
	var syncIdCounter = 1 || initialSyncIdCounter;
	
	//var alreadyCreated = _.extend({}, alreadyCreatedMap);
	
	function incr(obj){
		++editCount;
		_.assert(obj.meta !== undefined)//_.isDefined(obj.meta));
		obj.meta.editId = editCount;
	}
	
	function makeNewSyncId(){
		var syncId = syncIdCounter;
		++syncIdCounter;
		return syncId;
	}
	
	//var state;
	//var manyCreated;
	var mo;
	/*function clearState(){
		mo = memobjects.make(editCount);
		//state = {};
		manyCreated = {};
		//console.log(JSON.stringify(alreadyCreated));
		_.each(schema._byCode, function(value, typeCode){
			//state[typeCode] = {};
			manyCreated[typeCode] = 0;
			//if(alreadyCreated[typeCode] === undefined) alreadyCreated[typeCode] = 0;
		});
	}
	clearState();*/

	var inverses = {};
	/*_.each(schema, function(ts){
		if(!ts.isView) inverses[ts.code] = {};
	});*/
	function getTs(id, typeCode, sid){
		//var lk = inverses//[tc];
		if(inverses[id] === undefined) inverses[id] = {};
		var ts = inverses[id];
		if (ts[typeCode] === undefined){
			ts[typeCode] = {};
		}
		var nts = ts[typeCode];
		if(nts[sid] === undefined) nts[sid] = 0;
		return nts;
	}
	function recordInverse(id, typeCode, sid){
		_.assertLength(arguments, 3);
		//console.log('recorded inverse: ' + JSON.stringify([tc, id, stc, sid]));
		var ts = getTs(id, typeCode, sid);
		++ts[sid];
	}
	function removeInverse(id, typeCode, sid){
		_.assertLength(arguments, 3);
		//console.log('removed inverse: ' + JSON.stringify([tc, id, stc, sid]));
		var ts = getTs(id, typeCode, sid);
		--ts[sid];
		if(ts[sid] < 0) delete ts[sid];
	}
	
	function extractAndRecordObjectInverseRelationships(typeCode, obj){
		_.assertLength(arguments, 2);
		var sc = schema._byCode[typeCode];
		var objId = obj.meta.id
		var propertyCodeKeys = Object.keys(sc.propertiesByCode);
		for(var i=0;i<propertyCodeKeys.length;++i){
			var key = propertyCodeKeys[i];
			var vs = obj[key];
			if(vs !== undefined){
				var p = sc.propertiesByCode[key];
				if(p.type.type === 'object'){
					if(_.isInteger(vs)){
						recordInverse(vs, typeCode, objId);
					}
				}else if(p.type.type === 'list' || p.type.type === 'set'){
					var arr = vs;
					for(var j=0;j<arr.length;++j){
						var a = arr[j];
						if(_.isInteger(a)){
							recordInverse(a, typeCode, objId);
						}
					}
				}
			}
		}
	}
	
	function findUnusedId(arr){
		var max = -1;
		console.log('searching arr: ' + JSON.stringify(arr))
		for(var i=0;i<arr.length;++i){
			var e = arr[i];
			if(_.isInteger(e)){
				//ignore referential entry
				console.log('ignoring referential entry: ' + JSON.stringify(e));
			}else{
				var obj = e;
				var id = obj.meta.id
				_.assertInt(id);
				max = Math.max(id, max);
			}
		}
		_.assertInt(max);
		_.assert(max >= -1);
		return max + 1;
	}
	
	function getOrMakeCurrentCollection(currentObject){
		//_.assertLength(arguments, 2);
		_.assertObject(currentObject);
		
		//console.log('(' + currentType + ') ' + JSON.stringify(currentPath));

		var lastCode = currentPath[currentPath.length-1];
		_.assertInt(lastCode);
		var obj = selectPathParent(schema, currentObject, currentPath);
		if(obj === undefined){
			_.errout('evaluating path: ' + JSON.stringify(currentPath) + 
				' failed against object: ' + JSON.stringify(currentObject));
		}
		_.assertObject(obj);
		var arr = obj[lastCode];

		
		if(arr === undefined){
			arr = [];
			obj[lastCode] = arr;
		}

		_.assertArray(arr);
		if(_.isString(arr)) _.errout('collection cannot be a string');
		
		return arr;
	}
	
	function getCurrentCollection(currentObject, path){
		_.assertLength(arguments, 2);
		
		path = path || currentPath;
		console.log('getCurrentCollection: ' + JSON.stringify(path));
		var lastCode = path[path.length-1];
		_.assertInt(lastCode);
		var obj = selectPathParent(schema, currentObject, path);
		if(obj === undefined){
			_.errout('evaluating path: ' + JSON.stringify(path) + 
				' failed against object: ' + JSON.stringify(currentObject));
		}
		//console.log('obj: ' + JSON.stringify(obj));
		_.assertObject(obj);
		var arr = obj[lastCode];
		
		//_.assertDefined(arr)

		return arr;
	}
	
	function addCurrent(currentObject, v){
		_.assertLength(arguments, 2);
		_.assertNot(_.isArray(v));
		var arr = getOrMakeCurrentCollection(currentObject);

		v.meta.id = findUnusedId(arr);
		_.assertInt(v.meta.id);


		arr.push(v);

		
		
		incr(currentObject);
	}
	function addPrimitive(obj, v){
		_.assertLength(arguments, 2);
		
		var arr = getOrMakeCurrentCollection(obj);
		//console.log('adding primitive(' + arr.length + '): ' + JSON.stringify(arr));
		//console.log('adding: ' + JSON.stringify(v));
		arr.push(v);
		
		incr(obj);
	}
	
	//replace is for lists only
	function replaceCurrent(currentObject, obj, dontIncr){
		_.assert(arguments.length >= 2);
		_.assert(arguments.length <= 3);

		
		if(dontIncr !== undefined) _.assertBoolean(dontIncr);
		
		var path = currentPath.slice(0, currentPath.length-1);
		var id = currentPath[currentPath.length-1];
		
		var arr = getCurrentCollection(currentObject, path);
		if(arr === undefined){
			console.log('WARNING: ignoring invalid replace');//TODO standardize this sort of command-checking
			return;
		}else{
		
			if(!dontIncr){
				incr(currentObject);
		
				obj.meta.id = findUnusedId(arr);
			}
			
			var found = false;

			var index = findElementInList(arr, id);
			
			if(index === undefined){
				console.log('*WARNING: ignoring invalid replace');//TODO standardize this sort of command-checking
				return;
			}

			arr.splice(index, 1, obj);
		}
		
		
	}
	
	function findElementInList(arr, id){
		_.assertLength(arguments, 2);
		console.log('finding ' + id);
		console.log('in array: ' + JSON.stringify(arr));
		for(var i=0;i<arr.length;++i){
			var e = arr[i];
			if(_.isInteger(e)){
				if(e === id){
					return i;
				}
			}else{
				if(e.meta.id === id){
					return i;
				}
			}
		}
	}
	

	function removeCurrentPrimitive(value, currentObject){
		
		var arr = getCurrentCollection(currentObject, currentPath);
	
		if(arr === undefined){
			console.log('WARNING: ignoring invalid remove');//TODO standardize this sort of command-checking
			return;
		}

		_.assertArray(arr)
		var index = arr.indexOf(value);
		
		if(index === -1){
			console.log('*WARNING: ignoring invalid remove');//TODO standardize this sort of command-checking
			return;
		}
		
		arr.splice(index, 1);

		incr(currentObject);
	}
	
	function removeCurrent(currentObject){
		_.assertLength(arguments, 1);

		//var typeCode = currentPath[currentPath.length-2];
		var id = currentPath[currentPath.length-1];
		
		//_.assertInt(typeCode);
		//
		var path = currentPath.slice(0, currentPath.length-1);
		var arr = getCurrentCollection(currentObject, path);
	
		if(arr === undefined){
			console.log('WARNING: ignoring invalid remove');//TODO standardize this sort of command-checking
			return;
		}
		_.assertArray(arr)
		var index = findElementInList(arr, typeCode, id);
		
		if(index === undefined){
			console.log('*WARNING: ignoring invalid remove');//TODO standardize this sort of command-checking
			return;
		}
		
		arr.splice(index, 1);

		incr(currentObject);
	}
	
	function modifyCurrent(currentObject, modifierFunction){
		_.assertLength(arguments, 2);
		_.assertObject(currentObject);
		_.assertFunction(modifierFunction);

		_.assertObject(currentObject);
		_.assertNot(_.isArray(currentObject));

		var lastCode = currentPath[currentPath.length-1];
		_.assertInt(lastCode);
		var obj = selectPathParent(schema, currentObject, currentPath);
		if(obj === undefined){
			_.errout('evaluating path: ' + JSON.stringify(currentPath) + 
				' failed against object: ' + JSON.stringify(currentObject));
		}
		_.assertObject(obj);
		if(_.isArray(obj)) _.errout('object is array: ' + JSON.stringify(obj));
		_.assertNot(_.isArray(obj));

		var oldValue = obj[lastCode];

		obj[lastCode] = modifierFunction(oldValue);
		
		if(currentPath.length === 1){
			_.assert(currentObject === obj);
			var currentType = currentObject.meta.typeCode
			indexing.updateIndexingOnProperty(currentType, obj, lastCode, oldValue);
		}
		
		//incr(currentObject);
	}
	function setCurrent(currentObject, v){
		modifyCurrent(currentObject, function(oldValue){
			return v;
		})
	}
	/*
	function setCurrent(currentObject, v){
		_.assertLength(arguments, 2);
		_.assertObject(currentObject);
		_.assertDefined(v);

		_.assertObject(currentObject);
		_.assertNot(_.isArray(currentObject));

		var lastCode = currentPath[currentPath.length-1];
		_.assertInt(lastCode);
		var obj = selectPathParent(schema, currentObject, currentPath);
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
			var currentType = currentObject.meta.typeCode
			indexing.updateIndexingOnProperty(currentType, obj, lastCode, oldValue);
		}
		
		incr(currentObject);
	}*/
	
	
	//var currentType;
	var currentId;
	var currentPath = [];

	//var currentObject;
	//var currentSchema;

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
			ap.ascend({many: manyToAscend});
		}
		var remaining = path.slice(manyShared);
		if(remaining.length > 0){
			ap.descend({path: JSON.stringify(remaining)});
		}
		currentPath = path;
		
		//console.log('shifted to path: ' + JSON.stringify(path));
		
	}

	function refreshIndexing(typeCode, id, obj){
		var keys = Object.keys(obj);
		for(var i=0;i<keys.length;++i){
			var propertyCode = keys[i];
			if(propertyCode !== 'meta'){
				var pc = parseInt(propertyCode);
				//console.log('updating property indexing: ' + typeCode + ' ' + pc);
				indexing.updateIndexingOnProperty(typeCode, obj, pc, undefined);
			}
		}
		
		extractAndRecordObjectInverseRelationships(typeCode, obj);
	}
	
	function makeNew(typeCode, versionId){
		_.assertInt(versionId)
		var obj = ol.make({}, typeCode, versionId);
		//obj.meta.id = id;
		//++alreadyCreated[typeCode];
		//++manyCreated[typeCode];
		//_.assertInt(id)
		return obj.meta.id;
	}
	
	var internalHandle = {
		setId: function(e){
			//ap.setId(id);
			console.log('internal setId: ' + JSON.stringify(e))
			_.assertInt(e.id);
			currentId = e.id;
		},
		setTypeAndId: function(e){
			//ap.setTypeAndId(typeCode, id);
			//console.log('internal setTypeAndId: ' + JSON.stringify(e))
			currentType = e.typeCode;
			currentId = e.id;
		},
		ascend: function(e){
			//ap.ascend(many);
			var many = JSON.parse(e.many);
			currentPath = currentPath.slice(0, currentPath.length-many);
		},
		descend: function(e){
			//ap.descend(path);
			var path = JSON.parse(e.path);
			currentPath = currentPath.concat(path);
		},
		set: function(e){
			_.assertDefined(e.value);
			ol.change(currentId, function(obj){
				setCurrent(obj, e.value);
			})
		},
		putNew: function(e, editId){
			_.assertDefined(e.key);
			var newId;
			ol.change(currentId, function(currentObject){
			
				if(e.external){
					var id = makeNew(e.newType, editId);
				
					ol.change(id, function(obj){
			
						var m = getOrMakeCurrentCollection(currentObject, currentPath);
						m[e.key] = id;
						recordInverse(id, currentObject.meta.typeCode, currentId);

						++editCount;
						obj.meta.editId = editCount;
					})
					newId = id;
				}else{
					_.errout('TODO')
				}
			})
			return newId;
		},
		setData: function(e){
			_.assertDefined(e.data);
			ol.change(currentId, function(obj){
				setCurrent(obj, e.data);
			})
		},
		truncate: function(e){
			_.assertInt(e.newLength);
			ol.change(currentId, function(obj){
				modifyCurrent(obj, function(oldBuffer){
					if(oldBuffer === undefined) return undefined;
					
					_.assertBuffer(oldBuffer)
					return oldBuffer.slice(0, e.newLength);
				});
			})
		},
		append: function(e){
			ol.change(currentId, function(obj){
				modifyCurrent(obj, function(oldBuffer){
					var oldLen = oldBuffer ? oldBuffer.length : 0
										
					var nb = new Buffer(oldLen+e.data.length);
					if(oldBuffer) oldBuffer.copy(nb);
					e.data.copy(nb, oldLen);
					return nb;
				});
			})
		},
		writeData: function(e){
			_.assertInt(e.position);
			ol.change(currentId, function(obj){
				modifyCurrent(obj, function(old){
					var oldLen = old ? old.length : 0
					if(e.position+e.data.length > oldLen){
						var nb = new Buffer(e.position+e.data.length);
						if(old) old.copy(nb);
						old = nb;
					}
					e.data.copy(old, e.position);
					return old;
				});
			})
		},
		setObject: function(e){
			_.assertInt(e.typeCode);
			//ap.set(v);
			ol.change(currentId, function(currentObject){
				setCurrent(currentObject, e.v, e.typeCode);
			})
		},
		remove: function(){
			ap.remove();
			
			ol.change(currentId, function(currentObject){
				removeCurrent(currentObject);
			})
		},
		removePrimitive: function(e){
			ol.change(currentId, function(currentObject){
				removeCurrentPrimitive(e.value, currentObject);
			})
		},
		add: function(e){
			_.assertDefined(e.value);
			//ap.add(value);

			console.log('current(' + currentId + '): ' + JSON.stringify(currentPath));
			ol.change(currentId, function(obj){
				addPrimitive(obj, e.value);
				console.log('currentObject(' + currentId + '): ' + JSON.stringify(obj))
			})
		},
		shift: function(){
			
			ol.change(currentId, function(currentObject){
				console.log('currentObject(' + currentId + '): ' + JSON.stringify(currentObject))
				var arr = getCurrentCollection(currentObject, currentPath);
			
				//console.log('current(' + currentType + ' ' + currentId + '): ' + JSON.stringify(currentPath));
				if(arr.length > 0){

					//console.log('shifting(' + arr.length + '): ' + JSON.stringify(arr))
					arr.shift();
					incr(currentObject);
				}else{
					console.log('WARNING: shifting empty list');
				}
			})
		},
		setToNew: function(e, editId){

			var typeCode = e.newType;
			//var obj = {meta: {typeCode: typeCode}};
			
			var newObj
			
			ol.change(currentId, function(currentObject){
				if(e.external){

					newObj = ol.make({}, typeCode, editId);
					var id = newObj.meta.id
					//obj.meta.id = id;
				
					ol.change(id, function(obj){
				
						//++alreadyCreated[typeCode];
						//++manyCreated[typeCode];
						
						setCurrent(currentObject, id);			
						recordInverse(id, currentObject.meta.typeCode, currentId);

						//++editCount;
						//obj.meta.editId = editCount;
					})
				
					return id;
				}else{
			
					mo.change(currentId, function(currentObject){
						addCurrent(currentObject, obj);
					})
			
				}
			})
			return newObj.meta.id;
		},
		addNewExternal: function(e, editId){
			_.assertInt(editId)

			var typeCode = e.newType;
			_.assertInt(typeCode);

			var obj = ol.make({}, typeCode, editId);
			var id = obj.meta.id
			ol.change(id, function(obj){

				ol.change(currentId, function(currentObject){
					var arr = getOrMakeCurrentCollection(currentObject);
					arr.push(id);
					var currentType = currentObject.meta.typeCode;
					recordInverse(id, currentType, currentId);
				});
					
			})
			
			return id;
		},
		addNewInternal: function(e, editId){
			_.assertInt(editId)
			//console.log('e: ' + JSON.stringify(e))
			//var typeCode = e.newType;
			//_.assertInt(typeCode);
			
			var obj = e.obj.object//{meta: {typeCode: typeCode}};
			ol.change(currentId, function(currentObject, newVersionId){
				addCurrent(currentObject, obj);
				obj.meta.editId = newVersionId
			})
		
			return obj.meta.id;
		},
		addExisting: function(e){
			var id = e.id;
			//_.assertInt(typeCode);
			_.assertInt(id);

			//ap.addExisting(typeCode, id);
			
			var arr = getOrMakeCurrentCollection();
			//var t = computePathType(schema, currentPath);
			//if(t.type.type === 'set'){
				arr.push(id);
			//}else{
			//	arr.push([typeCode, id]);
			//}
			incr(currentObject);		
			recordInverse(id, currentId);
		},
		replaceExisting: function(e){
			/*//_.assertInt(typeCode);
			var id = e.id;
			_.assertInt(id);
			
			//ap.replaceExisting(typeCode, id);

			replaceCurrent(id, true);

			//var oldTypeCode = currentPath[currentPath.length-2];
			var oldId = currentPath[currentPath.length-1];
			
			removeInverse(oldId, currentId);
			recordInverse(id, currentId);*/
			
			
			_.assert(currentPath.length > 1);
			
			var oldId = currentPath[currentPath.length-1];
			
			var newId = e.newId
			
			ol.change(currentId, function(currentObject, newVersionId){
				replaceCurrent(currentObject, newId, true);

				removeInverse(oldId, e.newType, currentId);
			})
						
			//var id = obj.meta.id;
			//_.assert(id >= 0);
			//return id;
		},
		replaceNew: function(e){
			//_.assertInt(e.newType);
			
			//console.log('currentPath: ' + JSON.stringify(currentPath))
			_.assert(currentPath.length > 1);
			
			//var oldTypeCode = currentPath[currentPath.length-2];
			var oldId = currentPath[currentPath.length-1];
			
			//ap.replaceNew(typeCode);
			
			var obj = e.obj.object
			
			ol.change(currentId, function(currentObject, newVersionId){

				//obj = {meta: {typeCode: e.newType, editId: newVersionId}};
				replaceCurrent(currentObject, obj);

				removeInverse(oldId, e.newType, currentId);
			})
						
			var id = obj.meta.id;
			_.assert(id >= 0);
			return id;
		},
		setEntireObject: function(typeCode, id, obj){//sets the current object state to the given one
			_.assertLength(arguments, 3);
			_.assertInt(typeCode);
			_.assertInt(id);
			_.assertObject(obj);

			var baseTypeCode = getBaseTypeCode(typeCode);
			
			//obj = state[baseTypeCode][id] = JSON.parse(JSON.stringify(obj));
			ol.change(id, function(co){
				Object.keys(co).forEach(function(key){
					delete co[key];
				})
				Object.keys(obj).forEach(function(key){
					co[key] = obj[key];
				})
			});
			//ap.setEntireObject(baseTypeCode, id, obj);
			incr(obj);

			refreshIndexing(typeCode, id, obj);
		},
		make: function(e, editId){

			//ap.make(e)
			
			//e = e.obj;

			//console.log('make: ' + JSON.stringify(e).slice(0,300));
			//_.assertInt(e.type);
			
			var typeCode = e.obj.type;
			var obj = e.obj.object;
			_.assertDefined(obj);
			_.assertInt(typeCode);
			
			var baseTypeCode = getBaseTypeCode(typeCode);
			
			if(obj.meta === undefined) obj.meta = {}
			//obj.meta.typeCode = typeCode;
			
			var realObj = ol.make(obj, typeCode, editId);
			/*_.assertInt(id)
			ol.change(id, function(obj){*/
				//obj.meta = {id: id, typeCode: typeCode};
						
				/*++alreadyCreated[baseTypeCode];
				++manyCreated[baseTypeCode];
				if(baseTypeCode !== typeCode){
					++manyCreated[typeCode];//TODO increment all intervening types
				}*/
			
				//incr(obj);
			
			refreshIndexing(typeCode, realObj.meta.id, realObj);
			
			return realObj.meta.id;
			//})	
			//_.assertInt(e.id)
			//return id;		
			//return ol.get(id);
		},
		cacheObject: function(typeCode, id, obj){
			ol.cache(id, obj);
		}
	};
	
	var broadcaster;

	var temporaryPaths = {};
	var temporaryIds = {};
	
	function translateWithTemporaries(path, syncId){
		var tp = temporaryPaths[syncId];
		var result;
		if(tp === undefined){
			//console.log('syncId: ' + syncId);
			result = path;
		}else{
			result = [].concat(path);
		
			//note that this is an iterative process - the fact that early (subpath) temporary ids will be translated
			//before later ones (since they are inserted in order) is important.
			for(var i=0;i<tp.length;++i){
				var tpe = tp[i];
				var tpath = tpe.path
				if(tpath.length >= result.length){
					continue;
				}else{
					console.log('trying tpath: ' + JSON.stringify(tpath))
					console.log('tpe: ' + JSON.stringify(tpe))
					for(var j=0;j<tpath.length;++j){
						if(tpath[j] !== result[j]){
							break;
						}
					}
					if(j === tpath.length){
						if(/*result[tpath.length] === tpe.type && */
							result[tpath.length] === tpe.temporary){
							//matched temporary
							console.log('matched temporary(' + tpe[1] + '): ' + tpe.temporary + ' translating to ' + tpe.id);
							result[tpath.length] = tpe.id;
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
	
	var temporaryIdsBySync = {};
	function translateTemporaryId(temp, syncId){
		_.assertInt(syncId)
		
		var real = temporaryIdsBySync[syncId].temporaryIds[temp];
		_.assertInt(real)
		return real;
	}
	function mapTemporaryId(temp, real, syncId){
		_.assertInt(syncId)
		var te = temporaryIdsBySync[syncId]
		if(te === undefined) te = temporaryIdsBySync[syncId] = {mappedIds: {}, temporaryIds: {}}
		
		if(te.mappedIds[real] !== undefined){
			_.errout('real id already mapped: ' + real);
		}
		if(te.temporaryIds[temp] !== undefined){
			_.errout('temporary id already mapped ' + temp + ' -> ' + temporaryIds[temp] + ', now being mapped to ' + real);
		}
		te.temporaryIds[temp] = real;
		te.mappedIds[real] = true;
	}
	
	var buffer = [];
	var retrieved = {};
	var retrieving = {};

	function processRetrieved(){
		_.errout('FIXME')
		while(buffer.length > 0){
			var typeCode = buffer[0][0];
			var id = buffer[0][1];
			if(retrieved[id] !== undefined || state[typeCode][id] !== undefined){
				persistEdit.apply(undefined, buffer[0]);
				delete retrieved[id];
				buffer.shift();
			}else{
				break;
			}
		}
	}
	function retrieveFunction(obj){
		_.assertDefined(obj)
		var id = obj.meta.id;
		retrieved[id] = obj;
		_.errout('FIXME')
		ap.cacheObject(id, obj);
		processRetrieved();
	}
	function hasObject(id){
		_.assertLength(arguments, 1)
		return mo.has(id);
	}
	function persistEditWrapper(id, path, op, edit, syncId,cb){
		_.assertString(op);

		//console.log('pre-processing op: ' + op)
		
		
		if(id < -1){
			var newId = translateTemporaryId(id, syncId);
			//console.log('translated temporary id ' + id + ' -> ' + newId);
			id = newId;
		}
		
		if(id >= 0 && !ol.has(id) && !retrieving[id]){//TODO what if the ol ceases to have while the edit is buffered behind other retrievals?
			retrieving[id] = true;
			//raf.getObject(id, retrieveFunction);
			ol.retrieve(id, retrieveFunction)
			buffer.push([id,path,op,edit,syncId]);
			console.log('*buffering edit: ' + buffer.length);
		}else if(buffer.length > 0){
			buffer.push([id,path,op,edit,syncId]);
			console.log('buffering edit: ' + buffer.length);
		}else{
			persistEdit.call(undefined, id,path,op,edit,syncId,cb);
		}
	}
	
	function persistEdit(id, path, op, edit, syncId, cb){
		_.assertLength(arguments, 6);

		_.assertObject(broadcaster);
		_.assertInt(id);
		_.assertInt(syncId);
		_.assertString(op);
		_.assertFunction(cb)
		
		//console.log('processing edit: ' + op + ' ' + JSON.stringify(path) + ' ' + JSON.stringify(edit).slice(0,300))
		
		function registerTemporary(type, temporary, newId, external, realPath){
			var tpa = temporaryPaths[syncId];
			if(tpa === undefined) tpa = temporaryPaths[syncId] = [];
			_.assertInt(temporary);
			_.assert(newId >= 0);
			realPath = realPath || path
			var tpe = {path: realPath, type: type, temporary: temporary, id: newId}
			tpa.push(tpe);//note that we are storing the *translated* path (with any subpath temporary ids already translated.)
			
			console.log('registered: ' + JSON.stringify(tpe))

			if(external){
				console.log('mapped: ' + temporary + ' -> ' + newId)
				mapTemporaryId(temporary, newId, syncId);
			}
		}
		if(op === 'make'){
			edit.editId = ap.make(edit);
			_.assertInt(edit.editId)
			var newId = internalHandle.make(edit, edit.editId)
			//_.assertInt(newId)
			//edit.objid = newId
			//edit.obj.object = obj;
			//edit.id = obj.meta.id;
			
			//_.assertInt(edit.id);
			//_.assert(edit.id >= 0);
			//_.assertInt(edit.obj.type);
			//_.assertInt(versionId)
			
			var type = edit.obj.object.meta.typeCode
			
			_.assertInt(type)

			registerTemporary(type, edit.temporary, newId, true)
			
			console.log('broadcasted creation: ' + type + ' ' + newId)

			broadcaster.input.objectCreated(type, newId, edit.editId);
			cb({id: newId});
			//console.log('made object: ' + edit.obj.type + ' ' + edit.id);
			return;
		}
		
		var oldPath = path;
		path = translateWithTemporaries(path, syncId);
		
		//console.log('translated path ' + JSON.stringify(oldPath) + ' -> ' + JSON.stringify(path));
		
		if(currentId !== id){
			internalHandle.setId({id: id});
			ap.setId({id: id})
		}
		shiftToPath(path);
		
		var editIdBefore = ap.getCurrentEditId()//editCount;
		
		var e = edit//JSON.parse(JSON.stringify(edit));
		//console.log('edit: ' + JSON.stringify(edit).slice(0,1000));
		
		if(op === 'set'){
			internalHandle.set(e,ap.set(e));
			;
		}else if(op === 'putNew'){
			var newId = internalHandle.putNew(e,ap.putNew(e));
			;
			
			registerTemporary(e.newType, e.temporary, newId, e.external)
		}else if(op === 'setObjectToJson'){
			
				//var oldObj = state[currentType][currentId];
				
				var oldObj = mo.get(currentId)
				_.assertDefined(oldObj);
				var obj = edit.object;
		
				obj.meta = JSON.parse(JSON.stringify(oldObj.meta));
		
				if(JSON.stringify(obj) === JSON.stringify(oldObj)){
					//console.log('ignoring non-change');
					return;
				}else{
					console.log('refresh change');
					console.log(JSON.stringify(oldObj));
					console.log(JSON.stringify(obj));
				}
				e.object = obj;

				internalHandle.setEntireObject(e,ap.setEntireObject(e))//currentType, currentId, obj);
				
				//TODO broadcast something

				//broadcaster.input.objectChanged(currentType, currentId, [],undefined,-2,-2);
				;
		}else if(op === 'setObject'){
			internalHandle.setObject(e,ap.setObject(e));
		}else if(op === 'setData'){
			internalHandle.setData(e,ap.setData(e));
		}else if(op === 'truncate'){
			internalHandle.truncate(e,ap.truncate(e));
		}else if(op === 'append'){
			internalHandle.append(e,ap.append(e));
		}else if(op === 'writeData'){
			internalHandle.writeData(e,ap.writeData(e));
		}else if(op === 'add'){
			internalHandle.add(e,ap.add(e));
		}else if(op === 'shift'){
			internalHandle.shift(ap.shift(e));
		}else if(op === 'setToNew'){
			var id = internalHandle.setToNew(e, ap.setToNew(e));
			e.id = id;
			if(e.external){
				registerTemporary(e.newType, e.temporary, id, e.external)
			}
		}else if(op === 'addNewInternal'){
			var id = internalHandle.addNewInternal(e, ap.addNewInternal(e));
			e.id = id
			registerTemporary(e.newType, e.temporary, id, false)
		}/*else if(op === 'addNewExternal'){
			var id = internalHandle.addNewExternal(e, ap.addNewExternal(e));
			e.id = id
			registerTemporary(e.newType, e.temporary, id, true)
		}*/else if(op === 'addExisting'){
			internalHandle.addExisting(e, ap.addExisting(e));
			
		}else if(op === 'replaceExisting'){
			if(e.newId < 0){
				e.newId = translateTemporaryId(e.newId, syncId)
			}
			internalHandle.replaceExisting(e, ap.replaceExisting(e));
			
		}else if(op === 'remove'){
			internalHandle.remove(ap.remove(e));
			;
		}else if(op === 'removePrimitive'){
			internalHandle.removePrimitive(e);
			//_.errout('TODO')
		}else if(op === 'replaceNew'){
			console.log('e: ' + JSON.stringify(e))
			_.assertInt(e.obj.object.meta.typeCode)
			
			var id = internalHandle.replaceNew(e, ap.replaceNew(e));
			_.assert(id >= 0);

			registerTemporary(e.newType, e.temporary, id, false, path.slice(0,path.length-1))
			e.id = id;

		}else{
			_.errout('TODO implement op: ' + op);
		}

		ol.get(currentId, function(obj){
			broadcaster.input.objectChanged(obj.meta.typeCode, currentId, currentPath, op, e, syncId, editIdBefore);
		})
	
	}		
	var externalHandle = {
		setBroadcaster: function(b){broadcaster = b;},
		persistEdit: persistEditWrapper,
		getInverse: function(id){
			_.assertLength(arguments, 1);
			//TODO when we implement the edits that cause this, implement the lookup/indexing for this
			//var lk = inverses[typeCode];
			var ts = inverses[id];
			if(ts === undefined) return [];
			else{
			
				var arr = [];
				_.each(ts, function(nts, typeCodeStr){
					var typeCode = parseInt(typeCodeStr);
					_.assertInt(typeCode)
					_.each(nts, function(count, idStr){
						arr.push([true, typeCode, parseInt(idStr)]);
					});
				});
				return arr;
			}
		},
		
		makeNewSyncId: makeNewSyncId,
		getSyncIdCounter: function(){//for RAFization only
			return syncIdCounter;
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
