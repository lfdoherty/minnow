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

var IntIntMap = require('primitivemap').IntIntMap
var IntLongMap = require('primitivemap').IntLongMap

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
	
	this.state = {}
}
OlReaders.prototype.make = function(e, timestamp){
	var newId = this.ol._make(e, timestamp, this.currentSyncId)//TODO
	//this.currentId = n.id
	this.state.top = newId
	//log('got make', e.typeCode, ':', this.currentId)
	//console.log('loading make '+ e.typeCode+ ':'+ this.currentId)
}
OlReaders.prototype.setSyncId = function(e){
	_.assert(e.syncId > 0)
	this.currentSyncId = e.syncId
}
OlReaders.prototype.selectTopObject = function(e,timestamp){
	_.assertInt(e.id)
	this.state.top = e.id
	//this.ol.persist(editCodes.selectTopObject, e, this.currentSyncId, timestamp, this.state)
}
OlReaders.prototype.selectObject = function(e,timestamp){
	_.assertInt(e.id)
	this.state.object = e.id
	this.ol.persist(editCodes.selectObject, e, this.currentSyncId, timestamp, this.state.top)
}
OlReaders.prototype.selectSubObject = function(e,timestamp){
	_.assertInt(e.id)
	this.state.sub = e.id
	this.ol.persist(editCodes.selectSubObject, e, this.currentSyncId, timestamp, this.state.top)
}
OlReaders.prototype.selectProperty = function(e,timestamp){
	_.assertInt(e.typeCode)
	this.state.property = e.typeCode 
	this.ol.persist(editCodes.selectProperty, e, this.currentSyncId, timestamp, this.state.top)
}
OlReaders.prototype.selectIntKey = function(e,timestamp){
	this.state.key = e.key
	this.ol.persist(editCodes.selectIntKey, e, this.currentSyncId, timestamp, this.state.top)
}
OlReaders.prototype.selectLongKey = function(e,timestamp){
	this.state.key = e.key
	this.ol.persist(editCodes.selectLongKey, e, this.currentSyncId, timestamp, this.state.top)
}
OlReaders.prototype.selectBooleanKey = function(e,timestamp){
	this.state.key = e.key
	this.ol.persist(editCodes.selectBooleanKey, e, this.currentSyncId, timestamp, this.state.top)
}
OlReaders.prototype.selectTimestampKey = function(e,timestamp){
	this.state.key = e.key
	this.ol.persist(editCodes.selectTimestampKey, e, this.currentSyncId, timestamp, this.state.top)
}
OlReaders.prototype.selectKey = function(e,timestamp){
	this.state.key = e.key
	this.ol.persist(editCodes.selectStringKey, e, this.currentSyncId, timestamp, this.state.top)
}
OlReaders.prototype.selectObjectKey = function(e,timestamp){
	this.state.key = e.key
	this.ol.persist(editCodes.selectObjectKey, e, this.currentSyncId, timestamp, this.state.top)
}
OlReaders.prototype.selectStringKey = function(e,timestamp){
	this.state.key = e.key
	this.ol.persist(editCodes.selectStringKey, e, this.currentSyncId, timestamp, this.state.top)
}

OlReaders.prototype.selectTopViewObject = function(e){
	_.errout('cannot save view object')
}

OlReaders.prototype.syntheticEdit = function(){
	this.syncIdsByEditId.put(this.lastVersionId, -5)
	++this.lastVersionId
}
OlReaders.prototype.destroy = function(){
	this.ol._destroy(this.state.top)//TODO
	//this.currentId = undefined	
}
OlReaders.prototype.madeSyncId = function(){
	++this.manySyncIdsMade
	//log('made sync id')
}
/*
OlReaders.prototype.refork = function(e){
	_.assert(e.sourceId > 0)
	this.ol.forks[this.currentId] = e.sourceId
}*/

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
			this.ol.persist(code, edit, this.currentSyncId, timestamp, this.state.top)
		}//appendEdit.bind(undefined, name)
	}
})


function FakeIntIntMap(){
	this.data = {}
}
FakeIntIntMap.prototype.get = function(key){
	if(!_.isInt(key)) _.errout('key not an int: ' + key)
	return this.data[key]
}
FakeIntIntMap.prototype.put = function(key, value){
	if(!_.isInt(key)) _.errout('key not an int: ' + key)
	if(!_.isInt(value)) _.errout('value not an int: ' + value)
	this.data[key] = value
}

