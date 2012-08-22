"use strict";

var fs = require('fs')

var _ = require('underscorem')
var sf = require('segmentedfile')
var indexFile = require('indexfilestream')
var parsicle = require('parsicle')
var fparse = require('fparse')
var shared = require('./tcp_shared')

var pathsplicer = require('./pathsplicer')
var bin = require('./../util/bin')
var olcache = require('./olcache')

function serializeEdits(fp, edits){
	var w = fparse.makeSingleBufferWriter()
	w.putInt(edits.length)
	edits.forEach(function(e){
		//w.putString(e.op)
		_.assertString(e.op)
		w.putByte(fp.codes[e.op])
		w.putInt(e.editId)
		fp.writers[e.op](w, e.edit)
	})
	return w.finish()
}

var log = require('quicklog').make('minnow/ol')

var fp = shared.editFp

function OlReaders(ol){
	this.ol = ol
	this.currentId = -1
	this.currentSyncId = -1
	this.lastVersionId = 1
	this.manySyncIdsMade = 0
}
OlReaders.prototype.make = function(e){
	var n = this.ol._make(e)//TODO
	this.currentId = n.id
	log('got make', e.typeCode, ':', this.currentId)
}
OlReaders.prototype.setSyncId = function(e){
	this.currentSyncId = e.syncId
}
OlReaders.prototype.selectTopObject = function(e){
	this.currentId = e.id
	_.assertInt(this.currentId)
}
OlReaders.prototype.selectTopViewObject = function(e){
	_.errout('cannot save view object')
},
OlReaders.prototype.syntheticEdit = function(){
	++this.lastVersionId
},
OlReaders.prototype.destroy = function(){
	this.ol._destroy(this.currentId)//TODO
	this.currentId = undefined	
},
OlReaders.prototype.madeSyncId = function(){
	++this.manySyncIdsMade
	log('made sync id')
}

_.each(shared.editSchema._byCode, function(objSchema){
	var name = objSchema.name
	/*if(readers[name] === undefined){
		readers[name] = appendEdit.bind(undefined, name)
	}*/
	if(OlReaders.prototype[name] === undefined){
		OlReaders.prototype[name] = function(edit){
			//appendEdit(name, edit)
			this.ol.persist(this.currentId, name, edit, this.currentSyncId)
		}//appendEdit.bind(undefined, name)
	}
})

function Ol(){
	this.readers = new OlReaders(this)
	this.olc = olcache.make()
	this.objectCurrentSyncId = {}
	this.idCounter = 0
	
	this.idsByType = {}
	this.objectTypeCodes = {}
	this.destroyed = {}//for better bug reporting
	
	this.stats = {
		make: 0,
		change: 0,
		writeToDisk: 0,
		reallyReadFromDisk: 0,
		readFromDisk: 0,
		readFromDiskCache: 0,
		readFromBuffer: 0
	}
}
Ol.prototype._make = function make(edit, syncId){

	++this.stats.make
		
	++this.idCounter;
	var editId = this.readers.lastVersionId
	++this.readers.lastVersionId
	
	log('wrote object ', this.idCounter)
	
	var id = this.idCounter
	this.olc.assertUnknown(id)
	this.olc.addEdit(id, {op: 'setSyncId', edit: {syncId: syncId}, editId: editId})
	this.olc.addEdit(id, {op: 'made', edit: {typeCode: edit.typeCode, id: this.idCounter}, editId: editId})
	//setObjectCurrentSyncId(id, syncId)
	this.objectCurrentSyncId[id] = syncId
	
	if(this.idsByType[edit.typeCode] === undefined){
		this.idsByType[edit.typeCode] = []
	}
	this.idsByType[edit.typeCode].push(this.idCounter)

	
	this.readers.currentId = this.idCounter
	this.objectTypeCodes[this.idCounter] = edit.typeCode

	return {id: this.idCounter, editId: editId}
}
Ol.prototype._destroy = function(id){

	this.olc.destroy(id)
	
	//_.each(idsByType, function(arr, tcStr){
	var keys = Object.keys(this.idsByType)
	for(var i=0;i<keys.length;++i){
		var arr = this.idsByType[keys[i]]
		var i = arr.indexOf(id)
		if(i !== -1){
			arr.splice(i, 1)
		}
	}
	
	this.destroyed[id] = true
}
Ol.prototype._getForeignIds = function(id, editId, cb){
	this.get(id, -1, editId, function(edits){
		var de = edits//deserializeEdits(edits)
		var ids = []
		var has = {}
		//console.log('getting foreign edits in: ' + JSON.stringify(edits))
		for(var i=0;i<de.length;++i){
			var e = de[i]
			if(e.op === 'setExisting' || e.op === 'addExisting' || e.op === 'setObject'){
				var id = e.edit.id
				if(!has[id]){
					ids.push(id)
					has[id] = true
				}
			}
		}
		//console.log('got: ' + JSON.stringify(ids))
		cb(ids)
	})
}

