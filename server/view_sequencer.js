"use strict";

/*

Given a view, creates an initial snapshot and emits an edit stream suitable for a sync handle.

Also handles creating an initial state for the view.

*/

var buckets = require('./../deps/buckets')
var _ = require('underscorem')

var fparse = require('fparse')

var shared = require('./tcp_shared')

function orderEditsByEditIdAndOrder(a,b){
	if(a.editId !== b.editId){
		return a.editId - b.editId
	}else{
		return a.order - b.order
	}
}

// The structure of a snapshot is just an edit stream, with selectTopObject and selectTopViewObject edits added

function serializeSnapshot(startEditId, endEditId, codes, writers, objectEditBuffers, viewObjectEditBuffers){
	var w = fparse.makeSingleBufferWriter()
	var viewIds = Object.keys(viewObjectEditBuffers)
	w.putInt(startEditId)
	w.putInt(endEditId)
	w.putInt(objectEditBuffers.length)
	//console.log('many ids: ' + objectEditBuffers.length)
	objectEditBuffers.forEach(function(e){
		//_.assertInt(e.many)
		writers.selectTopObject(w, {id: e.id})
		//console.log('many edits: ' + e.many + ' (' + e.edits.length + ')')
		//w.putInt(e.many)//number of edits
		//console.log('e2: ' + JSON.stringify(e).slice(0,300))
		_.assertBuffer(e.edits)
		w.putData(e.edits)
	})
	//console.log('many view ids: ' + viewIds.length)
	w.putInt(viewIds.length)
	viewIds.forEach(function(id){
		var list = viewObjectEditBuffers[id]
		
		//w.putByte(codes['selectTopViewObject'])
		//w.putInt(-1)
		writers.selectTopViewObject(w, {id: id})

		//console.log('many edits: ' + list.length)
		w.putInt(list.length)//number of edits
		
		list.forEach(function(e){
			w.putByte(codes[e.op])
			//console.log('code: ' + codes[e.op])
			_.assertInt(e.editId)
			w.putInt(e.editId)
			writers[e.op](w, e.edit)
		})
	})
	var b = w.finish()
	return b
}
 
