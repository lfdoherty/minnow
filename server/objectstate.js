"use strict";

var _ = require('underscorem');

var versions = require('./versions');

var set = require('structures').set;

var pathmerger = require('./pathmerger')
var pathsplicer = require('./pathsplicer')

//var isPathOp = require('./editutil').isPathOp

var editFp = require('./tcp_shared').editFp
var editCodes = editFp.codes
var editNames = editFp.names

var log = require('quicklog').make('minnow/objectstate')

/*
function makeSelectByMultiplePropertyConstraints(indexing, handle){

	return function(typeCode, descentPaths, filterFunctions, cb){
		var start = Date.now();
	
		var matchedList = [];
		var failed = false;
	
		var cdl = _.latch(descentPaths.length, finish);

		_.times(descentPaths.length, function(k){
			var descentPath = descentPaths[k];
			var filterFunction = filterFunctions[k];
			indexing.selectByPropertyConstraint(typeCode, descentPath, filterFunction, function(m){
				if(m === undefined) failed = true
				matchedList[k] = m;
				cdl();
			});
		})
	
		function finish(){
			if(!failed){
				cb(matchedList);
			}else{
				log('going slow, failed');
				handle.getAllObjects(typeCode, function(objs){
		
					var matchedList = [];
					for(var k=0; k<descentPaths.length;++k){
						var descentPath = descentPaths[k];
						var filterFunction = filterFunctions[k];
						var matched = set.make()
						_.each(objs, function(obj){
							//TODO use a more complete descent method that can descend along FKs to top-level objects
							var v = objutil.descendObject(schema, typeCode, obj, descentPath);
							if(filterFunction(v)){
								matched.add(obj.meta.id);
							}
						});
						matchedList.push(matched);
						log('slow result ', k, ': ', matched.size(), ' - ', typeCode, ' ', descentPath);
					}
						
					cb(matchedList);
				});
			}
		}
	}
}*/

function errorStub(){_.errout('this should never be called');}

function makePathTracker(path){
	
	_.assert(path.length > 0)
	
	path = [].concat(path)
	
	//console.log('\n\nhere: ' + JSON.stringify(path))
	
	var matchingDepth = 0
	var depth = 0
	var lastPathOpWasKey;
	
	var f = function(e){
		var op = e.op
		//console.log(depth + ' ' + JSON.stringify(e))
		if(op === editCodes.selectProperty){
			if(matchingDepth === depth && path.length > depth){
				if(e.edit.typeCode === path[depth].edit.typeCode){
					++matchingDepth
				}
			}
			++depth
			lastPathOpWasKey = false
		}else if(editFp.isKeyCode[op]){
			if(editFp.isKeySelectCode[op]){
				++depth
			}else{
				//reselect, no depth change
			}
			lastPathOpWasKey = true
		}else if(op === editCodes.reselectProperty){
			if(matchingDepth >= depth-1){
				//log('reselecting: ', path, e.edit.typeCode, depth)
				if(path[depth-1].edit.typeCode === e.edit.typeCode){
					matchingDepth = depth
				}else{
					matchingDepth = depth-1
				}
			}
			lastPathOpWasKey = false
		}else if(op === editCodes.selectObject){
			//console.log('dd: ' + matchingDepth + ' ' + depth + ' ' + JSON.stringify(path))
			if(matchingDepth === depth && path.length > depth && path[depth].op === editCodes.selectObject && path[depth].edit.id === e.edit.id){
				++matchingDepth
			}
			++depth
			lastPathOpWasKey = false
		}else if(op === editCodes.reselectObject){
			if(path.length > depth-1){
				if(matchingDepth >= depth-1){
					if(path[depth-1] === undefined){
						_.errout('logic problem: ' + depth + ' ' + matchingDepth + ' ' + JSON.stringify(path))
					}
					if(path[depth-1].edit.id === e.edit.id){
						matchingDepth = depth
					}else{
						matchingDepth = depth-1
					}
				}
			}
			lastPathOpWasKey = false
		}else if(op === editCodes.ascend1){
			depth -= 1
			lastPathOpWasKey = false
		}else if(op === editCodes.ascend2){
			depth -= 2
			lastPathOpWasKey = false
		}else if(op === editCodes.ascend3){
			depth -= 3
			lastPathOpWasKey = false
		}else if(op === editCodes.ascend4){
			depth -= 4
			lastPathOpWasKey = false
		}else if(op === editCodes.ascend5){
			depth -= 5
			lastPathOpWasKey = false
		}else if(op === editCodes.ascend){
			depth -= e.edit.many
			lastPathOpWasKey = false
		}else if(op === editCodes.madeFork){
			//_.errout('TODO')
			depth = 0
			matchingDepth = 0
			lastPathOpWasKey = false
		}
		
		_.assert(depth >= 0)
		
		if(matchingDepth > depth) matchingDepth = depth
		//log(matchingDepth + ' -(' + depth + ')- ' + path.length)
		//log(JSON.stringify(e))
		
		if(matchingDepth > path.length) _.errout('matching depth has become too large: ' + editNames[op] + ' ' + JSON.stringify(path))
		
		if(depth === matchingDepth && matchingDepth === path.length) return true
		if(depth-1 === matchingDepth && matchingDepth === path.length && lastPathOpWasKey){
			//console.log('HERE: ' + JSON.stringify(e) + ' ' + JSON.stringify(path) + ' ' + depth)
			return true
		}
		return false
	}
	
	f.matchesSubsequence = function(){
		return depth === matchingDepth
	}
	f.getDepth = function(){
		return depth
	}
	
	return f
}

var differentPathEdits = require('./pathmerger').differentPathEdits

function differentPaths(a,b){
	var lastOp = b[b.length-1].op
	if(a.length === b.length-1 && (editFp.isKeyCode[lastOp] || lastOp === editCodes.selectObject || lastOp === editCodes.reselectObject)){
		for(var i=0;i<a.length;++i){
			var av = a[i];
			var bv = b[i]
			if(differentPathEdits(av,bv)) return true
		}
		return false
	}
	if(a.length !== b.length) return true
	for(var i=0;i<a.length;++i){
		var av = a[i];
		var bv = b[i]
		if(differentPathEdits(av,bv)){
			return true
		}
	}
}

var pvCache = {}

function makeObjectPropertyTracker(id, pc){
	//_.assert(path.length > 0)
	
	//path = [].concat(path)
	
	//console.log('\n\nhere: ' + JSON.stringify(path))
	
	//var matchingDepth = 0
	//var inProperty = false
	
	//var depth = 0
	var lastPathOpWasKey;
	
	var inProperty = false
	var inObj = false
	if(id.inner === undefined) inObj = true
	var f = function(e){
		var op = e.op
		//console.log(depth + ' ' + JSON.stringify(e))
		if(op === editCodes.selectProperty){
			
			if(e.edit.typeCode === pc){
				//++matchingDepth
				inProperty = true
			}else{
				inProperty = false
			}
			lastPathOpWasKey = false
		}else if(editFp.isKeyCode[op]){
		}else if(op === editCodes.selectObject){
			lastPathOpWasKey = false
			inObj = e.edit.id === id 
			if(id.inner) inObj = e.edit.id === id.inner
			//console.log(inObj + ' ' + id)
		}else if(op === editCodes.clearObject){
			inObj = id.inner === undefined
		}else if(op === editCodes.madeFork){
			if(id.inner === undefined) inObj = true
			inProperty = false
			lastPathOpWasKey = false
		}else if(op === editCodes.made){
			//inObj = e.edit.id === id
		}

		//console.log(inProperty + ' ' + lastPathOpWasKey + ' ' + JSON.stringify(e))
		
		//if((depth === 2 || depth === 1) && inProperty) return true
		//if(depth === 3 && inProperty && lastPathOpWasKey) return true
		return inObj && inProperty
	}
	
	f.matchesSubsequence = function(){
		return depth === matchingDepth
	}
	f.getDepth = function(){
		return depth
	}
	
	return f
}

/*
function makeObjectPropertyTracker(id, pc){
	//_.assert(path.length > 0)
	
	//path = [].concat(path)
	
	//console.log('\n\nhere: ' + JSON.stringify(path))
	
	//var matchingDepth = 0
	var inProperty = false
	
	var depth = 0
	var lastPathOpWasKey;
	
	var f = function(e){
		var op = e.op
		//console.log(depth + ' ' + JSON.stringify(e))
		if(op === editCodes.selectProperty){
			
			if(depth === 0){//matchingDepth === depth && path.length > depth){
				if(e.edit.typeCode === pc){
					//++matchingDepth
					inProperty = true
				}else{
					inProperty = false
				}
			}
			++depth
			lastPathOpWasKey = false
		}else if(editFp.isKeyCode[op]){
			if(editFp.isKeySelectCode[op]){
				++depth
			}else{
				//reselect, no depth change
			}
			//lastPathOpWasKey = true
		}else if(op === editCodes.reselectProperty){
			if(depth === 1){
				if(e.edit.typeCode === pc){
					inProperty = true
				}else{
					inProperty = false
				}
			}
			lastPathOpWasKey = false
		}else if(op === editCodes.selectObject){
			//console.log('dd: ' + matchingDepth + ' ' + depth + ' ' + JSON.stringify(path))
			//if(matchingDepth === depth && path.length > depth && path[depth].op === editCodes.selectObject && path[depth].edit.id === e.edit.id){
			//	++matchingDepth
			//}
			++depth
			lastPathOpWasKey = false
		}else if(op === editCodes.reselectObject){

			lastPathOpWasKey = false
		}else if(op === editCodes.ascend1){
			depth -= 1
			lastPathOpWasKey = false
		}else if(op === editCodes.ascend2){
			depth -= 2
			lastPathOpWasKey = false
		}else if(op === editCodes.ascend3){
			depth -= 3
			lastPathOpWasKey = false
		}else if(op === editCodes.ascend4){
			depth -= 4
			lastPathOpWasKey = false
		}else if(op === editCodes.ascend5){
			depth -= 5
			lastPathOpWasKey = false
		}else if(op === editCodes.ascend){
			depth -= e.edit.many
			lastPathOpWasKey = false
		}else if(op === editCodes.madeFork){
			//_.errout('TODO')
			depth = 0
			inProperty = false
			//matchingDepth = 0
			lastPathOpWasKey = false
		}
		
		_.assert(depth >= 0)


		console.log(depth + ' ' + inProperty + ' ' + lastPathOpWasKey + ' ' + JSON.stringify(e))
		
		if((depth === 2 || depth === 1) && inProperty) return true
		if(depth === 3 && inProperty && lastPathOpWasKey) return true
		return false
	}
	
	f.matchesSubsequence = function(){
		return depth === matchingDepth
	}
	f.getDepth = function(){
		return depth
	}
	
	return f
}*/
var innerify = require('./innerId').innerify

