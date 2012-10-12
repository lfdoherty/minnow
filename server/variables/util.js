
/*
TODO standardize edit names (e.g. remove, addExisting)
*/

var _ = require('underscorem')

var typeSuffix = {
	int: 'Int',
	long: 'Long',
	string: 'String',
	boolean: 'Boolean',
	real: 'Real',
	timestamp: 'Long'
}

exports.setOp = function(t){
	if(t.type === 'primitive'){
		var ts = typeSuffix[t.primitive]
		if(ts === undefined) _.errout('TODO: ' + t.primitive)
		return 'set'+ts
	}else{
		return 'setObject'
	}
}

exports.putOp = function(t){
	if(t.value.type === 'primitive'){
		var ts = typeSuffix[t.value.primitive]
		if(ts === undefined) _.errout('TODO: ' + t.value.primitive)
		return 'put'+ts
	}else{
		return 'putObject'
	}
}

exports.putAddOp = function(t){
	_.assertDefined(t.value.members.primitive)
	var ts = typeSuffix[t.value.members.primitive]
	return 'putAdd'+ts
}
exports.putRemoveOp = function(t){
	_.assertDefined(t.value.members.primitive)
	var ts = typeSuffix[t.value.members.primitive]
	return 'putRemove'+ts
}
exports.selectKeyOp = function(t){
	return 'select'+(typeSuffix[t.key.primitive]||'Int')+'Key'
}

exports.addOp = function(t){
	if(t.members.type === 'primitive'){
		var ts = typeSuffix[t.members.primitive]
		if(ts === undefined) _.errout('TODO: ' + t.members.primitive)
		return 'add'+ts
	}else{
		return 'addExisting'
	}
}
exports.removeOp = function(t){
	if(t.members.type === 'primitive'){
		var ts = typeSuffix[t.members.primitive]
		if(ts === undefined) _.errout('TODO: ' + t.members.primitive)
		return 'remove'+ts
	}else{
		return 'remove'
	}
}
