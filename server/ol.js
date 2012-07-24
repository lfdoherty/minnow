"use strict";

var sf = require('segmentedfile')

var indexFile = require('indexfilestream')

var parsicle = require('parsicle')
var baleen = require('baleen')
var fparse = require('fparse')
var shared = require('./tcp_shared')
var pathupdater = require('./pathupdater')

var fs = require('fs')

var bin = require('./../util/bin')

var _ = require('underscorem')

var indexFormat = parsicle.make(function(parser){

	parser('entry', 'object', function(p){
		p.key('versionId').long();
		var obj = p.key('objects').array().loop().object();
		obj.key('id').long();
		obj.key('typeCode').int()
		obj.optionalKey('serverId').long();
		obj.key('position').long();
		obj.key('length').int();
	})

	parser('parser', 'object', function(p){
		p.key('id').int();
		p.key('data').binary();
	})
})

function serializeEdits(fp, edits){
	var w = fparse.makeSingleBufferWriter()
	w.putInt(edits.length)
	edits.forEach(function(e){
		//w.putString(e.op)
		w.putByte(fp.codes[e.op])
		w.putInt(e.editId)
		fp.writers[e.op](w, e.edit)
	})
	return w.finish()
}

var log = require('quicklog').make('ol')

var MaxBufferSize = 200;
var BufferFlushChunkSize = 100;
exports.make = function(dataDir, schema, cb){
	_.assertLength(arguments, 3)
	_.assertFunction(cb)


	//var ex = baleen.makeFromSchema(schema,undefined,true, true);

	var idCounter = 0;

	var fp = fparse.makeFromSchema(shared.editSchema)
	
	var parsers = {}
	var newParsers = [];

	var filePositions = {}//by id, actually provides position, length, and parserId

	//TODO construct buffer in chunks for fast discard and writing to disk?
	var buffer = [];
	var bufferIndex = {};//by id

	//we double-buffer these for cheap discarding of old results
	//TODO eventually this will be replaced or supplemented by full edit sequence saving
	var recentVersionCacheFront = {}
	var recentVersionCacheBack = {}
	function getRecentVersion(id, editId){
		//var key = id+':'+editId
		var candidates = recentVersionCacheFront[id] || []
		candidates = candidates.concat(recentVersionCacheBack[id] || [])
		if(candidates.length === 0) return
		var best = candidates[0];
		//console.log('candidates: ' + JSON.stringify(_.map(candidates, function(c){return c.editId;})))
		for(var i=1;i<candidates.length;++i){
			var e = candidates[i]
			if(e.editId > best.editId && e.editId <= editId){
				best = e
			}
		}
		if(best.editId > editId) return
		//console.log('returning ' + best.editId)
		return best.value;
	}
	function cacheVersion(id, editId, value){
		if(recentVersionCacheFront[id] === undefined) recentVersionCacheFront[id] = []
		recentVersionCacheFront[id].push({editId: editId, value: value})
	}
	/*setTimeout(function(){
		recentVersionCacheBack = recentVersionCacheFront
		recentVersionCacheFront = {}
	}, 50000)*/

	var stats = {
		make: 0,
		change: 0,
		writeToDisk: 0,
		reallyReadFromDisk: 0,
		readFromDisk: 0,
		readFromDiskCache: 0,
		readFromBuffer: 0
	}
	/*
	var statHandle = setInterval(function(){
		var fullStats = _.extend({}, stats)
		fullStats.cacheSize = _.size(cache)
		fullStats.bufferSize = buffer.length
		fullStats.recentVersionCacheSize = _.size(recentVersionCacheFront)+_.size(recentVersionCacheBack)
		console.log('ol stats:\n' + JSON.stringify(fullStats, null, 2))
	}, 2000)*/

	var cache = {};	
	
	var idsByType = {}
	
	var lastVersionId = 1
	
	var segmentsForId = {}
	
	//var currentSyncId;

	//var editCounter = 0//TODO update with load properly

	function addByType(typeCode, id){
		if(idsByType[typeCode] === undefined) idsByType[typeCode] = []
		//++many[typeCode];
		idsByType[typeCode].push(id)
	}
	//var isWriting = false;
	function writeToDiskIfNecessary(){
		return //TODO reimplement writing ol to disk
		if(buffer.length >= MaxBufferSize/* && !isWriting*/){
			//console.log('OL WRITING BUFFER TO DISK')
			writeToDisk();
		}
	}
	
	var syncBuffer = []
	var waiting = false;
	var manyToFlush;
	function advanceSyncBuffer(){
		if(waiting) return;
		waiting = true;
		manyToFlush = 1
		log('begun sync')
		dataWriter.sync(gotSync)
	}
	function gotSync(){
		waiting = false
		log('got sync, flushing ' + manyToFlush)
		for(var i=0;i<manyToFlush;++i){
			var sf = syncBuffer.shift()
			sf()
		}
		log('synced: ' + syncBuffer.length)
		if(syncBuffer.length > 0){
			waiting = true
			manyToFlush = syncBuffer.length
			dataWriter.sync(gotSync)
		}
	}
	function writeToDisk(){
		//just write all new parsers, assume they'll get used
		
		//console.log('writing to disk, buffer length: ' + buffer.length)
		
		newParsers.forEach(function(parserId){
			var parserBuf = parsers[parserId];
			indexWriter.writer.parser({id: parserId, data: parserBuf}, 1)
		})
		newParsers = [];
		
		var writingBuffer = buffer.slice(0, BufferFlushChunkSize);
		var indexObj = {versionId: -1, objects: []};
		//TODO consolidate write into a single buffer for performance?
		writingBuffer.forEach(function(b, index){
			if(b.versionId > indexObj.versionId) indexObj.versionId = b.versionId;
			
			//var pos = dataWriter.getOffset();
			var len = b.data.length;
			var pos = dataWriter.write(b.data);
			var fp = {id: b.id, position: pos, length: len, typeCode: b.typeCode};
			//console.log(b.id + ' -> (' + pos + ',' + len + ') (' + b.typeCode + ')')
			indexObj.objects.push(fp)
			delete bufferIndex[b.id];
			filePositions[b.id] = fp;
		})

		//console.log('syncing...')
		//isWriting = true;

		Object.keys(bufferIndex).forEach(function(key){
			bufferIndex[key] -= BufferFlushChunkSize;
		})
		buffer = buffer.slice(BufferFlushChunkSize);
		
		//uses streaming-sync so that we can do further writes before sync returns
		//console.log('pushing sync')
		syncBuffer.push(function(){
			//console.log('...synced')
			var si = indexWriter.writer.entry(indexObj, indexObj.objects.length);
			indexObj.objects.forEach(function(obj){
				segmentsForId[obj.id] = si;
			})
			//console.log('...OL done writing to disk')
		})
		advanceSyncBuffer()
		//isWriting = false;
		writeToDiskIfNecessary()
		//dataWriter.sync()
	}

	var objectReaderDedup = _.doOnce(
		function(id){return id;},
		function(id, cb){
			var pos = filePositions[id];
			if(pos === undefined){
				throw new Error('unknown object: ' + id + ' is not on disk')
			}
			++stats.reallyReadFromDisk
			dataWriter.readRange(pos.position, pos.length, function(buf){
				_.assertEqual(buf.length, pos.length)
				try{
					var json = objReader(buf);
				}catch(e){
					log('reading buf: ' + buf.length)
					var typeCode = bin.readInt(buf, 0)
					log('read typeCode: ' + typeCode)
					var str = '';
					for(var i=0;i<buf.length;++i){
						str += buf[i]+','
					}
					log('buf: ' + str)
					log('pos: ' + JSON.stringify(pos))
					throw e;
				}
				_.assertObject(json)
				cache[id] = json
				cb(json)				
			});					
		})

	function readObject(id, cb){
		++stats.readFromDisk
		objectReaderDedup(id, cb)
	}

	var objReader, objWriter;
	
	var currentSyncId
	var currentId
	var readers = {
		make: function(e){
			//log('GOT MAKE $$$$$$$$$$4')


			var n = make(e)
			currentId = n.id
			log('got make ' + e.typeCode + ' : ' + currentId)
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
		}/*,
		addNew: function(e){
			_.errout('TODO')
		}*/
	}
	
	function appendEdit(op, edit){
		//console.log('here: '  + op + ' ' + JSON.stringify(edit))
		_.assertDefined(currentId)

		//inverse.indexInverse(currentId, op, edit)
		
		log(currentId + ' appending ' + op + ' ' + JSON.stringify(edit))
		
		/*var bi = bufferIndex[currentId]
		if(bi !== undefined){
			var e = buffer[bi];
			e.data.push({op: op, edit: edit, editId: lastVersionId})
			++lastVersionId
		}else{
			_.errout('TODO: ' + currentId + ' ' + JSON.stringify(bufferIndex))
		}*/
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
		//initialState.meta = {id: idCounter,typeCode: typeCode, editId: editId}

		//console.log('making to ' + editId)

		//Object.freeze(initialState.meta)
	
		//console.log('writing...')
		//var data = objWriter[typeCode](initialState);
		//console.log('~~~wrote new object: ' + data.length + ' ' + JSON.stringify(initialState))
		log('wrote object: ' + idCounter)
		bufferIndex[idCounter] = buffer.length
		var bi = {data: [
			{op: 'setSyncId', edit: {syncId: syncId}, editId: editId},
			{op: 'made', edit: {typeCode: edit.typeCode, id: idCounter}, editId: editId}], 
			id: idCounter, typeCode: edit.typeCode, versionId: editId}
		buffer.push(bi)
		//cacheVersion(bi.id, editId, bi)
	

		//writeToDiskIfNecessary()
	
		addByType(edit.typeCode, idCounter);
		currentId = idCounter
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
				if(syncBuffer.length > 0){
					console.log('waiting for sync: ' + syncBuffer.length)
					syncBuffer.push(function(){
						console.log('*closed ol')
						cb()
					})
				}else{
					console.log('closed ol')
					cb()
				}
			}
			//clearInterval(statHandle)
			closed()
			//indexWriter.close(closed)
		},
		getSet: function(ids, cb){
			//console.log('ol getSet ' + ids.length)
			_.assertFunction(cb)
			
			if(ids.length === 0) throw new Error('you probably should not call this with zero values, since it will never callback')
			for(var i=0;i<ids.length;++i){
				var id = ids[i];
				var index = bufferIndex[id];
				if(index === undefined){
					readObject(id, cb);					
				}else{
					var dataBuf = buffer[index].data
					//var parserId = parserIds[index];
					//cb(parserId, parsers[parserId], dataBuf)
					cb(objReader(dataBuf))
				}
				//handle.get(id, cb)
			}
		},
		getAsBuffer: function(id, startEditId, endEditId, cb){//TODO optimize away
			_.assertLength(arguments, 4)
			_.assertInt(startEditId)
			_.assertInt(endEditId)
			_.assertInt(id)
			_.assert(id >= 0)
			
			//console.log('getting ' + id + ' ' + startEditId + ' - ' + endEditId)

			var index = bufferIndex[id];
			if(index !== undefined){
				var bi = buffer[index]

				var actual = []
				bi.data.forEach(function(e){
					//console.log(JSON.stringify(e).slice(0,300))
					_.assertInt(e.editId)
					if(startEditId < e.editId && (endEditId === -1 || e.editId <= endEditId)){
						//console.log('adding: ' + JSON.stringify(e))
						actual.push(e)
					}else{
						//console.log('skipping ' + e.editId)
					}
				})
				
				//console.log('(' + bi.data.length + ')serializing ' + actual.length + ' between ' + startEditId + ' and ' + endEditId)
				//_.assert(actual.length > 0)
				if(actual.length > 0){
					var buf = serializeEdits(fp, actual)
					cb(buf)
				}else{
					cb()
				}
				return
			}
			_.errout('TODO: ' + id + ' ' + index)
		},
		get: function(id, startEditId, endEditId, cb){//TODO optimize away
			_.assertLength(arguments, 4)
			_.assertInt(startEditId)
			_.assertInt(endEditId)
			_.assertInt(id)
			
			//console.log('getting ' + id + ' ' + startEditId + ' - ' + endEditId)

			var index = bufferIndex[id];
			if(index !== undefined){
				var bi = buffer[index]

				var actual = []
				bi.data.forEach(function(e){
					if(startEditId <= e.editId && (endEditId === -1 || e.editId <= endEditId)){
						actual.push(e)
					}else{
						//console.log('skipping ' + startEditId + ' <= ' + e.editId + ' < ' + endEditId)
					}
				})
				//console.log('cbing: ' + JSON.stringify(actual))
				cb(actual)
				return
			}
			_.errout('TODO: ' + id)
			/*
			var nbi = getRecentVersion(id, editId)
			if(nbi !== undefined){
				var json = objReader(nbi.data);
				if(json.meta.editId > editId) throw new Error()
				cb(json)
				return
			}
			
			
			var cached = cache[id];
			if(cached){
				if(cached.meta.editId > startEditId) throw new Error('TODO')
				++stats.readFromDiskCache
				cb(cached)
			}else{
				//TODO handle object versioning
				//console.log('buffered: ' + JSON.stringify(Object.keys(bufferIndex)))
				//console.log('buffer: ' + JSON.stringify(bufferIndex))
				//console.log('cached: ' + JSON.stringify(Object.keys(cache)))
				//console.log('object is not in buffer or cache, requesting read from disk: ' + id + ' ' + editId)
				readObject(id, function(obj){
					if(obj.meta.editId > editId) throw new Error('TODO')
					cb(obj)
				})
			}*/
		},
		isTopLevelObject: function(id){
			var index = bufferIndex[id];
			return index !== undefined//TODO also lookup disk index			
		},
		getLatest: function(id, cb){//TODO optimize away
			_.assertLength(arguments, 2)
			var index = bufferIndex[id];
			if(index === undefined){

				var cached = cache[id];
				if(cached){
					++stats.readFromDiskCache
					cb(cached)
				}else{
					readObject(id, cb)
				}
			}else{
				++stats.readFromBuffer
				var buf = buffer[index].data
				var json = objReader(buf);
				cb(json)				
			}
		},
		has: function(id){
			return bufferIndex[id] !== undefined;
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
			
			var bi = bufferIndex[id]
			if(bi !== undefined){
				var e = buffer[bi];
				//var n = lastVersionId
				
				if(e.syncId !== syncId){
					e.data.push({op: 'setSyncId', edit: {syncId: syncId}, editId: lastVersionId})					
					e.syncId = syncId
					++lastVersionId
				}

				var res = {editId: lastVersionId}
				++lastVersionId

				if(op === 'addNew'){
					op = 'addedNew'
					++idCounter
					res.id = idCounter
					//_.assertInt(edit.temporary)
					edit = {id: res.id/*, temporary: edit.temporary*/, typeCode: edit.typeCode}
				}else if(op === 'replaceInternalNew' || op === 'replaceExternalNew'){
					//es.objectChanged(id, 'replacedNew', {typeCode: edit.typeCode, newId: newId, temporary: temporary, oldId: edit.id}, syncId, editId)
					op = 'replacedNew'
					++idCounter
					res.id = idCounter
					edit = {typeCode: edit.typeCode, newId: res.id, oldId: edit.id}
				}else if(op === 'setToNew'){
					op = 'wasSetToNew'
					++idCounter
					res.id = idCounter
					//_.assertInt(edit.temporary)
					edit = {typeCode: edit.typeCode, id: res.id/*, temporary: edit.temporary*/}
				}
				res.edit = edit
				res.op = op
				
				e.data.push({op: op, edit: edit, editId: res.editId})				
				
				/*if(op === 'addNew' || op === 'replaceInternalNew' || op === 'replaceExternalNew'){
					++idCounter
					res.id = idCounter
					console.log('adding new id: ' + res.id)
				}*/
				return res
			}else{
				_.errout('TODO: ' + id + ' ' + JSON.stringify(bufferIndex))
			}			
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
			var pu = pathupdater.make()
			//var processEx
			handle.get(id, -1, -1, function(edits){
				edits.forEach(pu.update)
			})
			cb(pu.getTypeCode(), pu.getPath(), pu.getSyncId())
		},
		//calls-back with the json representation, and saves it once the callback returns
		//must be in buffer or cache
		/*
		change: function(id, cb){
			_.assertInt(id)
			
			++stats.change
			var bi = bufferIndex[id]
			if(bi !== undefined){
				var e = buffer[bi];
				var data = e.data;
				//console.log('reading data bytes: ' + e.data.length)
				var json = objReader(data);
				_.assertObject(json)

				var editId = lastVersionId
				++lastVersionId
				//console.log('changing to ' + editId)
				//var versionId = incr(json)
				
				cb(json, editId);
				json.meta.editId = editId
				var newData = objWriter[json.meta.typeCode](json)
				//console.log('### wrote object ' + id + ' ' + JSON.stringify(json))
				//e.versionId = editId;

				var newBi = {data: newData, id: id, versionId: editId, typeCode: e.typeCode}
				
				cacheVersion(id, e.editId, e)//cache the old version
				
				buffer[bi] = newBi
				
				++stats.readFromBuffer
			}else{

				var cached = cache[id];
				_.assertObject(cached)
				
				var json = cached
				cb(json);
				//var versionId = incr(json)
				
				var editId = lastVersionId
				//console.log('changing to ' + editId)
				++lastVersionId
				json.meta.editId = editId
				
				//if(versionId !== undefined){
				var buf = objWriter[json.meta.typeCode](json);
				//console.log('### wrote object ' + id + ' ' + JSON.stringify(json))
				bufferIndex[id] = buffer.length;
				var bi = {data: buf, id: id, versionId: editId, typeCode: json.meta.typeCode}
				buffer.push(bi);
				//cacheVersion(id, editId, bi)
				delete cache[id]
				++stats.readFromDiskCache
			}
			//console.log('next editId will be ' + lastVersionId)
			writeToDiskIfNecessary()
		},*/
		//ensures that the requested id will retrieve synchronously for the lifetime
		//of the cb call.
		//this is for change calls.
		cache: function(id, cb){
			if(bufferIndex[id] !== undefined){
				cb();
				return;
			}
			var fp = filePositions[id];
			_.assertDefined(fp)
			_.assertInt(fp.position);
			_.assertInt(fp.length);
			++stats.readFromDisk
			dataWriter.readRange(fp.position, fp.length, function(buf){

				cache[id] = objReader(buf)
				cb()
			})
		},
		/*make: function(initialState, typeCode){
			//_.assertLength(arguments, 2)
			_.assertObject(initialState)
			_.assertInt(typeCode)
			
			++stats.make
			
			++idCounter;
			var editId = lastVersionId
			++lastVersionId
			initialState.meta = {id: idCounter,typeCode: typeCode, editId: editId}

			//console.log('making to ' + editId)

			Object.freeze(initialState.meta)
			
			//console.log('writing...')
			var data = objWriter[typeCode](initialState);
			//console.log('~~~wrote new object: ' + data.length + ' ' + JSON.stringify(initialState))
			bufferIndex[idCounter] = buffer.length
			var bi = {data: data, id: idCounter, typeCode: typeCode, versionId: editId}
			buffer.push(bi)
			//cacheVersion(bi.id, editId, bi)
			

			writeToDiskIfNecessary()
			
			addByType(typeCode, initialState.meta.id);
			
			//console.log('reading data: ' + data.length)
			//console.log('next editId will be ' + lastVersionId)
			return objReader(data)//idCounter;
		},*/
		getLatestVersionId: function(){
			return lastVersionId;
		},
		getMany: function(typeCode){
			return (idsByType[typeCode] || []).length
		},
		getAllIdsOfType: function(typeCode, cb){//gets a read-only copy of all objects of that type
			_.assertLength(arguments, 2)
			var ids = idsByType[typeCode] || [];
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
		}
	};
	
	var indexReaders = {
		entry: function(e, segmentIndex){
			if(lastVersionId < e.versionId) lastVersionId = e.versionId;
			log('read entry: ' + e.versionId)
			e.objects.forEach(function(obj){			
				_.assertUndefined(obj.serverId)//TODO
				if(filePositions[obj.id] === undefined){
					addByType(obj.typeCode, obj.id);
				}
				filePositions[obj.id] = {id: obj.id, position: obj.position, length: obj.length, typeCode: obj.typeCode};
				segmentsForId[obj.id] = segmentIndex
			})
			return e.objects.length
		},
		parser: function(p, segmentIndex){
			parsers[p.id] = p.data;//we never rewrite parsers unless we have to, so no need to track their segment
		}
	}
	
	var indexRewriters = {
		entry: function(e, oldSegment){
			var newEntry = {objects: [], versionId: e.versionId}
			e.objects.forEach(function(obj){
				if(segmentsForId[obj.id] === oldSegment){
					newEntry.objects.push(obj)//TODO rewrite chained data
				}
			})
			indexWriter.writer.entry(newEntry, newEntry.objects.length);
		},
		parser: function(p, oldSegment){	
			indexWriter.writer.parser(p, 1)
		}
	}
	
	//_.assertString(schema.name)
	
	var config = {
		path: dataDir + '/minnow_data/ol.index', 
		readers: indexReaders, 
		rewriters: indexRewriters, 
		format: indexFormat,
		maxSegmentLength: 100*1024,
		chained: dataDir + '/minnow_data/ol.data'
	}
	/*
	var indexWriter = indexFile.open(config, function(){
		
		console.log('loaded ol, latest version id: ' + lastVersionId)

		cb(handle)
	})*/
	log('done ol')
	cb(handle)
	log('done ol after cb')
	
	//var dataWriter
}