function indexOfRawId(arr, id){
	for(var i=0;i<arr.length;++i){
		var v = arr[i]
		if(typeof(v) === 'number'){
			if(v === id){
				return i
			}
		}else{
			if(v.inner === id){
				return i
			}
		}
	}
	return -1
}
function hasInnerId(arr, id){
	for(var i=0;i<arr.length;++i){
		var v = arr[i]
		if(typeof(v) === 'number'){
			if(v === id){
				return true
			}
		}else{
			if(v.inner === id){
				return true
			}
		}
	}
	return false
}

function advanceStateAndReportChange(objId, prop, changeReport, e){
	var op = e.op
	var syncId
	if(editFp.isSetCode[op]){
		if(editFp.isPrimitiveSetCode[op]){
			if(e.edit.value !== prop){
				_.assertDefined(e.edit.value)
				changeReport({type: 'set', value: e.edit.value, editId: e.editId, syncId: syncId})
				prop = e.edit.value
			}
		}else if(op === editCodes.setExisting || op === editCodes.setObject){
			if(e.edit.id !== prop){
				if(e.edit.id === undefined){
					changeReport({type: 'clear', editId: e.editId, syncId: syncId})
				}else{
					_.assertDefined(e.edit.id)
					changeReport({type: 'set', value: e.edit.id, editId: e.editId, syncId: syncId})
				}
				prop = e.edit.id
			}
		}else if(op === editCodes.setSyncId){
			syncId = e.edit.syncId
			_.assertInt(syncId)
		}else{
			_.errout('TODO: ' + op)
		}
	}else if(op === editCodes.setSyncId){
		syncId = e.edit.syncId
		_.assertInt(syncId)
	}else if(op === editCodes.wasSetToNew){
		//_.errout('TODO')
		prop = innerify(objId, e.edit.id)
		changeReport({type: 'set', value: prop, editId: e.editId, syncId: syncId})
	}else if(editFp.isAddCode[op]){
		if(prop === undefined) prop = []
		if(editFp.isPrimitiveAddCode[op]){
			if(prop.indexOf(e.edit.value) === -1){
				//console.log('added primitive: ' + e.edit.value)
				changeReport({type: 'add', value: e.edit.value, editId: e.editId, syncId: syncId})
				prop.push(e.edit.value)
			}
		}else if(op === editCodes.addExisting){
			if(prop.indexOf(e.edit.id) === -1){
				changeReport({type: 'add', value: e.edit.id, editId: e.editId, syncId: syncId})
				prop.push(e.edit.id)
			}
		}else if(op === editCodes.addedNew){
			var innerId = innerify(objId, e.edit.id)
			if(!hasInnerId(prop, innerId)){
				console.log('reporting change: ' + JSON.stringify({type: 'add', value: innerId, editId: e.editId, syncId: syncId}))
				changeReport({type: 'add', value: innerId, editId: e.editId, syncId: syncId})
				prop.push(innerId)
			}
		}else if(op === editCodes.unshiftExisting){
			if(prop.indexOf(e.edit.id) === -1){
				prop.unshift(e.edit.id)
			}
		}else if(op === editCodes.unshiftedNew){
			var innerId = innerify(objId, e.edit.id)
			if(!hasInnerId(prop, innerId)){//prop.indexOf(e.edit.id) === -1){
				//prop.push(e.edit.id)
				//prop.unshift(innerId)
				changeReport({type: 'unshift', value: e.edit.id, editId: e.editId, syncId: syncId})

			}
		}else if(op === editCodes.addAfter){
			if(prop.indexOf(e.edit.id) === -1){
				var beforeId = editPath[editPath.length-1].edit.id
				var beforeIndex = indexOfRawId(prop, beforeId)
				if(beforeIndex === -1){
					changeReport({type: 'add', value: e.edit.id, editId: e.editId, syncId: syncId})
					prop.push(e.edit.id)
				}else{
					changeReport({type: 'addAt', index: beforeIndex+1, value: e.edit.id, editId: e.editId, syncId: syncId})
					prop.splice(beforeIndex+1, 0, e.edit.id)
				}
			}
		}else if(op === editCodes.addedNewAfter){
			var innerId = innerify(objId, e.edit.id)
			if(!hasInnerId(prop, innerId)){//prop.indexOf(e.edit.id) === -1){
				var beforeId = editPath[editPath.length-1].edit.id
				var beforeIndex = indexOfRawId(prop, beforeId)
				if(beforeIndex === -1){
					changeReport({type: 'add', value: innerId, editId: e.editId, syncId: syncId})
					prop.push(innerId)
				}else{
					changeReport({type: 'addAt', index: beforeIndex+1, value: innerId, editId: e.editId, syncId: syncId})
					prop.splice(beforeIndex+1, 0, innerId)
				}
			}else{
				//TODO is this even possible?
			}
		}else{
			_.errout('TODO: ' + JSON.stringify(e))
		}
	}else if(editFp.isRemoveCode[op]){
		if(op === editCodes.remove){
			_.errout('TODO')
			
			var id = editPath[editPath.length-1].edit.id
			var i = indexOfRawId(prop, id)//prop.indexOf(id)
			if(i !== -1){
				c//onsole.log('removing object from property')
				changeReport({type: 'remove', value: e.edit.id, editId: e.editId, syncId: syncId})
				prop.splice(i, 1)
			}else{
				_.errout('TODO: ' + JSON.stringify([op, edit]))
			}						
		}else if(editFp.isPrimitiveRemoveCode[op]){
			var i = prop.indexOf(e.edit.value)
			if(i !== -1){
				changeReport({type: 'remove', value: e.edit.value, editId: e.editId, syncId: syncId})
				prop.splice(i, 1)
			}else{
				_.errout('TODO: ' + JSON.stringify([op, edit]))
			}
		}else{
			_.errout('TODO: ' + op)
		}
	}else if(op === editCodes.didPutNew){
		//_.errout('TODO: put')
		if(prop === undefined) prop = {}
		prop[lastKey] = innerify(objId, e.edit.id)
		changeReport({type: 'put', key: lastKey, value: prop[lastKey], editId: e.editId, syncId: syncId})
	}else if(editFp.isPutCode[op]){
		//_.errout('TODO: put')
		if(prop === undefined) prop = {}
		if(op === editCodes.putExisting){
			changeReport({type: 'put', key: lastKey, value: e.edit.id, editId: e.editId, syncId: syncId})
			prop[lastKey] = (e.edit.id)
		}else{
			_.assertDefined(e.edit.value)
			changeReport({type: 'put', key: lastKey, value: e.edit.value, editId: e.editId, syncId: syncId})
			prop[lastKey] = e.edit.value
			//_.errout('TODO: ' + op)
		}
	}else if(op === editCodes.refork){
		_.errout('TODO')
	}
	return prop
}
function advanceState(objId, prop, e, state){
	_.assertObject(state)
	var op = e.op
	
	//var lastKey
	
	if(editFp.isSetCode[op]){
		if(editFp.isPrimitiveSetCode[op]){
			if(e.edit.value !== prop){
				prop = e.edit.value
			}
		}else if(op === editCodes.setExisting || op === editCodes.setObject){
			if(e.edit.id !== prop){
				prop = e.edit.id
			}
		}else if(op === editCodes.setSyncId){
		}else{
			_.errout('TODO: ' + op)
		}
	}else if(op === editCodes.clearProperty){
		//_.errout('TODO')
		prop = undefined
	}else if(op === editCodes.selectSubObject){
		state.sub = e.edit.id
	}else if(op === editCodes.wasSetToNew){
		//_.errout('TODO')
		prop = innerify(objId, e.edit.id)
	}else if(editFp.isAddCode[op]){
		if(prop === undefined) prop = []
		if(editFp.isPrimitiveAddCode[op]){
			if(prop.indexOf(e.edit.value) === -1){
				//console.log('added primitive: ' + e.edit.value)
				prop.push(e.edit.value)
			}
		}else if(op === editCodes.addExisting){
			if(prop.indexOf(e.edit.id) === -1){
				prop.push(e.edit.id)
			}
		}else if(op === editCodes.addedNew){
			var innerId = innerify(objId.top||objId, e.edit.id)
			if(!hasInnerId(prop, innerId)){//prop.indexOf(e.edit.id) === -1){
				//prop.push(e.edit.id)
				prop.push(innerId)
			}
		}else if(op === editCodes.unshiftExisting){
			if(prop.indexOf(e.edit.id) === -1){
				prop.unshift(e.edit.id)
			}
		}else if(op === editCodes.unshiftedNew){
			var innerId = innerify(objId, e.edit.id)
			if(!hasInnerId(prop, innerId)){//prop.indexOf(e.edit.id) === -1){
				//prop.push(e.edit.id)
				prop.unshift(innerId)
			}
		}else if(op === editCodes.addAfter){
			if(prop.indexOf(e.edit.id) === -1){
				var beforeId = state.sub//editPath[editPath.length-1].edit.id
				var beforeIndex = indexOfRawId(prop, beforeId)
				if(beforeIndex === -1){
					prop.push(e.edit.id)
				}else{
					prop.splice(beforeIndex+1, 0, e.edit.id)
				}
			}
		}else if(op === editCodes.addedNewAfter){
			var innerId = innerify(objId, e.edit.id)
			if(!hasInnerId(prop, innerId)){//prop.indexOf(e.edit.id) === -1){
				var beforeId = state.sub//editPath[editPath.length-1].edit.id
				var beforeIndex = indexOfRawId(prop, beforeId)
				if(beforeIndex === -1){
					prop.push(innerId)
				}else{
					prop.splice(beforeIndex+1, 0, innerId)
				}
			}else{
				//TODO is this even possible?
			}
		}else{
			_.errout('TODO: ' + JSON.stringify(e))
		}
	}else if(editFp.isRemoveCode[op]){
		if(op === editCodes.remove){
			//_.errout('TODO')
			
			var id = state.sub//editPath[editPath.length-1].edit.id
			_.assertDefined(id)
			
			var i = indexOfRawId(prop, id)//prop.indexOf(id)
			if(i !== -1){
				//console.log('removing object from property')
				prop.splice(i, 1)
			}else{
				//_.errout('TODO: ' + JSON.stringify([op, state]))
				//just ignore
			}						
		}else if(editFp.isPrimitiveRemoveCode[op]){
			var i = prop.indexOf(e.edit.value)
			if(i !== -1){
				prop.splice(i, 1)
			}else{
				_.errout('TODO: ' + JSON.stringify([op, edit]))
			}
		}else{
			_.errout('TODO: ' + op)
		}
	}else if(op === editCodes.didPutNew){
		//_.errout('TODO: put')
		if(prop === undefined) prop = {}
		prop[state.key] = innerify(objId, e.edit.id)
	}else if(editFp.isPutCode[op]){
		//_.errout('TODO: put')
		if(prop === undefined) prop = {}
		if(op === editCodes.putExisting){
			prop[state.key] = (e.edit.id)
		}else{
			_.assertDefined(e.edit.value)
			prop[state.key] = e.edit.value
			//_.errout('TODO: ' + op)
		}
	}else if(op === editCodes.refork){
		//_.errout('TODO')//TODO?
	}
	return prop
}

