"use strict";

/*

Given a view, creates an initial snapshot and emits an edit stream suitable for a sync handle.

Also handles creating an initial state for the view.

*/

var buckets = require('./../deps/buckets')
var _ = require('underscorem')

var fparse = require('fparse')

var shared = require('./tcp_shared')
var pathmerger = require('./pathmerger')

var editFp = require('./tcp_shared').editFp
var editCodes = editFp.codes
var editNames = editFp.names


function orderEditsByEditIdAndOrder(a,b){
	if(a.editId !== b.editId){
		return a.editId - b.editId
	}else{
		return a.order - b.order
	}
}

var log = require('quicklog').make('minnow/viewsequencer')

// The structure of a snapshot is just an edit stream, with selectTopObject and selectTopViewObject edits added

function serializeSnapshot(startEditId, endEditId, codes, writersByCode, objectEditBuffers, viewObjectEditBuffers){
	var w = fparse.makeSingleBufferWriter()
	w.putInt(startEditId)
	w.putInt(endEditId)
	
	var realObjBufs = []
	for(var i=0;i<objectEditBuffers.length;++i){
		var eb = objectEditBuffers[i]
		if(eb.edits.length > 4){
			realObjBufs.push(eb)
			//console.log('pushing: ' + eb.id + ' ' + eb.edits.length)
		}else{
			//console.log('discarding: ' + eb.id + ' ' + eb.edits.length)//TODO eliminate the need for this upstream
		}
	}
	
	w.putInt(realObjBufs.length)
	//console.log('put objs count: ' + realObjBufs.length)

	for(var i=0;i<realObjBufs.length;++i){
		var e = realObjBufs[i]

		writersByCode[editCodes.selectTopObject](w, {id: e.id})

		_.assertBuffer(e.edits)
		w.putData(e.edits, 0, e.edits.length)
	}

	serializeViewObjects(w, codes, writersByCode, viewObjectEditBuffers)
	
	var b = w.finish()
	return b
}

function serializeViewObjects(w, codes, writersByCode, viewObjectEditBuffers){
	var viewIds = Object.keys(viewObjectEditBuffers)
	w.putInt(viewIds.length)

	for(var i=0;i<viewIds.length;++i){
		var id = viewIds[i]
		var list = viewObjectEditBuffers[id]
		

		writersByCode[editCodes.selectTopViewObject](w, {id: id})

		serializeViewObject(w, codes, writersByCode, list)
	}
}

function serializeViewObject(w, codes, writersByCode, list){
	w.putInt(list.length)//number of edits
	
	for(var j=0;j<list.length;++j){
		var e = list[j]
		_.assertInt(e.op)
		w.putByte(e.op)//codes[e.op])
		_.assertInt(e.editId)
		w.putInt(e.editId)
		try{
			//console.log(JSON.stringify(writersByCode))
			writersByCode[e.op](w, e.edit)
		}catch(err){
			throw new Error('error writing op: (' + e.op + ') ' + JSON.stringify(e.edit)+'\n'+err)
		}	
	}
}
exports.serializeViewObject = serializeViewObject

var fp = shared.editFp
 
