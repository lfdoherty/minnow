
var _ = require('underscorem')

var temporaryIdCounter = -1;
function makeTemporaryId(){
	--temporaryIdCounter;
	return temporaryIdCounter
}
exports.makeTemporaryId = makeTemporaryId

function stub(){}

exports.getObject = function getObject(local, id){

	var localObjId;
	if(_.isInteger(id)){
		localObjId = id;
	}else{
		localObjId = id.meta.id
	}
	
	var a = local.getFromApiCache(localObjId);
	
	if(a === undefined){
		if(_.isInteger(id)){
			a = local.getObjectApi(id, local);
		}else{
			a = local.wrapObject(id, [], local);
		}
		local.addToApiCache(localObjId, a);
	}
	_.assertObject(a);
	return a;
}

exports.genericCollectionGet = function get(desiredId){
	_.assertLength(arguments, 1);
	
	if(this.obj === undefined){
		_.errout('unknown id: ' + desiredId);
	}
	
	var a = this.getFromApiCache(desiredId);
	if(a){
		a.prepare();
		return a;
	}
	
	var local = this;

	var arr = local.obj;

	for(var i=0;i<arr.length;++i){
		var idOrObject = arr[i];
		if(_.isInteger(idOrObject) || _.isString(idOrObject)){
			var id = idOrObject;
			if(desiredId === id){
				a = local.getObjectApi(id, local);
				_.assertObject(a);
				local.addToApiCache(id, a);
				a.prepare();
				return a;
			}
		}else{
			var obj = idOrObject;
			var localObjId = obj.meta.id
			if(desiredId === localObjId){

				a = local.wrapObject(obj, [], local);
				local.addToApiCache(desiredId, a);
				a.prepare();
				return a;
			}
		}
	}
	
	_.errout('unknown id: ' + desiredId);
}

exports.genericCollectionTypes = function types(){
	var fullSchema = this.getFullSchema();
	var objectSchema = fullSchema[this.schema.type.members.object];
	return recursivelyGetLeafTypes(objectSchema, fullSchema);
}

function recursivelyGetLeafTypes(objType, schema){
	if(_.size(objType.subTypes) === 0){
		return [objType.name];
	}
	
	var res = [];
	//if(!objType.superTypes.abstract) res.push(objType.name)
	_.each(objType.subTypes, function(v, subType){
		res = res.concat(recursivelyGetLeafTypes(schema[subType], schema));
	});
	return res;
}

exports.getOnlyPossibleType = function getOnlyPossibleType(local, typeName){
	if(typeName === undefined){
		//there must be a unambiguous type, or that type must be specified
		_.assertLength(local.types(), 1);
		typeName = local.types()[0];
	}
	
	var tt = local.types();
	var found = false;
	for(var i=0;i<tt.length;++i){
		if(tt[i] === typeName){
			found = true;
			break;
		}
	}
	
	_.assert(found);
	
	var type = local.getFullSchema()[typeName];
	_.assertObject(type);
	_.assertInt(type.code);//must not be an abstract type TODO provide better error
	
	return type;
}

exports.getPrimitiveCollectionAssertion = function(collectionType, typeSchema){
	if(typeSchema.type.members.primitive === 'string') return _.assertString
	else if(typeSchema.type.members.primitive === 'int') return _.assertInt
	else if(typeSchema.type.members.primitive === 'long') return _.assertNumber
	else _.errout('TODO: ' + typeSchema.type.members.primitive)
}

exports.primitiveChangeListener = function changeListener(path, op, edit, syncId){
	_.assertLength(path, 0);

	if(syncId === this.getEditingId()){
		return stub;//TODO deal with local/global priority
	}
	
	if(op === 'set'){
		this.obj = edit.value;
		return this.emit(edit, 'set')
	}else{
		_.errout('-TODO implement op: ' + JSON.stringify(edit));
	}
	
	//return this.refresh();
}

exports.doRefresh = function doRefresh(already, sourceOfRefresh, e){
	if(this.invalidated) _.errout('refresh called on invalid API object');
	
	already = JSON.parse(JSON.stringify(already));
	
	var cbs = [];
	if(this.refreshListeners){
		//console.log('got listeners');

		_.each(this.refreshListeners, function(listener, listenerName){
			if(already[listenerName]) return;
			already[listenerName] = true;
			//console.log('calling ' + listenerName + ' listener');
			var cb = listener(e, sourceOfRefresh);
			if(cb){
				_.assertFunction(cb);
				cbs.push(cb);
			}
		});
	}else{
		//console.log('ignoring refresh, no listeners');
	}

	if(this.parent){
		//console.log('refreshing upwards (' + this.constructor.name + ')');
		var cb = this.parent.doRefresh(already, false, e);
		_.assertFunction(cb);
		cbs = cbs.concat(cb);
	}
	//if(!this.parent && !this.refreshListeners){
	//	console.log('WARNING: refresh encountered neither parents nor listeners');
	//}
	
	return function(){
		for(var i=0;i<cbs.length;++i){
			cbs[i]();
		}
	}
}

exports.reifyTemporary = function reifyTemporary(arr, temporary, realId, local){
	//var realId = edit.id;
	_.assertInt(realId)
	
	console.log('reifying temporary ' + temporary + ' -> ' + realId);
	var did = false;
	
	var index = findListElement(arr, temporary);
	if(index === undefined){
		console.log('WARNING: cannot reify missing object (might be ok if removed): real(' + realId + ') temporary(' + temporary + ') ' + JSON.stringify(arr));
		return;
	}
	
	var e = arr[index];
	if(_.isInteger(e)){
		arr[index] = realId
		local.parent.reifyExternalObject(temporary, realId);
	}else{
		console.log(JSON.stringify(e))
		_.assertEqual(e.meta.id, temporary);
		e.meta.id = realId;
	}

	console.log('reified temporary id ' + temporary + ' -> ' + realId);

	var key = temporary;
	if(local.apiCache[key]){
		var newKey = realId;
		_.assert(local.apiCache[newKey] === undefined);
		local.apiCache[newKey] = local.apiCache[key];
		local.apiCache[key].objectId = realId;
		delete local.apiCache[key];
		console.log('reified api cache entry');
	}
}

function findListElement(arr, id){
	for(var i=0;i<arr.length;++i){
		var e = arr[i];
		if(_.isInteger(e)){
			if(e === id){
				return i;
			}
		}else{
			var obj = e;
			var eId = obj.meta.id
			if(id === eId){
				return i;
			}
		}
	}
}
exports.findListElement = findListElement
