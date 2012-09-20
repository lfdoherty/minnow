"use strict";

var fs = require('fs')

var _ = require('underscorem')
var sf = require('segmentedfile')
var indexFile = require('indexfilestream')
//var parsicle = require('parsicle')
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
		var code = fp.codes[e.op]
		_.assert(code > 0)
		console.log('code: ' + code + ' ' + e.editId)
		w.putByte(code)
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
	this.currentSyncId = undefined
	this.lastVersionId = 1
	this.manySyncIdsMade = 0
}
OlReaders.prototype.make = function(e, timestamp){
	var n = this.ol._make(e, timestamp, this.currentSyncId)//TODO
	this.currentId = n.id
	log('got make', e.typeCode, ':', this.currentId)
	//console.log('loading make '+ e.typeCode+ ':'+ this.currentId)
}
OlReaders.prototype.setSyncId = function(e){
	_.assert(e.syncId > 0)
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
		OlReaders.prototype[name] = function(edit, timestamp){
			_.assertNumber(timestamp)
			//console.log('loading timestamp: ' + timestamp)
			//console.log(new Error().stack)
			//console.log('args: ' + JSON.stringify(arguments))
			//appendEdit(name, edit)
			log('edit: ' + JSON.stringify([this.currentId, name, edit, this.currentSyncId, timestamp]))
			//console.log('loading edit: ' + JSON.stringify([this.currentId, name, edit, this.currentSyncId, timestamp]))
			this.ol.persist(this.currentId, name, edit, this.currentSyncId, timestamp)
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
	
	this.timestamps = {}//TODO optimize
	
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
Ol.prototype._make = function make(edit, timestamp, syncId){

	++this.stats.make
		
	++this.idCounter;
	var editId = this.readers.lastVersionId
	this.timestamps[editId]  = timestamp

	++this.readers.lastVersionId
	
	log('wrote object ', this.idCounter)
	
	var id = this.idCounter
	this.olc.assertUnknown(id)
	_.assert(syncId > 0)
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

	//console.log('destroying')

	this.olc.destroy(id)

	//console.log('destroying...')
	
	//_.each(idsByType, function(arr, tcStr){
	var keys = Object.keys(this.idsByType)
	for(var i=0;i<keys.length;++i){
		var arr = this.idsByType[keys[i]]
		var index = arr.indexOf(id)
		//console.log(id + ': ' + JSON.stringify(arr))
		if(index !== -1){
			arr.splice(index, 1)
		}
	}
	//console.log('done destroying')
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
		//console.log('closed indexWriter, maybe waiting for sync')
		//console.log('closed ol')
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
Ol.prototype.getVersionTimestamp = function(v){
	_.assert(v > 0)
	var t = this.timestamps[v]
	_.assertNumber(t)
	_.assert(t > 0)
	return t
}
Ol.prototype.getVersionTimestamps = function(versions){
	var timestamps = []
	for(var i=0;i<versions.length;++i){
		var v = versions[i]
		if(v === -1){
			//timestamps.push(0)
			_.errout('TODO ENSURE THIS DOES NOT HAPPEN')
		}else{
			var t = this.timestamps[v]
			_.assertNumber(t)
			_.assert(t > 0)
			timestamps.push(t)
		}
	}
	return timestamps
}
Ol.prototype.getSyncIds = function(id, cb){
	this.get(id, -1, -1, function(edits){
		var syncIds = []
		var has = {}
		//console.log(JSON.stringify(edits))
		for(var i=0;i<edits.length;++i){
			var e = edits[i]
			if(e.op === 'setSyncId'){
				var syncId = e.edit.syncId
				if(has[syncId] === undefined){
					has[syncId] = true
					syncIds.push(syncId)
				}
			}
		}
		cb(syncIds)
	})
}

var isPathOp = require('./editutil').isPathOp

Ol.prototype.getVersions = function(id, cb){
	this.get(id, -1, -1, function(edits){
		var versions = []
		var has = {}
		for(var i=0;i<edits.length;++i){
			var e = edits[i]
			if(isPathOp(e.op)) continue
			var version = e.editId
			if(has[version] === undefined){
				has[version] = true
				//console.log('adding version: ' + JSON.stringify(e))
				versions.push(version)
			}
		}
		cb(versions)
	})
}
Ol.prototype.persist = function(id, op, edit, syncId, timestamp){
	_.assertNumber(timestamp)
	if(op === 'make'){
		_.assert(syncId > 0)
		return this._make(edit, timestamp, syncId)
	}
	//console.log('PERSISTING PERSISTING: ' + JSON.stringify(arguments))
	_.assertInt(id)
	_.assert(id > 0)
	
	var newEdits = []
	
	var objCurrentSyncId = this.objectCurrentSyncId[id]

	if(objCurrentSyncId !== syncId){
		_.assert(syncId > 0)
		this.olc.addEdit(id, {op: 'setSyncId', edit: {syncId: syncId}, editId: this.readers.lastVersionId})					
		this.objectCurrentSyncId[id] = syncId
		++this.readers.lastVersionId
	}

	var res = {editId: this.readers.lastVersionId}
	++this.readers.lastVersionId

	this.timestamps[res.editId]  = timestamp

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

	//console.log('op now: ' + op)
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
	if(this.destroyed[id]){
		_.errout('id already destroyed: ' + id)
	}
	var pu = pathsplicer.make()
	this.get(id, -1, -1, function(edits){
		pu.updateAll(edits)
	//	console.log('getting metadata: ' + id)
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

