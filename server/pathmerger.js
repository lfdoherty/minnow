
var _ = require('underscorem')

//var tcpShared = require('./tcp_shared')

function stub(){}

var log = require('quicklog').make('minnow/pathmerger')

function differentPathEdits(a, b){
	var opsDifferent = a.op !== b.op
	if(opsDifferent && a.op.substr(0,2) === 're') opsDifferent = a.op.substr(2) === b.op
	if(opsDifferent && b.op.substr(0,2) === 're') opsDifferent = b.op.substr(2) === a.op
	//&& (a.op.substr(0,2) === 're' && a.op.substr(2) !== b.op) && b.op.substr(2) !== a.op)
	if(opsDifferent || JSON.stringify(a.edit) !== JSON.stringify(b.edit)) return true
}

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
			var oldOp = curPath[newPath.length-1].op
			if(newOp === oldOp || (newOp.indexOf('re') === 0 && newOp.substr(2) === oldOp)){
				var op = newOp
				if(newOp.indexOf('re') !== 0) op = 're'+op
				cb(op, newPath[newPath.length-1].edit)
				return
			}
		}
		//console.log('ascending: ' + many)
		//console.log(JSON.stringify([curPath,newPath]))
		if(many === 1){
			cb('ascend1', {})
		}else{
			cb('ascend', {many: many})
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
			if(pe.op.indexOf('re') === 0){
				cb(pe.op.substr(2), pe.edit)
			}else{
				cb(pe.op, pe.edit)
			}
		}
	}
}

exports.editToMatch = editToMatch

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
	
	function advance(id, typeCode, path, syncId){
		var list = olMap[id]
		
		var curPath = [].concat(path)

		list.forEach(function(e){

			if(e.type === 'forgetTemporary'){
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
			
			callAp(typeCode, e.id, curPath, e.op, e.edit, e.syncId, e.computeTemporary, Date.now())//TODO address serialization issue with timestamp
		})
		delete olMap[id]
	}
	function take(id, path, op, edit, syncId, computeTemporary){
	//	_.assertFunction(cb)
		var e = {id: id, op: op, edit: edit, syncId: syncId, path: path, computeTemporary: computeTemporary}//, cb: cb}

		//for(var i=0;i<path.length;++i){_.assertObject(path[i]);}

		if(olMap[id]){
			olMap[id].push(e)
		}else{
			olMap[id] = [e]
			//console.log('taking: ' + JSON.stringify(e))
			ol.getObjectMetadata(id, function(typeCode, path, syncId){
				//log.info('GOT OBJECT METADATA', [id, path])
				_.assertInt(typeCode)
				advance(id, typeCode, path, syncId)
			})
		}
	}
	
	take.forgetTemporary = function(real, temporary, syncId){
		var m = olMap[real]
		if(m){
			m.push({type: 'forgetTemporary', real: real, temporary: temporary, syncId: syncId})
		}else{
			forgetTemporaryAp(real, temporary, syncId)
		}
	}
	
	return take
}

exports.make = make