exports.makeSnapshot = function(schema, objectState, viewTypeCode, viewVariable, startEditId, endEditId, readyCb){
	_.assertLength(arguments, 7)

	_.assert(endEditId === -1 || startEditId <= endEditId)
	_.assert(endEditId >= -1)
	
	_.assert(endEditId < objectState.getCurrentEditId())
	
	var viewId = viewVariable.key

	var objectEditBuffers = []//unlike view objects, we don't have to worry about appending to these
	var viewObjectEditBuffers = {}//?
	if(startEditId === -1){
		viewObjectEditBuffers[viewId] = [{op: editCodes.madeViewObject, edit: {id: viewId, typeCode: viewTypeCode}, editId: -1}]
	}
	var has = {}
	has[viewId] = true
	var ready = false
	
	var orderingIndex = 1
	
	var editBuffer = new buckets.Heap(orderEditsByEditIdAndOrder)
	
	function advanceEdits(){
		if(editBuffer.isEmpty()) return
		var oldestEditId = viewVariable.oldest()
		//console.log('advancing edits')
		while(true){
			if(ready) return
			if(editBuffer.isEmpty()){
				//console.log('returning, empty')
				return
			}
			var e = editBuffer.peek()
			if(e.editId < oldestEditId){
				//console.log('emitting')
				emitEdit(editBuffer.removeRoot())
			}else{
				return
				//console.log('*not emitting: ' + e.editId + ' ' + oldestEditId + ' ' + e.op + ' ' + editBuffer.size())
				//console.log(new Error().stack)
			}
		}
	}
	
	var isView = {}
	_.each(schema, function(objSchema){
		if(objSchema.isView) isView[objSchema.code] = true
	})
	
	var pathUpdaters = {}
	
	function emitEdit(e){
		_.assertInt(e.editId)
		_.assertArray(e.path)
		
		//log('(makeSnapshot) emitting edit: ', e)
		
		if(isView[e.typeCode] && viewObjectEditBuffers[e.id] === undefined){
			_.assertInt(e.typeCode)
			viewObjectEditBuffers[e.id] = [{op: editCodes.madeViewObject, edit: {typeCode: e.typeCode, id: e.id}, editId: e.editId}]
		}

		var curPath = pathUpdaters[e.id]
		if(curPath === undefined){
			curPath = pathUpdaters[e.id] = []
		}
		var newPath = [].concat(e.path)
		pathmerger.editToMatch(curPath, newPath, function(op, edit){
			//log('sending update: ' + JSON.stringify([op, edit]))
			//sendUpdate(op, edit, -1, e.editId, e.syncId)					
			viewObjectEditBuffers[e.id].push({op: op, edit: edit, syncId: -1, editId: e.editId})
		})
		pathUpdaters[e.id] = newPath
		
		//_.errout('TODO: ' + JSON.stringify(e.path))
		
		if(e.op === editCodes.addExisting){
			ensureHasObject(e.edit.id, e.editId)
		}else if(e.op === editCodes.addAfter){
			ensureHasObject(e.edit.id, e.editId)
		}else if(e.op === editCodes.setObject){
			ensureHasObject(e.edit.id, e.editId)
		}else if(e.op === editCodes.putExisting){
			if(e.edit.id == null) _.errout('invalid e: ' + JSON.stringify(e))
			ensureHasObject(e.edit.id, e.editId)
		}else if(e.op === editCodes.putAddExisting){
			ensureHasObject(e.edit.id, e.editId)
		}else if(e.op === editCodes.selectObjectKey){
			ensureHasObject(e.edit.key, e.editId)
		}
		
		//TODO ensure hasObject for key for all puts where the key is an existing object
		if(editFp.isPutCode[e.op] && newPath[newPath.length-1].op === editCodes.selectObjectKey){//pathUpdater.isKeyAnObject()){
			//process.exit(0)
			ensureHasObject(newPath[newPath.length-1].edit.key, e.editId)
		}
		
		
		if(e.op === editCodes.includeObject){
			ensureHasObject(e.edit.id, e.editId)
		}else{
			viewObjectEditBuffers[e.id].push(e)
		}
	}
	var manyObjectsOut = 0
	function ensureHasObject(id, sourceEditId){
		_.assertInt(id)
		_.assertInt(sourceEditId)
		if(has[id] === undefined && !objectState.isDeleted(id)){
			//has[id] = true
			++manyObjectsOut
			//log('getting state(' + id + '): ' + manyObjectsOut)
			//console.log('getting state(' + id + '): ' + manyObjectsOut + ' ' + viewTypeCode)

			//gets only edits between the given range
			//TODO set start point to -1 if the first ensure source falls within this snapshots edit interval
			var s = startEditId
			if(startEditId < sourceEditId && (endEditId === -1 || sourceEditId <= endEditId)){
				s = -1
				//console.log('is ' + sourceEditId)
			}else{
				//console.log('not ' + startEditId + ' <= ' + sourceEditId + ' < ' + endEditId)
			}
			
			objectState.streamObjectState(has, id, s, endEditId, function(id, editsBuffer){
				_.assertLength(arguments, 2)
				//log('added object to buffer: ' + id)
				//_.assertInt(manyEdits)
				if(editsBuffer){
					_.assertBuffer(editsBuffer)
					objectEditBuffers.push({id: id, edits: editsBuffer})
				}else{
					//log('no edits, skipping object entirely: ' + id)
				}
			}, function(){
				--manyObjectsOut
				//console.log('got state(' + id + '): ' + manyObjectsOut)
			})	
		}else{
			//log('already has: ' + id)
		}
	}
	
	var includedViews = {}
	var viewInclusionCount = {}
	var viewDetachers = {}
	
	//var detachViewVariable;
	var viewListeners = {
		set: function(viewId, editId){},//stub
		includeObject: function(id, editId){
			ensureHasObject(id, editId)
		},
		objectChange: function(typeCode, id, path, op, edit, syncId, editId){
			_.assertLength(arguments, 7)
			_.assert(isView[typeCode])
			
			_.assertInt(editId)
			
			if(editId >= objectState.getCurrentEditId()){
				_.errout('editId too large: ' + editId)
			}
			
			if(ready) return

			editBuffer.add({order: ++orderingIndex, typeCode: typeCode, id: id, path: path, op: op, edit: edit, syncId: syncId, editId: editId})
		},
		includeView: function(viewId, viewHandle, editId){
			_.assertInt(editId)
			if(viewInclusionCount[viewId] === undefined){
				viewInclusionCount[viewId] = 1
				includedViews[viewId] = viewHandle
				viewDetachers[viewId] = viewHandle.include(viewListeners, editId)
			}else{
				++viewInclusionCount[viewId]
			}
		},
		removeView: function(viewId, viewHandle, editId){
			--viewInclusionCount[viewId]
			//console.log('removing view: ' + viewId + ' ' + viewInclusionCount[viewId])
			if(viewInclusionCount[viewId] === 0){
				delete viewInclusionCount[viewId]
				viewDetachers[viewId](editId)
				delete viewDetachers[viewId]
			}
		}
	}

	viewVariable.attach(viewListeners, endEditId)
	//_.assertFunction(detachViewVariable)
	
	var lastOldest = viewVariable.oldest()
	//console.log('initial oldest: ' + lastOldest)
	
	var intervalHandle = setInterval(function(){

		var oldest = viewVariable.oldest()
		//console.log('*** oldest: ' + oldest + ' ' + objectState.getCurrentEditId())
		if(oldest < lastOldest) _.errout('oldest must increase monotonically: ' + oldest + ' < ' + lastOldest + ' < ' + objectState.getCurrentEditId())
		lastOldest = oldest

		advanceEdits()
		if(manyObjectsOut === 0 && oldest > endEditId){
			clearInterval(intervalHandle)
			editBuffer = undefined
			//detachViewVariable()
			ready = true
			viewVariable.detach(viewListeners)

			var snapshot = serializeSnapshot(startEditId, endEditId,fp.codes, fp.writersByCode, objectEditBuffers, viewObjectEditBuffers)
			_.assertBuffer(snapshot)
			//log('SNAP READY: ', [oldest, startEditId, endEditId])

			readyCb(snapshot)
		}else{
			//log('waiting for snapshot ' + manyObjectsOut + ' ' + oldest + ' <? ' + endEditId + ' ' + objectState.getCurrentEditId() + ' ' + viewId)
		}
	}, 10)

}