function Ol(schema){
	_.assertObject(schema)
	
	this.readers = new OlReaders(this)
	this.olc = olcache.make()
	this.idCounter = 0
	
	this.idsByType = {}
	this.creationEditIdsByType = {}
	this.destroyed = {}
	this.destructionEditIdsByType = {}
	this.destructionIdsByType = {}
	this.uuid = {}
	
	this.creationEditIds = {}
	
	//all int->int maps here	

	/*
	this.objectTypeCodes = new IntIntMap()
	
	*/
	
	this.syncIdsByEditId = new IntIntMap()
	this.timestamps = new IntLongMap()
	this.objectCurrentSyncId = new IntIntMap()
	this.lastEditId = new IntIntMap()
	
	//this.objectCurrentSyncId = new FakeIntIntMap()
	this.objectTypeCodes = new FakeIntIntMap()
	//this.syncIdsByEditId = new FakeIntIntMap()
	//this.lastEditId = new FakeIntIntMap()
	
	//this.innerParentIndex = {}
	
	this.schema = schema
	
	//this.timestamps = {}//TODO optimize
	
	//this.forks = {}
	
	this.propertyIndex = require('./propertyindex').make(schema, this)
	
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
	var superTypes = this.typeCodeSuperTypes = {}
	var local = this
	_.each(schema._byCode, function(objSchema){
		var list = tcst[objSchema.code] = [objSchema.code]
		var superList = superTypes[objSchema.code] = [objSchema.code]
		local.idsByType[objSchema.code] = []
		local.creationEditIdsByType[objSchema.code] = []
		local.destructionEditIdsByType[objSchema.code] = []
		local.destructionIdsByType[objSchema.code] = []
		if(objSchema.subTypes){
			Object.keys(objSchema.subTypes).forEach(function(stName){
				if(schema[stName]){//might be a contract keyword like 'readonly'
					list.push(schema[stName].code)
				}
			})
		}
		if(objSchema.superTypes){
			Object.keys(objSchema.superTypes).forEach(function(stName){
				if(schema[stName]){//might be a contract keyword like 'readonly'
					superList.push(schema[stName].code)
				}
			})
		}
	})
}


Ol.prototype.getSyncIdFor = function(editId){
	return this.syncIdsByEditId.get(editId)
}
Ol.prototype._make = function make(edit, timestamp, syncId){

	++this.stats.make
		
	++this.idCounter;
	var editId = this.readers.lastVersionId
	this.syncIdsByEditId.put(editId, syncId)
	this.timestamps[editId]  = timestamp

	++this.readers.lastVersionId
	//log('wrote object ', this.idCounter)
	
	var id = this.idCounter
	this.olc.assertUnknown(id)
	_.assert(syncId > 0)
	this.olc.addEdit(id, {op: editCodes.setSyncId, edit: {syncId: syncId}, editId: editId})
	this.olc.addEdit(id, {op: editCodes.made, edit: {typeCode: edit.typeCode, id: this.idCounter, following: edit.following}, editId: editId})
	this.objectCurrentSyncId.put(id,syncId)
	_.assertInt(edit.typeCode)
	//console.log('edit.typeCode: ' + edit.typeCode)
	//this.idsByType[edit.typeCode].push(this.idCounter)
	_.assertInt(edit.following)
	//console.log(edit.typeCode + ' following: ' + edit.following)
	this.creationEditIdsByType[edit.typeCode].push(editId+edit.following)

	this.creationEditIds[id] = editId+edit.following
	
	var sts = this.typeCodeSuperTypes[edit.typeCode]
	for(var j=0;j<sts.length;++j){
		var tc = sts[j]
		this.idsByType[tc].push(id)
	}	
	
	//console.log(JSON.stringify(this.idsByType))
	
	this.readers.currentId = this.idCounter
	this.objectTypeCodes.put(this.idCounter, edit.typeCode)
	this.lastEditId.put(this.idCounter, editId)
	
	this.propertyIndex.creation(edit.typeCode, id, editId+edit.following)
	
	//console.log('made object: ' + id + ' ' + this.schema._byCode[edit.typeCode].name + ' ' + editId)
	return id//{id: this.idCounter, editId: editId}
}
/*
Ol.prototype.isFork = function(id){
	return !!this.forks[id]
}
Ol.prototype.getForked = function(id){
	return this.forks[id]
}*/
Ol.prototype.getUuid = function(id){
	return this.uuid[id]
}

/*
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
	this.syncIdsByEditId[editId] = syncId

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
	this.creationEditIdsByType[sourceTypeCode].push(editId)

	this.readers.currentId = this.idCounter
	this.objectTypeCodes[this.idCounter] = sourceTypeCode

	
	this.forks[id] = edit.sourceId

	this.lastEditId[this.idCounter] = editId

	return {id: this.idCounter, editId: editId}
}*/