function getPropertyValueChangesDuring(objId, propertyCode, edits){
	var prop;

	//console.log('streamProperty got ' + edits.length + ' edits, path: ' + JSON.stringify(path))
	//console.log('streamProperty got ' + edits.length + ' edits ' + editId + ' ' + objId + ' ' + propertyCode)
	//console.log(objId + ' edits: ' + JSON.stringify(edits))
	
	var tracker = makeObjectPropertyTracker(objId, propertyCode)
	
	//console.log(JSON.stringify(edits))
	
	//console.log('!!!! objId: ' + JSON.stringify(objId) + ', ' + propertyCode + ' has stream override: ' + (!!objId.stream))
	//console.log(new Error().stack)
	
	var lastKey
	
	var changes = []
	function changeReport(change){
		changes.push(change)
	}
	
	edits.forEach(function(e){
		
		var op = e.op
		var matching = tracker(e)

		_.assertInt(op)
		
		//console.log(matching, ' <- ', propertyCode + ' ' + editNames[e.op] + ' ' + JSON.stringify(e.edit))
		if(editFp.isKeyCode[op]){
			lastKey = e.edit.key
		}

		if(!matching){
			//console.log('not matching(' + JSON.stringify(objId) + ', ' + propertyCode + '): ' + JSON.stringify(e))
			return
		}
		
		//console.log('op: ' + editNames[op] + ' ' + JSON.stringify(e))
		
		prop = advanceStateAndReportChange(objId, prop, changeReport, e)
	})
	//log('streaming ', path, ':', prop)
	//console.log(' here streaming ' + JSON.stringify(prop))//, path, ':', prop)
	//console.log(JSON.stringify(edits))
	return changes
}
function getResultingPropertyValue(objId, propertyCode, edits, defaultValue){
	var prop = defaultValue;

	//console.log('streamProperty got ' + edits.length + ' edits, path: ' + JSON.stringify(path))
	//console.log('streamProperty got ' + edits.length + ' edits ' + editId + ' ' + objId + ' ' + propertyCode)
	//console.log(objId + ' edits: ' + JSON.stringify(edits))
	
	var tracker = makeObjectPropertyTracker(objId, propertyCode)
	
	//console.log(JSON.stringify(edits))
	
	//console.log('!!!! objId: ' + JSON.stringify(objId) + ', ' + propertyCode + ' has stream override: ' + (!!objId.stream))
	//console.log(new Error().stack)
	
	//var lastKey
	var state = {}
	//edits.forEach(function(e){
	for(var i=0;i<edits.length;++i){
		var e = edits[i]
		
		var op = e.op
		var matching = tracker(e)

		_.assertInt(op)
		
		//console.log(matching, state, ' <- ', editNames[e.op] + ' ' + JSON.stringify(e.edit))
		if(editFp.isKeyCode[op]){
			//lastKey = e.edit.key
			state.key = e.edit.key
		}

		if(!matching){
			//console.log('not matching(' + JSON.stringify(objId) + ', ' + propertyCode + '): ' + JSON.stringify(e))
			//return
			continue
		}
		
		//console.log('op: ' + editNames[op] + ' ' + JSON.stringify(e))
		
		prop = advanceState(objId, prop, e, state)
		if(prop === undefined) prop = defaultValue
	}
	//})
	//log('streaming ', path, ':', prop)
	//console.log(' here streaming ' + JSON.stringify(prop))//, path, ':', prop)
	//console.log(JSON.stringify(edits))
	return prop
}
//note that the path must not descend into a top-level object for this function
function makePropertyStream(broadcaster, objId, propertyCode, edits, editId, cb, continueListening, ol){

	//if(path.length !== 2) _.errout('TODO: ' + JSON.stringify(path))	

	//var objId = id//path[0].edit.id
	//var propertyCode = path[1].edit.typeCode
	
	//_.assert(ol.isTopLevelObject(objId))
	
	//_.errout('TODO')
	
	var prop;

	//console.log('streamProperty got ' + edits.length + ' edits, path: ' + JSON.stringify(path))
	//console.log('streamProperty got ' + edits.length + ' edits ' + editId + ' ' + objId + ' ' + propertyCode)
	console.log(objId + ' edits: ' + JSON.stringify(edits))
	
	var tracker = makeObjectPropertyTracker(objId, propertyCode)
	
	//console.log(JSON.stringify(edits))
	
	//console.log('!!!! objId: ' + JSON.stringify(objId) + ', ' + propertyCode + ' has stream override: ' + (!!objId.stream))
	//console.log(new Error().stack)
	
	var lastKey
	
	edits.forEach(function(e){
		
		var op = e.op
		var matching = tracker(e)

		_.assertInt(op)
		
		//console.log(matching, path, ' <- ', editNames[e.op] + ' ' + JSON.stringify(e.edit))
		if(editFp.isKeyCode[op]){
			lastKey = e.edit.key
		}

		if(!matching){
			//console.log('not matching(' + JSON.stringify(objId) + ', ' + propertyCode + '): ' + JSON.stringify(e))
			return
		}
		
		//console.log('op: ' + editNames[op] + ' ' + JSON.stringify(e))
		
		if(editFp.isSetCode[op]){
			if(editFp.isPrimitiveSetCode[op]){
				if(e.edit.value !== prop){
					prop = e.edit.value
				}
			}else if(op === editCodes.setExisting || op === editCodes.setObject){
				if(e.edit.id !== prop){
					prop = e.edit.id
				}
			}else if(op === editCodes.setSyncId){
			}else{
				_.errout('TODO: ' + op)
			}
		}else if(op === editCodes.wasSetToNew){
			//_.errout('TODO')
			prop = innerify(objId, e.edit.id)
		}else if(editFp.isAddCode[op]){
			if(prop === undefined) prop = []
			if(editFp.isPrimitiveAddCode[op]){
				if(prop.indexOf(e.edit.value) === -1){
					//console.log('added primitive: ' + e.edit.value)
					prop.push(e.edit.value)
				}
			}else if(op === editCodes.addExisting){
				if(prop.indexOf(e.edit.id) === -1){
					prop.push(e.edit.id)
				}
			}else if(op === editCodes.addedNew){
				var innerId = innerify(objId, e.edit.id)
				if(!hasInnerId(prop, innerId)){//prop.indexOf(e.edit.id) === -1){
					//prop.push(e.edit.id)
					prop.push(innerId)
				}
			}else if(op === editCodes.unshiftExisting){
				if(prop.indexOf(e.edit.id) === -1){
					prop.unshift(e.edit.id)
				}
			}else if(op === editCodes.unshiftedNew){
				var innerId = innerify(objId, e.edit.id)
				if(!hasInnerId(prop, innerId)){//prop.indexOf(e.edit.id) === -1){
					//prop.push(e.edit.id)
					prop.unshift(innerId)
				}
			}else if(op === editCodes.addAfter){
				if(prop.indexOf(e.edit.id) === -1){
					var beforeId = editPath[editPath.length-1].edit.id
					var beforeIndex = indexOfRawId(prop, beforeId)
					if(beforeIndex === -1){
						prop.push(e.edit.id)
					}else{
						prop.splice(beforeIndex+1, 0, e.edit.id)
					}
				}
			}else if(op === editCodes.addedNewAfter){
				var innerId = innerify(objId, e.edit.id)
				if(!hasInnerId(prop, innerId)){//prop.indexOf(e.edit.id) === -1){
					var beforeId = editPath[editPath.length-1].edit.id
					var beforeIndex = indexOfRawId(prop, beforeId)
					if(beforeIndex === -1){
						prop.push(innerId)
					}else{
						prop.splice(beforeIndex+1, 0, innerId)
					}
				}else{
					//TODO is this even possible?
				}
			}else{
				_.errout('TODO: ' + JSON.stringify(e))
			}
		}else if(editFp.isRemoveCode[op]){
			if(op === editCodes.remove){
				_.errout('TODO')
				
				var id = editPath[editPath.length-1].edit.id
				var i = indexOfRawId(prop, id)//prop.indexOf(id)
				if(i !== -1){
					c//onsole.log('removing object from property')
					prop.splice(i, 1)
				}else{
					_.errout('TODO: ' + JSON.stringify([op, edit]))
				}						
			}else if(editFp.isPrimitiveRemoveCode[op]){
				var i = prop.indexOf(e.edit.value)
				if(i !== -1){
					prop.splice(i, 1)
				}else{
					_.errout('TODO: ' + JSON.stringify([op, edit]))
				}
			}else{
				_.errout('TODO: ' + op)
			}
		}else if(op === editCodes.didPutNew){
			//_.errout('TODO: put')
			if(prop === undefined) prop = {}
			prop[lastKey] = innerify(objId, e.edit.id)
		}else if(editFp.isPutCode[op]){
			//_.errout('TODO: put')
			if(prop === undefined) prop = {}
			if(op === editCodes.putExisting){
				prop[lastKey] = (e.edit.id)
			}else{
				_.assertDefined(e.edit.value)
				prop[lastKey] = e.edit.value
				//_.errout('TODO: ' + op)
			}
		}else if(op === editCodes.refork){
			_.errout('TODO')
		}
	})
	//log('streaming ', path, ':', prop)
	//console.log(' here streaming ' + JSON.stringify(prop))//, path, ':', prop)
	//console.log(JSON.stringify(edits))
	cb(prop, editId)
	
	//console.log('listening for object: ' + JSON.stringify(objId))
	broadcaster.output.listenByObject(objId, function(state, op, edit, syncId, editId){
		//if(path.length > 1) return
		//var fullPath = [{op: editCodes.selectObject, edit: {id: id}}].concat(editPath)

		if(op === editCodes.refork){
			//TODO?
			return
		}
		
		_.assertObject(state)
		_.assertInt(op)
		_.assertInt(state.property)
		
		//var matched = false

		/*if(differentPaths(path, fullPath)){
			//console.log('edit does not match:\n' + JSON.stringify(fullPath) + '\n' + JSON.stringify(path) + '\n' + JSON.stringify([op, edit]) + ' ' + editNames[op])
			return
		}*/
		//console.log(JSON.stringify(editPath) + ' ' + propertyCode)

		//console.log('---(' + objId + ',' + propertyCode + '): ' + JSON.stringify(state) + ' ' + editNames[op] + ' ' + JSON.stringify(edit))
		//console.log(JSON.stringify(editPath))

		if(state.property !== propertyCode){
			//console.log('different properties ' + state.property + ' ' + propertyCode)
			return
		}
		
		/*if(editPath.length > 2){//TODO make this an error condition?
			//console.log('too long')
			return
		}*/
		
		//console.log('matched')
		
		//console.log('broadcaster provided edit matching property filter: ', path, ':', fullPath)
		//log(op, edit)
		if(editFp.isSetCode[op]){
			//console.log('set ' + editFp.isPrimitiveSetCode[op])
			if(editFp.isPrimitiveSetCode[op]){
				if(edit.value !== prop){
					prop = edit.value
					//console.log('got set string: ' + edit.value)
					//console.log(cb+'')
					cb(prop, editId)
				}//else{
					//console.log(prop + ' ' + edit.value)
				//}
			}else if(op === editCodes.setObject){
				if(edit.id !== prop){
					prop = edit.id
					//console.log('got set object: ' + edit.id)
					cb(prop, editId)
				}
			}else{
				_.errout('TODO: ' + op)
			}
		}else if(op === editCodes.wasSetToNew){
			//_.errout('TODO')
			if(edit.id !== prop){
				prop = innerify(objId, edit.id)
				cb(prop, editId)
			}
		}else if(editFp.isAddCode[op]){
			if(prop === undefined) prop = []
			if(editFp.isPrimitiveAddCode[op]){
				if(prop.indexOf(edit.value) === -1){
					prop.push(edit.value)
					//console.log('got add*: ' + edit.value)
					cb(prop, editId)
				}
			}else if(op === editCodes.addExisting){
				if(prop.indexOf(edit.id) === -1){
					prop.push(edit.id)
					cb(prop, editId)
				}
			}else if(op === editCodes.addedNew){
				//if(prop.indexOf(edit.id) === -1){
					prop.push(innerify(objId, edit.id))
					cb(prop, editId)
				//}
			}else if(op === editCodes.unshiftExisting){
				if(prop.indexOf(edit.id) === -1){
					prop.unshift(edit.id)
					cb(prop, editId)
				}
			}else if(op === editCodes.unshiftedNew){
				//if(prop.indexOf(edit.id) === -1){
					prop.unshift(innerify(objId, edit.id))
					cb(prop, editId)
				//}
			}else if(op === editCodes.addAfter){
				if(prop.indexOf(edit.id) === -1){
					var beforeId = editPath[editPath.length-1].edit.id
					var beforeIndex = prop.indexOf(beforeId)
					if(beforeIndex === -1){
						prop.push(edit.id)
					}else{
						prop.splice(beforeIndex+1, 0, edit.id)
					}
					cb(prop, editId)
				}
			}else if(op === editCodes.addedNewAfter){
				//if(prop.indexOf(edit.id) === -1){
					var beforeId = editPath[editPath.length-1].edit.id
					var beforeIndex = indexOfRawId(prop, beforeId)//prop.indexOf(beforeId)
					var innerId = innerify(objId, edit.id)
					if(beforeIndex === -1){
						prop.push(innerId)
					}else{
						prop.splice(beforeIndex+1, 0, innerId)
					}
					cb(prop, editId)
				//}
			}else{
				_.errout('TODO: ' + op)
			}
		}else if(editFp.isRemoveCode[op]){
			if(op === editCodes.remove){
				//_.errout('TODO')
				if(!prop){
					log.warn('tried to remove element from property that does not contain it: ' + edit.value)
					return
				}

				//var id = editPath[editPath.length-1].edit.id
				var id = state.sub
				_.assertInt(id)
				var i = indexOfRawId(prop, id)//prop.indexOf(id)
				if(i !== -1){
					//console.log('removing object from property')
					prop.splice(i, 1)
					cb(prop, editId)
				}else{
					//_.errout('TODO: ' + JSON.stringify([op, edit]))
					console.log('WARNING: tried to remove element from property that does not contain it: ' + id)
				}
			}else if(editFp.isPrimitiveRemoveCode[op]){
				var i = prop === undefined?-1:prop.indexOf(edit.value)
				if(i !== -1){
					prop.splice(i, 1)
					//console.log('removing string: ' + edit.value)
					cb(prop, editId)
				}else{
					//_.errout('TODO: ' + JSON.stringify([op, edit]))
					log.warn('tried to remove element from property that does not contain it: ' + edit.value)
				}
			}else{
				_.errout('TODO: ' + op)
			}
		}else if(op === editCodes.didPutNew){
			//_.errout('TODO: put')
			if(prop === undefined) prop = {}
			var key = state.key//editPath[editPath.length-1].edit.key
			_.assertDefined(key)
			prop[key] = innerify(objId, edit.id)
			cb(prop, editId)
		}else if(editFp.isPutCode[op]){
			//_.errout('TODO: put')
			if(prop === undefined) prop = {}
			if(op === editCodes.putExisting){
				var key = state.key//editPath[editPath.length-1].edit.key
				_.assertDefined(key)
				prop[key] = edit.id
				_.assert(edit.id > 0)
				cb(prop, editId)
				//console.log('used putExisting: ' + key + ' -> ' + edit.id)
			}else{
				var key = state.key//editPath[editPath.length-1].edit.key
				_.assertDefined(key)
				prop[key] = edit.value
				cb(prop, editId)
				//console.log('used put: ' + key + ' -> ' + edit.value)
			}
		}else if(op === editCodes.delKey){
			var key = state.key//editPath[editPath.length-1].edit.key
			_.assertDefined(key)
			delete prop[key]
			cb(prop, editId)
		}else if(op === editCodes.clearProperty){
			prop = undefined
			cb(undefined, editId)
		}else if(op === editCodes.refork){
			_.errout('TODO')
		}else{
			_.errout('TODO: ' + editNames[op])
		}
	})
}