//readers: readers,
Ol.prototype.close = function(cb){//TODO wait for writing to sync
	//function closed(){
		console.log('closed indexWriter, maybe waiting for sync')
		console.log('closed ol')
		cb()
	//}
	//closed()
}

Ol.prototype.getAsBuffer = function(id, startEditId, endEditId, cb){//TODO optimize away
	_.assertLength(arguments, 4)
	_.assertInt(startEditId)
	_.assertInt(endEditId)
	_.assertInt(id)
	_.assert(id >= 0)

	//_.errout('TODO')

	/*this.get(id, startEditId, endEditId, function(actual){
		if(actual.length > 0){
			var buf = serializeEdits(fp, actual)
			cb(buf)
		}else{
			cb()
		}
	})*/
	
	var w = fparse.makeSingleBufferWriter(100)
	this.olc.serializeBinaryRange(id, startEditId, endEditId, w)
	var buf = w.finish()
	/*var str = ''
	for(var i=0;i<buf.length;++i){
		str += buf[i] + ' '
	}
	console.log('str(' + buf.length + '): ' + str)*/
	cb(buf)
	/*var actual = []
	edits.forEach(function(e){
		_.assertInt(e.editId)
		if(startEditId <= e.editId && (endEditId === -1 || e.editId <= endEditId)){
			actual.push(e)
		}
	})
	cb(actual)*/

}
Ol.prototype.get = function(id, startEditId, endEditId, cb){//TODO optimize away
	_.assertLength(arguments, 4)
	_.assertInt(startEditId)
	_.assertInt(endEditId)
	_.assertInt(id)
	
	var edits = this.olc.get(id)
	var actual = []
	edits.forEach(function(e){
		_.assertInt(e.editId)
		if(startEditId <= e.editId && (endEditId === -1 || e.editId <= endEditId)){
			actual.push(e)
		}
	})
	cb(actual)
}
Ol.prototype.isTopLevelObject = function(id){
	//var index = bufferIndex[id];
	//return index !== undefined//TODO also lookup disk index			
	//_.errout('TODO')
	return this.objectTypeCodes[id] !== undefined//this.olc.has(id)
}
Ol.prototype.getLatest = function(id, cb){//TODO optimize away
	_.assertLength(arguments, 2)
	_.errout('TODO')
}
Ol.prototype.has = function(id){
	_.errout('TODO')
}
Ol.prototype.retrieve = function(id, cb){
	_.errout('DEPRECATED, same as get?')
}
Ol.prototype.syntheticEditId = function(){
	var editId = this.readers.lastVersionId
	++this.readers.lastVersionId
	return editId
}
Ol.prototype.persist = function(id, op, edit, syncId){
	if(op === 'make'){
		return this._make(edit, syncId)
	}
	//console.log('PERSISTING PERSISTING: ' + JSON.stringify(arguments))
	_.assertInt(id)
	_.assert(id > 0)
	
	var newEdits = []
	
	var objCurrentSyncId = this.objectCurrentSyncId[id]

	if(objCurrentSyncId !== syncId){
		this.olc.addEdit(id, {op: 'setSyncId', edit: {syncId: syncId}, editId: this.readers.lastVersionId})					
		this.objectCurrentSyncId[id] = syncId
		++this.readers.lastVersionId
	}

	var res = {editId: this.readers.lastVersionId}
	++this.readers.lastVersionId

	if(op === 'addNew'){
		op = 'addedNew'
		++this.idCounter
		res.id = this.idCounter
		edit = {id: res.id, typeCode: edit.typeCode}
	}else if(op === 'replaceInternalNew' || op === 'replaceExternalNew'){
		op = 'replacedNew'
		++this.idCounter
		res.id = this.idCounter
		edit = {typeCode: edit.typeCode, newId: res.id, oldId: edit.id}
	}else if(op === 'setToNew'){
		op = 'wasSetToNew'
		++this.idCounter
		res.id = this.idCounter
		edit = {typeCode: edit.typeCode, id: res.id}
	}else if(op === 'putNew'){
		op = 'didPutNew'
		++this.idCounter
		res.id = this.idCounter
		_.assert(edit.typeCode > 0)
		edit = {typeCode: edit.typeCode, id: res.id}
	}else if(op === 'destroy'){
		//_.errout('TODO')
		this._destroy(id)
	}
	res.edit = edit
	res.op = op

	this.olc.addEdit(id, {op: op, edit: edit, editId: res.editId})
	
	return res

}
//streams the object and its dependencies
Ol.prototype.streamVersion = function(already, id, startEditId, endEditId, cb, endCb){
	_.assert(id >= 0)
	
	if(already[id]){
		log('already got: ' + id)
		endCb()
		return
	}
	already[id] = true

	var gCdl = _.latch(2, function(){
		endCb()
	})
	
	this.getAsBuffer(id, startEditId, endEditId, function(res){
		cb(id, res)
		gCdl()
	})
	
	var local = this
	this._getForeignIds(id, endEditId, function(ids){
		
		var cdl = _.latch(ids.length, gCdl)
		
		for(var i=0;i<ids.length;++i){

			if(ids[i] === id){
				cdl()
				continue
			}
			
			local.streamVersion(already, ids[i], startEditId, endEditId, cb, cdl)
		}
	})
}
Ol.prototype.getObjectMetadata = function(id, cb){
	var pu = pathsplicer.make()
	this.get(id, -1, -1, function(edits){
		pu.updateAll(edits)
		cb(pu.getTypeCode(), pu.getPath(), pu.getSyncId())
	})
}
Ol.prototype.getObjectType = function(id){
	_.assertLength(arguments, 1)

	var tc = this.objectTypeCodes[id]
	if(tc === undefined) _.errout('unknown id: ' + id)
	return tc
}
//ensures that the requested id will retrieve synchronously for the lifetime
//of the cb call.
//this is for change calls.
/*cache: function(id, cb){
	_.errout('TODO')
},*/
Ol.prototype.getLatestVersionId = function(){
	return this.readers.lastVersionId;
}
Ol.prototype.getMany = function(typeCode){
	return (this.idsByType[typeCode] || []).length
}
Ol.prototype.getAllIdsOfType = function(typeCode, cb){//gets a read-only copy of all objects of that type
	_.assertLength(arguments, 2)
	var ids = this.idsByType[typeCode] || [];
	//console.log('ol getting ids(' + typeCode + '): ' + JSON.stringify(ids))
	cb(ids)
}
Ol.prototype.getAllOfType = function(typeCode, cb){//gets a read-only copy of all objects of that type
	_.assertLength(arguments, 2)
	//_.errout('TODO')
	var objs = []
	var ids = this.idsByType[typeCode] || [];
	var cdl = _.latch(ids.length, function(){
		cb(objs)
	})
	function storeCb(obj){
		_.assertObject(obj)
		objs.push(obj)
		cdl()
	}
	ids.forEach(function(id){handle.get(id, storeCb);})
}
Ol.prototype.getAllObjectsOfType = function(typeCode, cb, doneCb){
	var ids = this.idsByType[typeCode] || [];
	var cdl = _.latch(ids.length, function(){
		doneCb()
	})
	for(var i=0;i<ids.length;++i){
		var id = ids[i]
		this.get(id, -1, -1, function(obj){
			cb(id, obj)
			cdl()
		});
	}
}