Ol.prototype.isDeleted = function(id){
	return this.destroyed[id]
}
Ol.prototype._destroy = function(id,editId){
	if(!editId){
		editId = this.readers.lastVersionId
		++this.readers.lastVersionId
	}
	_.assertInt(editId)
	//console.log('id destroyed: ' + id)
	this.destroyed[id] = true
	var typeCode = this.objectTypeCodes.get(id)
	this.destructionEditIdsByType[typeCode].push(editId)
	this.destructionIdsByType[typeCode].push(id)
	
	var sts = this.typeCodeSubTypes[typeCode]
	for(var j=0;j<sts.length;++j){
		var tc = sts[j]
		var arr = this.idsByType[tc]
		arr.splice(arr.indexOf(id), 1)
		//console.log('removed ' + id + ' ' + JSON.stringify(arr))
	}
}
/*
Ol.prototype.getPathTo = function(id, cb){
	//_.errout('TODO')


	if(this.isTopLevelObject(id)){
		cb([])
	}else{
		cb(this.innerParentIndex[id])
	}
}*/

Ol.prototype._getForeignIdsDuring = function(id, startEditId, endEditId, cb){
	if(endEditId === -1){
		cb([])
		return
	}
	if(_.isObject(id)) id = id.top
	_.assertInt(id)
	
	var local = this
	this.get(id, startEditId, endEditId, function(edits){
		//console.log('getting foreign ids: ' + id + ' ' + editId + ' ' + JSON.stringify(edits))
		cb(computeForeignIds(local, edits))
	})
}

Ol.prototype._getForeignIds = function(id, editId, cb){

	if(!cb){
		var local = this
		var edits
		this.get(id, -1, editId, function(es){
			edits = es
		})
		return computeForeignIds(local, edits)
	}
		
	if(editId === -1){
		cb([])
		return
	}
	if(_.isObject(id)) id = id.top
	_.assertInt(id)
	
	var local = this
	this.get(id, -1, editId, function(edits){
		//console.log('getting foreign ids: ' + id + ' ' + editId + ' ' + JSON.stringify(edits))
		cb(computeForeignIds(local, edits))
	})
}

function computeForeignIds(local, edits){
	var de = edits//deserializeEdits(edits)
	var ids = []
	var has = {}

	//console.log('getting foreign edits in: ' + JSON.stringify(edits))
	for(var i=0;i<de.length;++i){
		var e = de[i]
		if(e.op === editCodes.setExisting || e.op === editCodes.addExisting ||  e.op === editCodes.unshiftExisting || e.op === editCodes.setObject || 
				e.op === editCodes.putExisting || e.op === editCodes.addAfter){
			var id = e.edit.id
			_.assertInt(id)
			if(!has[id]){
				ids.push(id)
				has[id] = true
				//console.log('*id: ' + id + ' ' +e.op)
			}
		}else if(e.op === editCodes.replaceExternalExisting || e.op === editCodes.replaceInternalExisting){
			var id = e.edit.newId
			_.assertInt(id)
			if(!has[id]){
				ids.push(id)
				has[id] = true
				//console.log('**id: ' + id)
			}
		}else if(e.op === editCodes.selectObjectKey /*|| e.op === editCodes.reselectObjectKey*/){
			var id = e.edit.key
			_.assertInt(id)
			if(!has[id] && local.isTopLevelObject(id)){
				ids.push(id)
				has[id] = true
				//console.log('***id: ' + id)
			}
		}
	}
	//console.log('got: ' + JSON.stringify(ids))
	return ids//cb(ids)
}

Ol.prototype.close = function(cb){//TODO wait for writing to sync
	this.olc.close(cb)
}
/*
Ol.prototype.getAsBuffer = function(id, startEditId, endEditId, cb){//TODO optimize away
	_.assertLength(arguments, 4)
	_.assertInt(startEditId)
	_.assertInt(endEditId)
	_.assertInt(id)
	_.assert(id >= 0)

	++this.stats.getAsBuffer
	
	_.errout('here')

	if(startEditId === -1 && endEditId >= this.lastEditId.get(id)){
		var buf = this.olc.getBinary(id)
		cb(buf)
		return
	}
	var w = fparse.makeSingleBufferWriter(100)
	var did = this.olc.serializeBinaryRange(id, startEditId, endEditId, w)
	var buf = w.finish()

	cb(did?buf:undefined)
}*/

Ol.prototype.getObjectState = function(id, cb){
	_.assertLength(arguments, 2)
	//_.assertInt(startEditId)
	//_.assertInt(endEditId)
	_.assertInt(id)
	_.assert(id >= 0)

	++this.stats.getAsBuffer
	
	//_.errout('here')

	var buf = this.olc.getBinary(id)
	cb(buf)
/*	return
	}
	var w = fparse.makeSingleBufferWriter(100)
	var did = this.olc.serializeBinaryRange(id, startEditId, endEditId, w)
	var buf = w.finish()

	cb(did?buf:undefined)*/
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


		cb(edits)
	
}