function makeMapPropertyStream(broadcaster, path, edits, editId, cb, continueListening){

	//if(path.length !== 2) _.errout('TODO: ' + JSON.stringify(path))	

	var objId = path[0].edit.id
	var propertyCode = path[1].edit.typeCode

	var prop;

	//log('streamProperty got ' + edits.length + ' edits')
	//console.log('streamProperty got ' + edits.length + ' edits')
		
	var tracker = makePathTracker(path)
	
	//console.log(JSON.stringify(edits))
	
	edits.forEach(function(e){
		
		var op = e.op
		var matching = tracker(e)

		//log(matching, path, ' <- ',e)

		if(!matching) return
		
		if(editFp.isPutCode[op]){
			_.errout('TODO')
		}
	})
	//log('streaming ', path, ':', prop)
	cb(prop, editId)
	
	broadcaster.output.listenByObject(objId, function(typeCode, id, editPath, op, edit, syncId, editId){
		//if(path.length > 1) return
		var fullPath = [{op: editCodes.selectObject, edit: {id: id}}].concat(editPath)//[id].concat(path)
		
		var matched = false

		if(differentPaths(path, fullPath)){
			//log('edit does not match:', fullPath, path, [op, edit])
			return//id ===objId && path.length === 1 && path[0] === propertyCode){
		}
		
		//log('broadcaster provided edit matching property filter:',path,':',fullPath)
		//log(op, edit)
	
		if(editFp.isPutCode[op]){
			_.errout('TODO')
		}
	})
}

