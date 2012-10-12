"use strict";

var _ = require('underscorem')

//exports.makeTemporaryId = makeTemporaryId

function stub(){}

exports.genericObjectTypes = function types(){
	var fullSchema = this.getFullSchema();
	return recursivelyGetLeafTypes(this.typeSchema, fullSchema);
}

exports.genericCollectionTypes = function types(){
	var fullSchema = this.getFullSchema();
	var objectSchema = fullSchema[this.schema.type.members.object];
	return recursivelyGetLeafTypes(objectSchema, fullSchema);
}

function recursivelyGetLeafTypes(objType, schema){
	if(!objType.subTypes || _.size(objType.subTypes) === 0){
		return [objType.name];
	}
	
	var res = [];

	_.each(objType.subTypes, function(v, subType){
		res = res.concat(recursivelyGetLeafTypes(schema[subType], schema));
	});
	return res;
}
exports.recursivelyGetLeafTypes = recursivelyGetLeafTypes

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
	else if(typeSchema.type.members.primitive === 'boolean') return _.assertBoolean
	else _.errout('TODO: ' + typeSchema.type.members.primitive)
}

exports.primitiveChangeListener = function changeListener(op, edit, syncId, editId){

	if(syncId === this.getEditingId()){
		return stub;//TODO deal with local/global priority
	}
	//console.log('pcl: ' + JSON.stringify({op: op, edit: edit, syncId: syncId, editId: editId}))
	/*if(!isNotExternal){
		if(this.edits === undefined) this.edits = []
		this.edits.push({op: op, edit: edit, syncId: syncId, editId: editId})
	}*/
	
	if(op.indexOf('set') === 0){
		this.obj = edit.value;
		//console.log('primitive value set to: ' + this.obj)
		return this.emit(edit, 'set', edit.value, editId)
	}else{
		_.errout('-TODO implement op: ' + op + ' ' + JSON.stringify(edit));
	}
}

function findObj(arr, desiredId){
	_.assertInt(desiredId)
	//console.log('finding: ' + desiredId)
	//console.log(JSON.stringify(arr))
	//console.log('out of: ' + JSON.stringify(_.map(arr, function(v){return v.id();})))
	var res;
	for(var i=0;i<arr.length;++i){
		var a = arr[i]
		if(a._internalId() === desiredId){
			res = a
			break;
		}
	}
	return res
}
exports.findObj = findObj


function wrapCollection(local, arr){
	var res = []
	if(arr){
		arr.forEach(function(idOrObject){
			if(_.isInt(idOrObject) || _.isString(idOrObject)){
				var a = local.getObjectApi(idOrObject, local);
				res.push(a)
			}else{
				var a = local.wrapObject(idOrObject, [], local);
				res.push(a)
			}
		})
	}
	return res
}
exports.wrapCollection = wrapCollection

function adjustObjectCollectionPath(source){
	return this.parent.adjustPath(this.part)
	//console.log('adjust object collection path ' + source)
	/*var remainingCurrentPath = this.parent.adjustPath(this.part)
	console.log('remaining: ' + JSON.stringify(remainingCurrentPath))
	if(remainingCurrentPath.length === 0){
		console.log('zero -> ' + source)
		this.persistEdit('selectObject', {id: source})
		return []
	}else if(remainingCurrentPath[0] !== source){
		//console.log('different')
		if(remainingCurrentPath.length > 1){
			if(remainingCurrentPath.length < 6){
				//console.log('primitive ascending ' + remainingCurrentPath[0])
				this.persistEdit('ascend'+(remainingCurrentPath.length-1), {})
			}else{
				this.persistEdit('ascend', {many: remainingCurrentPath.length-1})
			}
		}else{
			//console.log('reselecting')
		}
		this.persistEdit('reselectObject', {id: source})
		return []
	}else{
		//console.log('same')
		return remainingCurrentPath.slice(1)
	}*/
}
exports.adjustObjectCollectionPath = adjustObjectCollectionPath

var typeSuffix = {
	string: 'String',
	int: 'Int',
	long: 'Long',
	boolean: 'Boolean',
	real: 'Real'
}
exports.getAddOperator = function(schema){
	var ts = typeSuffix[schema.type.members.primitive]
	if(ts === undefined) _.errout('TODO: ' + JSON.stringify(schema))
	return 'add' + ts
}
exports.getRemoveOperator = function(schema){
	var ts = typeSuffix[schema.type.members.primitive]
	if(ts === undefined) _.errout('TODO: ' + JSON.stringify(schema))
	return 'remove' + ts
}
exports.getPutOperator = function(schema){
	var ts = typeSuffix[schema.type.value.primitive]
	if(ts === undefined) _.errout('TODO: ' + JSON.stringify(schema))
	return 'put' + ts
}
exports.getKeyOperator = function(schema){
	if(schema.type.key.type === 'primitive'){
		var ts = typeSuffix[schema.type.key.primitive]
	}else{
		return 'selectObjectKey'
	}
	if(ts === undefined) _.errout('TODO: ' + JSON.stringify(schema))
	return 'select' + ts + 'Key'
}
exports.getSetOperator = function(schema){
	var ts = typeSuffix[schema.type.primitive]
	if(ts === undefined) _.errout('TODO: ' + JSON.stringify(schema))
	return 'set' + ts
}
