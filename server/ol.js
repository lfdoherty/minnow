"use strict";

var fs = require('fs')

var _ = require('underscorem')
//var sf = require('segmentedfile')
//var indexFile = require('indexfilestream')
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
		//console.log('code: ' + code + ' ' + e.editId)
		w.putByte(code)
		w.putInt(e.editId)
		fp.writers[e.op](w, e.edit)
	})
	return w.finish()
}

var log = require('quicklog').make('minnow/ol')

var fp = shared.editFp
var editCodes = fp.codes
var editNames = fp.names

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
	//log('got make', e.typeCode, ':', this.currentId)
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
	//log('made sync id')
}

OlReaders.prototype.refork = function(e){
	_.assert(e.sourceId > 0)
	this.ol.forks[this.currentId] = e.sourceId
},

_.each(shared.editSchema._byCode, function(objSchema){
	var name = objSchema.name
	/*if(readers[name] === undefined){
		readers[name] = appendEdit.bind(undefined, name)
	}*/
	if(OlReaders.prototype[name] === undefined){
		var code = objSchema.code
		OlReaders.prototype[name] = function(edit, timestamp){
			_.assertNumber(timestamp)
			//console.log('loading timestamp: ' + timestamp)
			//console.log(new Error().stack)
			//console.log('args: ' + JSON.stringify(arguments))
			//appendEdit(name, edit)
			//log('edit: ' + JSON.stringify([this.currentId, name, edit, this.currentSyncId, timestamp]))
			//console.log('loading edit: ' + JSON.stringify([this.currentId, name, edit, this.currentSyncId, timestamp]))
			this.ol.persist(this.currentId, code, edit, this.currentSyncId, timestamp)
		}//appendEdit.bind(undefined, name)
	}
})

function Ol(schema){
	_.assertObject(schema)
	
	this.readers = new OlReaders(this)
	this.olc = olcache.make()
	this.objectCurrentSyncId = {}
	this.idCounter = 0
	
	this.idsByType = {}
	this.objectTypeCodes = {}
	this.destroyed = {}
	
	this.schema = schema
	
	this.timestamps = {}//TODO optimize
	
	this.forks = {}
	
	this.stats = {
		make: 0,
		change: 0,
		writeToDisk: 0,
		reallyReadFromDisk: 0,
		readFromDisk: 0,
		readFromDiskCache: 0,
		readFromBuffer: 0,
		allRequested: 0,
		getAsBuffer: 0,
		get: 0
	}
	
	var tcst = this.typeCodeSubTypes = {}
	var local = this
	_.each(schema._byCode, function(objSchema){
		var list = tcst[objSchema.code] = [objSchema.code]
		local.idsByType[objSchema.code] = []
		if(objSchema.subTypes){
			Object.keys(objSchema.subTypes).forEach(function(stName){
				if(schema[stName]){//might be a contract keyword like 'readonly'
					list.push(schema[stName].code)
				}
			})
		}
	})
}
Ol.prototype._make = function make(edit, timestamp, syncId){

	++this.stats.make
		
	++this.idCounter;
	var editId = this.readers.lastVersionId
	this.timestamps[editId]  = timestamp

	++this.readers.lastVersionId
	
	//log('wrote object ', this.idCounter)
	
	var id = this.idCounter
	this.olc.assertUnknown(id)
	_.assert(syncId > 0)
	this.olc.addEdit(id, {op: editCodes.setSyncId, edit: {syncId: syncId}, editId: editId})
	this.olc.addEdit(id, {op: editCodes.made, edit: {typeCode: edit.typeCode, id: this.idCounter}, editId: editId})
	this.objectCurrentSyncId[id] = syncId
	this.idsByType[edit.typeCode].push(this.idCounter)

	
	this.readers.currentId = this.idCounter
	this.objectTypeCodes[this.idCounter] = edit.typeCode

	console.log('made object: ' + id + ' ' + this.schema._byCode[edit.typeCode].name)
	return {id: this.idCounter, editId: editId}
}