Ol.prototype.getInitialManySyncIdsMade = function(){
	return this.readers.manySyncIdsMade
}

exports.make = function(dataDir, schema, cb){
	var ol = new Ol()
	//return ol
	cb(ol)
}

/*
exports.make = function(dataDir, schema, cb){
	_.assertLength(arguments, 3)
	_.assertFunction(cb)

	var olc = olcache.make()

	var idCounter = 0;

	var stats = {
		make: 0,
		change: 0,
		writeToDisk: 0,
		reallyReadFromDisk: 0,
		readFromDisk: 0,
		readFromDiskCache: 0,
		readFromBuffer: 0
	}

	var idsByType = {}
	
	var lastVersionId = 1
	
	var destroyed = {}//just for better error msgs
	
	var objectTypeCodes = {}

	var objectCurrentSyncId = {}
	function getObjectCurrentSyncId(id){return objectCurrentSyncId[id];}
	function setObjectCurrentSyncId(id, syncId){objectCurrentSyncId[id] = syncId;}
	
	function addByType(typeCode, id){
		if(idsByType[typeCode] === undefined){
			idsByType[typeCode] = []
		}
		idsByType[typeCode].push(id)
	}

	var manySyncIdsMade = 0
	
	var currentSyncId
	var currentId
	var readers = {
		make: function(e){

			var n = make(e)
			currentId = n.id
			log('got make', e.typeCode, ':', currentId)
		},
		setSyncId: function(e){
			currentSyncId = e.syncId
		},
		selectTopObject: function(e){
			currentId = e.id
			_.assertInt(currentId)
		},
		selectTopViewObject: function(e){
			//currentId = e.id
			_.errout('cannot save view object')
		},
		syntheticEdit: function(){
			++lastVersionId
		},
		destroy: function(){
			destroy(currentId)
			currentId = undefined	
		},
		madeSyncId: function(){
			++manySyncIdsMade
			log('made sync id')
		}
	}
	
	function destroy(id){

		olc.destroy(id)
		
		_.each(idsByType, function(arr, tcStr){
			var i = arr.indexOf(id)
			if(i !== -1){
				arr.splice(i, 1)
			}
		})
		
		destroyed[id] = true
	}
	
	function appendEdit(op, edit){
		_.assertDefined(currentId)
		log(currentId, 'appending', op, edit)
		handle.persist(currentId, op, edit, currentSyncId)
	}
	_.each(shared.editSchema._byCode, function(objSchema){
		var name = objSchema.name
		if(readers[name] === undefined){
			readers[name] = appendEdit.bind(undefined, name)
		}
	})
	
	function make(edit, syncId){
	
		++stats.make
			
		++idCounter;
		var editId = lastVersionId
		++lastVersionId
		
		log('wrote object ', idCounter)
		
		var id = idCounter
		olc.assertUnknown(id)
		olc.addEdit(id, {op: 'setSyncId', edit: {syncId: syncId}, editId: editId})
		olc.addEdit(id, {op: 'made', edit: {typeCode: edit.typeCode, id: idCounter}, editId: editId})
		setObjectCurrentSyncId(id, syncId)
		
		addByType(edit.typeCode, idCounter);
		
		currentId = idCounter
		objectTypeCodes[currentId] = edit.typeCode

		return {id: idCounter, editId: editId}
	}
	
	//TODO make more accurate and efficient
	//TODO especially we need to track the current path state to determine when edits override or cancel out one another
	//TODO perhaps we should just implement 'merging' to flatten the edit sequence to the non-overridden edits
	function getForeignIds(id, editId, cb){
		handle.get(id, -1, editId, function(edits){
			var de = edits//deserializeEdits(edits)
			var ids = []
			var has = {}
			//console.log('getting foreign edits in: ' + JSON.stringify(edits))
			for(var i=0;i<de.length;++i){
				var e = de[i]
				if(e.op === 'setExisting' || e.op === 'addExisting' || e.op === 'setObject'){
					var id = e.edit.id
					if(!has[id]){
						ids.push(id)
						has[id] = true
					}
				}
			}
			//console.log('got: ' + JSON.stringify(ids))
			cb(ids)
		})
	}
	
	function deserializeEdits(edits){
		var result = []
		edits.forEach(function(e){
			//console.log('edit: ' + JSON.stringify(e.edit))
			var r = fparse.makeSingleReader(e.edit)
			var edit = r.readers[e.op]()
			result.push({op: e.op, edit: edit, editId: e.editId})
		})
		return result
	}
	
	var handle = {
		readers: readers,
		close: function(cb){//TODO wait for writing to sync
			function closed(){
				console.log('closed indexWriter, maybe waiting for sync')
				console.log('closed ol')
				cb()
			}
			closed()
		},

		getAsBuffer: function(id, startEditId, endEditId, cb){//TODO optimize away
			_.assertLength(arguments, 4)
			_.assertInt(startEditId)
			_.assertInt(endEditId)
			_.assertInt(id)
			_.assert(id >= 0)
			
			//console.log('getting ' + id + ' ' + startEditId + ' - ' + endEditId)
			
			var edits = olc.get(id)

			var actual = []
			edits.forEach(function(e){
				//console.log(JSON.stringify(e).slice(0,300))
				_.assertInt(e.editId)
				if(startEditId < e.editId && (endEditId === -1 || e.editId <= endEditId)){
					//console.log('adding: ' + JSON.stringify(e))
					actual.push(e)
				}else{
					//console.log('skipping ' + e.editId)
				}
			})

			if(actual.length > 0){
				var buf = serializeEdits(fp, actual)
				cb(buf)
			}else{
				cb()
			}
		},
		get: function(id, startEditId, endEditId, cb){//TODO optimize away
			_.assertLength(arguments, 4)
			_.assertInt(startEditId)
			_.assertInt(endEditId)
			_.assertInt(id)
			
			//console.log('getting ' + id + ' ' + startEditId + ' - ' + endEditId)
			
			var edits = olc.get(id)
			var actual = []
			edits.forEach(function(e){
				_.assertInt(e.editId)
				if(startEditId <= e.editId && (endEditId === -1 || e.editId <= endEditId)){
					actual.push(e)
				}else{
					//console.log('skipping ' + startEditId + ' <= ' + e.editId + ' < ' + endEditId)
				}
			})
			//console.log('cbing: ' + JSON.stringify(actual))
			cb(actual)
		},
		isTopLevelObject: function(id){
			var index = bufferIndex[id];
			return index !== undefined//TODO also lookup disk index			
		},
		getLatest: function(id, cb){//TODO optimize away
			_.assertLength(arguments, 2)
			_.errout('TODO')
		},
		has: function(id){
			_.errout('TODO')
		},
		retrieve: function(id, cb){
			handle.get(id, cb)
		},
		syntheticEditId: function(){
			var editId = lastVersionId
			++lastVersionId
			return editId
		},
		persist: function(id, op, edit, syncId){
			if(op === 'make'){
				return make(edit, syncId)
			}
			//console.log('PERSISTING PERSISTING: ' + JSON.stringify(arguments))
			_.assertInt(id)
			_.assert(id > 0)
			
			var newEdits = []
			
			var objCurrentSyncId = getObjectCurrentSyncId(id)
		
			if(objCurrentSyncId !== syncId){
				olc.addEdit(id, {op: 'setSyncId', edit: {syncId: syncId}, editId: lastVersionId})					
				setObjectCurrentSyncId(id, syncId)
				++lastVersionId
			}

			var res = {editId: lastVersionId}
			++lastVersionId

			if(op === 'addNew'){
				op = 'addedNew'
				++idCounter
				res.id = idCounter
				edit = {id: res.id, typeCode: edit.typeCode}
			}else if(op === 'replaceInternalNew' || op === 'replaceExternalNew'){
				op = 'replacedNew'
				++idCounter
				res.id = idCounter
				edit = {typeCode: edit.typeCode, newId: res.id, oldId: edit.id}
			}else if(op === 'setToNew'){
				op = 'wasSetToNew'
				++idCounter
				res.id = idCounter
				edit = {typeCode: edit.typeCode, id: res.id}
			}else if(op === 'putNew'){
				op = 'didPutNew'
				++idCounter
				res.id = idCounter
				_.assert(edit.typeCode > 0)
				edit = {typeCode: edit.typeCode, id: res.id}
			}else if(op === 'destroy'){
				//_.errout('TODO')
				destroy(id)
			}
			res.edit = edit
			res.op = op

			olc.addEdit(id, {op: op, edit: edit, editId: res.editId})
			
			return res
		
		},
		//streams the object and its dependencies
		streamVersion: function(already, id, startEditId, endEditId, cb, endCb){
			_.assert(id >= 0)
			
			if(already[id]){
				log('already got: ' + id)
				endCb()
				return
			}
			already[id] = true

			var gCdl = _.latch(2, function(){
				endCb()
			})
			
			handle.getAsBuffer(id, startEditId, endEditId, function(res){
				cb(id, res)
				gCdl()
			})
			
			getForeignIds(id, endEditId, function(ids){
				
				var cdl = _.latch(ids.length, gCdl)
				
				for(var i=0;i<ids.length;++i){

					if(ids[i] === id){
						cdl()
						continue
					}
					
					handle.streamVersion(already, ids[i], startEditId, endEditId, cb, cdl)
				}
			})
		},
		getObjectMetadata: function(id, cb){
			//_.errout('TODO')
			var pu = pathsplicer.make()

			handle.get(id, -1, -1, function(edits){
				//console.log(JSON.stringify(edits))
				edits.forEach(function(e){
					pu.update(e)
				})
			})
			cb(pu.getTypeCode(), pu.getPath(), pu.getSyncId())
		},
		getObjectType: function(id){
			_.assertLength(arguments, 1)

			var tc = objectTypeCodes[id]
			if(tc === undefined) _.errout('unknown id: ' + id)
			return tc
		},
		//ensures that the requested id will retrieve synchronously for the lifetime
		//of the cb call.
		//this is for change calls.
		cache: function(id, cb){
			_.errout('TODO')
		},
		getLatestVersionId: function(){
			return lastVersionId;
		},
		getMany: function(typeCode){
			return (idsByType[typeCode] || []).length
		},
		getAllIdsOfType: function(typeCode, cb){//gets a read-only copy of all objects of that type
			_.assertLength(arguments, 2)
			var ids = idsByType[typeCode] || [];
			//console.log('ol getting ids(' + typeCode + '): ' + JSON.stringify(ids))
			cb(ids)
		},
		getAllOfType: function(typeCode, cb){//gets a read-only copy of all objects of that type
			_.assertLength(arguments, 2)
			//_.errout('TODO')
			var objs = []
			var ids = idsByType[typeCode] || [];
			var cdl = _.latch(ids.length, function(){
				cb(objs)
			})
			function storeCb(obj){
				_.assertObject(obj)
				objs.push(obj)
				cdl()
			}
			ids.forEach(function(id){handle.get(id, storeCb);})
		},
		getAllObjectsOfType: function(typeCode, cb, doneCb){
			var ids = idsByType[typeCode] || [];
			var cdl = _.latch(ids.length, function(){
				doneCb()
			})
			ids.forEach(function(id){
				handle.get(id, function(obj){
					cb(id, obj)
					cdl()
				});
			})
		},
		getPropertyValueForChangedSince: function(typeCode, propertyCode, editId, cb, doneCb){
			//TODO optimize
			handle.getAllOfType(typeCode, function(objs){
				objs.forEach(function(obj){
					if(obj.meta.editId > editId){
						cb(obj.meta.id, obj[propertyCode], obj.meta.editId)
					}
				})
				doneCb()
			})
		},
		getInitialManySyncIdsMade: function(){
			return manySyncIdsMade
		}
	};
	
	log('done ol')
	cb(handle)
	log('done ol after cb')
}*/


