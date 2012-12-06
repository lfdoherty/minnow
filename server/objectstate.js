"use strict";

var _ = require('underscorem');

var versions = require('./versions');

var set = require('structures').set;

//var pathupdater = require('./pathupdater')

var pathmerger = require('./pathmerger')
var pathsplicer = require('./pathsplicer')

var isPathOp = require('./editutil').isPathOp

var editFp = require('./tcp_shared').editFp
var editCodes = editFp.codes
var editNames = editFp.names
/*
function couldHaveForeignKey(objSchema){
	return _.any(objSchema.properties, function(p){
		if(p.type.type === 'object') return true;
		if(p.type.type === 'list' || p.type.type === 'set'){
			_.assert(p.type.members.type === 'primitive' || p.type.members.type === 'object');
			return p.type.members.type === 'object';
		}
	});
}*/

var log = require('quicklog').make('minnow/objectstate')

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
}

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
		}else if(op === editCodes.selectObject || op === editCodes.made){
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
/*
function differentOps(a, b){
	_.assertString(a)
	_.assertString(b)
	return a !== b && 're'+a !== b && 're'+b !== a
}*/
/*
function differentPathEdits(a, b){
	if(differentOps(a.op, b.op) || JSON.stringify(a.edit) !== JSON.stringify(b.edit)) return true
}*/

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
function makePropertyStream(broadcaster, path, edits, editId, cb, continueListening){

	//if(path.length !== 2) _.errout('TODO: ' + JSON.stringify(path))	

	var objId = path[0].edit.id
	var propertyCode = path[1].edit.typeCode

	var prop;

	//console.log('streamProperty got ' + edits.length + ' edits, path: ' + JSON.stringify(path))
	//console.log('streamProperty got ' + edits.length + ' edits ' + editId + ' ' + objId + ' ' + propertyCode)
	//console.log(JSON.stringify(edits))
	
	var tracker = makePathTracker(path)
	
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
			/*console.log(tracker.getDepth() + ' ' + editNames[op])
			if(tracker.matchesSubsequence() && tracker.getDepth() > 2 && tracker.getDepth() < path.length && tracker.getDepth() % 2 === 1){
				console.log(editNames[op])
				if(op === editCodes.setExisting || op === editCodes.putExisting || op === editCodes.addExisting){
					_.errout('TODO')
				}
			}*/
			
			return
		}/*else{
			console.log('* ' + tracker.getDepth() + ' ' + editNames[op])
		}*/
		
		//console.log('op: ' + editNames[op] + ' ' + JSON.stringify(e))
		
		if(editFp.isSetCode[op]){//op.indexOf('set') === 0){
			if(editFp.isPrimitiveSetCode[op]){//op === 'setString' || op === 'setLong' || op === 'setBoolean' || op === 'setInt'){
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
		}else if(editFp.isAddCode[op]){//op.indexOf('add') === 0){
			if(prop === undefined) prop = []
			if(editFp.isPrimitiveAddCode[op]){//op === 'addString' || op === 'addLong' || op === 'addInt'){
				if(prop.indexOf(e.edit.value) === -1){
					//console.log('added primitive: ' + e.edit.value)
					prop.push(e.edit.value)
				}
			}else if(op === editCodes.addExisting || op === editCodes.addedNew){
				if(prop.indexOf(e.edit.id) === -1){
					prop.push(e.edit.id)
				}
			}else{
				_.errout('TODO: ' + JSON.stringify(e))
			}
		}else if(editFp.isRemoveCode[op]){//op.indexOf('remove') === 0){
			if(op === editCodes.remove){
				_.errout('TODO')
				/*var i = prop.indexOf(e.edit.id)
				if(i !== -1){
					//console.log('removing object from property')
					prop.splice(i, 1)
				}else{
					log('warning: removed object not in set: ' + e.edit.id)
				}	*/
				var id = editPath[editPath.length-1].edit.id
				var i = prop.indexOf(id)
				if(i !== -1){
					c//onsole.log('removing object from property')
					prop.splice(i, 1)
				}else{
					_.errout('TODO: ' + JSON.stringify([op, edit]))
				}						
			}else if(editFp.isPrimitiveRemoveCode[op]){//op === 'removeString' || op === 'removeInt' || op === 'removeLong' || op === 'removeBoolean'){
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
		}else if(editFp.isPutCode[op]){//op.indexOf('put') === 0){
			//_.errout('TODO: put')
			if(prop === undefined) prop = {}
			if(op === editCodes.putExisting){
				prop[lastKey] = (e.edit.id)
			}else{
				_.assertDefined(e.edit.value)
				prop[lastKey] = e.edit.value
				//_.errout('TODO: ' + op)
			}
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
			}else{
				_.errout('TODO: ' + op)
			}
		}else if(editFp.isRemoveCode[op]){
			if(op === editCodes.remove){
				//_.errout('TODO')
				var id = editPath[editPath.length-1].edit.id
				var i = prop.indexOf(id)
				if(i !== -1){
					//console.log('removing object from property')
					prop.splice(i, 1)
					cb(prop, editId)
				}else{
					_.errout('TODO: ' + JSON.stringify([op, edit]))
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
			if(op === editCodes.addExisting){
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
		isDeleted: function(id){
			return ol.isDeleted(id)
		},
		addEdit: function(id, op, path, edit, syncId, computeTemporary, reifyCb){
			//_.assertLength(arguments, 7);
			if(op !== editCodes.make && op !== editCodes.forgetTemporary) _.assertInt(id);
			_.assertInt(syncId);
			_.assertInt(op)
			//TODO support merge models
			
			if(op === editCodes.make){
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

			ol.get(objId, -1, editId, function(edits){
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

			ol.get(objId, -1, editId, function(edits){
				makePropertyStream(broadcaster, realPath, edits, editId, cb, continueListening)
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

			ol.get(objId, -1, editId, function(edits){
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

			var isPc = {}
			for(var i=0;i<propertyCodes.length;++i){
				isPc[propertyCodes[i]] = true
			}			
			
			var objSchema = schema._byCode[objTypeCode]
			
			function eventListener(typeCode, id, path, op, edit, syncId, editId){
				
				
				//console.log('op: ' + op)
				if(op === editCodes.destroy){
					destroyedCb(id, editId)
					return//TODO?
				}

				++outstandingEditCount

				if(outstandingEditCount === 1){
					liveCb(false, editId)
				}
			
				ol.getAll(id, function(res){
			
					--outstandingEditCount
				
					computeMap(id, res, undefined, cb, destroyedCb, ol, objSchema, propertyCodes, isPc)
					liveCb(true)
				})
			}
			ol.getAllObjectsOfType(objTypeCode, function(id, res){
				computeMap(id, res, attachmentEditId, cb, destroyedCb, ol, objSchema, propertyCodes, isPc)				
			}, function(){
				//console.log('got all objects of type')
				liveCb(true)				
				broadcaster.output.listenByType(objTypeCode, eventListener)
			})
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
			
				ol.getAll(id, function(res){
			
					--outstandingEditCount

					if(ids[id]){
						computeMap(id, res, undefined, cb, destroyedCb, ol, objSchema, propertyCodes, isPc)
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
						ol.getAll(id, function(res){
							if(!adding[id]) return
							delete adding[id]
							ids[id] = true
							--outstandingEditCount
							if(ids[id]){
								computeMap(id, res, editId, cb, destroyedCb, ol, objSchema, propertyCodes, isPc)
							}
							if(outstandingEditCount === 0){
								liveCb(true)
							}
						})
					})
				},
				remove: function(id, editId){
					if(adding[id]){
						--outstandingEditCount
						if(outstandingEditCount === 0){
							liveCb(true)
						}
						delete adding[id]
					}
					delete ids[id]
				}
			}
			
			return setListener
			
			/*ol.getAllObjectsOfType(objTypeCode, computeMap, function(){
				//console.log('got all objects of type')
				liveCb(true)				
				broadcaster.output.listenByType(objTypeCode, eventListener)
			})*/
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
	
	_.assertEqual(res[1].op, editCodes.made)
	
	for(var i=0;i<res.length;++i){
		var e = res[i]
		//var ignorable = pu.update(e)
		var op = e.op
		
		if(op === editCodes.selectProperty){
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
		}
		
		if(isInPc){
			if(editFp.isPrimitiveSetCode[op]){//op === 'setInt' || op === 'setString' || op === 'setBoolean'){
				map[pc] = e.edit.value
			}else if(op === editCodes.setObject){
				if(!ol.isDeleted(e.edit.id)){
					map[pc] = e.edit.id
				}
			}else if(op === editCodes.addExisting){
				if(map[pc] === undefined) map[pc] = []
				if(!ol.isDeleted(e.edit.id)){
					map[pc].push(e.edit.id)
				}
			}else if(op === editCodes.addInt){
				if(map[pc] === undefined) map[pc] = []
				map[pc].push(e.edit.value)
			}else if(op === editCodes.removeInt){
				var list = map[pc]
				list.splice(list.indexOf(e.edit.value), 1)
			}else if(op === editCodes.destroy){
				console.log('destroyed included: ' + id)
				destroyedCb(id, e.editId)
			}else{
				_.errout('TODO: ' + editNames[e.op] + ' ' + JSON.stringify(e))
			}
		}
	}
	for(var i=0;i<propertyCodes.length;++i){
		var pc = propertyCodes[i]
		if(map[pc] === undefined){
			var t = objSchema.propertiesByCode[pc].type
			if(t.type === 'set' || t.type === 'list'){
				map[pc] = []
			}
		}
	}
	//console.log('computed map: ' + JSON.stringify(map))
	var resultEditId = res.length > 0 ? res[res.length-1].editId : -1
	if(attachmentEditId) resultEditId = attachmentEditId
	cb(id, map, resultEditId)
}

/*
function computeMap(id, res, cb, destroyedCb, ol, objSchema, propertyCodes, isPc){
	var pu = pathsplicer.make()
	var map = {}

	//_.assert(!ol.isDeleted(id))
	
	for(var i=0;i<res.length;++i){
		var e = res[i]
		var ignorable = pu.update(e)

		
		if(!ignorable && pu.getPath().length === 1){
			var pc = pu.getPath()[0].edit.typeCode
			if(!isPc[pc]) continue
			if(e.op === 'setInt' || e.op === 'setString' || e.op === 'setBoolean'){
				map[pc] = e.edit.value
			}else if(e.op === 'setObject'){
				if(!ol.isDeleted(e.edit.id)){
					map[pc] = e.edit.id
				}
			}else if(e.op === 'addInt'){
				if(map[pc] === undefined) map[pc] = []
				map[pc].push(e.edit.value)
			}else if(e.op === 'removeInt'){
				var list = map[pc]
				list.splice(list.indexOf(e.edit.value), 1)
			}else if(e.op === 'destroy'){
				console.log('destroyed included: ' + id)
				destroyedCb(id, e.editId)
			}else{
				_.errout('TODO: ' + JSON.stringify(e))
			}
		}
	}
	for(var i=0;i<propertyCodes.length;++i){
		var pc = propertyCodes[i]
		if(map[pc] === undefined){
			var t = objSchema.propertiesByCode[pc].type
			if(t.type === 'set' || t.type === 'list'){
				map[pc] = []
			}
		}
	}
	//console.log(JSON.stringify(map))
	cb(id, map, res.length > 0 ? res[res.length-1].editId : -1)
}
*/
