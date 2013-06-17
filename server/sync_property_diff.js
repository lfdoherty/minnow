
var _ = require('underscorem')

exports.make = makePropertyDiffer

var u = require('./sync_util')

var editFp = require('./tcp_shared').editFp
var editCodes = editFp.codes
var editNames = editFp.names

function makePropertyDiffer(p){
	if(p.type.type === 'set' || p.type.type === 'list'){

		if(p.type.members.type === 'object'){
			return function(a,b){
				var changes = []
				if(!a){
					if(!b) return changes
					for(var i=0;i<b.length;++i){
						var v = b[i]
						//if(b.indexOf(v) < i) _.errout('TODO FIXME')
						changes.push({op: editCodes.addExisting, edit: {id: v}})
					}
					return changes
				}else if(!b){
					for(var i=0;i<a.length;++i){
						var v = a[i]
						changes.push({op: editCodes.selectSubObject, edit: {id: v}})
						changes.push({op: editCodes.remove, edit: {}})
					}
					return changes
				}
				
				var has = {}
				for(var i=0;i<a.length;++i){
					var v = a[i]
					has[v] = true
				}
				var hasB = {}
				for(var i=0;i<b.length;++i){
					var v = b[i]
					//if(b.indexOf(v) < i) _.errout('TODO FIXME: ' + JSON.stringify(p))
					if(!has[v]){
						changes.push({op: editCodes.addExisting, edit: {id: v}})
					}else{
						hasB[v] = true
					}
				}
				for(var i=0;i<a.length;++i){
					var v = a[i]
					if(!hasB[v]){
						changes.push({op: editCodes.selectSubObject, edit: {id: v}})
						changes.push({op: editCodes.remove, edit: {}})
					}
				}
				//console.log('diff ' + JSON.stringify([a,b,changes, p]))
				return changes
			}
		}else if(p.type.members.type === 'view'){
			return function(a,b){
				var has = {}
				for(var i=0;i<a.length;++i){
					var v = a[i]
					has[v] = true
				}
				var changes = []
				var hasB = {}
				for(var i=0;i<b.length;++i){
					var v = b[i]
					if(!has[v]){
						changes.push({op: editCodes.addExistingViewObject, edit: {id: v}})
					}else{
						hasB[v] = true
					}
				}
				for(var i=0;i<a.length;++i){
					var v = a[i]
					if(!hasB[v]){
						changes.push({op: editCodes.selectSubViewObject, edit: {id: v}})
						changes.push({op: editCodes.removeViewObject, edit: {}})
					}
				}
				//console.log('diff ' + JSON.stringify([a,b,changes]))
				return changes
			}
		}

		var addOp = u.getAddOp(p)
		var removeOp = u.getRemoveOp(p)
		
		return function(a,b){
			var has = {}
			var changes = []
			//console.log('diffing ' + JSON.stringify([a,b,]))
			if(!a){
				if(!b) return []
				
				for(var i=0;i<b.length;++i){
					var v = b[i]
					if(!has[v]){
						changes.push({op: addOp, edit: {value: v}})
					}
					hasB[v] = true
				}
				return changes
			}
			for(var i=0;i<a.length;++i){
				var v = a[i]
				has[v] = true
			}
			var hasB = {}
			for(var i=0;i<b.length;++i){
				var v = b[i]
				if(!has[v]){
					changes.push({op: addOp, edit: {value: v}})
				}
				hasB[v] = true
			}
			for(var i=0;i<a.length;++i){
				var v = a[i]
				if(!hasB[v]){
					changes.push({op: removeOp, edit: {value: v}})
				}
			}
			//console.log('changes: ' + JSON.stringify([changes,a,b,p]))
			return changes
		}
	}else if(p.type.type === 'object'){
		_.assertInt(editCodes.setObject)
		return function(a,b){
			if(a !== b){
				if(b === undefined){
					return [{op: editCodes.clearObject, edit: {}}]
				}else{
					return [{op: editCodes.setObject, edit: {id: b}}]
				}
			}
			return []
		}
	}else if(p.type.type === 'view'){
		_.assertInt(editCodes.setViewObject)
		return function(a,b){
			if(a !== b){
				if(b === undefined){
					_.errout('TODO')
				}else{
					return [{op: editCodes.setViewObject, edit: {id: b}}]
				}
			}
			return []
		}
	}else if(p.type.type === 'primitive'){
		var setOp = u.getSetOp(p)
		return function(a,b){
			if(a !== b){
				if(b === undefined){
					_.errout('TODO')
				}else{
					return [{op: setOp, edit: {value: b}}]
				}
			}
			return []
		}
	}else if(p.type.type === 'map'){
		var keyOp = u.getKeyOp(p.type.key)
		if(/*p.type.key.type === 'primitive' && */p.type.value.type === 'primitive'){
			var putOp = u.getPutOp(p.type.value)
			
			return function(a,b){
				var aKeys = Object.keys(a)
				var bKeys = Object.keys(b)
				
				var changes = []
				for(var i=0;i<aKeys.length;++i){
					var key = aKeys[i]
					if(b[key] === undefined){
						//changes.push({op: keyOp, edit: {key: key}})
						//_.errout('TODO remove key')
						changes.push({op: keyOp, edit: {key: key}})
						changes.push({op: editCodes.delKey, edit: {}})
					}
				}
				for(var i=0;i<bKeys.length;++i){
					var key = bKeys[i]
					if(a[key] === undefined){
						changes.push({op: keyOp, edit: {key: key}})
						changes.push({op: putOp, edit: {value: b[key]}})
					}
				}
				//console.log('diff map: ' + JSON.stringify([a, b, changes]))
				return changes
			}
		}else if(/*p.type.key.type === 'primitive' && */p.type.value.type === 'object'){
			//var putOp = getPutOp(p.type.value)
			return function(a,b){
				var aKeys = Object.keys(a)
				var bKeys = Object.keys(b)
				
				var changes = []
				for(var i=0;i<aKeys.length;++i){
					var key = aKeys[i]
					if(b[key] === undefined){
						//changes.push({op: keyOp, edit: {key: key}})
						_.errout('TODO remove key')
					}
				}
				for(var i=0;i<bKeys.length;++i){
					var key = bKeys[i]
					if(a[key] === undefined){
						changes.push({op: keyOp, edit: {key: key}})
						changes.push({op: editCodes.putExisting, edit: {id: b[key]}})
					}
				}
				return changes
			}
		}else if(/*p.type.key.type === 'primitive' && */p.type.value.type === 'view'){
			//var putOp = getPutOp(p.type.value)
			return function(a,b){
				var aKeys = Object.keys(a)
				var bKeys = Object.keys(b)
				
				var changes = []
				for(var i=0;i<aKeys.length;++i){
					var key = aKeys[i]
					if(b[key] === undefined){
						//changes.push({op: keyOp, edit: {key: key}})
						//_.errout('TODO remove key')
						changes.push({op: keyOp, edit: {key: key}})
						changes.push({op: editCodes.delKey, edit: {}})
					}
				}
				for(var i=0;i<bKeys.length;++i){
					var key = bKeys[i]
					if(a[key] === undefined){
						changes.push({op: keyOp, edit: {key: key}})
						changes.push({op: editCodes.putViewObject, edit: {id: b[key]}})
					}
				}
				return changes
			}
		}else if(/*p.type.key.type === 'primitive' && */p.type.value.type === 'set' && p.type.value.members.type === 'primitive'){
			var putAddOp = u.getPutAddOp(p.type.value.members)
			var putRemoveOp = u.getPutRemoveOp(p.type.value.members)
			return function(a,b){
				var aKeys = Object.keys(a)
				var bKeys = Object.keys(b)
				
				
				var changes = []
				for(var i=0;i<aKeys.length;++i){
					var key = aKeys[i]
					if(b[key] === undefined || b[key].length === 0){
						changes.push({op: keyOp, edit: {key: key}})
						changes.push({op: editCodes.delKey, edit: {}})
					}
				}
				for(var i=0;i<bKeys.length;++i){
					var key = bKeys[i]
					if(a[key] === undefined || a[key].length === 0){
						
						changes.push({op: keyOp, edit: {key: key}})
						
						var arr = b[key]
						for(var j=0;j<arr.length;++j){
							var v = arr[j]
							changes.push({op: putAddOp, edit: {value: v}})
						}
					}else{
						//_.errout('TODO diff sets')
						var aArr = a[key]
						var bArr = b[key]
						
						//console.log('arrs: ' + JSON.stringify([aArr, bArr]))
						
						changes.push({op: keyOp, edit: {key: key}})
						
						var has = {}
						for(var j=0;j<aArr.length;++j){
							var v = aArr[j]
							has[v] = true
						}
						//var changes = []
						var hasB = {}
						for(var j=0;j<bArr.length;++j){
							var v = bArr[j]
							if(!has[v]){
								changes.push({op: putAddOp, edit: {value: v}})
							}
							hasB[v] = true
						}
						for(var j=0;j<aArr.length;++j){
							var v = aArr[j]
							if(!hasB[v]){
								//console.log('removing: ' + v)
								changes.push({op: putRemoveOp, edit: {value: v}})
							}
						}
						//return changes
					}
				}
				//console.log('*diffing: ' + JSON.stringify([a,b,changes]))
				return changes
			}
		}else if(p.type.value.type === 'set' && p.type.value.members.type === 'object'){
			var putAddOp = u.getPutAddOp(p.type.value.members)
			var putRemoveOp = u.getPutRemoveOp(p.type.value.members)
			return function(a,b){
				var aKeys = a !== undefined ? Object.keys(a) : []
				var bKeys = b !== undefined ? Object.keys(b) : []
				
				
				var changes = []
				for(var i=0;i<aKeys.length;++i){
					var key = aKeys[i]
					if(!b || b[key] === undefined || b[key].length === 0){
						changes.push({op: keyOp, edit: {key: key}})
						changes.push({op: editCodes.delKey, edit: {}})
					}
				}
				for(var i=0;i<bKeys.length;++i){
					var key = bKeys[i]
					if(!a || a[key] === undefined || a[key].length === 0){
						
						changes.push({op: keyOp, edit: {key: key}})
						
						var arr = b[key]
						for(var j=0;j<arr.length;++j){
							var v = arr[j]
							changes.push({op: putAddOp, edit: {id: v}})
						}
					}else{
						//_.errout('TODO diff sets')
						var aArr = a[key]
						var bArr = b[key]
						
						//console.log('arrs: ' + JSON.stringify([aArr, bArr]))
						
						changes.push({op: keyOp, edit: {key: key}})
						
						var has = {}
						for(var j=0;j<aArr.length;++j){
							var v = aArr[j]
							has[v] = true
						}
						//var changes = []
						var hasB = {}
						for(var j=0;j<bArr.length;++j){
							var v = bArr[j]
							if(!has[v]){
								changes.push({op: putAddOp, edit: {id: v}})
							}
							hasB[v] = true
						}
						for(var j=0;j<aArr.length;++j){
							var v = aArr[j]
							if(!hasB[v]){
								//console.log('removing: ' + v)
								changes.push({op: putRemoveOp, edit: {id: v}})
							}
						}
						//return changes
					}
				}
				//console.log('**diffing: ' + JSON.stringify([a,b,changes,p]))
				return changes
			}
		}
	}
	_.errout('TODO: ' + JSON.stringify(p))//[p,[p.type.type === 'map', p.type.key.type === 'primitive', p.type.value.type === 'set', p.type.value.members.type === 'primitive']]))
}