exports.makeSnapshot = function(schema, objectState, viewTypeCode, viewVariable, startEditId, endEditId, readyCb){
	_.assertLength(arguments, 7)
	console.log(' &&&&&&& between ' + startEditId + ' ' + endEditId)
	_.assert(endEditId === -1 || startEditId <= endEditId)
	_.assert(endEditId >= -1)
	
	_.assert(endEditId < objectState.getCurrentEditId())
	
	//console.log(new Error().stack)

	var fp = fparse.makeFromSchema(shared.editSchema)//TODO reuse
	
	var viewId = viewVariable.key

	//_.errout('TODO synthesize make event for root view object')
	var objectEditBuffers = []//unlike view objects, we don't have to worry about appending to these
	var viewObjectEditBuffers = {}//?
	if(startEditId === -1){
		viewObjectEditBuffers[viewId] = [{op: 'madeViewObject', edit: {id: viewId, typeCode: viewTypeCode}, editId: -1}]
	}
	var has = {}
	has[viewId] = true
	var ready = false
	
	var orderingIndex = 1
	
	var editBuffer = new buckets.Heap(orderEditsByEditIdAndOrder)
	
	function advanceEdits(){
		while(true){
			if(ready) return
			if(editBuffer.isEmpty()){
				//console.log('returning, empty')
				return
			}
			var e = editBuffer.peek()
			var oldestEditId = viewVariable.oldest()
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
		
		if(isView[e.typeCode] && viewObjectEditBuffers[e.id] === undefined){
			_.assertInt(e.typeCode)
			viewObjectEditBuffers[e.id] = [{op: 'madeViewObject', edit: {typeCode: e.typeCode, id: e.id}, editId: e.editId}]
		}
		
		var pathUpdater = pathUpdaters[e.id]
		if(pathUpdater === undefined) pathUpdater = pathUpdaters[e.id] = shared.makePathStateUpdater(schema, e.typeCode)
		
		pathUpdater(e.path, function(op, edit){
			//sendUpdate(op, edit, -1, up.editId, e.syncId)					
			//_.errout('TODO: ' + JSON.stringify(e.path))
			//emitEdit({op: op, edit: edit, syncId: -1, editId: e.editId})
			viewObjectEditBuffers[e.id].push({op: op, edit: edit, syncId: -1, editId: e.editId})
		})
		
		if(e.op === 'addExisting'){
			ensureHasObject(e.edit.id, e.editId)
		}else if(e.op === 'setObject'){
			ensureHasObject(e.edit.id, e.editId)
		}else if(e.op === 'putExisting'){
			ensureHasObject(e.edit.id, e.editId)
		}else if(e.op === 'putAddExisting'){
			ensureHasObject(e.edit.id, e.editId)
		}
		
		//TODO ensure hasObject for key for all puts where the key is an existing object
		if(e.op.indexOf('put') === 0 && pathUpdater.isKeyAnObject()){
			//process.exit(0)
			ensureHasObject(pathUpdater.getKey(), e.editId)
		}
		
		
		if(e.op === 'includeObject'){
			ensureHasObject(e.edit.id, e.editId)
		}else{
			viewObjectEditBuffers[e.id].push(e)
		}
	}
	var manyObjectsOut = 0
	function ensureHasObject(id, sourceEditId){
		_.assertInt(id)
		_.assertInt(sourceEditId)
		if(has[id] === undefined){
			//has[id] = true
			++manyObjectsOut
			//console.log('getting state(' + id + '): ' + manyObjectsOut)

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
				//console.log('added object to buffer: ' + id)
				//_.assertInt(manyEdits)
				if(editsBuffer){
					_.assertBuffer(editsBuffer)
					objectEditBuffers.push({id: id, edits: editsBuffer})
				}else{
					console.log('no edits, skipping object entirely: ' + id)
				}
			}, function(){
				--manyObjectsOut
				//console.log('got state(' + id + '): ' + manyObjectsOut)
			})	
		}
	}
	var detachViewVariable;
	var viewListeners = {
		set: function(viewId, editId){
		},
		objectChange: function(destTypeCode, destId, typeCode, id, path, op, edit, syncId, editId){
			_.assertLength(arguments, 9)
			_.assert(isView[typeCode])//?
			console.log('snapshot got op: ' + JSON.stringify(arguments))
			/*if(editId < startEditId || editId >= endEditId){
				console.log('outside range, ignoring')
				return
			}*/
			if(ready) return
			_.assertInt(editId)
			//TODO filter edits by editId?
			for(var i=0;i<path.length;++i){_.assert(_.isString(path[i]) || path[i] > 0);}
			editBuffer.add({order: ++orderingIndex, typeCode: typeCode, id: id, path: path, op: op, edit: edit, syncId: syncId, editId: editId})
		},
		shouldHaveObject: function(id, flag, editId){
			//_.errout('TODO')
			if(flag){
				ensureHasObject(id, editId)
			}else{
				_.errout('TODO')
			}
		}
	}
	
	var intervalHandle = setInterval(function(){
		//console.log('**U**')
		advanceEdits()
		if(manyObjectsOut === 0 && viewVariable.oldest() > endEditId){
			clearInterval(intervalHandle)
			editBuffer = undefined
			detachViewVariable()
			ready = true

			//console.log('snapshot: ' + JSON.stringify([objectEditBuffers, viewObjectEditBuffers]))
			var snapshot = serializeSnapshot(startEditId, endEditId,fp.codes, fp.writers, objectEditBuffers, viewObjectEditBuffers)
			_.assertBuffer(snapshot)
			console.log('SNAP READY: ' + JSON.stringify([viewVariable.oldest(), startEditId, endEditId]))
			console.log(JSON.stringify(viewObjectEditBuffers).slice(0,1000))
			//process.exit(0)
			readyCb(snapshot)
		}else{
			console.log('waiting for snapshot ' + manyObjectsOut + ' ' + viewVariable.oldest() + ' <? ' + endEditId + ' ' + objectState.getCurrentEditId() + ' ' + viewId)
		}
	}, 0)

	detachViewVariable = viewVariable.attach(viewListeners, endEditId)
}