function makePropertyTypesStream(ol, broadcaster, streamObjId, edits, editId, cb, continueListening){

	//if(path.length !== 2) _.errout('TODO: ' + JSON.stringify(path))	
	//_.assertEqual(path[0].op, editCodes.selectObject)
	//var objId = path[0].edit.id
	//_.assertInt(objId)

	var prop = {}

	//log('streamPropertyTypes got ' + edits.length + ' edits')
	//console.log('streamPropertyTypes got ' + edits.length + ' edits')
	//console.log(JSON.stringify(edits))
	
	var tracker = makePathTracker(path)
	
	edits.forEach(function(e){
		
		var op = e.op
		var matching = tracker(e)

		//log(matching, path, ' <- ', e)
		//console.log(matching + ' ' + JSON.stringify(path) + ' <- ' + JSON.stringify(e))

		if(!matching) return
		
		if(editFp.isSetCode[op]){//op.indexOf('set') === 0){
			if(op === editCodes.setExisting || op === editCodes.setObject){
				if(e.edit.id !== prop){
					prop[e.edit.id] = ol.getObjectType(e.edit.id)//e.edit.id
				}
			}else if(op === editCodes.setSyncId){
			}else{
				_.errout('TODO: ' + op)
			}
		}else if(editFp.isAddCode[op]){//op.indexOf('add') === 0){
			if(op === editCodes.addExisting || op === editCodes.unshiftExisting){
				prop[e.edit.id] = ol.getObjectType(e.edit.id)
			}else if(op === editCodes.addedNew){
				prop[e.edit.id] = e.edit.typeCode
			}else{
				_.errout('TODO: ' + JSON.stringify(e))
			}
		}else if(editFp.isRemoveCode[op]){//op.indexOf('remove') === 0){
			//TODO deal with
			//_.errout('TODO')
		}else if(op === editCodes.wasSetToNew){
			//_.errout('TODO')
			prop[e.edit.id] = e.edit.typeCode
		}else if(op === editCodes.refork){
			_.errout('TODO')
		}
	})
	//log('streaming types ', path, ':', prop)
	function getType(id, undefOk){
		var typeCode = prop[id]
		if(!undefOk && typeCode === undefined){
			//console.log('requested type code of unknown id: ' + id + ', only got: ' + JSON.stringify(prop))
			return
		}
		return typeCode
	}
	cb(getType, editId)
	
	broadcaster.output.listenByObject(objId, function(typeCode, id, state, op, edit, syncId, editId){
		//if(path.length > 1) return
		//var fullPath = [{op: editCodes.selectObject, edit: {id: id}}].concat(editPath)//[id].concat(path)
		
		var matched = false

		//if(differentPaths(path, fullPath)){
			//log('edit does not match: ' + JSON.stringify(fullPath) + ' ' + JSON.stringify(path))
		//	return//id ===objId && path.length === 1 && path[0] === propertyCode){
		//}
		
		if(state.property !== propertyCode){
			return
		}
		
		//console.log(JSON.stringify(path) + ' <- ' + JSON.stringify(fullPath))
		
		//log('broadcaster provided edit matching property filter:', path, ':', fullPath)
		//log(op, edit)
	
		if(editFp.isSetCode[op]){//op.indexOf('set') === 0){
			if(op === editCodes.setObject){
				if(prop[edit.id] === undefined){
					prop[edit.id] = ol.getObjectType(edit.id)
					cb(getType, editId)
				}
			}else{
				_.errout('TODO: ' + op)
			}
		}else if(op === editCodes.wasSetToNew){
			if(prop[edit.id] === undefined){
				prop[edit.id] = edit.typeCode
				cb(prop, editId)
			}
		}else if(editFp.isAddCode[op]){//op.indexOf('add') === 0){
			if(op === editCodes.addExisting){
			}else if(op === editCodes.addedNew){
				prop[edit.id] = edit.typeCode
				cb(getType, editId)
			}else{
				_.errout('TODO: ' + op)
			}
		}else if(editFp.isRemoveCode[op]){//op.indexOf('remove') === 0){
			//_.errout('TODO')
			//TODO
			/*if(op === 'remove'){
				var i = prop.indexOf(edit.id)
				if(i !== -1){
					//console.log('removing object from property')
					prop.splice(i, 1)
					cb(getType, editId)
				}else{
					_.errout('TODO: ' + JSON.stringify([op, edit]))
				}
			}else if(op === 'removeString' || op === 'removeInt' || op === 'removeLong' || op === 'removeBoolean'){
				var i = prop.indexOf(edit.value)
				if(i !== -1){
					prop.splice(i, 1)
					cb(getType, editId)
				}else{
					_.errout('TODO: ' + JSON.stringify([op, edit]))
				}
			}else{
				_.errout('TODO: ' + op)
			}*/
		}else if(op === editCodes.refork){
			_.errout('TODO')
		}
	})
}