Ol.prototype.isFork = function(id){
	return !!this.forks[id]
}
Ol.prototype.getForked = function(id){
	return this.forks[id]
}
Ol.prototype.getAllForked = function(id){
	var ids = []
	var fid = this.getForked(id)
	while(fid){
		ids.push(fid)
		fid = this.getForked(fid)
	}
	return ids
}
Ol.prototype._makeFork = function make(edit, timestamp, syncId){


	++this.stats.make
		
	++this.idCounter;
	var editId = this.readers.lastVersionId
	this.timestamps[editId]  = timestamp

	++this.readers.lastVersionId
	
	//log('wrote object ', this.idCounter)

	var sourceTypeCode = this.objectTypeCodes[edit.sourceId]
	_.assertInt(sourceTypeCode)
	
	var id = this.idCounter
	this.olc.assertUnknown(id)
	_.assert(syncId > 0)
	this.olc.addEdit(id, {op: editCodes.setSyncId, edit: {syncId: syncId}, editId: editId})
	this.olc.addEdit(id, {op: editCodes.madeFork, edit: {sourceId: edit.sourceId, id: id, typeCode: sourceTypeCode}, editId: editId})
	this.objectCurrentSyncId[id] = syncId

	//console.log('cannot find type: ' + JSON.stringify(edit))

	this.idsByType[sourceTypeCode].push(this.idCounter)

	this.readers.currentId = this.idCounter
	this.objectTypeCodes[this.idCounter] = sourceTypeCode

	
	this.forks[id] = edit.sourceId

	return {id: this.idCounter, editId: editId}
}