Ol.prototype.getPartiallyIncludingForked = function(id, filter, eachCb, doneCb){
	var local = this
	/*if(local.forks[id]){
		local.getPartiallyIncludingForked(local.forks[id], filter, eachCb, function(){
			local.getPartially(id, filter, eachCb, doneCb)
		})
	}else{*/
		local.getPartially(id, filter, eachCb, doneCb)
	//}
}
Ol.prototype.getIncludingForked = function(id, startEditId, endEditId, cb){//TODO optimize away
	var local = this
	this.get(id, startEditId, endEditId, function(edits){
		/*if(local.forks[id]){
			//console.log('getting including forked')
			local.getIncludingForked(local.forks[id], startEditId, endEditId, function(moreEdits){
				edits = moreEdits.concat(edits)
				cb(edits)
			})
		}else{*/
			cb(edits)
		//}
	})
}

function selectInside(edits, innerId){
	var inside = false
	//var depth = 0
	//var depthAtInside
	var insideNested = false
	var result = []
	//console.log('selectInside(' + JSON.stringify(innerId) + '): ' + JSON.stringify(edits))
	//_.errout('TODO upgrade to modern state-based paths')
	for(var i=0;i<edits.length;++i){
		var e = edits[i]
		var op = e.op
		if(op === editCodes.selectObject){
			var objId = e.edit.id
			if(objId === innerId){
				inside = true
			}
		}else if(op === editCodes.selectProperty){
		}else if(fp.isKeySelectCode[op]){
		}
		
		if(inside){
			//console.log('*'+inside + ' ' + JSON.stringify(e))
			result.push(e)
		}else{
			//console.log('@'+inside + ' ' + JSON.stringify(e))
		}
	}
	//console.log(JSON.stringify(result))
	return result
}

Ol.prototype.getPartially = function(id, filter, eachCb, doneCb){
	_.assertLength(arguments, 4)
	_.assertFunction(filter)
	_.assertFunction(eachCb)
	_.assertFunction(doneCb)
	
	if(!_.isInt(id)){
		//console.log('id: ' + JSON.stringify(id))
		_.assertInt(id.top)
	
		++this.stats.get
	
		try{
			this.olc.getPartially(id.top, filter, eachCb)
			doneCb()
		}catch(e){
			var typeCode = this.objectTypeCodes.get(id.top)
			console.log('failed on top type: ' + this.schema._byCode[typeCode].name)
			throw e
		}
		/*var actual = []

		for(var i=0;i<edits.length;++i){
			var e = edits[i]
			_.assertInt(e.editId)
			if(startEditId <= e.editId && (endEditId === -1 || e.editId <= endEditId)){
				actual.push(e)
			}
		}
		if(id.top !== id.inner){
			cb(selectInside(actual, id.inner))
		}else{
			cb(actual)
		}*/
	}else{
		_.assertInt(id)
		
		++this.stats.get
	
		try{
			this.olc.getPartially(id, filter, eachCb)
			doneCb()
		}catch(e){
			var typeCode = this.objectTypeCodes.get(id)
			console.log('getting type of id: ' + id)
			if(typeCode === undefined){
				_.errout('cannot find id(' + id + '), got: ' + JSON.stringify(Object.keys(this.objectTypeCodes.data)))
			}
			console.log('failed on type: ' + this.schema._byCode[typeCode].name)
			throw e
		}
		//console.log('computing actual(' + startEditId + ',' + endEditId + ') from: ' + JSON.stringify(edits))
		/*var actual = []

		for(var i=0;i<edits.length;++i){
			var e = edits[i]
			_.assertInt(e.editId)
			if(startEditId <= e.editId && (endEditId === -1 || e.editId <= endEditId)){
				actual.push(e)
			}
		}
		//console.log('actual: ' + JSON.stringify(actual))
		//console.log('returning(' + startEditId+', '+endEditId + ') actual of(' + id + '): ' + JSON.stringify(actual))
		cb(actual)*/
	}
}