var fs = require('fs')

function filterInclusions(op, edit, editId, includeObjectCb){
	_.assertInt(op)
	//console.log('filtering:', op,edit)

	if(_.isInt(edit.id)){//for view objects, we require that the constructing variables correctly include them
		if(op === editCodes.addExisting || op === editCodes.setObject || op === editCodes.putExisting || op === editCodes.addAfter){
			
			includeObjectCb(edit.id, editId)
		}
	}
	if(op === editCodes.selectObjectKey || op === editCodes.reselectObjectKey){
		includeObjectCb(edit.key, editId)
	}
	if(_.isInt(edit.newId)){
		if(op === editCodes.replaceInternalExisting){
			includeObjectCb(edit.newId, editId)
		}else if(op === editCodes.replaceExternalExisting){
			includeObjectCb(edit.newId, editId)
		}
	}
}

function lambdaRunner(f){f()}

exports.make = function(schema, objectState, broadcaster, alreadyHasCb, includeObjectCb, editCb, sendViewObject, infoSyncId){
	_.assertLength(arguments,8)

	var editBuffer = new buckets.Heap(orderEditsByEditIdAndOrder)
	
	var timeoutHandle
	
	var latestSent = -1
	
	var orderIndex = 1
	
	var oldestEditId = -1
	function advanceEdits(){
		if(editBuffer.isEmpty()) return
		
		_.assertInt(oldestEditId)
		var toEmit = []
		while(true){
			if(editBuffer.isEmpty()){
				//log('emitting all: ' + toEmit.length)
				toEmit.forEach(emitEdit)
				return
			}
			var e = editBuffer.peek()
			if(e.editId >= oldestEditId){
				var prev = oldestEditId
				oldestEditId = oldest()
				//console.log(prev + ' -> ' + oldestEditId)
			}
			if(e.editId < oldestEditId){
				toEmit.push(editBuffer.removeRoot())
			}else{
				//console.log('not emitting edit yet ' + e.editId + ' ' + oldestEditId + ' ' + objectState.getCurrentEditId() + ' ' + JSON.stringify(e))
				//log('emitting all: ', toEmit)
				toEmit.forEach(emitEdit)
				return;
			}
		}
	}

	timeoutHandle = setInterval(advanceEdits, 10)
	
	function oldest(){
		//console.log('oldest*$')
		if(viewVariables.length === 0){
			return objectState.getCurrentEditId()
		}
		var least
		for(var i=0;i<viewVariables.length;++i){
			var vv = viewVariables[i]
			var old = vv.oldest()
			if(least === undefined || least > old) least = old
		}
		return least
	}

	var isView = {}
	_.each(schema, function(objSchema){
		if(objSchema.isView) isView[objSchema.code] = true
	})

	var dd = Math.random()
	function emitEdit(e){
		//log(dd, ' sync sequencer emitting(', oldest(), '): ', e)
		//console.log(dd + ' sync sequencer emitting(' + oldest() + '): ' + JSON.stringify(e))

		if(e.editId < latestSent){
			_.errout('out-of-order emitting happening: ' + latestSent + ' > ' + e.editId + ': ' + JSON.stringify(e))
		}
		latestSent = e.editId

		//_.assertArray(e.path)
		editCb(e)
	}
	
	var isReadyFuncs = []
	var detachFuncs = []
	var viewVariables = []
	
	var alreadyHas = {}
	
	function inclusionsListener(id, editId){
		if(alreadyHas[id]) return
		alreadyHas[id] = true

		includeObjectCb(id, function(editId){
			listenObjectCb(id)
		})
	}

	function objectUpdateListener(typeCode, id, op, edit, syncId, editId){
		_.assertInt(op)
		_.assertInt(syncId)
		
		//_.assertDefined(shared.editSchema[op])
		
		if(!editBuffer){
			console.log('WARNING: editBuffer gone, seq already closed *')
			console.log(new Error().stack)
			return
		}
		filterInclusions(op, edit, editId, inclusionsListener)
		
		var e = {order: ++orderIndex, typeCode: typeCode, id: id, op: op, edit: edit, syncId: syncId, editId: editId}

		//console.log('got object update: ' + JSON.stringify(e))
		
		if(editId < latestSent){
			_.errout('really out-of-order edit got: ' + latestSent + ' > ' + editId + ': ' + JSON.stringify(e))
		}

		editBuffer.add(e)
	}
	
	var broadcastSet = broadcaster.output.updateBySet(objectUpdateListener)
	
	function addObjectToSet(id){
		broadcastSet.add(id)		
	}
	
	function listenObjectCb(id){
		if(!objectState.isDeleted(id)){
			//console.log(infoSyncId + '**listening for object ' + id + ' ' + objectState.getCurrentEditId())
			objectState.updateObject(id,objectState.getCurrentEditId(), objectUpdateListener, addObjectToSet)
		}
	}
	
	var includedViews = {}
	var viewInclusionCount = {}
	var viewDetachers = {}
				
	return {
		addView: function(viewTypeCode, viewVariable, startEditId, readyCb){
			var viewId = viewVariable.key	
			var readyYetTimeoutHandle
			var isReady = false
			viewVariables.push(viewVariable)
			
			function retryReady(){
				readyYetTimeoutHandle=undefined
				isReadyYet()
			}
			
			var viewObjectBuffers = {}
			
			function isReadyYet(){
				if(isReady) return;
				var old = viewVariable.oldest()
				//console.log('isReadyYet oldest')
				if(old > startEditId){
					isReady = true
					//console.log('isReady: ' + old)
					Object.keys(viewObjectBuffers).forEach(function(idStr){
						var edits = viewObjectBuffers[idStr]
						sendViewObject(idStr, edits)
					})
					viewObjectBuffers = undefined
					readyCb()
				}else{
					//console.log('waiting for isReadyYet')
					if(readyYetTimeoutHandle === undefined){
						readyYetTimeoutHandle = setTimeout(retryReady, 50)
					}
				}
			}	
			function requiresOldEditsInclusionsListener(id, editId){
				if(alreadyHas[id]) return
				alreadyHas[id] = true
				
				alreadyHasCb(id, editId)
				listenObjectCb(id, startEditId)//note startEditId instead of editId
			}
			
			var listenHandle = {
				set: function(viewId, editId){},//stub
				includeObject: function(id, editId){
					if(editId > startEditId){
						_.assert(objectState.isTopLevelObject(id))
						inclusionsListener(id, editId)
					}
				},
				includeView: function(viewId, handle, editId){
					//console.log('already included: ' + viewId)
					if(viewInclusionCount[viewId] === undefined){
						//console.log('including view: ' + viewId + ' ' + editId)
						viewInclusionCount[viewId] = 1
						includedViews[viewId] = handle
						viewDetachers[viewId] = handle.include(listenHandle, editId)
					}
				},
				removeView: function(viewId, handle, editId){
					--viewInclusionCount[viewId]
					//console.log('removing view: ' + viewId + ' ' + viewInclusionCount[viewId])
					if(viewInclusionCount[viewId] === 0){
						delete viewInclusionCount[viewId]
						delete includedViews[viewId]
						//console.log('detaching view: ' + viewId)
						if(viewDetachers[viewId]){
							var d = viewDetachers[viewId]
							delete viewDetachers[viewId]
							d()
						}
					}
				},
				objectChange: function(typeCode, id, path, op, edit, syncId, editId){
					_.assertLength(arguments, 7)
					_.assertInt(editId)
					_.assertString(id)
					_.assertInt(syncId)
					_.assertInt(op)
					
					//console.log('edit change: ' + JSON.stringify([typeCode, id, path, op, edit, syncId, editId]))
					
					if(editBuffer === undefined){
						console.log('WARNING: editBuffer gone, seq already closed')
						console.log(new Error().stack)
						return
					}
					
					if(editId === -20){

						filterInclusions(op, edit, editId, requiresOldEditsInclusionsListener)
						
						//console.log('-20ing')

						//aggregate into view object updates
						var vbo = viewObjectBuffers[id]
						if(vbo === undefined){
							vbo = viewObjectBuffers[id] = []
							viewObjectBuffers[id].path = []
							vbo.push({op: editCodes.setSyncId, edit: {syncId: -1}, editId: -20})//just a dummy to match with non-view objects
							vbo.push({op: editCodes.madeViewObject, edit: {typeCode: typeCode, id: id}, editId: -20})
						}
						pathmerger.editToMatch(vbo.path, path, function(op, edit){
							vbo.push({op: op, edit: edit, editId: editId})
						})
						vbo.path = path
						vbo.push({op: op, edit: edit, editId: editId})
						return
					}
					
					if(editId > startEditId){//ignore all changes already known to the consumer

						filterInclusions(op, edit, editId, inclusionsListener)
						
						_.assertArray(path)
						if(_.isInt(id)) _.assert(id >= 0)
						
						var e = {order: ++orderIndex, typeCode: typeCode, id: id, path: path, op: op, edit: edit, syncId: syncId, editId: editId}
						
						//console.log('sending: ' + JSON.stringify(e))

						if(editId < latestSent){
							_.errout('really out-of-order edit got: ' + latestSent + ' > ' + editId + ': ' + JSON.stringify(e))
						}

						//_.assertDefined(shared.editSchema[op])
						if(shared.editSchema[editNames[op]] === undefined) _.errout('invalid edit name: ' + op)

						editBuffer.add(e)
					}else{
					
						//console.log('ignoring old edit: ' + startEditId)
						//console.log(new Error().stack)
						
						filterInclusions(op, edit, editId, requiresOldEditsInclusionsListener)
						//log('otherwise, ignoring old edit: ' + editId + ' <= ' + startEditId)
					}
				}
			}
			//we attach with -20 so that we can accumulate the object inclusions
			var detachFunc = viewVariable.attach(listenHandle, -20)//objectState.getCurrentEditId()-1)
			//detachFuncs.push(detachFunc)
			isReadyYet()
		},
		subscribeToObject: function(id){
			_.assert(id >= 0)

			if(alreadyHas[id]){
				//console.log('ignored subscription, already has: ' + id)
				return
			}
			alreadyHas[id] = true
			
			//console.log(infoSyncId + ' subscribed to ' + id)
			
			listenObjectCb(id)
		},
		end: function(){
			//_.assertDefined(editBuffer)
			if(editBuffer === undefined) _.errout('already ended before')
			editBuffer = undefined
			clearInterval(timeoutHandle)
			//detachFuncs.forEach(lambdaRunner)
			Object.keys(viewDetachers).forEach(function(viewId){
				var d = viewDetachers[viewId]
				viewDetachers[viewId] = undefined
				if(d){
					d()
				}else{
					console.log('no detacher found for viewId: ' + viewId)
				}
			})
			broadcaster.output.stopUpdatingBySet(objectUpdateListener)
		}
	}
}

