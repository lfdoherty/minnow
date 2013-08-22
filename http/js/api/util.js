"use strict";

var _ = require('underscorem')

//exports.makeTemporaryId = makeTemporaryId

var lookup = require('./../lookup')
var editCodes = lookup.codes
var editNames = lookup.names

function stub(){}

function viewReadonlyFunction(){
	throw new Error('cannot modify a view object')
}
exports.viewReadonlyFunction = viewReadonlyFunction

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
	
	var res = [objType.name];

	_.each(objType.subTypes, function(v, subType){
		res = res.concat(recursivelyGetLeafTypes(schema[subType], schema));
	});
	return res;
}
exports.recursivelyGetLeafTypes = recursivelyGetLeafTypes

exports.getOnlyPossibleObjectPropertyType = function getOnlyPossibleType(local, property, typeName){
	_.assertLength(arguments, 3)

	var fullSchema = local.getFullSchema();
	var objSchema = fullSchema[property.type.object]
	var types = recursivelyGetLeafTypes(objSchema, fullSchema);
	
	if(typeName === undefined){
		//there must be a unambiguous type, or that type must be specified
		_.assertLength(types, 1);
		typeName = types[0];
	}
	
	//var tt = local.types();
	var found = false;
	for(var i=0;i<types.length;++i){
		if(types[i] === typeName){
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

exports.immediatePropertyFunction = function(){
	if(this.parent.put || this.parent.each){
		return this.parent.part
	}else{
		//_.assertInt(this.part)
		return this.part
	}
}

exports.primitiveChangeListener = function changeListener(subObj, key, op, edit, syncId, editId){

	/*if(syncId === this.getEditingId()){
		console.log('same sync, ignoring')
		return stub;//TODO deal with local/global priority
	}*/
	//console.log('pcl: ' + JSON.stringify({op: op, edit: edit, syncId: syncId, editId: editId}))
	/*if(!isNotExternal){
		if(this.edits === undefined) this.edits = []
		this.edits.push({op: op, edit: edit, syncId: syncId, editId: editId})
	}*/
	_.assertInt(op)
	
	if(lookup.isSetCode[op]){//op.indexOf('set') === 0){
		//if(syncId === this.getEditingId()) return

		if(this.obj === edit.value) return
		this.obj = edit.value;
		//console.log('primitive value set to: ' + this.obj + ' for ' + this.parent.ruid + ' ' + this.parent.objectId + ' ' + this.parent.typeSchema.name)
		this.emit(edit, 'set', edit.value, editId)
	}else if(op === editCodes.insertString){
		//if(syncId === this.getEditingId()) return
		
		//console.log('inserting: ' + edit.value + ' ' + syncId + ' ' + this.getEditingId())
		if(!this.obj){
			console.log('WARNING: ignoring insert of undefined string property: ' + edit.index + ' ' + edit.value)
		}else{
			this.obj = this.obj.substr(0, edit.index) + edit.value + this.obj.substr(edit.index)
			this.emit(edit, 'set', this.obj, editId)
		}
	}else{
		_.errout('-TODO implement op: ' + editNames[op] + ' ' + JSON.stringify(edit) + ' ' + JSON.stringify(lookup.isSetCode));
	}
	
	this._wasEdited = true
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
				var a = local.getObjectApi(idOrObject)//, local);
				if(a == undefined) _.errout('cannot find object: ' + idOrObject)
				res.push(a)
			}else{
				var a = local.wrapObject(idOrObject, [], local);
				if(a == undefined) _.errout('cannot find object: ' + idOrObject)
				res.push(a)
			}
		})
	}
	return res
}
exports.wrapCollection = wrapCollection

function adjustPathToPrimitiveSelf(){
	/*var remaining = this.parent.adjustPath(_.isArray(this.part) ? this.part[0] : this.part)
	if(remaining.length > 0){
		_.errout('logic error, cannot have descended into primitive: ' + JSON.stringify(remaining))
	}*/
	this.adjustTopObjectToOwn()
	this.adjustCurrentObject(this.getImmediateObject())
	if(this.parent.put){
		this.adjustCurrentProperty(this.parent.part)
		this.adjustCurrentKey(this.part, this.parent.keyOp)
	}else{
		this.adjustCurrentProperty(this.part[0]||this.part)
	}
}
exports.adjustPathToPrimitiveSelf = adjustPathToPrimitiveSelf

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

var primitiveTypeChecker = {
	string: function(v){_.assertString(v);},
	int: function(v){_.assertInt(v);},
	long: function(v){_.assertLong(v);},
	boolean: function(v){_.assertBoolean(v);},
	real: function(v){_.assertReal(v);}
}
function objectIdTypeChecker(v){
	_.assertInt(v)
	_.assert(v !== -1)
}

exports.getAddOperator = function(schema){
	var ts = typeSuffix[schema.type.members.primitive]
	if(ts === undefined) _.errout('TODO: ' + JSON.stringify(schema))
	return editCodes['add' + ts]
}
exports.getRemoveOperator = function(schema){
	var ts = typeSuffix[schema.type.members.primitive]
	if(ts === undefined) _.errout('TODO: ' + JSON.stringify(schema))
	return editCodes['remove' + ts]
}
exports.getSetAtOperator = function(schema){
	var ts = typeSuffix[schema.type.members.primitive]
	if(ts === undefined) _.errout('TODO: ' + JSON.stringify(schema))
	return editCodes['set' + ts+'At']
}
exports.getPutOperator = function(schema){
	var ts = typeSuffix[schema.type.value.primitive]
	if(ts === undefined) _.errout('TODO: ' + JSON.stringify(schema))
	return editCodes['put' + ts]
}
exports.getKeyOperator = function(schema){
	if(schema.type.key.type === 'primitive'){
		var ts = typeSuffix[schema.type.key.primitive]
	}else{
		return editCodes.selectObjectKey
	}
	if(ts === undefined) _.errout('TODO: ' + JSON.stringify(schema))
	return editCodes['select' + ts + 'Key']
}
/*exports.getKeyReOperator = function(schema){
	if(schema.type.key.type === 'primitive'){
		var ts = typeSuffix[schema.type.key.primitive]
	}else{
		return editCodes.reselectObjectKey
	}
	if(ts === undefined) _.errout('TODO: ' + JSON.stringify(schema))
	return editCodes['reselect' + ts + 'Key']
}*/
exports.makeKeyTypeChecker = function(schema){
	if(schema.type.key.type === 'primitive'){
		//var ts = typeSuffix[schema.type.key.primitive]
		var tc = primitiveTypeChecker[schema.type.key.primitive]
		_.assertDefined(tc)
		return tc
	}else{
		return objectIdTypeChecker//editCodes.reselectObjectKey
	}
	//if(ts === undefined) _.errout('TODO: ' + JSON.stringify(schema))
	//return editCodes['reselect' + ts + 'Key']	
}

exports.getSetOperator = function(schema){
	var ts = typeSuffix[schema.type.primitive]
	if(ts === undefined) _.errout('TODO: ' + JSON.stringify(schema))
	return editCodes['set' + ts]
}
