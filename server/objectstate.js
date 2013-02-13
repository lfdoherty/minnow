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

//note that the path must not descend into a top-level object for this function
function makePropertyStream(broadcaster, path, edits, editId, cb, continueListening, ol){

	//if(path.length !== 2) _.errout('TODO: ' + JSON.stringify(path))	

	var objId = path[0].edit.id
	var propertyCode = path[1].edit.typeCode
	
	_.assert(ol.isTopLevelObject(objId))
	
	var prop;

	//console.log('streamProperty got ' + edits.length + ' edits, path: ' + JSON.stringify(path))
	//console.log('streamProperty got ' + edits.length + ' edits ' + editId + ' ' + objId + ' ' + propertyCode)
	//console.log(JSON.stringify(edits))
	
	var tracker = makePathTracker(path.slice(1))
	
	//console.log(JSON.stringify(edits))
	
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
			prop = e.edit.id
		}else if(editFp.isAddCode[op]){
			if(prop === undefined) prop = []
			if(editFp.isPrimitiveAddCode[op]){
				if(prop.indexOf(e.edit.value) === -1){
					//console.log('added primitive: ' + e.edit.value)
					prop.push(e.edit.value)
				}
			}else if(op === editCodes.addExisting || op === editCodes.addedNew){
				if(prop.indexOf(e.edit.id) === -1){
					prop.push(e.edit.id)
				}
			}else if(op === editCodes.unshiftExisting || op === editCodes.unshiftedNew){
				if(prop.indexOf(e.edit.id) === -1){
					prop.unshift(e.edit.id)
				}
			}else if(op === editCodes.addAfter || op === editCodes.addedNewAfter){
				if(prop.indexOf(e.edit.id) === -1){
					var beforeId = editPath[editPath.length-1].edit.id
					var beforeIndex = prop.indexOf(beforeId)
					if(beforeIndex === -1){
						prop.push(e.edit.id)
					}else{
						prop.splice(beforeIndex+1, 0, e.edit.id)
					}
				}
			}else{
				_.errout('TODO: ' + JSON.stringify(e))
			}
		}else if(editFp.isRemoveCode[op]){
			if(op === editCodes.remove){
				_.errout('TODO')
				
				var id = editPath[editPath.length-1].edit.id
				var i = prop.indexOf(id)
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
			prop[lastKey] = (e.edit.id)
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
	//console.log('streaming ', path, ':', prop)
	cb(prop, editId)
	
	broadcaster.output.listenByObject(objId, function(typeCode, id, editPath, op, edit, syncId, editId){
		//if(path.length > 1) return
		var fullPath = [{op: editCodes.selectObject, edit: {id: id}}].concat(editPath)
		
		var matched = false

		if(differentPaths(path, fullPath)){
			//console.log('edit does not match:\n' + JSON.stringify(fullPath) + '\n' + JSON.stringify(path) + '\n' + JSON.stringify([op, edit]) + ' ' + editNames[op])
			return
		}
		
		//console.log('broadcaster provided edit matching property filter: ', path, ':', fullPath)
		//log(op, edit)
		if(editFp.isSetCode[op]){
			if(editFp.isPrimitiveSetCode[op]){
				if(edit.value !== prop){
					prop = edit.value
					//console.log('got set string: ' + edit.value)
					cb(prop, editId)
				}
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
				prop = edit.id
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
			}else if(op === editCodes.addExisting || op === editCodes.addedNew){
				if(prop.indexOf(edit.id) === -1){
					prop.push(edit.id)
					cb(prop, editId)
				}
			}else if(op === editCodes.unshiftExisting || op === editCodes.unshiftedNew){
				if(prop.indexOf(edit.id) === -1){
					prop.unshift(edit.id)
					cb(prop, editId)
				}
			}else if(op === editCodes.addAfter || op === editCodes.addedNewAfter){
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

				var id = editPath[editPath.length-1].edit.id
				var i = prop.indexOf(id)
				if(i !== -1){
					//console.log('removing object from property')
					prop.splice(i, 1)
					cb(prop, editId)
				}else{
					//_.errout('TODO: ' + JSON.stringify([op, edit]))
					console.log('WARNING: tried to remove element from property that does not contain it: ' + id)
				}
			}else if(editFp.isPrimitiveRemoveCode[op]){
				var i = prop.indexOf(edit.value)
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
			var key = editPath[editPath.length-1].edit.key
			prop[key] = edit.id
			cb(prop, editId)
		}else if(editFp.isPutCode[op]){
			//_.errout('TODO: put')
			if(prop === undefined) prop = {}
			if(op === editCodes.putExisting){
				var key = editPath[editPath.length-1].edit.key
				prop[key] = edit.id
				_.assert(edit.id > 0)
				cb(prop, editId)
				//console.log('used putExisting: ' + key + ' -> ' + edit.id)
			}else{
				var key = editPath[editPath.length-1].edit.key
				prop[key] = edit.value
				cb(prop, editId)
				//console.log('used put: ' + key + ' -> ' + edit.value)
			}
		}else if(op === editCodes.delKey){
			var key = editPath[editPath.length-1].edit.key
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

function makePropertyTypesStream(ol, broadcaster, path, edits, editId, cb, continueListening){

	//if(path.length !== 2) _.errout('TODO: ' + JSON.stringify(path))	
	_.assertEqual(path[0].op, editCodes.selectObject)
	var objId = path[0].edit.id
	_.assertInt(objId)

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
	
	broadcaster.output.listenByObject(objId, function(typeCode, id, editPath, op, edit, syncId, editId){
		//if(path.length > 1) return
		var fullPath = [{op: editCodes.selectObject, edit: {id: id}}].concat(editPath)//[id].concat(path)
		
		var matched = false

		if(differentPaths(path, fullPath)){
			//log('edit does not match: ' + JSON.stringify(fullPath) + ' ' + JSON.stringify(path))
			return//id ===objId && path.length === 1 && path[0] === propertyCode){
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
			pm.forgetTemporary(real, temporary, syncId)
		},
		isTopLevelObject: function(id){
			return ol.isTopLevelObject(id)
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
		addEdit: function(id, op, path, edit, syncId, computeTemporary, reifyCb){
			//_.assertLength(arguments, 7);
			if(op !== editCodes.make && op !== editCodes.makeFork && op !== editCodes.forgetTemporary) _.assertInt(id);
			_.assertInt(syncId);
			_.assertInt(op)
			//TODO support merge models
			
			if(op === editCodes.make || op === editCodes.makeFork){
				return ap.persistEdit(-1, -1, [], op, edit, syncId, computeTemporary, Date.now())//TODO this timestamp is inconsistent with what will be serialized
			}else{
				_.assert(id < -1 || id > 0)
				
				if(id < -1){
					id = ap.translateTemporaryId(id, syncId)
				}
				_.assert(id > 0)
				pm(id, path, op, edit, syncId, computeTemporary, reifyCb)
			}
		},
		updatePath: function(id, path, syncId){
			pm.updatePath(id, path, syncId)
		},
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
		streamPropertyTypes: function(path, editId, cb, continueListening, mustMatch){
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
		},
	
		//TODO add specialize methods for streaming collection properties vs single-value properties?
		streamProperty: function(path, editId, cb, continueListening){
			_.assert(arguments.length >= 3)
			_.assert(arguments.length <= 4)
			_.assertArray(path)
			_.assertInt(editId)
			_.assertFunction(cb)

			_.assert(path.length >= 2)

			var realPath = computeRealPath(path)
			
			_.assertEqual(realPath[0].op, editCodes.selectObject)
			
			//console.log(JSON.stringify(realPath))
			
			var objId = realPath[0].edit.id
			//console.log('streamProperty: ' + JSON.stringify(path))
			_.assertInt(objId)

			ol.getIncludingForked(objId, -1, editId, function(edits){
				//console.log('got including forks: ' + JSON.stringify(path) + ' -> ' + JSON.stringify(edits))
				makePropertyStream(broadcaster, realPath, edits, editId, cb, continueListening, ol)
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
					process.nextTick(function(){//wait a bit so edits can happen, to avoid unnecessary thrashing of property states (especially during the initial make transactoin)
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
					})
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
						computeMap(id, res, undefined, function(id, map, resultEditId){
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
					process.nextTick(function(){//wait a bit so edits can happen, to avoid unnecessary thrashing of property states (especially during the initial make transactoin)
						ol.getAllIncludingForked(id, function(res){
							if(!adding[id]) return
							adding[id] = false
							ids[id] = true
							--outstandingEditCount
							if(ids[id]){
								computeMap(id, res, editId, function(id, map, resultEditId){
									console.log('here('+resultEditId+','+editId+'): ' + JSON.stringify(res))
									cb(id, map, resultEditId > editId?resultEditId:editId)//TODO is this right?
								}, destroyedCb, ol, objSchema, propertyCodes, isPc)
							}
							if(outstandingEditCount === 0){
								//adding = undefined
								liveCb(true)
							}
						})
					})
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
		getHistoricalCreationsOfType: function(typeCode, cb){
			ol.getHistoricalCreationsOfType(typeCode, cb)
		},
		getAllObjects: function(typeCode, cb){
			ol.getAllOfType(typeCode, cb)
		},
		getObjectType: function(id){
			_.assertLength(arguments, 1)
			return ol.getObjectType(id)
		}
	};
	
	return handle;
}

function computeMap(id, res, attachmentEditId, cb, destroyedCb, ol, objSchema, propertyCodes, isPc){
	_.assertLength(arguments, 9)
	
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
		}else if(op === editCodes.refork){
			//_.errout('TODO')
			map.forked = e.edit.sourceId
//			console.log('reforked: ' + JSON.stringify(res))
		}
		
		if(isInPc){
			if(editFp.isPrimitiveSetCode[op]){//op === 'setInt' || op === 'setString' || op === 'setBoolean'){
				map[pc] = e.edit.value
			}else if(op === editCodes.setObject){
				if(!ol.isDeleted(e.edit.id)){
					map[pc] = e.edit.id
				}
			}else if(op === editCodes.addExisting){
				//if(map[pc] === undefined) map[pc] = []
				if(!ol.isDeleted(e.edit.id)){
					map[pc].push(e.edit.id)
				}
			}else if(op === editCodes.unshiftExisting){
				//if(map[pc] === undefined) map[pc] = []
				if(!ol.isDeleted(e.edit.id)){
					map[pc].unshift(e.edit.id)
				}
			}else if(op === editCodes.addInt){
				//if(map[pc] === undefined) map[pc] = []
				map[pc].push(e.edit.value)
			}else if(op === editCodes.removeInt){
				var list = map[pc]
				list.splice(list.indexOf(e.edit.value), 1)
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

function computeAllHistoricalMaps(id, res, attachmentEditId, cb, destroyedCb, ol, objSchema, propertyCodes, isPc){
	_.assertLength(arguments, 9)
	
	console.log('computing all historical maps: ' + JSON.stringify(res))
	
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
