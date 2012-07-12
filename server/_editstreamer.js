
var _ = require('underscorem')

var pathControlEdits = [
	'reset', 
	'selectProperty', 'reselectProperty', 
	'selectObject', 'reselectObject', 
	'selectIntKey', 'selectStringKey', 'selectLongKey', 'selectBooleanKey',
	'reselectIntKey', 'reselectStringKey', 'reselectLongKey', 'reselectBooleanKey',
	'ascend', 'ascend1', 'ascend2', 'ascend3', 'ascend4', 'ascend5']
	
var isPathControlEdit = {}
pathControlEdits.forEach(function(op){isPathControlEdit[op] = true;})

function make(ol, broadcaster){
	_.assertLength(arguments, 2)
	
	var waiting = []
	
	function advance(){
		while(waiting.length > 0){
			var e = waiting[0]
			if(e.got !== false){
				waiting.shift()
				if(e.type === 'created'){
					console.log('CREATED: %%%%%%%%%%%%%5')
					broadcaster.input.objectCreated(e.data.typeCode, e.data.id, e.data.editId)
				}else if(e.type === 'changed'){
					broadcaster.input.objectChanged(e.got.typeCode, e.data.id, e.got.path, e.data.op, e.data.edit, e.data.syncId, e.data.editId)
				}else{
					_.errout('TODO: ' + e.type)
				}
			}else{
				return
			}
		}
	}
	var handle = {
		objectCreated: function(typeCode, id, editId){
			var e = {type: 'created', data: {typeCode: typeCode, id: id, editId: editId}}
			waiting.push(e)
			advance()
		},
		objectChanged: function(id, op, edit, syncId, editId){
			if(isPathControlEdit[op]) return
			
			var e = {type: 'changed', got: false, data: {id: id, op: op, edit: edit, syncId: syncId, editId: editId}}
			console.log('editstream changed: ' + JSON.stringify(e))
			waiting.push(e)
			ol.getObjectMetadata(id, function(typeCode, path){
				e.got = {typeCode: typeCode, path: path}
				advance()
			})
		}
	}
	
	return handle
}

exports.make = make
