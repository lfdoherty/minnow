
var _ = require('underscorem')

var editFp = require('./tcp_shared').editFp
var editCodes = editFp.codes
var editNames = editFp.names

function getSetOp(p){
	var op
	if(p.type.type === 'primitive'){
		var primitive = p.type.primitive
		op = editCodes['set'+primitive.substr(0,1).toUpperCase()+primitive.substr(1)]
	}else{
		_.errout('TODO: ' + JSON.stringify(p))
	}
	_.assertInt(op)
	return op
}

function getAddOp(p){
	var addOp
	if(p.type.members.type === 'primitive'){
		var primitive = p.type.members.primitive
		addOp = editCodes['add'+primitive.substr(0,1).toUpperCase()+primitive.substr(1)]
	}else{
		_.errout('TODO: ' + JSON.stringify(p))
	}
	_.assertInt(addOp)
	return addOp
}
function getRemoveOp(p){
	var op
	if(p.type.members.type === 'primitive'){
		var primitive = p.type.members.primitive
		op = editCodes['remove'+primitive.substr(0,1).toUpperCase()+primitive.substr(1)]
	}/*else if(p.type.members.type === 'object'){
		addOp = editCodes.removeExisting
	}*/else{
		_.errout('TODO')
	}
	_.assertInt(op)
	return op
}

function getPutAddOp(members){
	if(members.type === 'primitive'){
		var primitive = members.primitive
		op = editCodes['putAdd'+primitive.substr(0,1).toUpperCase()+primitive.substr(1)]
		_.assertInt(op)
		return op
	}else if(members.type === 'object'){
		return editCodes.putAddExisting
	}else{
		_.errout('tODO' + JSON.stringify(members))
	}
}
function getPutRemoveOp(members){
	if(members.type === 'primitive'){
		var primitive = members.primitive
		op = editCodes['putRemove'+primitive.substr(0,1).toUpperCase()+primitive.substr(1)]
		_.assertInt(op)
		return op
	}else if(members.type === 'object'){
		return editCodes.putRemoveExisting
	}else{
		_.errout('tODO' + JSON.stringify(members))
	}
}
function getKeyOp(key){
	if(key.type === 'primitive'){
		var primitive = key.primitive
		op = editCodes['select'+primitive.substr(0,1).toUpperCase()+primitive.substr(1)+'Key']
		_.assertInt(op)
		return op
	}else if(key.type === 'object'){
		return editCodes.selectObjectKey
	}else{
		_.errout('tODO: ' + JSON.stringify(key))
	}
}
function getPutOp(value){
	if(value.type === 'primitive'){
		var primitive = value.primitive
		op = editCodes['put'+primitive.substr(0,1).toUpperCase()+primitive.substr(1)]
		_.assertInt(op)
		return op
	}else{
		_.errout('tODO: ' + JSON.stringify(value))
	}
	
}

exports.getPutOp = getPutOp
exports.getKeyOp = getKeyOp
exports.getPutRemoveOp = getPutRemoveOp
exports.getPutAddOp = getPutAddOp
exports.getRemoveOp = getRemoveOp
exports.getSetOp = getSetOp
exports.getAddOp = getAddOp

