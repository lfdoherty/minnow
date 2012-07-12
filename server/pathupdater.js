"use strict";

var _ = require('underscorem')

function makePathUpdater(initialPath){
	var path = initialPath||[]
	var typeCode;
	var syncId;
	function update(e){
		var op = e.op
		console.log(JSON.stringify(e))
		if(op === 'made'){
			typeCode = e.edit.typeCode
		}else if(op === 'setSyncId'){
			syncId = e.edit.syncId
		}else if(op === 'reset'){
			path = []
		}else if(op === 'selectProperty'){
			_.assert(e.edit.typeCode > 0)
			path.push(e.edit.typeCode)
		}else if(op === 'reselectProperty'){
			_.assert(e.edit.typeCode > 0)
			path[path.length-1] = e.edit.typeCode
		}else if(op === 'selectObject'){
			//_.assert(e.edit.id > 0)
			path.push(e.edit.id)
		}else if(op === 'reselectObject'){
			//_.assert(e.edit.id > 0)
			path[path.length-1] = e.edit.id
		}else if(op === 'selectStringKey' || op === 'selectLongKey' || op === 'selectIntKey' || op === 'selectBooleanKey'){
			path.push(e.edit.key)
		}else if(op === 'reselectStringKey' || op === 'reselectLongKey' || op === 'reselectIntKey' || op === 'reselectBooleanKey'){
			path[path.length-1] = e.edit.key
		}else if(op === 'ascend'){
			path = path.slice(0, path.length-e.edit.many)
		}else if(op === 'ascend1'){
			console.log('pu-sourced ascend1')
			path = path.slice(0, path.length-1)
		}else if(op === 'ascend2'){
			path = path.slice(0, path.length-2)
		}else if(op === 'ascend3'){
			path = path.slice(0, path.length-3)
		}else if(op === 'ascend4'){
			path = path.slice(0, path.length-4)
		}else if(op === 'ascend5'){
			path = path.slice(0, path.length-5)
		}else{
			return false
		}
		return true
	}
	
	return {
		update: update,
		getPath: function(){
			return path
		},
		getTypeCode: function(){
			return typeCode
		},
		getSyncId: function(){
			return syncId
		}
	}
}

exports.make = makePathUpdater