exports.make = function(schema, objectState, broadcaster, includeObjectCb, editCb, infoSyncId){
	_.assertLength(arguments,6)

	
	//TODO return handle for disconnecting from sequence
	
	var editBuffer = new buckets.Heap(orderEditsByEditIdAndOrder)
	
	var timeoutHandle
	
	var latestSent = -1
	
	var orderIndex = 1
	
	function advanceEdits(){
		if(editBuffer.isEmpty()) return
		
		var oldestEditId = oldest()//TODO cache?
		_.assertInt(oldestEditId)
		var toEmit = []
		while(true){
			if(editBuffer.isEmpty()){
				console.log('emitting all: ' + toEmit.length)
				toEmit.forEach(emitEdit)
				return
			}
			var e = editBuffer.peek()
			if(e.editId < oldestEditId){
				toEmit.push(editBuffer.removeRoot()) //emitEdit(editBuffer.removeRoot())
			}else{
				console.log('not emitting edit yet ' + e.editId + ' ' + oldestEditId + ' ' + JSON.stringify(e))
				console.log('emitting all: ' + JSON.stringify(toEmit))
				toEmit.forEach(emitEdit)
				return;
			}
		}
	}

	var onNext = false;
	function advanceOnNext(){
		if(!onNext){
			onNext = true
			process.nextTick(function(){
				onNext = false;
				advanceEdits()
			})
		}
	}
	timeoutHandle = setInterval(advanceEdits, 0)
	
	function oldest(){
		if(viewVariables.length === 0){
			return objectState.getCurrentEditId()
		}
		var least
		viewVariables.forEach(function(vv){
			var old = vv.oldest()
			if(least === undefined || least > old) least = old
		})
		return least
	}


	//TODO how do we know which view objects already exist due to the snapshot?
	//TODO why not just have them created lazily client-side?
	var viewObjects = {}
	
	var isView = {}
	_.each(schema, function(objSchema){
		if(objSchema.isView) isView[objSchema.code] = true
	})

	var dd = Math.random()
	function emitEdit(e){
		console.log(dd + ' sync sequencer emitting(' + oldest() + '): ' + JSON.stringify(e))

		if(e.editId < latestSent){
			_.errout('out-of-order emitting happening: ' + latestSent + ' > ' + e.editId + ': ' + JSON.stringify(e))
		}
		latestSent = e.editId
		/*if(isView[e.typeCode] && viewObjects[e.id] === undefined){
			viewObjects[e.id] = true
			console.log('emitting automatically: madeViewObject: ' + e.edit.id)
			emitEdit({typeCode: -1, id: -1, path: [], op: 'madeViewObject', edit: {typeCode: e.typeCode, id: e.id}, editId: e.editId})
		}*/
		


		//console.log('***********')
		//console.log('***********')
		
		// we pass the deduplication task downstream
		if(_.isInt(e.edit.id)){//for view objects, we require that the constructing variables correctly include them
			if(e.op === 'addExisting'){
				includeObjectCb(e.edit.id, e.editId)
			}else if(e.op === 'setObject'){
				includeObjectCb(e.edit.id, e.editId)
			}
		}
		if(_.isInt(e.edit.newId)){
			if(e.op === 'replaceInternalExisting'){
				includeObjectCb(e.edit.newId, e.editId)
			}else if(e.op === 'replaceExternalExisting'){
				includeObjectCb(e.edit.newId, e.editId)
			}
		}
		//if(knownIds[e.id] === undefined){
		//	console.log('WARNING: extraneous edit was about to be emitted by sequencer, ignored due to the object not being known: ' + JSON.stringify(e))
		//}
		/*if(_.isInt(e.id) && e.id !== -1){
			includeObjectCb(e.id, -1)//e.editId)
		}*/
		
		_.assertArray(e.path)
		editCb(e)
	}
	
	var isReadyFuncs = []
	var detachFuncs = []
	var viewVariables = []
	
	return {
		addView: function(viewTypeCode, viewVariable, startEditId, readyCb){
			var viewId = viewVariable.key	
			var readyYetTimeoutHandle;
			var isReady = false
			viewVariables.push(viewVariable)
			function isReadyYet(){
				if(isReady) return;
				var old = viewVariable.oldest()
				if(old > startEditId){
					isReady = true
					//console.log('isReady: ' + old)
					readyCb()
				}else{
					//console.log('waiting for isReadyYet')
					if(readyYetTimeoutHandle === undefined){
						readyYetTimeoutHandle = setTimeout(function(){readyYetTimeoutHandle=undefined;isReadyYet()}, 50)
					}
				}
			}		
			var listenHandle = {
				set: function(viewId, editId){
				},
				objectChange: function(destTypeCode, destId, typeCode, id, path, op, edit, syncId, editId){
					_.assertInt(editId)
					//_.assert(editId >= 0)
					console.log(dd + ' (' + startEditId + ') ' + id + ' view got change: ' + op + ' ' + JSON.stringify(edit) + ' ' + syncId + ' ' + editId)
					//console.log(JSON.stringify(path))
					//console.log(new Error().stack)
					if(editId > startEditId){//ignore all changes already known to the consumer
						_.assertArray(path)
						if(_.isInt(id)) _.assert(id >= 0)
						for(var i=0;i<path.length;++i){_.assert(_.isString(path[i]) || path[i] > 0);}
						//console.log('sending change')
						//console.log(new Error().stack)
						
						var e = {order: ++orderIndex, typeCode: typeCode, id: id, path: path, op: op, edit: edit, syncId: syncId, editId: editId}

						if(editId < latestSent){
							_.errout('really out-of-order edit got: ' + latestSent + ' > ' + editId + ': ' + JSON.stringify(e))
						}

						editBuffer.add(e)
					}else{
						console.log('ignoring old edit: ' + editId + ' <= ' + startEditId)
					}
				},
				shouldHaveObject: function(id, flag, editId){
					if(flag){
						if(editId >= startEditId){
							includeObjectCb(id, editId)
							broadcaster.output.listenByObject(id, function(subjTypeCode, subjId, typeCode, id, path, op, edit, syncId, editId){
								//cb(typeCode, id, path, op, edit, syncId, editId)
								editBuffer.add({order: ++orderIndex, typeCode: typeCode, id: id, path: path, op: op, edit: edit, syncId: syncId, editId: editId})
							})
						}else{
							console.log('ignoring previous should')
						}
					}else{
						console.log('TODO: ' + id + ' ' + flag + ' ' + editId)
					}
				}
			}
			var detachFunc = viewVariable.attach(listenHandle, startEditId)
			detachFuncs.push(detachFunc)
			isReadyYet()
		},
		subscribeToObject: function(id){
			_.assert(id >= 0)
			objectState.subscribeToObject(id, function(subjTypeCode, subjId, path, op, edit, syncId, editId){//destTypeCode, destId, typeCode, id, path, op, edit, syncId, editId){
				console.log('adding edit via subscription for ' + infoSyncId)
				console.log(new Error().stack)
				_.assertInt(editId)
				_.assertArray(path)
				editBuffer.add({order: ++orderIndex, typeCode: subjTypeCode, id: subjId, path: path, op: op, edit: edit, syncId: syncId, editId: editId})
				//editBuffer.add({from: infoSyncId, typeCode: typeCode, id: id, path: path, op: op, edit: edit, syncId: syncId, editId: editId})
				advanceOnNext()
			})
		},
		end: function(){
			editBuffer = undefined
			clearInterval(timeoutHandle)
			detachFuncs.forEach(function(f){f()})
		}
	}
}