exports.make = function(schema, ap, broadcaster, ol){
	_.assertLength(arguments, 4);
	
	var includeFunctions = {};
	
	function emptyIncludeFunction(id, obj, addObjectCb, endCb){endCb();}

	var indexing;
	
	var pm = pathmerger.make(schema, ol, ap.saveEdit, ap.persistEdit, ap.forgetTemporary, function(id, syncId){
		_.assert(id < -1)
		return ap.translateTemporaryId(id, syncId)
	})
	
	function computeRealPath(path){
		var realPath = path			
		var index = path.length-2
		while(index > 0){
			var id = path[index].edit.id
			if(ol.isTopLevelObject(id)){
				realPath = path.slice(index)
				break;
			}
			index -= 2
		}
		return realPath
	}
	
	var handle = {
		ol: ol,
		getCurrentEditId: function(){
			return ol.getLatestVersionId()
		},
		forgetTemporary: function(temporary, syncId){
			var real = ap.translateTemporaryId(temporary, syncId)
			//pm.forgetTemporary(real, temporary, syncId)
			//TODO forget in ap?
		},
		isTopLevelObject: function(id){
			return ol.isTopLevelObject(id)
		},
		validateId: function(id){
			ol.validateId(id)
		},
		getUuid: function(id){
			return ol.getUuid(id)
		},
		isFork: function(id){
			return ol.isFork(id)
		},
		getForked: function(id){
			return ol.getForked(id)
		},
		getAllForked: function(id){
			return ol.getAllForked(id)
		},
		isDeleted: function(id){
			return ol.isDeleted(id)
		},
		addEdit: function(op, state, edit, syncId, computeTemporary, reifyCb){
			//_.assertLength(arguments, 7);

			//console.log('adding edit: ' + JSON.stringify(arguments))
			if(op !== editCodes.make && op !== editCodes.makeFork && op !== editCodes.forgetTemporary){
				_.assertInt(state.object);
			}
			_.assertInt(syncId);
			_.assertInt(op)
			//TODO support merge models
			
			if(op === editCodes.make || op === editCodes.makeFork){
				return ap.persistEdit({}, op, edit, syncId, computeTemporary, Date.now())//TODO this timestamp is inconsistent with what will be serialized
			}else{
				_.assertInt(state.top)
				_.assert(state.object < -1 || state.object > 0)
				
				if(state.object < -1){
					state.object = ap.translateTemporaryId(state.object, syncId)
				}
				_.assert(state.object > 0)
				if(state.top < -1){
					state.top = ap.translateTemporaryId(state.top, syncId)
				}
				//console.log('state.top: ' + state.top)
				_.assert(state.top > 0)
				//pm(id, state, op, edit, syncId, computeTemporary, reifyCb)
				
				//console.log(new Error().stack)
				var currentState = ol.getObjectMetadata(state.top)
				//console.log(JSON.stringify(currentState) + ' -> ' + JSON.stringify(state))
				if(state.object && state.object !== currentState.object){// && state.object !== state.top){
					if(state.object === state.top){
						if(currentState.object !== undefined){
							ap.saveEdit(handle.getObjectType(state.top), state.top, editCodes.clearObject, {}, syncId, Date.now())						
						}
					}else{
						currentState.property = undefined
						ap.saveEdit(handle.getObjectType(state.top), state.top, editCodes.selectObject, {id: state.object}, syncId, Date.now())
					}
				}
				if(state.property && state.property !== currentState.property){
					ap.saveEdit(handle.getObjectType(state.top), state.top, editCodes.selectProperty, {typeCode: state.property}, syncId, Date.now())
				}
				if(state.sub && state.sub !== currentState.sub){
					ap.saveEdit(handle.getObjectType(state.top), state.top, editCodes.selectSubObject, {id: state.sub}, syncId, Date.now())
				}
				if(state.key !== undefined && state.key !== currentState.key){
					_.assertInt(state.keyOp)
					ap.saveEdit(handle.getObjectType(state.top), state.top, state.keyOp, {key: state.key}, syncId, Date.now())
				}
				
				var objId = state.object
				if(objId < 0) objId = ap.translateTemporaryId(state.object, syncId)
				
				state.topTypeCode = handle.getObjectType(state.top)
				state.objTypeCode = handle.getObjectType(objId||id)
				//state.top = id 
				_.assertInt(state.object)
				
				ap.persistEdit(state, op, edit, syncId, computeTemporary, Date.now(), reifyCb)
			}
		},
		/*selectCurrentObject: function(id, objId){
			pm.selectCurrentObject(id, objId)
		},*/
		/*updatePath: function(id, path, syncId){
			pm.updatePath(id, path, syncId)
		},*/
		translateTemporaryId: function(id, syncId){
			_.assertInt(id)
			_.assertInt(syncId)
			_.assert(id < 0)
			_.assert(syncId >= 0)
			return ap.translateTemporaryId(id, syncId)
		},
		syntheticEditId: function(){
			return ap.syntheticEditId()
		},
		getSyncIds: function(id, cb){
			ol.getSyncIds(id, cb)
		},
		getVersions: function(id, cb){
			ol.getVersions(id, cb)
		},
		getLastVersion: function(id, cb){
			ol.getLastVersion(id, cb)
		},
		getVersionTimestamp: function(id){
			return ol.getVersionTimestamp(id)
		},
		getPathTo: function(id, cb){
			_.assertFunction(cb)
			ol.getPathTo(id, cb)
		},
		/*streamPropertyTypes: function(path, editId, cb, continueListening, mustMatch){
			_.errout('REMOVEME?')
			_.assert(arguments.length >= 3)
			_.assert(arguments.length <= 5)
			_.assertArray(path)
			_.assertInt(editId)
			_.assertFunction(cb)

			_.assert(path.length >= 2)
			
			_.assertEqual(path[0].op, editCodes.selectObject)

			var realPath = computeRealPath(path)
			
			var objId = realPath[0].edit.id
			//console.log('streaming object: ' + objId)
			if(!handle.isTopLevelObject(objId)){
				_.errout('tried to stream, but not top-level object: ' + objId)
			}

			ol.getIncludingForked(objId, -1, editId, function(edits){
				makePropertyTypesStream(ol, broadcaster, realPath, edits, editId, cb, continueListening)
			})
			
			return true
		},*/
	
		//TODO add specialize methods for streaming collection properties vs single-value properties?
		/*streamProperty: function(path, editId, cb, continueListening){
			_.assert(arguments.length >= 3)
			_.assert(arguments.length <= 4)
			_.assertArray(path)
			_.assertInt(editId)
			_.assertFunction(cb)

			_.assert(path.length >= 2)

			//console.log('path: ' + JSON.stringify(path))

			var realPath = computeRealPath(path)
			
			_.assertEqual(realPath[0].op, editCodes.selectObject)
			
			//console.log('realPath: ' + JSON.stringify(realPath))
			
			var objId = realPath[0].edit.id
			//console.log('streamProperty: ' + JSON.stringify(path))
			_.assertInt(objId)

			ol.getIncludingForked(objId, -1, editId, function(edits){
				//console.log('got including forks: ' + JSON.stringify(path) + ' -> ' + JSON.stringify(edits))
				makePropertyStream(broadcaster, realPath, edits, editId, cb, continueListening, ol)
			})
		},*/
		getInclusionsDuring: function(id, lastEditId, endEditId, cb){//TODO getExclusionsDuring?
			//_.assertInt(id)
			if(_.isObject(id)) id = id.top
			_.assertInt(id)
			ol._getForeignIds(id, lastEditId-1, function(a){
				ol._getForeignIds(id, endEditId, function(b){
				//	console.log('during: ' + lastEditId+' ' + endEditId + ' ' + JSON.stringify([id,a,b]))
					var has = {}
					var res = []
					a.forEach(function(id){
						has[id] = true
					})
					b.forEach(function(id){
						if(!has[id]){
							res.push(id)
						}
					})
					cb(res)
				})
			})
		},
		getInclusionsAt: function(id, editId, cb){
			_.assertInt(id)
			ol._getForeignIds(id, editId, cb)
		},
		getSyncIdFor: function(editId){
			return ol.getSyncIdFor(editId)
		},
		getEditsBetween: function(id, lastEditId, endEditId, cb){
			if(id.getChangesBetween) _.errout('TODO')
			
			ol.getIncludingForked(id, -1, -1, function(edits){
				var res = []
				//console.log(JSON.stringify(edits))
				var syncId = -100
				edits.forEach(function(e){
					if(e.op === editCodes.setSyncId){
						syncId = e.edit.syncId
					}
					if(e.editId > lastEditId && e.editId <= endEditId){
						//_.assertInt(e.syncId)
						e.syncId = syncId
						res.push(e)
					}
				})
				cb(res)
			})
		},
		getPropertyChangesDuring: function(id, propertyCode, lastEditId, endEditId, cb){
			_.assertDefined(id)
			if(id.getPropertyChangesDuring) _.errout('TODO')

			if(!_.isInt(id)) _.assertInt(id.top)
			
			ol.getIncludingForked(id, -1, -1, function(edits){
				var actual = []
				edits.forEach(function(e){
					if(e.editId <= endEditId){
						actual.push(e)
					}
				})
				//console.log('getting property changes during ' + lastEditId + ',' + endEditId + ' with ' + JSON.stringify(actual))

				var changes = getPropertyValueChangesDuring(id, propertyCode, actual)
				var actualChanges = []
				changes.forEach(function(c){
					if(c.editId > lastEditId && c.editId <= endEditId){
						actualChanges.push(c)
					}
				})

				/*console.log('got during ' + id + '.' + propertyCode + ': ' + 
					JSON.stringify(changes) + ' \n' + 
					JSON.stringify(actualChanges) + ' \n' + 
					JSON.stringify(actual) + ' \n' + 
					JSON.stringify(edits))
*/
				cb(actualChanges)
				//console.log('got including forks: ' + JSON.stringify(path) + ' -> ' + JSON.stringify(edits))
				/*makePropertyStream(broadcaster, id, propertyCode, edits, editId, function(v, editId){
				
				}, false, ol)*/
			})
		},
		getPropertyValueAt: function(id, propertyCode, editId, cb){
			_.assertDefined(id)
			if(id.getPropertyValueAt){
				//console.log('using id.propertyValueAt: ' + id)
				id.getPropertyValueAt(id, propertyCode, editId, cb)
				return
			}
			
			/*var pvcKey = id+':'+propertyCode+'_'+editId
			if(pvCache[pvcKey]){
				cb(pvCache[pvcKey])
				return
			}*/
			
			//if(editId === -1000) _.errout('bad editId -1000')
			
			var typeCode = ol.getObjectType(id.inner||id.top||id)//TODO optimize this stuff
			var propertyType = schema._byCode[typeCode].propertiesByCode[propertyCode]
			var defaultValue = undefined
			if(propertyType === undefined) _.errout('cannot get non-existent property ' + id + ' ' + typeCode + '.' + propertyCode)
			if(propertyType.type.type === 'set' || propertyType.type.type === 'list') defaultValue = []
			else if(propertyType.type.type === 'map') defaultValue = {}
			//console.log('type: ' + JSON.stringify(propertyType))
			
			ol.getIncludingForked(id, -1, -1, function(edits){
				var actual = []
				//edits.forEach(function(e){
				for(var i=0;i<edits.length;++i){
					var e = edits[i]
					if(e.editId <= editId){
						actual.push(e)
					}
				}
				//console.log(id + '.' + propertyCode + ' getting property value at ' + editId + ' with ' + JSON.stringify(actual))
				var pv = getResultingPropertyValue(id, propertyCode, actual, defaultValue)
				//console.log('got ' + id + '.' + propertyCode + ': ' + JSON.stringify(pv))// + ' ' + JSON.stringify(actual) + ' full: ' + JSON.stringify(edits))
				//pvCache[pvcKey] = pv
				cb(pv)
			})
		},
		streamProperty: function(id, propertyCode, editId, cb, continueListening){
			_.assert(arguments.length >= 3)
			_.assert(arguments.length <= 4)
			//_.assertArray(path)
			
			_.assertInt(propertyCode)
			_.assertInt(editId)
			_.assertFunction(cb)
			
			_.assert(_.isInt(id) || _.isInt(id.top))

			//_.assert(path.length >= 2)

			//console.log('path: ' + JSON.stringify(path))

			/*var realPath = computeRealPath(path)
			
			_.assertEqual(realPath[0].op, editCodes.selectObject)
			
			//console.log('realPath: ' + JSON.stringify(realPath))
			
			var objId = realPath[0].edit.id
			//console.log('streamProperty: ' + JSON.stringify(path))
			_.assertInt(objId)*/

			ol.getIncludingForked(id, -1, -1, function(edits){
				//console.log('got including forks: ' + JSON.stringify(path) + ' -> ' + JSON.stringify(edits))
				makePropertyStream(broadcaster, id, propertyCode, edits, editId, cb, continueListening, ol)
			})
		},
		streamMapProperty: function(path, editId, cb, continueListening){
			_.assert(arguments.length >= 3)
			_.assert(arguments.length <= 4)
			_.assertArray(path)
			_.assertInt(editId)
			_.assertFunction(cb)

			_.assert(path.length >= 2)

			var realPath = computeRealPath(path)
			
			_.assertEqual(realPath[0].op, editCodes.selectObject)
			
			var objId = realPath[0].edit.id
			//console.log(JSON.stringify(path))
			_.assertInt(objId)

			ol.getIncludingForked(objId, -1, editId, function(edits){
				makeMapPropertyStream(broadcaster, realPath, edits, editId, cb, continueListening)
			})
		},

		streamObjectState: function(already, id, startEditId, endEditId, cb, endCb){
			_.assertLength(arguments, 6)
			_.assertInt(startEditId)
			_.assertInt(endEditId)
			_.assertObject(already)
			_.assert(id > 0)

			ol.streamVersion(already, id, startEditId, endEditId, cb, endCb)
		},

		updateObject: function(objId, editId, cb, doneCb){
			_.assertLength(arguments, 4)
			
			
			
			ol.getAll(objId, function(res){
				//var pu = pathsplicer.make()
				var typeCode = ol.getObjectType(objId)
				var syncId
				res.forEach(function(e){
					if(e.op === editCodes.setSyncId){//TODO do not provide this at all?
						syncId = e.edit.syncId
					}
					//var ignorable = pu.update(e)
					if(e.editId >= editId){
						cb(typeCode, objId, e.op, e.edit, syncId, e.editId)
					}
				})
				doneCb(objId)
			})
		},
		streamObject: function(objId, editId, cb){

			handle.updateObject(objId, editId, cb, function(){
				broadcaster.output.listenByObject(objId, cb)
			})
		},	
		streamAllPropertyValues: function(objTypeCode, propertyCodes, attachmentEditId, cb, liveCb, destroyedCb){

			_.assertFunction(destroyedCb)
			
			var outstandingEditCount = 0
			var isListening = false
			var dead = false
			
			var isPc = {}
			for(var i=0;i<propertyCodes.length;++i){
				isPc[propertyCodes[i]] = true
			}			
			
			var objSchema = schema._byCode[objTypeCode]
			
			var forkers = {}//TODO remove old forkers when reforks happen...?
			function reforkInterceptor(id, map, resultId){
				if(map.forked){
					if(forkers[map.forked] === undefined) forkers[map.forked] = []
					forkers[map.forked].push(updateSelf.bind(undefined, id))
				}
				cb(id, map, resultId)
			}
			function updateSelf(id, editId){
				++outstandingEditCount

				if(outstandingEditCount === 1){
					liveCb(false, editId)
				}//TODO include the get in this block?
			
				ol.getAllIncludingForked(id, function(res){
			
					--outstandingEditCount
					
					computeMap(id, res, undefined, reforkInterceptor, destroyedCb, ol, objSchema, propertyCodes, isPc)
					
					if(forkers[id]){
						forkers[id].forEach(function(fff){
							fff(editId)
						})
					}
					
					liveCb(true)
				})
			}
			function eventListener(state,/*typeCode, id, path, */op, edit, syncId, editId){
				_.assertObject(state)
				_.assertInt(op)
				//console.log('op: ' + op)
				//console.log('event listener: ' + typeCode + ' ' + id + ' ' + editNames[op])
				
				if(op === editCodes.destroy){
					destroyedCb(id, editId)
					return//TODO?
				}
				
				updateSelf(state.top, editId)
			}
			var hasStartedBroadcastListening = false
			
			//console.log('getAllObjectsOfTypeIncludingForked: ' + objTypeCode)
			ol.getAllObjectsOfTypeIncludingForked(objTypeCode, function(id, res){
				//console.log('all: ' + id)
				//console.log('res: ' + JSON.stringify(res))
				computeMap(id, res, attachmentEditId, reforkInterceptor, destroyedCb, ol, objSchema, propertyCodes, isPc)				
			}, function(){
				//console.log('got all objects of type: ' + objTypeCode)
				if(dead) return
				
				liveCb(true)
				hasStartedBroadcastListening = true			
				broadcaster.output.listenByType(objTypeCode, eventListener)
			})
			
			return function stopListening(){
				dead = true
				if(hasStartedBroadcastListening){
					broadcaster.output.stopListeningByType(objTypeCode, eventListener)
				}
			}
		},
		streamAllPropertyValuesHistorically: function(objTypeCode, propertyCodes, attachmentEditId, cb, liveCb, destroyedCb){
			///_.errout('TODO')
			_.assertFunction(destroyedCb)
			
			var outstandingEditCount = 0
			var isListening = false
			var dead = false
			
			var isPc = {}
			for(var i=0;i<propertyCodes.length;++i){
				isPc[propertyCodes[i]] = true
			}			
			
			var objSchema = schema._byCode[objTypeCode]
			
			var forkers = {}//TODO remove old forkers when reforks happen...?
			function reforkInterceptor(id, map, resultId){
				if(map.forked){
					if(forkers[map.forked] === undefined) forkers[map.forked] = []
					forkers[map.forked].push(updateSelf.bind(undefined, id))
				}
				cb(id, map, resultId)
			}
			function updateSelf(id, editId){
				++outstandingEditCount

				if(outstandingEditCount === 1){
					liveCb(false, editId)
				}//TODO include the get in this block?
			
				ol.getAllIncludingForked(id, function(res){
			
					--outstandingEditCount
					
					computeAllHistoricalMaps(id, res, undefined, reforkInterceptor, destroyedCb, ol, objSchema, propertyCodes, isPc)
					
					if(forkers[id]){
						forkers[id].forEach(function(fff){
							fff(editId)
						})
					}
					
					liveCb(true)
				})
			}
			function eventListener(typeCode, id, path, op, edit, syncId, editId){
				
				//console.log('op: ' + op)
				//console.log('event listener: ' + typeCode + ' ' + id + ' ' + editNames[op])
				
				if(op === editCodes.destroy){
					destroyedCb(id, editId)
					return//TODO?
				}
				
				updateSelf(id, editId)
			}
			var hasStartedBroadcastListening = false
			
			//console.log('getAllObjectsOfTypeIncludingForked: ' + objTypeCode)
			ol.getAllObjectsOfTypeIncludingForked(objTypeCode, function(id, res){
				//console.log('all: ' + id)
				//console.log('res: ' + JSON.stringify(res))
				computeAllHistoricalMaps(id, res, attachmentEditId, reforkInterceptor, destroyedCb, ol, objSchema, propertyCodes, isPc)				
			}, function(){
				//console.log('got all objects of type: ' + objTypeCode)
				if(dead) return
				
				liveCb(true)
				hasStartedBroadcastListening = true			
				broadcaster.output.listenByType(objTypeCode, eventListener)
			})
			
			return function stopListening(){
				dead = true
				if(hasStartedBroadcastListening){
					broadcaster.output.stopListeningByType(objTypeCode, eventListener)
				}
			}
		},
		streamAllPropertyValuesForSetHistorically: function(objTypeCode, propertyCodes, attachmentEditId, cb, liveCb, destroyedCb){

			_.assertFunction(destroyedCb)

			//console.log('here: ' + new Error().stack)
			
			var outstandingEditCount = 0
			var isListening = false

			var isPc = {}
			for(var i=0;i<propertyCodes.length;++i){
				isPc[propertyCodes[i]] = true
			}			
			
			var objSchema = schema._byCode[objTypeCode]

			var ids = {}
			
			function eventListener(typeCode, id, path, op, edit, syncId, editId){
			
				if(!ids[id]) return
				
				if(op === editCodes.destroy){
					destroyedCb(id, editId)
					return//TODO?
				}

				++outstandingEditCount

				if(outstandingEditCount === 1){
					liveCb(false, editId)
				}
			
				ol.getAllIncludingForked(id, function(res){
			
					--outstandingEditCount

					if(ids[id]){
						computeAllHistoricalMaps(id, res, undefined, function(id, map, resultEditId){
							//console.log('editIdes: ' + editId + ' ' + resultEditId)
							cb(id, map, resultEditId > editId?resultEditId:editId)//TODO is this right?
						}, destroyedCb, ol, objSchema, propertyCodes, isPc)
					}
					
					if(outstandingEditCount === 0){
						liveCb(true)
					}
				})
			}

			broadcaster.output.listenByType(objTypeCode, eventListener)
			
			liveCb(true)
			
			var adding = {}
			
			var setListener = {
				add: function(id, editId){
					++outstandingEditCount
					if(outstandingEditCount === 1){
						liveCb(false, editId)
					}
					adding[id] = true
					//process.nextTick(function(){//wait a bit so edits can happen, to avoid unnecessary thrashing of property states (especially during the initial make transactoin)
						ol.getAllIncludingForked(id, function(res){
							if(!adding[id]) return
							adding[id] = false
							ids[id] = true
							--outstandingEditCount
							if(ids[id]){
								computeAllHistoricalMaps(id, res, editId, function(id, map, resultEditId){
									//console.log('here('+resultEditId+','+editId+'): ' + JSON.stringify(res))
									cb(id, map, resultEditId > editId?resultEditId:editId)//TODO is this right?
								}, destroyedCb, ol, objSchema, propertyCodes, isPc)
							}
							if(outstandingEditCount === 0){
								//adding = undefined
								liveCb(true)
							}
						})
					//})
				},
				remove: function(id, editId){
					if(adding[id]){
						--outstandingEditCount
						if(outstandingEditCount === 0){
							//adding = undefined
							liveCb(true)
						}
						adding[id] = false
					}
					delete ids[id]
				}
			}
			
			return setListener
		},
		streamAllPropertyValuesForSet: function(objTypeCode, propertyCodes, attachmentEditId, cb, liveCb, destroyedCb){

			_.assertFunction(destroyedCb)
			
			var outstandingEditCount = 0
			var isListening = false

			var isPc = {}
			for(var i=0;i<propertyCodes.length;++i){
				isPc[propertyCodes[i]] = true
			}			
			
			var objSchema = schema._byCode[objTypeCode]

			var ids = {}
			
			function eventListener(state, op, edit, syncId, editId){
			
				//_.errout('EVENT LISTENER: ' + id)
				
				if(!ids[state.object]) return
				
				if(op === editCodes.destroy){
					destroyedCb(state.top, editId)
					return//TODO?
				}

				++outstandingEditCount

				if(outstandingEditCount === 1){
					liveCb(false, editId)
				}
			
				ol.getAllIncludingForked(state.object, function(res){
			
					--outstandingEditCount

					if(ids[state.object]){
						computeMap(state.object, res, undefined, function(id, map, resultEditId){
							//console.log('editIdes: ' + editId + ' ' + resultEditId)
							cb(id, map, resultEditId > editId?resultEditId:editId)//TODO is this right?
						}, destroyedCb, ol, objSchema, propertyCodes, isPc)
					}
					
					if(outstandingEditCount === 0){
						liveCb(true)
					}
				})
			}

			broadcaster.output.listenByType(objTypeCode, eventListener)
			
			liveCb(true)
			
			var adding = {}
			
			var setListener = {
				add: function(id, editId){
					//console.log('here: ' + id)
					++outstandingEditCount
					if(outstandingEditCount === 1){
						liveCb(false, editId)
					}
					adding[id] = true
					//process.nextTick(function(){//wait a bit so edits can happen, to avoid unnecessary thrashing of property states (especially during the initial make transactoin)
						ol.getAllIncludingForked(id, function(res){
							if(!adding[id]) return
							adding[id] = false
							ids[id] = true
							--outstandingEditCount
							if(ids[id]){
								computeMap(id, res, editId, function(id, map, resultEditId){
									//console.log('~~~~~~~~~~ here('+resultEditId+','+editId+'): ' + JSON.stringify(res))
									cb(id, map, resultEditId > editId?resultEditId:editId)//TODO is this right?
								}, destroyedCb, ol, objSchema, propertyCodes, isPc)
							}
							if(outstandingEditCount === 0){
								//adding = undefined
								liveCb(true)
							}
						})
					//})
				},
				remove: function(id, editId){
					if(adding[id]){
						--outstandingEditCount
						if(outstandingEditCount === 0){
							//adding = undefined
							liveCb(true)
						}
						adding[id] = false
					}
					delete ids[id]
				}
			}
			
			return setListener
		},
		//Note that these method's implementations will always return a result that is up-to-date,
		//by fetching the async parts and then synchronously merging them with the AP parts
		getManyOfType: function(typeCode){
			_.assertLength(arguments, 1)
			return ol.getMany(typeCode)
		},
		getObjects: function(typeCode, ids, cb){
			_.assertFunction(cb);
			_.assertArray(ids)
			
			if(ids.length === 0){
				cb({})
				return;
			}

			//console.log('getting objects: ' + ids.length)

			var objs = {}
			var cdl = _.latch(ids.length, function(){
				//console.log('got all objects, done')
				cb(objs)
			})
			ol.getSet(ids, function(obj){
				objs[obj.meta.id] = obj
				//console.log('got obj')
				cdl()
			})
		},
		getAllIdsOfType: function(typeCode, cb){
			ol.getAllIdsOfType(typeCode, cb)
		},
		getAllIdsOfTypeAt: function(typeCode, editId, cb){
			ol.getHistoricalCreationsOfType(typeCode, function(vs){
				var res = []
				for(var i=0;i<vs.length;++i){
					var v = vs[i]
					//_.assert(v.editId > 0)
					if(v.editId <= editId){
						res.push(v.id)
					}
				}
				//console.log(JSON.stringify(vs) + ' ' + editId + ' ' + JSON.stringify(res))
				cb(res)
			})
		},
		getHistoricalCreationsOfType: function(typeCode, cb){
			ol.getHistoricalCreationsOfType(typeCode, cb)
		},
		getAllObjectCreationsOfType: function(typeCode, cb, doneCb){
			ol.getHistoricalCreationsOfType(typeCode, function(vs){
				vs.forEach(function(v){
					cb(v.id, v.editId)
				})
				doneCb()
			})
		},
		getAllObjects: function(typeCode, cb){
			ol.getAllOfType(typeCode, cb)
		},
		getObjectType: function(id){
			_.assertLength(arguments, 1)
			return ol.getObjectType(id)
		},
		getSubsetThatChangesBetween: function(ids, startEditId, endEditId, cb){
			ol.getSubsetThatChangesBetween(ids, startEditId, endEditId, cb)
		},
		getCreationsOfTypeBetween: function(typeCode, startEditId, endEditId, cb){
			ol.getCreationsOfTypeBetween(typeCode, startEditId, endEditId, cb)
		}
	};
	
	return handle;
}

