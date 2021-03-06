
var _ = require('underscorem')

var fp = require('./tcp_shared').editFp
var editCodes = fp.codes
var editNames = fp.names

var innerify = require('./../http/js/innerId').innerify

/*

TODO: remove no longer referenced foreign ids?

*/

exports.make = function(){

	var index = {}
	var hasIndex = {}
	
	function addForeignId(id, foreignId){
		_.assertString(id)
		_.assertString(foreignId)
		
		var has = hasIndex[id]
		if(!has){
			has = hasIndex[id] = {}
			index[id] = []
		}
		if(!has[foreignId]){
			has[foreignId] = true
			var list = index[id]
			list.push(foreignId)
		}
	}
	
	var handle = {
		addEdit: function(id, op, edit, editId){
			if(op === editCodes.setObject){
				addForeignId(id, edit.id)
			}else if(op === editCodes.replaceExternalExisting || op === editCodes.replaceInternalExisting){
				addForeignId(id, edit.newId)
			}else if(op === editCodes.addExisting || op === editCodes.addAfter || op === editCodes.unshiftExisting){
				addForeignId(id, edit.id)
			}else if(op === editCodes.putExisting){
				addForeignId(id, edit.id)
			}else if(op === editCodes.putAddExisting){
				addForeignId(id, edit.id)
			}else if(op === editCodes.selectObjectKey){
				addForeignId(id, edit.key)
			}//else if(op === editCodes.selectObject){
			//	addForeignId(id, edit.id)
			//}
		},
		get: function(id){
			var arr = index[id]||[]
			//console.log('foreign ' + id + ' -> ' + JSON.stringify(arr))
			return [].concat(arr)
		}
	}
	return handle
}