Ol.prototype.getObjectEdits = function(id){
	_.assertInt(id)
	var edits = this.olc.get(id)
	return [].concat(edits)
}
Ol.prototype.get = function(id, startEditId, endEditId, cb){//TODO optimize away
	_.assertLength(arguments, 4)
	_.assertInt(startEditId)
	_.assertInt(endEditId)
	
	if(!_.isInt(id)){
		//console.log('id: ' + JSON.stringify(id))
		_.assertInt(id.top)
	
		++this.stats.get
	
		try{
			var edits = this.olc.get(id.top)
		}catch(e){
			var typeCode = this.objectTypeCodes.get(id.top)
			console.log('failed on top type: ' + this.schema._byCode[typeCode].name)
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
		if(id.top !== id.inner){
			cb(selectInside(actual, id.inner))
		}else{
			cb(actual)
		}
	}else{
		_.assertInt(id)
		
		++this.stats.get
	
		try{
			var edits = this.olc.get(id)
		}catch(e){
			var typeCode = this.objectTypeCodes.get(id)
			console.log('getting type of id: ' + id)
			if(typeCode === undefined){
				_.errout('cannot find id(' + id + '), got: ' + JSON.stringify(Object.keys(this.objectTypeCodes.data)))
			}
			console.log('failed on type: ' + this.schema._byCode[typeCode].name)
			throw e
		}
		//console.log('computing actual(' + startEditId + ',' + endEditId + ') from: ' + JSON.stringify(edits))
		var actual = []

		for(var i=0;i<edits.length;++i){
			var e = edits[i]
			_.assertInt(e.editId)
			if(startEditId <= e.editId && (endEditId === -1 || e.editId <= endEditId)){
				actual.push(e)
			}
		}
		//console.log('actual: ' + JSON.stringify(actual))
		//console.log('returning(' + startEditId+', '+endEditId + ') actual of(' + id + '): ' + JSON.stringify(actual))
		cb(actual)
	}
}

Ol.prototype.validateId = function(id){
	var topId = id.top || id
	if(this.objectTypeCodes.get(topId) === undefined) _.errout('invalid top id: ' + topId)
	if(id.inner){
		if(this.objectTypeCodes.get(id.inner) === undefined) _.errout('invalid inner id: ' + id.inner)
	}
}

Ol.prototype.isTopLevelObject = function(id){
	return this.olc.isTopLevelObject(id)
}

Ol.prototype.syntheticEditId = function(){
	var editId = this.readers.lastVersionId
	this.syncIdsByEditId.put(editId, -5)
	++this.readers.lastVersionId
	return editId
}
Ol.prototype.getCreationVersion = function(id){
	return this.creationEditIds[id]
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

Ol.prototype.getVersions = function(id){//, cb){
	var versions = []
	this.get(id, -1, -1, function(edits){
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
		//cb(versions, id)
	})
	return versions
}
Ol.prototype.getVersionsAt = function(id, editId, cb){
	this.get(id, -1, editId, function(edits){
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
		cb(versions, id)
	})
}
Ol.prototype.getLastVersion = function(id){
	return this.lastEditId.get(id.top||id)
}
/*
Ol.prototype.getLastVersionAt = function(id, editId, cb){//, cb){
	var last = this.lastEditId.get(id)
	if(last < editId){
		cb(last)
	}else{
		this.get(id, -1, editId, function(edits){
			var version
			//var has = {}
			for(var i=0;i<edits.length;++i){
				var e = edits[i]
				if(isPathOp(e.op)) continue

				version = e.editId
			}
			cb(version)
		})
	}
}*/

//note that 'path' is only required for edits that are not path updates
Ol.prototype.persist = function(op, edit, syncId, timestamp, id){
	_.assertNumber(timestamp)
	_.assertInt(op)
	
	//var id = state.top
	
	//if(op === editCodes.selectTopObject) _.errout('err')
	
	if(op === editCodes.make){
		//_.assert(syncId > 0)
		//console.log('MAKE ' + this.readers.lastVersionId)
		return this._make(edit, timestamp, syncId)
	}/*else if(op === editCodes.makeFork){
		//_.assert(syncId > 0)
		return this._makeFork(edit, timestamp, syncId)
	}else if(op === editCodes.refork){
		//_.assert(syncId > 0)
		//return this._makeFork(edit, timestamp, syncId)
		//_.assert(edit.sourceId > 0)//TODO how to handle property streams?
		this.forks[id] = edit.sourceId
	}*/

	//_.assertInt(state.top)
	//_.assert(state.top > 0)
	
	//var newEdits = []
	
	var objCurrentSyncId = this.objectCurrentSyncId.get(id)

	if(objCurrentSyncId !== syncId){
		_.assert(syncId > 0)
		this.olc.addEdit(id, {op: editCodes.setSyncId, edit: {syncId: syncId}, editId: this.readers.lastVersionId})					
		this.objectCurrentSyncId.put(id, syncId)
		this.syncIdsByEditId.put(this.readers.lastVersionId, syncId)
		++this.readers.lastVersionId
	}

	//var res = {editId: this.readers.lastVersionId}
	var resEditId = this.readers.lastVersionId
	this.syncIdsByEditId.put(resEditId, syncId)
	++this.readers.lastVersionId

	//console.log(resEditId + ' PERSISTING (' + id + '): ' + editNames[op] + ' ' + JSON.stringify(arguments))

	this.timestamps[resEditId]  = timestamp

	var local = this
	/*function indexParent(resId){
		local.innerParentIndex[resId] = state.top//[{op: editCodes.selectObject, edit: {id: id}}].concat(path)		
	}*/
	if(op === editCodes.initializeUuid){
		//console.log('saved uuid ' + id + '->' + edit.uuid)
		this.uuid[id] = edit.uuid
	}else if(op === editCodes.addNew){
		op = editCodes.addedNew
		++this.idCounter
		var resId = this.idCounter
		edit = {id: resId, typeCode: edit.typeCode}
		this.objectTypeCodes.put(resId, edit.typeCode)

		//this.innerParentIndex[res.id] = [{op: editCodes.selectObject, edit: {id: id}}].concat(path)		
		//indexParent(res.id)
	//	console.log('added new ' + res.id + ' ' + this.schema._byCode[edit.typeCode].name)
	}else if(op === editCodes.unshiftNew){
		op = editCodes.unshiftedNew
		++this.idCounter
		var resId = this.idCounter
		edit = {id: resId, typeCode: edit.typeCode}
		this.objectTypeCodes.put(resId, edit.typeCode)

		//indexParent(res.id)
	//	console.log('added new ' + res.id + ' ' + this.schema._byCode[edit.typeCode].name)
	}else if(op === editCodes.addNewAt){
		op = editCodes.addedNewAt
		++this.idCounter
		var resId = this.idCounter
		edit = {id: resId, typeCode: edit.typeCode, index: edit.index}
		this.objectTypeCodes.put(resId, edit.typeCode)

		//indexParent(res.id)
	}else if(op === editCodes.addNewAfter){
		op = editCodes.addedNewAfter
		++this.idCounter
		var resId = this.idCounter
		edit = {id: resId, typeCode: edit.typeCode}
		this.objectTypeCodes.put(resId, edit.typeCode)

		//indexParent(res.id)
	}else if(op === editCodes.replaceInternalNew || op === editCodes.replaceExternalNew){
		op = editCodes.replacedNew
		++this.idCounter
		var resId = this.idCounter
		edit = {typeCode: edit.typeCode, newId: resId, oldId: edit.id}
		this.objectTypeCodes.put(resId, edit.typeCode)

		//indexParent(res.id)
	}else if(op === editCodes.setToNew){
		op = editCodes.wasSetToNew
		++this.idCounter
		var resId = this.idCounter
		edit = {typeCode: edit.typeCode, id: resId}
		this.objectTypeCodes.put(resId, edit.typeCode)

		//indexParent(res.id)
	}else if(op === editCodes.putNew){
		op = editCodes.didPutNew
		++this.idCounter
		var resId = this.idCounter
		_.assert(edit.typeCode > 0)
		edit = {typeCode: edit.typeCode, id: resId}
		this.objectTypeCodes.put(resId, edit.typeCode)

		//indexParent(res.id)
	}else if(op === editCodes.destroy){
		//_.errout('TODO')
		this._destroy(id, resEditId)
	}
	
	//res.edit = edit
	//res.op = op

	//console.log('op now: ' + op)
	this.olc.addEdit(id, {op: op, edit: edit, editId: resEditId})
	
	this.lastEditId.put(id, resEditId)

	this.propertyIndex.addEdit(id, op, edit, resEditId)
	
	return resId

}
//streams the object and its dependencies
Ol.prototype.streamVersion = function(already, id, startEditId, endEditId, cb, endCb){
	_.assertLength(arguments, 6)
	_.assert(id >= 0)
	
	if(startEditId > 0 && startEditId === endEditId){
		endCb()
		return
	}
	//if(this.destroyed[id]) _.errout('object has been destroyed: ' + id)
	
	if(already[id]){
		//log('already got: ' + id)
		endCb()
		return
	}
	already[id] = true

	var sourceRes
	var gCdl = _.latch(2, function(){
		//console.log('sending sourceRes: ' + id + ' ' + sourceRes.length)
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
Ol.prototype.getObjectMetadata = function(id){
	/*if(this.destroyed[id]){
		_.errout('id already destroyed: ' + id)
	}*/

	var pu = pathsplicer.make()
	var edits = this.olc.get(id)
	pu.updateAll(edits)
	return pu.getAll()
	
	//cb(pu.getTypeCode(), pu.getPath(), pu.getSyncId())
}

Ol.prototype.getObjectType = function(id){
	_.assertLength(arguments, 1)
	
	var tc = this.objectTypeCodes.get(id.inner||id)
	if(tc === undefined) _.errout('unknown id: ' + JSON.stringify(id))
	return tc
}
Ol.prototype.getLatestVersionId = function(){
	return this.readers.lastVersionId;
}
Ol.prototype.getMany = function(typeCode){
	return (this.idsByType[typeCode] || []).length
}
/*
Ol.prototype.getManyAt = function(typeCode, endEditId, cb){
	var many = 0
	var sts = this.typeCodeSubTypes[typeCode]
	for(var j=0;j<sts.length;++j){
		var tc = sts[j]
		var editIds = this.creationEditIdsByType[tc]
		if(editIds){
			for(var i=0;i<editIds.length;++i){//TODO use binary search
				var editId = editIds[i]
				if(editId > endEditId){
					break//creationEditIdsByType is sequential
				}
				++many
			}
			var destroyedEditIds = this.destructionEditIdsByType[tc]
			if(destroyedEditIds){
				for(var i=0;i<destroyedEditIds.length;++i){
					var editId = destroyedEditIds[i]
					if(editId > endEditId){
						break//creationEditIdsByType is sequential
					}
					--many
				}
			}
		}
	}
	if(cb) cb(many)
	return many
}*/
/*
Ol.prototype.getAllIdsOfTypeAt = function(typeCode, endEditId, cb){
	var res = []
	var sts = this.typeCodeSubTypes[typeCode]
	for(var j=0;j<sts.length;++j){
		var tc = sts[j]
		var ids = this.idsByType[tc] || [];
		var editIds = this.creationEditIdsByType[tc]
		for(var i=0;i<ids.length;++i){
			var id = ids[i]
			//if(!this.destroyed[id]){
				var editId = editIds[i]
				if(editId > endEditId){
					break//creationEditIdsByType is sequential
				}
				res.push(id)
			//}
		}

		var destroyedEditIds = this.destructionEditIdsByType[tc]
		if(destroyedEditIds){
			var dids = this.destructionIdsByType[tc] || [];
			for(var i=0;i<destroyedEditIds.length;++i){
				var editId = destroyedEditIds[i]
				if(editId > endEditId){
					break//creationEditIdsByType is sequential
				}
				var id = dids[i]
				if(res.indexOf(id) !== -1){
					res.splice(res.indexOf(id), 1)
				}
				//--many
			}
		}
	}
	

	
	if(cb) cb(res)
	return res
}
Ol.prototype.getHistoricalCreationsOfType = function(typeCode, cb){
	var res = []
	var sts = this.typeCodeSubTypes[typeCode]
	for(var j=0;j<sts.length;++j){
		var tc = sts[j]
		var ids = this.idsByType[tc] || [];
		var editIds = this.creationEditIdsByType[tc]
		for(var i=0;i<ids.length;++i){
			var id = ids[i]
			//if(!this.destroyed[id]){
				var editId = editIds[i]
				res.push({id: id, editId: editId})
			//}
		}
	}
	if(cb) cb(res)
	return res
}
*/
function binarySearchNext(arr, value){
  var low = 0, high = arr.length - 1,
      i, comparison;
  while (low <= high) {
    i = Math.floor((low + high) / 2);
    if (arr[i] < value) { low = i + 1; continue; };
    if (arr[i] > value) { high = i - 1; continue; };
    return i;
  }
  return i;
};

function selectIdsForEvents(startEditId, endEditId, editIds, ids, res){
	//var res = []
	if(editIds.length === 0) return
	var binResult
	if(startEditId <= 0){
		binResult = 0
	}else{
		binResult = binarySearchNext(editIds, startEditId+1)
	//	console.log('bin result: ' + binResult + ' ' + startEditId + ' ' + JSON.stringify([editIds.slice(binResult-2, binResult+2),editIds.length]))
		_.assert(binResult === 0 || editIds[binResult-1] < startEditId+1)
		if(editIds[binResult] <= startEditId){
			//_.assert(binResult+1 === editIds.length)
			++startEditId
			return res
		}
	}
	for(var i=binResult;i<ids.length;++i){
		var id = ids[i]
		var editId = editIds[i]
		if(editId > endEditId){
			break
		}
		if(editId <= startEditId){//TODO do a binary search for the startEditId point
			_.errout('bug: ' + editId + ' ' + startEditId)
		}
		res.push(id)
	}
}
/*
Ol.prototype.getIdsDestroyedOfTypeBetween = function(typeCode, startEditId, endEditId, cb){
	var res = []
	var sts = this.typeCodeSubTypes[typeCode]
	for(var j=0;j<sts.length;++j){
		var tc = sts[j]
		var ids = this.destructionIdsByType[tc] || [];
		var editIds = this.destructionEditIdsByType[tc]||[]
		
		selectIdsForEvents(startEditId, endEditId, editIds, ids, res)
		//console.log(JSON.stringify([startEditId, endEditId, editIds, ids,res]))
	}
	if(cb) cb(res)
	return res
}

Ol.prototype.getIdsCreatedOfTypeBetween = function(typeCode, startEditId, endEditId, cb){
	var res = []
	var sts = this.typeCodeSubTypes[typeCode]
	for(var j=0;j<sts.length;++j){
		var tc = sts[j]
		var ids = this.idsByType[tc] || [];
		var editIds = this.creationEditIdsByType[tc]
		
		selectIdsForEvents(startEditId, endEditId, editIds, ids, res)
	}
	if(cb) cb(res)
	return res
}

Ol.prototype.getDestructionsOfTypeBetween = function(typeCode, startEditId, endEditId, cb){

	var res = []
	var sts = this.typeCodeSubTypes[typeCode]
	for(var j=0;j<sts.length;++j){
		var tc = sts[j]
		var ids = this.destructionIdsByType[tc] || [];
		var editIds = this.destructionEditIdsByType[tc]
		for(var i=0;i<ids.length;++i){
			var id = ids[i]
			//if(!this.destroyed[id]){
				var editId = editIds[i]
				if(editId > endEditId){
					break
				}
				if(editId > startEditId){
					res.push({id: id, editId: editId})
				}
			//}
		}
	}
	if(cb) cb(res)
	return res	
}
Ol.prototype.getCreationsOfTypeBetween = function(typeCode, startEditId, endEditId, cb){

	var res = []
	var sts = this.typeCodeSubTypes[typeCode]
	for(var j=0;j<sts.length;++j){
		var tc = sts[j]
		var ids = this.idsByType[tc] || [];
		var editIds = this.creationEditIdsByType[tc]
		for(var i=0;i<ids.length;++i){
			var id = ids[i]
			var editId = editIds[i]
			if(editId > endEditId){
				break
			}
			if(editId > startEditId){
				res.push({id: id, editId: editId})
			}
		}
	}
	if(cb) cb(res)
	return res	
}

Ol.prototype.getExistedAtAndMayHaveChangedDuring = function(typeCode, startEditId, endEditId, cb){
	var res = []
	var sts = this.typeCodeSubTypes[typeCode]
	for(var j=0;j<sts.length;++j){
		var tc = sts[j]
		var ids = this.idsByType[tc] || [];
		var editIds = this.creationEditIdsByType[tc]
		for(var i=0;i<ids.length;++i){
			var id = ids[i]
			var editId = editIds[i]
			if(editId > startEditId){
				break
			}
			
			var lastEditId = this.lastEditId.get(id)
			if(lastEditId > startEditId){
				res.push(id)
			}else{
				//var cid = id
				
			}
		}
	}
	if(cb) cb(res)
	return res
}
Ol.prototype.getChangedDuringOfType = function(typeCode, startEditId, endEditId, cb){
	var ids = this.getAllIdsOfType(typeCode)
	var remainingIds = []
	var definite = []
	for(var i=0;i<ids.length;++i){
		var id = ids[i]
		var lastVersion = this.getLastVersion(id)
		if(lastVersion > startEditId){
			if(lastVersion <= endEditId){
				definite.push(id)
			}else{
				remainingIds.push(id)
			}
		}
	}
	this.getSubsetThatChangesBetween(remainingIds, startEditId, endEditId, function(ids){
		cb(definite.concat(ids))
	})
}
Ol.prototype.getSubsetThatChangesBetween = function(ids, startEditId, endEditId, cb){
	var subset = []
	var local = this
	var rem = 1
	//ids.forEach(function(id){
	for(var i=0;i<ids.length;++i){
		var id = ids[i]
		_.assertInt(id)
		var last = local.lastEditId.get(id)
		if(last < startEditId) return
		++rem
		local.getVersions(id, function(versions, id){
			var changed = false
			for(var j=0;j<versions.length;++j){
				var v = versions[j]
				if(v > startEditId && v <= endEditId){
					changed = true
					break
				}
			}
			subset.push(id)
			--rem
			if(rem === 0) cb(subset)
		})
	}
	--rem
	if(rem === 0) cb(subset)	
}
*/

Ol.prototype.getAllIdsOfType = function(typeCode){
	
	var res = this.idsByType[typeCode]//[].concat(this.idsByType[typeCode])
	//console.log('got by type: ' + typeCode + ': ' + JSON.stringify(res))
	return res
}
/*
Ol.prototype.getAllOfType = function(typeCode, cb){//gets a read-only copy of all objects of that type
	_.assertLength(arguments, 2)
	//_.errout('TODO')
	var objs = []
	
	var ids = this.getAllIdsOfType(typeCode)
	
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
//	var ids = this.idsByType[typeCode] || [];
	var ids = this.getAllIdsOfType(typeCode)
	
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
*/
Ol.prototype.getInitialManySyncIdsMade = function(){
	return this.readers.manySyncIdsMade
}

exports.make = function(dataDir, schema, cb){
	var ol = new Ol(schema)
	//return ol
	cb(ol)
}

