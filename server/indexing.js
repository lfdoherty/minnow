"use strict";

var _ = require('underscorem');

var set = require('structures').set;

function loadIndexes(defStream, indexStream, schema, indexes, apState, objectState, raf){
	_.assertLength(arguments, 7);
	
	var primitiveIndexCodes = {};
	var indexPosition = {};
	var primitiveIndexes = {};
	var loading = {};

	_.each(schema._byCode, function(objSchema){
		primitiveIndexCodes[objSchema.code] = {};
		indexPosition[objSchema.code] = {};
		primitiveIndexes[objSchema.code] = {};
		loading[objSchema.code] = {};
	})
	
	function loadPrimitive(index, data){

		var loadedIndex = loadPrimitive.makeNew(index.code, index.property);		
		_.each(data.map, function(idArray, value){
			//console.log('index has ' + idArray.length + ' of ' + index.code + ' ' + index.property);
			loadedIndex.map[value] = set.fromArray(idArray);
			if(!loadedIndex.keyExists[value]){
				loadedIndex.keyExists[value] = true;
				loadedIndex.keys.push(value);
			}
		});
	}
	loadPrimitive.makeNew = function(typeCode, propertyCode){
		_.assertLength(arguments, 2);
		_.assertInt(typeCode);
		_.assertInt(propertyCode);
		
		var loadedIndex = {keys: [], map: {}, keyExists: {}};

		var map = loadedIndex.map;
		var keyExists = loadedIndex.keyExists;
		var keys = loadedIndex.keys;
		
		function addRecord(id, v){
			if(!keyExists[v]){
				keyExists[v] = true;
				keys.push(v);
				map[v] = set.fromSingle(id);
			}else{
				map[v].add(id);
			}
		}
		
		loadedIndex.update = function(obj, oldValue){
			var v = obj[propertyCode];
			var id = obj[0][2];
			if(oldValue === undefined){//the object wasn't indexed before
				addRecord(id, v)			
			}else{
				map[oldValue].remove(id);// = map[oldValue].getRemoved(id)
				if(v !== undefined){//the object is no longer indexed
					addRecord(id, v)			
				}
			}
		}
		loadedIndex.makeDef = function(){
			return {code: typeCode, property: propertyCode, type: 'primitive'};
		}
		loadedIndex.makeData = function(){
			var data = {keys: loadedIndex.keys, map: {}};
			console.log('making snapshot');
			_.each(loadedIndex.map, function(idSet, valueKey){
				console.log('at snapshot, index has ' + valueKey + ' ' + idSet.size());
				data.map[valueKey] = idSet.get();
			});
			console.log('finished making snapshot');
			return data;
		}
		primitiveIndexes[typeCode][propertyCode] = loadedIndex;
		return loadedIndex;
	}
	function load(index, loader, cb){
	
		var pos = indexPosition[index.code][index.property];
		if(loading[index.code][index.property] !== undefined){
			loading[index.code][index.property].push(cb);
		}else{
			loading[index.code][index.property] = [cb];
		
			if(indexStream === undefined){
				loader.makeNew();
				cb();
			}else{
				indexStream.readSingle(pos, function(buf, off, len){
					var str = buf.toString('utf8', off, off+len);
					var data = JSON.parse(str);
			
					loader(index, data);
				
					console.log('loaded index for ' + index.code + ' ' + index.property + ' into memory.');
					var listeners = loading[index.code][index.property];
					for(var i=0;i<listeners.length;++i){
						listeners[i]();
					}
					delete loading[index.code][index.property];
				});
			}
		}
	}
	function loadPrimitiveMap(index, data){
		//go through each idList and turn it into an IdSet
		var keys = data.keys;
		var loadedIndex = {byValue: {}, keys: keys}
		for(var j=0;j<keys.length;++j){
			var key = keys[i];
			var map = index.data.byValue[key].map;
			var loadedMap = {};
			_.each(map, function(idArray, valueStr){
				loadedMap[valueStr] = new IdSet(idArray);
			});
			loadedIndex.byValue[key] = {map: loadedMap, keys: data.byValue[key].keys};
		}
		primitiveIndexes[index.code][index.property] = loadedIndex;
		
		//TODO handle updates
	}
	
	function doSelect(typeCode, descentPath, filterFunction){
		if(descentPath.length === 1){

			var index = primitiveIndexes[typeCode][descentPath[0]];
			var setsToAdd = [];
			for(var i=0;i<index.keys.length;++i){
				var value = index.keys[i];
				var ids = index.map[value];
		
				if(filterFunction(value)){
					//console.log('matched: ' + value);
					setsToAdd.push(ids);
				}
			}
			if(setsToAdd.length === 0){
				//console.log('none matched');
				return set.empty;
			}else if(setsToAdd.length === 1){
				return setsToAdd[0].invariant();
			}else{
				var first = setsToAdd[0];
				return first.getUnionAll(setsToAdd.slice(1)).invariant();
				//_.errout('TODO: ' + filterFunction);
				//matching = matching.getAddedAllSets(setsToAdd);
				//return matching;
			}
		}else if(descentPath.length === 2){
			//for now at least, must be a primitive-map index
			console.log('using map special index');

			var key = descentPath[1];
			var index = primitiveIndexes[typeCode][descentPath[0]];
			var setsToAdd = [];

			index = index.byValue[key];
			if(index !== undefined){
				for(var i=0;i<index.keys.length;++i){
					var value = index.keys[i];
					var ids = index.map[value];
		
					if(filterFunction(value)){
						setsToAdd.push(ids);
					}
				}
				if(setsToAdd.length === 1){
					return setsToAdd[0].invariant();
				}else{
					_.errout('TODO');
					//matching.addAllSets(setsToAdd);
				}
			}
			console.log('...done using map special index: ' + matching.size());
			return set.empty;
		}
	}
	
	//index all in apState for a new or newly loaded index
	function initializeIndex(index, typeCode){
		var objs = apState.getAllObjects(typeCode);
		var keys = Object.keys(objs);
		for(var i=0;i<keys.length;++i){
			var obj = objs[keys[i]];
			index.update(obj)
		}
	}

	function initializeIndexFromAll(index, typeCode, cb){
		if(!defStream){//no raf has been created yet, so just do the ap-based initialization
			initializeIndex(index, typeCode);
		
			cb();
		}else{
		
			raf.getAllObjects(typeCode, function(objs){

				var keys = Object.keys(objs);
				for(var i=0;i<keys.length;++i){
					var obj = objs[keys[i]];
					index.update(obj)
				}
			
				defStream.append(new Buffer(JSON.stringify(index.makeDef())));
				indexStream.append(new Buffer(JSON.stringify(index.makeData())));

				initializeIndex(index, typeCode);
			
				cb();
			});
		}
	}
	
	function supportedPropertyIndex(property){
		var propertyType = property.type;
		return propertyType.type === 'primitive' || 
			(propertyType.type === 'map' && 
			 propertyType.value.type === 'primitive' && 
			 propertyType.key.type == 'primitive');
	}
	
	var handle = {
		selectByPropertyConstraint: function(typeCode, descentPath, filterFunction, cb){
			_.assertLength(arguments, 4);
			_.assertArray(descentPath);
			_.assertFunction(cb);
			
			//check that it is something we know how to index
			var property = schema._byCode[typeCode].propertiesByCode[descentPath[0]];
			if(supportedPropertyIndex(property)){
			
				if(primitiveIndexes[typeCode][descentPath[0]] === undefined){
					var loader;
					if(descentPath.length === 1){
						loader = loadPrimitive;
					}else{
						loader = loadPrimitiveMap;
					}
					var pic = primitiveIndexCodes[typeCode][descentPath[0]];
					if(pic){
						load(pic, loader, function(){
							console.log('got load callback');
					
							var index = primitiveIndexes[typeCode][descentPath[0]];
							initializeIndex(index, typeCode);
					
							cb(doSelect(typeCode, descentPath, filterFunction));
						});
					}else{
						var index = primitiveIndexes[typeCode][descentPath[0]] = loader.makeNew(typeCode, descentPath[0]);
						initializeIndexFromAll(index, typeCode, function(){
							cb(doSelect(typeCode, descentPath, filterFunction));
						});
					}
					return;
				}else{
					cb(doSelect(typeCode, descentPath, filterFunction));
					return;
				}
			}

			console.log('rejecting!!!: ' + typeCode + ' ' + JSON.stringify(descentPath) + ' ' + descentPath.length);
			cb();
			return;
		},
		updateIndexingOnProperty: function(typeCode, obj, propertyCode, oldValue){
			//console.log('updating indexing ' + typeCode + ' ' + propertyCode);
			var index = primitiveIndexes[typeCode][propertyCode];
			if(index !== undefined){
				index.update(obj, oldValue)
			}
		},
		flushToDisk: function(newDefStream, newIndexStream, syncedCb){
			_.assertFunction(syncedCb);
			
			_.each(primitiveIndexes, function(byProp, typeCodeStr){
				_.each(byProp, function(index, propertyCodeStr){
					newDefStream.append(new Buffer(JSON.stringify(index.makeDef())));
					newIndexStream.append(new Buffer(JSON.stringify(index.makeData())));
				});
			});
			
			defStream = newDefStream;
			indexStream = newIndexStream;
			
			var cdl = _.latch(2, syncedCb);
			defStream.sync(cdl);
			indexStream.sync(cdl);
		}
	};

	if(indexes){
		for(var i=0;i<indexes.length;++i){
		
			var index = indexes[i];
		
			if(index.type === 'primitive'){
		
				//console.log('loading primitive-property index: ' + index.code + ' ' + index.property);
			
				primitiveIndexCodes[index.code][index.property] = index;
			
			}else if(index.type === 'primitive-map'){

				//console.log('loading primitive-map index: ' + index.code + ' ' + index.property);

				primitiveIndexCodes[index.code][index.property] = index;
			
			
			}else _.errout('unknown index type: ' + index.type);

			indexPosition[index.code][index.property] = i;
		}
	}

	console.log('primitiveIndexCodes: ' + JSON.stringify(primitiveIndexCodes));
	
	return handle;
}

