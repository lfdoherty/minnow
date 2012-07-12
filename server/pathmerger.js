
var _ = require('underscorem')

var tcpShared = require('./tcp_shared')

function stub(){}

//saveAp is for saving path-changing edits,
//otherwise we use callAp
function make(schema, ol, saveAp, callAp, translateTemporary){
	_.assertLength(arguments, 5)
	_.assertFunction(saveAp)
	_.assertFunction(callAp)
	_.assertFunction(translateTemporary)
	
	var olMap = {}
	
	function advance(id, typeCode, path, syncId){
		var list = olMap[id]
		
		var updater = tcpShared.makePathStateUpdater(schema, typeCode, function(id){
			return translateTemporary(id, syncId)
		})
		updater(path, stub)

		list.forEach(function(e){
			/*if(e.syncId !== syncId){
				saveAp(e.id, 'setSyncId', {syncId: e.syncId})
			}*/
			updater(e.path, function(op, edit){
				saveAp(e.id, op, edit, e.syncId)
			})
			
			var realPath = updater.getCurrentPath()
			console.log('path: ' + JSON.stringify(e.path))
			console.log('real: ' + JSON.stringify(realPath))

			callAp(typeCode, e.id, realPath, e.op, e.edit, e.syncId, e.computeTemporary, e.cb)
		})
		delete olMap[id]
	}
	function take(id, path, op, edit, syncId, computeTemporary, cb){
		_.assertFunction(cb)
		var e = {id: id, op: op, edit: edit, syncId: syncId, path: path, computeTemporary: computeTemporary, cb: cb}

		if(olMap[id]){
			olMap[id].push(e)
		}else{
			olMap[id] = [e]
			ol.getObjectMetadata(id, function(typeCode, path, syncId){
				console.log('GOT OBJECT METADATA: ' + JSON.stringify([id, path]))
				advance(id, typeCode, path, syncId)
			})
		}
	}
	
	return take
}

exports.make = make