Ol.prototype.isDeleted = function(id){
	return this.destroyed[id]
}
Ol.prototype._destroy = function(id){
	this.destroyed[id] = true
}
Ol.prototype._getForeignIds = function(id, editId, cb){
	
	var local = this
	
	this.get(id, -1, editId, function(edits){
		var de = edits//deserializeEdits(edits)
		var ids = []
		var has = {}

		if(edits.length > 0 && edits[1].op === editCodes.madeFork){
			ids.push(edits[1].edit.sourceId)
			has[edits[1].edit.sourceId] = true
		}
		
		//console.log('getting foreign edits in: ' + JSON.stringify(edits))
		for(var i=0;i<de.length;++i){
			var e = de[i]
			if(e.op === editCodes.setExisting || e.op === editCodes.addExisting || e.op === editCodes.setObject || 
					e.op === editCodes.putExisting || e.op === editCodes.addAfter){
				var id = e.edit.id
				if(!has[id]){
					ids.push(id)
					has[id] = true
					//console.log('*id: ' + id + ' ' +e.op)
				}
			}else if(e.op === editCodes.replaceExternalExisting || e.op === editCodes.replaceInternalExisting){
				var id = e.edit.newId
				if(!has[id]){
					ids.push(id)
					has[id] = true
					//console.log('**id: ' + id)
				}
			}else if(e.op === editCodes.selectObjectKey || e.op === editCodes.reselectObjectKey){
				var id = e.edit.key
				if(!has[id] && local.isTopLevelObject(id)){
					ids.push(id)
					has[id] = true
					//console.log('***id: ' + id)
				}
			}else if(e.op === editCodes.refork){
			//	console.log('sourceId: ' + e.sourceId)
				_.assert(e.edit.sourceId > 0)
				var id = e.edit.sourceId
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

Ol.prototype.close = function(cb){//TODO wait for writing to sync
	cb()
}

Ol.prototype.getAsBuffer = function(id, startEditId, endEditId, cb){//TODO optimize away
	_.assertLength(arguments, 4)
	_.assertInt(startEditId)
	_.assertInt(endEditId)
	_.assertInt(id)
	_.assert(id >= 0)

	++this.stats.getAsBuffer

	var w = fparse.makeSingleBufferWriter(100)
	var did = this.olc.serializeBinaryRange(id, startEditId, endEditId, w)
	var buf = w.finish()

	cb(did?buf:undefined)
}

Ol.prototype.getAll = function(id, cb){//TODO optimize away
	_.assertLength(arguments, 2)
	_.assertInt(id)
	
	++this.stats.allRequested
	
	var edits = this.olc.get(id)

	cb(edits)	
}

Ol.prototype.getAllIncludingForked = function(id, cb){//TODO optimize away
	_.assertLength(arguments, 2)
	_.assertInt(id)
	
	++this.stats.allRequested
	
	var edits = this.olc.get(id)

	//console.log('getting all including forked')
	
	if(this.forks[id]){
		this.getAllIncludingForked(this.forks[id], function(moreEdits){
			cb(moreEdits.concat(edits))
		})
	}else{
		cb(edits)
	}
}

Ol.prototype.getIncludingForked = function(id, startEditId, endEditId, cb){//TODO optimize away
	var local = this
	this.get(id, startEditId, endEditId, function(edits){
		if(local.forks[id]){
			//console.log('getting including forked')
			local.getIncludingForked(local.forks[id], startEditId, endEditId, function(moreEdits){
				edits = moreEdits.concat(edits)
				cb(edits)
			})
		}else{
			cb(edits)
		}
	})
}

Ol.prototype.get = function(id, startEditId, endEditId, cb){//TODO optimize away
	_.assertLength(arguments, 4)
	_.assertInt(startEditId)
	_.assertInt(endEditId)
	_.assertInt(id)
	
	++this.stats.get
	
	try{
		var edits = this.olc.get(id)
	}catch(e){
		var typeCode = this.objectTypeCodes[id]
		console.log('failed on type: ' + this.schema._byCode[typeCode].name)
		throw e
	}
	var actual = []

	for(var i=0;i<edits.length;++i){
		var e = edits[i]
		_.assertInt(e.editId)
		if(startEditId <= e.editId && (endEditId === -1 || e.editId <= endEditId)){
			actual.push(e)
		}
	}
	cb(actual)	
}

Ol.prototype.isTopLevelObject = function(id){
	return this.olc.isTopLevelObject(id)
}

Ol.prototype.syntheticEditId = function(){
	var editId = this.readers.lastVersionId
	++this.readers.lastVersionId
	return editId
}
Ol.prototype.getVersionTimestamp = function(v){
	_.assert(v > 0)
	var t = this.timestamps[v]
	if(t === undefined){
		_.errout('no timestamp found for version: ' + v)
	}
	_.assertNumber(t)
	_.assert(t > 0)
	return t
}
Ol.prototype.getVersionTimestamps = function(versions){
	var timestamps = []
	for(var i=0;i<versions.length;++i){
		var v = versions[i]
		if(v === -1){
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
		for(var i=0;i<edits.length;++i){
			var e = edits[i]
			if(e.op === editCodes.setSyncId){
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
				console.log('adding version: ' + JSON.stringify(e))
				versions.push(version)
			}
		}
		cb(versions)
	})
}
Ol.prototype.getLastVersion = function(id, cb){
	this.get(id, -1, -1, function(edits){
		var version
		//var has = {}
		for(var i=0;i<edits.length;++i){
			var e = edits[i]
			if(isPathOp(e.op)) continue
			/*var version = e.editId
			if(has[version] === undefined){
				has[version] = true
				//console.log('adding version: ' + JSON.stringify(e))
				versions.push(version)
			}*/
			version = e.editId
		}
		cb(version)
	})
}
Ol.prototype.persist = function(id, op, edit, syncId, timestamp){
	_.assertNumber(timestamp)
	_.assertInt(op)
	
	if(op === editCodes.make){
		_.assert(syncId > 0)
		return this._make(edit, timestamp, syncId)
	}else if(op === editCodes.makeFork){
		_.assert(syncId > 0)
		return this._makeFork(edit, timestamp, syncId)
	}else if(op === editCodes.refork){
		_.assert(syncId > 0)
		//return this._makeFork(edit, timestamp, syncId)
		_.assert(edit.sourceId > 0)//TODO how to handle property streams?
		this.forks[id] = edit.sourceId
	}
	//console.log('PERSISTING PERSISTING: ' + editNames[op] + ' ' + JSON.stringify(arguments))
	_.assertInt(id)
	_.assert(id > 0)
	
	var newEdits = []
	
	var objCurrentSyncId = this.objectCurrentSyncId[id]

	if(objCurrentSyncId !== syncId){
		_.assert(syncId > 0)
		this.olc.addEdit(id, {op: editCodes.setSyncId, edit: {syncId: syncId}, editId: this.readers.lastVersionId})					
		this.objectCurrentSyncId[id] = syncId
		++this.readers.lastVersionId
	}

	var res = {editId: this.readers.lastVersionId}
	++this.readers.lastVersionId

	this.timestamps[res.editId]  = timestamp

	if(op === editCodes.addNew){
		op = editCodes.addedNew
		++this.idCounter
		res.id = this.idCounter
		edit = {id: res.id, typeCode: edit.typeCode}
		this.objectTypeCodes[res.id] = edit.typeCode
		console.log('added new ' + res.id + ' ' + this.schema._byCode[edit.typeCode].name)
	}else if(op === editCodes.addNewAt){
		op = editCodes.addedNewAt
		++this.idCounter
		res.id = this.idCounter
		edit = {id: res.id, typeCode: edit.typeCode, index: edit.index}
		this.objectTypeCodes[res.id] = edit.typeCode
	}else if(op === editCodes.addNewAfter){
		op = editCodes.addedNewAfter
		++this.idCounter
		res.id = this.idCounter
		edit = {id: res.id, typeCode: edit.typeCode}
		this.objectTypeCodes[res.id] = edit.typeCode
	}else if(op === editCodes.replaceInternalNew || op === editCodes.replaceExternalNew){
		op = editCodes.replacedNew
		++this.idCounter
		res.id = this.idCounter
		edit = {typeCode: edit.typeCode, newId: res.id, oldId: edit.id}
		this.objectTypeCodes[res.id] = edit.typeCode
	}else if(op === editCodes.setToNew){
		op = editCodes.wasSetToNew
		++this.idCounter
		res.id = this.idCounter
		edit = {typeCode: edit.typeCode, id: res.id}
		this.objectTypeCodes[res.id] = edit.typeCode
	}else if(op === editCodes.putNew){
		op = editCodes.didPutNew
		++this.idCounter
		res.id = this.idCounter
		_.assert(edit.typeCode > 0)
		edit = {typeCode: edit.typeCode, id: res.id}
		this.objectTypeCodes[res.id] = edit.typeCode
	}else if(op === editCodes.destroy){
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
	_.assertLength(arguments, 6)
	_.assert(id >= 0)
	
	//if(this.destroyed[id]) _.errout('object has been destroyed: ' + id)
	
	if(already[id]){
		//log('already got: ' + id)
		endCb()
		return
	}
	already[id] = true

	var sourceRes
	var gCdl = _.latch(2, function(){
		if(sourceRes) cb(id, sourceRes)
		endCb()
	})

	this.getAsBuffer(id, startEditId, endEditId, function(res){
		if(res){
			sourceRes = res
		}
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
	/*if(this.destroyed[id]){
		_.errout('id already destroyed: ' + id)
	}*/

	var pu = pathsplicer.make()
	var edits = this.olc.get(id)
	pu.updateAll(edits)
	return pu
	
	//cb(pu.getTypeCode(), pu.getPath(), pu.getSyncId())
}

Ol.prototype.getObjectType = function(id){
	_.assertLength(arguments, 1)

	var tc = this.objectTypeCodes[id]
	if(tc === undefined) _.errout('unknown id: ' + id)
	return tc
}
Ol.prototype.getLatestVersionId = function(){
	return this.readers.lastVersionId;
}
Ol.prototype.getMany = function(typeCode){
	return (this.idsByType[typeCode] || []).length
}
Ol.prototype.getAllIdsOfType = function(typeCode, cb){
	_.assertLength(arguments, 2)
	
	var res = []
	var sts = this.typeCodeSubTypes[typeCode]
	//console.log('ol types ' + typeCode + ' -> ' + JSON.stringify(sts))
	for(var j=0;j<sts.length;++j){
		var tc = sts[j]
		var ids = this.idsByType[tc] || [];
		//console.log('ol getting ids(' + tc + '): ' + JSON.stringify(ids))
		for(var i=0;i<ids.length;++i){
			var id = ids[i]
			if(!this.destroyed[id]){
				res.push(id)
			}
		}
	}
	cb(res)
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
Ol.prototype.getAllObjectsOfTypeIncludingForked = function(typeCode, cb, doneCb){
	var ids = this.idsByType[typeCode] || [];
	var cdl = _.latch(ids.length, function(){
		doneCb()
	})
	for(var i=0;i<ids.length;++i){
		var id = ids[i]
		if(this.destroyed[id]){
			cdl()
			continue
		}
		this.getAllIncludingForked(id, function(obj){
			cb(id, obj)
			cdl()
		});
	}
}
Ol.prototype.getAllObjectsOfType = function(typeCode, cb, doneCb){
	var ids = this.idsByType[typeCode] || [];
	var cdl = _.latch(ids.length, function(){
		doneCb()
	})
	for(var i=0;i<ids.length;++i){
		var id = ids[i]
		if(this.destroyed[id]){
			cdl()
			continue
		}
		this.getAll(id, function(obj){
			cb(id, obj)
			cdl()
		});
	}
}

Ol.prototype.getInitialManySyncIdsMade = function(){
	return this.readers.manySyncIdsMade
}

exports.make = function(dataDir, schema, cb){
	var ol = new Ol(schema)
	//return ol
	cb(ol)
}

