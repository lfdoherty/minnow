
var _ = require('underscorem')

//var tcpShared = require('./tcp_shared')

function stub(){}

var log = require('quicklog').make('minnow/pathmerger')

function differentPathEdits(a, b){
	if(a.op !== b.op || JSON.stringify(a.edit) !== JSON.stringify(b.edit)) return true
}

function editToMatch(curPath, newPath, cb){
	//console.log('editing to match: ' + JSON.stringify(curPath) + ' ' + JSON.stringify(newPath))
	var sameIndex = -1
	for(var i=0;i<newPath.length && i<curPath.length;++i){
	
		if(differentPathEdits(newPath[i], curPath[i])){
			break;
		}
		sameIndex = i
	}
	if(sameIndex+1 < curPath.length){
		var many = curPath.length-(sameIndex+1)
		cb('ascend', {many: many})
		curPath = curPath.slice(0, sameIndex+1)
	}
	if(curPath.length < newPath.length){
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
			
			log.info('path', e.path)
			log.info('cur', curPath)

			//console.log('path: ' + JSON.stringify(e.path))
			//console.log('cur: ' + JSON.stringify(curPath))
			
			editToMatch(curPath, e.path, function(op, edit){
				saveAp(e.id, op, edit, e.syncId)
			})

			curPath = [].concat(e.path)
			
			
			callAp(typeCode, e.id, curPath, e.op, e.edit, e.syncId, e.computeTemporary)//, e.cb)
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
			ol.getObjectMetadata(id, function(typeCode, path, syncId){
				log.info('GOT OBJECT METADATA', [id, path])
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