function computeMap(id, res, attachmentEditId, cb, destroyedCb, ol, objSchema, propertyCodes, isPc){
	_.assertLength(arguments, 9)
	
	_.assertObject(isPc)
	var map = {}

	var isInPc = false
	
	if(propertyCodes.indexOf(-1) !== -1) _.errout('TODO')
	
	_.assert(res[1].op === editCodes.made || res[1].op === editCodes.madeFork)

	for(var i=0;i<propertyCodes.length;++i){
		var pc = propertyCodes[i]
		if(map[pc] === undefined){
			var t = objSchema.propertiesByCode[pc].type
			if(t.type === 'set' || t.type === 'list'){
				map[pc] = []
			}
		}
	}
		
	for(var i=0;i<res.length;++i){
		var e = res[i]
		var op = e.op
		
		if(op === editCodes.initializeUuid){
			if(isPc[-3]){//propertyCodes.indexOf(-3) !== -1){
				console.log('mapped uuid: ' + e.edit.uuid)
				map[-3] = e.edit.uuid
			}
		}else if(op === editCodes.selectProperty){
			if(isPc[e.edit.typeCode]){
				pc = e.edit.typeCode
				isInPc = true
			}else{
				isInPc = false
			}
			continue	
		}else if(op === editCodes.selectObject){
			continue
		}else if(editFp.isKeySelectCode[op]){//op === 'selectStringKey' || op === 'selectLongKey' || op === 'selectIntKey' || op === 'selectBooleanKey' || op==='selectObjectKey'){
			continue
		}else if(op === editCodes.setSyncId){
			continue
		}else if(op === editCodes.madeFork){
			isInPc = false
			map.forked = e.edit.sourceId
		}else if(op === editCodes.refork){
			map.forked = e.edit.sourceId
		}
		
		if(isInPc){
			if(editFp.isPrimitiveSetCode[op]){//op === 'setInt' || op === 'setString' || op === 'setBoolean'){
				map[pc] = e.edit.value
			}else if(op === editCodes.setObject){
				if(!ol.isDeleted(e.edit.id)){
					map[pc] = e.edit.id
				}
			}else if(op === editCodes.addExisting){
				if(!ol.isDeleted(e.edit.id)){
					map[pc].push(e.edit.id)
				}
			}else if(op === editCodes.unshiftExisting){
				if(!ol.isDeleted(e.edit.id)){
					map[pc].unshift(e.edit.id)
				}
			}else if(op === editCodes.addInt){
				map[pc].push(e.edit.value)
			}else if(op === editCodes.removeInt){
				var list = map[pc]
				list.splice(list.indexOf(e.edit.value), 1)
			}else if(op === editCodes.destroy){
				console.log('destroyed included: ' + id)
				destroyedCb(id, e.editId)
			}else if(op === editCodes.madeFork || op === editCodes.refork){
				//TODO?
			}else if(op === editCodes.made){
				//TODO?
			}else{
				_.errout('TODO: ' + editNames[e.op] + ' ' + JSON.stringify(e))
			}
		}
	}

	//console.log('computed map: ' + JSON.stringify(map))
	var resultEditId = res.length > 0 ? res[res.length-1].editId : -1
	if(attachmentEditId) resultEditId = attachmentEditId
	cb(id, map, resultEditId)
}

