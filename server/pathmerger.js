
var _ = require('underscorem')

//var tcpShared = require('./tcp_shared')

function stub(){}

var log = require('quicklog').make('minnow/pathmerger')

var editFp = require('./tcp_shared').editFp
var editCodes = editFp.codes
var editNames = editFp.names
/*
function editsAreDifferent(op, a, b){
	if(editFp.isKeySelectCode[op]){//op === 'selectStringKey' || op === 'selectObjectKey' || op === 'selectIntKey' || op === 'reselectStringKey') {
		return a.key !== b.key
	}
	else if(op === editCodes.selectProperty || op === editCodes.reselectProperty) return a.typeCode !== b.typeCode
	else if(op === editCodes.selectObject || op === editCodes.reselectObject) return a.id !== b.id
	//console.log(op)
	return JSON.stringify(a) !== JSON.stringify(b)
}

function differentPathEdits(a, b){
	if(a.op === b.op) return editsAreDifferent(a.op, a.edit, b.edit)//false


	if(editFp.flipType[a.op] === b.op) return editsAreDifferent(a.op, a.edit, b.edit)//false
	return true
	//if(opsDifferent && b.op.substr(0,2) === 're') opsDifferent = b.op.substr(2) !== a.op
	//&& (a.op.substr(0,2) === 're' && a.op.substr(2) !== b.op) && b.op.substr(2) !== a.op)
	//if(opsDifferent || editsAreDifferent(a.op, a.edit, b.edit)) return true//JSON.stringify(a.edit) !== JSON.stringify(b.edit)) return true
}

exports.differentPathEdits = differentPathEdits

function editToMatch(curPath, newPath, cb){
	//console.log('editing to match: ' + JSON.stringify(curPath) + ' ' + JSON.stringify(newPath))
	var sameIndex = -1
	for(var i=0;i<newPath.length && i<curPath.length;++i){
	
		if(differentPathEdits(newPath[i], curPath[i])){
			//console.log('different at: ' + i)
			break;
		}
		sameIndex = i
	}
	if(sameIndex+1 < curPath.length){
		var many = curPath.length-(sameIndex+1)
		if(many === 1 && curPath.length === newPath.length){
			var newOp = newPath[newPath.length-1].op
			var oldOp = curPath[newPath.length-1].op//TODO optimize
			if(newOp === oldOp || (editNames[newOp].indexOf('re') === 0 && editNames[newOp].substr(2) === editNames[oldOp])){
				var op = newOp
				if(editNames[newOp].indexOf('re') !== 0) op = editCodes['re'+editNames[op]]
				cb(op, newPath[newPath.length-1].edit)
				return
			}
		}
		//console.log('ascending: ' + many)
		//console.log(JSON.stringify([curPath,newPath]))
		if(many === 1){
			cb(editCodes.ascend1, {})
		}else{
			cb(editCodes.ascend, {many: many})
		}
		curPath = curPath.slice(0, sameIndex+1)
	}
	if(curPath.length < newPath.length){
		//console.log('adding select: ' + curPath.length +' < ' + newPath.length)
		//console.log(new Error().stack)
		//console.log(JSON.stringify([curPath,newPath]))
		for(var i=curPath.length;i<newPath.length;++i){
			var pe = newPath[i]
			_.assertObject(pe)
			//console.log('op: ' + pe.op)
			if(editNames[pe.op].indexOf('re') === 0){
				cb(editCodes[editNames[pe.op].substr(2)], pe.edit)
			}else{
				cb(pe.op, pe.edit)
			}
		}
	}
}


//saveAp is for saving path-changing edits,
//otherwise we use callAp
function make(schema, ol, saveAp, callAp, forgetTemporaryAp, translateTemporary){//, notifyOfEdit){
	_.assertLength(arguments, 6)
	_.assertFunction(saveAp)
	_.assertFunction(callAp)
	_.assertFunction(forgetTemporaryAp)
	_.assertFunction(translateTemporary)
	//_.assertFunction(notifyOfEdit)
	
	var olMap = {}
	
	function advance(id, typeCode, path, syncId, list){
		//var list = olMap[id]
		
		var curPath = [].concat(path)

		//list.forEach(function(e){
		for(var i=0;i<list.length;++i){
			var e = list[i]

			if(e.type === editCodes.forgetTemporary){
				forgetTemporaryAp(e.real, e.temporary, e.syncId)
			}
			
			//console.log('id: ' + id)
			
			//log.info('path', e.path)
			//log.info('cur', curPath)

			//console.log('path: ' + JSON.stringify(e.path))
			//console.log('cur: ' + JSON.stringify(curPath))
			//console.log('current sync id: ' + e.syncId)
			editToMatch(curPath, e.path, function(op, edit){
				saveAp(typeCode, e.id, op, edit, e.syncId, Date.now())//TODO address serialization issue
			})

			curPath = [].concat(e.path)
			
			//console.log('advancing: ' + JSON.stringify(e))
			if(e.edit){
				callAp(typeCode, e.id, curPath, e.op, e.edit, e.syncId, e.computeTemporary, Date.now(), e.reifyCb)//TODO address serialization issue with timestamp
			}
		}
		delete olMap[id]
	}
	function take(id, path, op, edit, syncId, computeTemporary, reifyCb){

		if(olMap[id]){
			var e = {id: id, op: op, edit: edit, syncId: syncId, path: path, computeTemporary: computeTemporary, reifyCb: reifyCb}//, cb: cb}
			olMap[id].push(e)
		}else{
			var pu = ol.getObjectMetadata(id, function(typeCode, path, syncId){
				_.assertInt(typeCode)
				advance(id, typeCode, path, syncId, olMap[id])
			})
			if(pu){//fast-track when getObjectMetadata is a sync operation
			
				var typeCode = pu.getTypeCode()
				var curPath = pu.getPath()
				var previousSyncId = pu.getSyncId()
				
				//console.log('matching: ' + JSON.stringify(curPath))
				//console.log('to: ' + JSON.stringify(path))
				
				editToMatch(curPath, path, function(op, edit){
					saveAp(typeCode, id, op, edit, syncId, Date.now())//TODO address serialization issue
				})
				
				//console.log(editNames[op])

				if(edit){
					callAp(typeCode, id, path, op, edit, syncId, computeTemporary, Date.now(), reifyCb)//TODO address serialization issue with timestamp
				}
			}else{
				var e = {id: id, op: op, edit: edit, syncId: syncId, path: path, computeTemporary: computeTemporary, reifyCb: reifyCb}//, cb: cb}
				olMap[id] = [e]
			}
		}
	}
	
	take.updatePath = function(id, path, syncId){
		_.assert(id > 0)
		take(id, path, undefined, undefined, syncId)
	}
	
	take.forgetTemporary = function(real, temporary, syncId){
		var m = olMap[real]
		if(m){
			m.push({type: editCodes.forgetTemporary, real: real, temporary: temporary, syncId: syncId})
		}else{
			forgetTemporaryAp(real, temporary, syncId)
		}
	}
	
	return take
}*/