function load(schema, m, apState, structure, objectState, raf, cb){
	_.assertLength(arguments, 7);

	var defStream, indexStream;
	
	if(structure !== undefined){
		
		var indexes = [];
		
		console.log('index loading from structure ***********************');

		defStream = m.stream(structure.defStreamName);
		indexStream = m.stream(structure.dataStreamName);
		
		defStream.readAllImmediate(function(buf,off,len){
			var indexDef = JSON.parse(buf.toString('utf8', off, off+len));
			indexes.push(indexDef);
		},finish);
	}else{
		finish();
	}
	
	function finish(){
		var handle = loadIndexes(defStream, indexStream, schema, indexes, apState, objectState, raf);

		handle.snapshotToDisk = function(syncedCb){
			
			var c = structure !== undefined ? structure.offset + 1 : 0;
			var s = {
				offset: c,
				defStreamName: 'index_' + c + '.defs',
				dataStreamName: 'index_' + c + '.data'
			}
			
			//note that we clear streams in case of previous failed snapshotting
			var newDefStream = m.stream(s.defStreamName, true);
			var newDataStream = m.stream(s.dataStreamName, true);
			
			handle.flushToDisk(newDefStream, newDataStream, syncedCb);
			
			structure = s;
			return structure;
		}
		
		cb(handle);
	}
}

exports.load = load;

