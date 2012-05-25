
var sf = require('segmentedfile')

var indexFile = require('indexfilestream')

var parsicle = require('parsicle')
var baleen = require('baleen')

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

//TODO use number of changes rather than buffer size to decide when to flush?
var MaxBufferSize = 1000;
var BufferFlushChunkSize = 500;

exports.make = function(dataDir, schema, cb){

	_.assertFunction(cb)

	var ex = baleen.makeFromSchema(schema,undefined,true, true);

	var idCounter = 0;
	
	var parsers = {}
	var newParsers = [];

	var filePositions = {}//by id, actually provides position, length, and parserId

	var buffer = [];
	var bufferIndex = {};//by id

	var cache = {};
	
	var idsByType = {}
	
	var lastVersionId = -1
	
	var segmentsForId = {}

	var editCounter = 0//TODO update with load properly

	function addByType(typeCode, id){
		if(idsByType[typeCode] === undefined) idsByType[typeCode] = []
		//++many[typeCode];
		idsByType[typeCode].push(id)
	}
	var isWriting = false;
	function writeToDiskIfNecessary(){
		if(buffer.length > MaxBufferSize && !isWriting){
			writeToDisk();
		}
	}
	function writeToDisk(){
		//just write all new parsers, assume they'll get used
		
		console.log('writing to disk, buffer length: ' + buffer.length)
		
		newParsers.forEach(function(parserId){
			var parserBuf = parsers[parserId];
			indexWriter.writer.parser({id: parserId, data: parserBuf}, 1)
		})
		newParsers = [];
		
		var writingBuffer = buffer.slice(0, BufferFlushChunkSize);
		var indexObj = {versionId: -1, objects: []};
		writingBuffer.forEach(function(b, index){
			if(b.versionId > indexObj.versionId) indexObj.versionId = b.versionId;
			
			//var pos = dataWriter.getOffset();
			var len = b.data.length;
			var pos = dataWriter.write(b.data);
			var fp = {id: b.id, position: pos, length: len, typeCode: b.typeCode};
			console.log(b.id + ' -> (' + pos + ',' + len + ') (' + b.typeCode + ')')
			indexObj.objects.push(fp)
			delete bufferIndex[b.id];
			filePositions[b.id] = fp;
		})
		isWriting = true;
		dataWriter.sync(function(){
			var si = indexWriter.writer.entry(indexObj, indexObj.objects.length);
			indexObj.objects.forEach(function(obj){
				segmentsForId[obj.id] = si;
			})
			Object.keys(bufferIndex).forEach(function(key){
				bufferIndex[key] -= BufferFlushChunkSize;
			})
			buffer = buffer.slice(BufferFlushChunkSize);
			isWriting = false;
		})
	}

	var objectReaderDedup = _.doOnce(
		function(id){return id;},
		function(id, cb){
			var pos = filePositions[id];
			if(pos === undefined){
				throw new Error('unknown object: ' + id)
			}
			dataWriter.readRange(pos.position, pos.length, function(buf){
				_.assertEqual(buf.length, pos.length)
				try{
					var json = objReader(buf);
				}catch(e){
					console.log('reading buf: ' + buf.length)
					var typeCode = bin.readInt(buf, 0)
					console.log('read typeCode: ' + typeCode)
					var str = '';
					for(var i=0;i<buf.length;++i){
						str += buf[i]+','
					}
					console.log('buf: ' + str)
					console.log('pos: ' + JSON.stringify(pos))
					throw e;
				}
				_.assertObject(json)
				cache[id] = json
				cb(json)				
			});					
		})

	function readObject(id, cb){
		objectReaderDedup(id, cb)
	}

	var objReader, objWriter;

	function incr(json){
		json.meta.editId = editCounter;
		++editCounter;
		return json.meta.editId
	}
	
	var handle = {
		//returns the binary representation
		//cb(parserId, parserBuf, dataBuf)
		close: function(cb){
			function closed(){
				console.log('closed ol')
				cb()
			}
			indexWriter.close(closed)
			//dataWriter.close(cdl)
		},
		getSet: function(ids, cb){
			console.log('ol getSet ' + ids.length)
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
		get: function(id, cb){//TODO optimize away
			var index = bufferIndex[id];
			if(index === undefined){

				var cached = cache[id];
				if(cached){
					//cb(cached)
					//var json = objReader(cached);
					cb(cached)
				}else{
					readObject(id, cb)
				}
			}else{
				var buf = buffer[index].data
				//var parserId = bin.readInt(buf, 0)//parserIds[index];
				//var dataBuf = buf.slice(4)
				//cb(parserId, parsers[parserId], dataBuf)
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
		//calls-back with the json representation, and saves it once the callback returns
		//must be in buffer or cache
		change: function(id, cb){
			_.assertInt(id)
			
			var bi = bufferIndex[id]
			if(bi !== undefined){
				var e = buffer[bi];
				var data = e.data;
				//console.log('reading data bytes: ' + e.data.length)
				var json = objReader(data);
				_.assertObject(json)
				var versionId = incr(json)
				cb(json, versionId);
				e.data = objWriter[json.meta.typeCode](json)
				e.versionId = versionId;
				//}
			}else{
				/*if(id !== cachedId){
					_.errout('unknown id or not cached: ' + id);
				}
				_.assertEqual(id, cachedId);*/
				var cached = cache[id];
				_.assertObject(cached)
				
				var json = cached
				/*var versionId = */cb(json);
				var versionId = incr(json)
				//if(versionId !== undefined){
				var buf = objWriter[json.meta.typeCode](json);
				bufferIndex[id] = buffer.length;
				buffer.push({data: buf, id: id, versionId: versionId, typeCode: json.meta.typeCode});
				delete cache[id]
				//}
			}
			writeToDiskIfNecessary()
		},
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
			dataWriter.readRange(fp.position, fp.length, function(buf){

				cache[id] = objReader(buf)
				cb()
			})
		},
		make: function(initialState, typeCode, editId){
			_.assertObject(initialState)
			_.assertInt(editId)
			_.assertInt(typeCode)
			
			++idCounter;
			
			initialState.meta = {id: idCounter,typeCode: typeCode, editId: editId}
			
			//console.log('writing...')
			var data = objWriter[typeCode](initialState);
			//console.log('wrote data: ' + data.length + ' ' + JSON.stringify(initialState))
			bufferIndex[idCounter] = buffer.length
			buffer.push({data: data, id: idCounter, typeCode: typeCode, versionId: editId})
			

			writeToDiskIfNecessary()
			
			addByType(typeCode, initialState.meta.id);
			
			//console.log('reading data: ' + data.length)
			return objReader(data)//idCounter;
		},
		getLatestVersionId: function(){
			return lastVersionId;
		},
		getMany: function(typeCode){
			return (idsByType[typeCode] || []).length
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
			console.log('read entry: ' + e.versionId)
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
	
	var indexWriter = indexFile.open(config, function(){
		
		console.log('loaded ol, latest version id: ' + lastVersionId)
		objReader = ex.binary.single.makeReader(function(parserId){return parsers[parserId];});
		objWriter = ex.binary.single.makeWriter(parsers, function(parserId, parserBuf){
			if(parsers[parserId] === undefined){
				parsers[parserId] = parserBuf;
				newParsers.push(parserId);
			}
		});
		
		dataWriter = indexWriter.chained;
		cb(handle)
	})
	
	var dataWriter
}