function computeAllHistoricalMaps(id, res, attachmentEditId, cb, destroyedCb, ol, objSchema, propertyCodes, isPc){
	_.assertLength(arguments, 9)
	
	//console.log('computing all historical maps: ' + JSON.stringify(res))
	//console.log(new Error().stack)
	
	_.assertObject(isPc)
	//var pu = pathsplicer.make()
	var map = {}

	var depth = 0
	var isInPc = false
	var pc
	
	if(propertyCodes.indexOf(-1) !== -1) _.errout('TODO')
	
	_.assert(res[1].op === editCodes.made || res[1].op === editCodes.madeFork)

	for(var i=0;i<propertyCodes.length;++i){
		var pc = propertyCodes[i]
		if(map[pc] === undefined){
			var t = objSchema.propertiesByCode[pc].type
			if(t.type === 'set' || t.type === 'list'){
				map[pc] = []
			}
		}
	}	
	
	for(var i=0;i<res.length;++i){
		var e = res[i]
		//var ignorable = pu.update(e)
		var op = e.op
		
		if(op === editCodes.initializeUuid){
			if(isPc[-3]){//propertyCodes.indexOf(-3) !== -1){
				console.log('mapped uuid: ' + e.edit.uuid)
				map[-3] = e.edit.uuid
				cb(id, map, e.editId)
			}
		}else if(op === editCodes.selectProperty){
			if(depth === 0 && isPc[e.edit.typeCode]){
				pc = e.edit.typeCode
				isInPc = true
			}else{
				isInPc = false
			}
			++depth
			continue	
		}else if(op === editCodes.reselectProperty){
			if(depth === 1 && isPc[e.edit.typeCode]){
				pc = e.edit.typeCode
				isInPc = true
			}else{
				isInPc = false
			}
			continue	
		}else if(op === editCodes.ascend1){
			--depth
			isInPc = false
			continue	
		}else if(op === editCodes.ascend){
			depth -= e.edit.many
			isInPc = false
			continue	
		}else if(op === editCodes.ascend2){
			depth -= 2
			isInPc = false
			continue	
		}else if(op === editCodes.ascend3){
			depth -= 3
			isInPc = false
			continue	
		}else if(op === editCodes.ascend4){
			depth -= 4
			isInPc = false
			continue	
		}else if(op === 'ascend5'){
			depth -= 5
			isInPc = false
			continue	
		}else if(op === editCodes.selectObject){
			++depth
			continue
		}else if(op === editCodes.reselectObject){
			continue
		}else if(editFp.isKeySelectCode[op]){//op === 'selectStringKey' || op === 'selectLongKey' || op === 'selectIntKey' || op === 'selectBooleanKey' || op==='selectObjectKey'){
			++depth
			continue
		}else if(editFp.isKeyReselectCode[op]){//op === 'reselectStringKey' || op === 'reselectLongKey' || op === 'reselectIntKey' || op === 'reselectBooleanKey' || op === 'reselectObjectKey'){
			continue
		}else if(op === editCodes.setSyncId){
			continue
		}else if(op === editCodes.madeFork){
			depth = 0
			isInPc = false
			map.forked = e.edit.sourceId
			cb(id, map, e.editId)
		}else if(op === editCodes.refork){
			//_.errout('TODO')
			map.forked = e.edit.sourceId
//			console.log('reforked: ' + JSON.stringify(res))
		}
		
		if(isInPc){
			if(editFp.isPrimitiveSetCode[op]){//op === 'setInt' || op === 'setString' || op === 'setBoolean'){
				if(map[pc] !== e.edit.value){
					map[pc] = e.edit.value
					cb(id, map, e.editId)
				}
			}else if(op === editCodes.setObject){
				if(!ol.isDeleted(e.edit.id)){
					map[pc] = e.edit.id
					cb(id, map, e.editId)
				}
			}else if(op === editCodes.addExisting){
				//if(map[pc] === undefined) map[pc] = []
				if(!ol.isDeleted(e.edit.id)){
					map[pc].push(e.edit.id)
					cb(id, map, e.editId)
				}
			}else if(op === editCodes.unshiftExisting){
				//if(map[pc] === undefined) map[pc] = []
				if(!ol.isDeleted(e.edit.id)){
					map[pc].unshift(e.edit.id)
					cb(id, map, e.editId)
				}
			}else if(op === editCodes.addInt){
				//if(map[pc] === undefined) map[pc] = []
				map[pc].push(e.edit.value)
				cb(id, map, e.editId)
			}else if(op === editCodes.removeInt){
				var list = map[pc]
				list.splice(list.indexOf(e.edit.value), 1)
				cb(id, map, e.editId)
			}else if(op === editCodes.destroy){
				console.log('destroyed included: ' + id)
				destroyedCb(id, e.editId)
			}else if(op === editCodes.madeFork){
				//TODO?
			}else{
				_.errout('TODO: ' + editNames[e.op] + ' ' + JSON.stringify(e))
			}
		}
	}
	
	//console.log('computed map: ' + JSON.stringify(map))
	var resultEditId = res.length > 0 ? res[res.length-1].editId : -1
	if(attachmentEditId) resultEditId = attachmentEditId
	cb(id, map, resultEditId)
}