function editToMatch(c, n, cb){
	_.assertObject(c)
	_.assertObject(n)
	_.assertInt(n.property)
	if(n.object && c.object !== n.object){
		c.object = n.object
		cb(editCodes.selectObject, {id: n.object})
	}
	if(n.sub && c.sub !== n.sub){
		c.sub = n.sub
		if(_.isInt(n.sub)){
			cb(editCodes.selectSubObject, {id: n.sub})
		}else{
			cb(editCodes.selectSubViewObject, {id: n.sub})
		}
	}
	if(n.property !== c.property){
		c.property = n.property
		cb(editCodes.selectProperty, {typeCode: n.property})
	}
	if(n.key !== c.key){
		if(n.key === undefined) return
		//console.log('emitting key: ' + n.key)
		_.assertInt(n.keyOp)
		c.key = n.key
		c.keyOp = n.keyOp
		cb(n.keyOp, {key: n.key})
	}
}

exports.editToMatch = editToMatch

function make(){
	return {
		selectCurrentObject: function(id, objId){
			_.errout('TODO: get current object, saveAp the new one if it is changing')
		}/*,
		forgetTemporary = function(real, temporary, syncId){
			var m = olMap[real]
			if(m){
				m.push({type: editCodes.forgetTemporary, real: real, temporary: temporary, syncId: syncId})
			}else{
				forgetTemporaryAp(real, temporary, syncId)
		}*/
	
	}
}

exports.make = make
