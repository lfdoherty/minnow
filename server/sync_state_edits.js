
var _ = require('underscorem')
var u = require('./sync_util')

var editFp = require('./tcp_shared').editFp
var editCodes = editFp.codes
var editNames = editFp.names

exports.make = makeViewStateConverter

function makeViewStatePropertyConverter(p){
	if(p.type.type === 'set' || p.type.type === 'list'){
		if(p.type.members.type === 'primitive'){
			var addOp = u.getAddOp(p)
			//_.assertInt(addOp)
			return function(state){
				if(!state) return []
				var edits = []
				for(var i=0;i<state.length;++i){
					edits.push({op: addOp, edit: {value: state[i]}})
				}
				return edits
			}
		}else if(p.type.members.type === 'object'){
			return function(state){
				if(!state) return []
				var edits = []
				for(var i=0;i<state.length;++i){
					edits.push({op: editCodes.addExisting, edit: {id: state[i]}})
				}
				return edits
			}
		}else if(p.type.members.type === 'view'){
			return function(state){
				if(!state) return []
				var edits = []
				for(var i=0;i<state.length;++i){
					edits.push({op: editCodes.addExistingViewObject, edit: {id: state[i]}})
				}
				return edits
			}
		}else{
		}
	}else if(p.type.type === 'map'){
		var keyOp = u.getKeyOp(p.type.key)
		//if(p.type.key.type === 'primitive'){
		if(p.type.value.type === 'set'){
			var putAddOp = u.getPutAddOp(p.type.value.members)
			if(p.type.value.members.type === 'primitive'){
				return function(state){
					if(!state) return []
					var edits = []
					var keys = Object.keys(state)
					for(var i=0;i<keys.length;++i){
						var key = keys[i]
						var value = state[key]
						
						edits.push({op: keyOp, edit: {key: key}})
						var arr = b[key]
						for(var j=0;j<arr.length;++j){
							var v = arr[j]
							edits.push({op: putAddOp, edit: {value: v}})
						}
					}
					return edits
				}
			}else if(p.type.value.members.type === 'object'){
				return function(state){
					if(!state) return []
					var edits = []
					var keys = Object.keys(state)
					for(var i=0;i<keys.length;++i){
						var key = keys[i]
						var value = state[key]
						
						edits.push({op: keyOp, edit: {key: key}})
						var arr = state[key]
						for(var j=0;j<arr.length;++j){
							var v = arr[j]
							edits.push({op: putAddOp, edit: {id: v}})
						}
					}
					return edits
				}
			}
		}else if(p.type.value.type === 'primitive'){
			var putOp = u.getPutOp(p.type.value)
			return function(state){
				if(!state) return []
				var edits = []
				var keys = Object.keys(state)
				for(var i=0;i<keys.length;++i){
					var key = keys[i]
					var value = state[key]
					
					edits.push({op: keyOp, edit: {key: key}})
					var v = state[key]
					edits.push({op: putOp, edit: {value: v}})
				}
				return edits
			}
		}else if(p.type.value.type === 'object' || p.type.value.type === 'view'){
			var putOp = p.type.value.type === 'object' ? editCodes.putExisting : editCodes.putViewObject
			return function(state){
				if(!state) return []
				var edits = []
				var keys = Object.keys(state)
				for(var i=0;i<keys.length;++i){
					var key = keys[i]
					var value = state[key]
					
					edits.push({op: keyOp, edit: {key: key}})
					edits.push({op: putOp, edit: {id: value}})
				}
				return edits
			}
		}
	}else if(p.type.type === 'primitive'){
		var setOp = u.getSetOp(p)
		return function(state){
			if(state !== undefined){
				return [{op: setOp, edit: {value: state}}]
			}else{
				return []
			}
		}
	}else if(p.type.type === 'object' || p.type.type === 'view'){
		var setOp = p.type.type === 'object' ? editCodes.setObject : editCodes.setViewObject
		_.assertInt(setOp)
		return function(state){
			if(state !== undefined){
				return [{op: setOp, edit: {id: state}}]
			}else{
				return []
			}
		}
	}else{
		return function(state){
			var edits = []
			_.errout('TODO: ' + JSON.stringify(state) + ' ' + JSON.stringify(p))
			return edits
		}
	}
	_.errout('TODO: ' + JSON.stringify(p))
}

function makeViewStateConverter(objSchema){

	function makeEdits(viewId){
		return [{
			op: editCodes.madeViewObject, 
			edit: {id: viewId, typeCode: objSchema.code}, 
			state: {top: viewId}, 
			//editId: -1000, 
			syncId: -1
		}]
	}
	if(!objSchema.properties){
		return function(viewId, state){return makeEdits(viewId);}
	}
	var propertyConverters = []
	
	Object.keys(objSchema.properties).forEach(function(propertyName){
		var p = objSchema.properties[propertyName]
		var pc = makeViewStatePropertyConverter(p)
		pc.code = p.code
		_.assertInt(pc.code)
		propertyConverters.push(pc)
	})
	return function(viewId, state){
		
		var edits = makeEdits(viewId)
		
		for(var i=0;i<propertyConverters.length;++i){
			var pc = propertyConverters[i]
			var pcEdits = pc(state[pc.code])
			if(pcEdits.length > 0){
				edits.push({op: editCodes.selectProperty, edit: {typeCode: pc.code}})
				edits = edits.concat(pcEdits)
			}
		}

		//console.log('converting ' + viewId + ' ' + JSON.stringify([state, edits]))

		return edits
	}
}
