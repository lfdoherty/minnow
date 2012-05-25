"use strict";

var _ = require('underscorem');

var propertyvalueindex = require('./propertyvalueindex')

var set = require('structures').set

function supportedPropertyIndex(property){
	var propertyType = property.type;
	return propertyType.type === 'primitive' || 
		(propertyType.type === 'map' && 
		 propertyType.value.type === 'primitive' && 
		 propertyType.key.type == 'primitive');
}

function load(dataDir, schema, ol, cb){
	_.assertLength(arguments, 4);
	_.assertString(dataDir)

	/*var defStream, indexStream;
	
	if(structure !== undefined){
		
		var indexes = [];
		
		//console.log('index loading from structure ***********************');

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


		
		cb(handle);
	}*/
	
	var loadedPvis = {}
	
	function hasPvi(typeCode, propertyCode){
		var key = typeCode + ':' + propertyCode;
		return loadedPvis[key] !== undefined;
	}
	var pviLoader = _.doOnce(
		function(typeCode, propertyCode){
			return typeCode + ':' + propertyCode;
		},
		function(typeCode, propertyCode, cb){
			_.assertFunction(cb)
			propertyvalueindex.load(dataDir, schema, typeCode, propertyCode, ol, function(pvi){
				var key = typeCode + ':' + propertyCode;
				loadedPvis[key] = pvi;
				cb(pvi)
			})
		})
	
	function getPvi(typeCode, propertyCode, cb){
		var key = typeCode + ':' + propertyCode;
		var pvi = loadedPvis[key];
		if(pvi){
			cb(pvi)
			return;
		}
		pviLoader(typeCode, propertyCode, cb);
	}
		
	var handle = {
		selectByPropertyConstraint: function(typeCode, descentPath, filterFunction, cb){
			_.assertLength(arguments, 4);
			_.assertArray(descentPath);
			_.assertFunction(cb);
			
			//console.log('selecting by index: ' + typeCode + ' ' + JSON.stringify(descentPath));
			//check that it is something we know how to index
			var propertyCode = descentPath[0]
			var property = schema._byCode[typeCode].propertiesByCode[propertyCode];
			if(property === undefined){
				_.errout('cannot follow path: ' + JSON.stringify(descentPath))
			}
			//_.assertLength(descentPath, 1) 
			
			//TODO support longer descent paths
			if(descentPath.length === 1 && supportedPropertyIndex(property)){
			
				getPvi(typeCode, propertyCode, function(pvi){

					var setsToAdd = [];
					var values = pvi.getValues()
					for(var i=0;i<values.length;++i){
						var value = values[i]
		
						if(filterFunction(value)){
							//console.log('matched: ' + value);
							var ids = pvi.get(value)
							setsToAdd.push(ids);
						}else{
							//console.log('rejected: ' + value);
						}
					}
					if(setsToAdd.length === 0){
						//console.log('none matched');
						cb(set.empty)
					}else if(setsToAdd.length === 1){
						cb(setsToAdd[0].invariant())
					}else{
						var first = setsToAdd[0];
						cb(first.getUnionAll(setsToAdd.slice(1)).invariant())
					}
				})
			
				/*if(primitiveIndexes[typeCode][descentPath[0]] === undefined){
					var loader;
					if(descentPath.length === 1){
						loader = loadPrimitive;
					}else{
						loader = loadPrimitiveMap;
					}
					//console.log('loading index ' + typeCode + ' ' + descentPath[0]);
					var pic = primitiveIndexCodes[typeCode][descentPath[0]];
					if(pic){
						load(pic, loader, function(){
							//console.log('got load callback');
					
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
				}*/
			}else{

				console.log('rejecting!!!: ' + typeCode + ' ' + JSON.stringify(descentPath) + ' ' + descentPath.length);
				console.log(JSON.stringify(property))
				cb();
			}
		},
		/*
			TODO: use passthrough to special indexes for updating?
		*/
		updateIndexingOnProperty: function(typeCode, obj, propertyCode, oldValue){
			/*//if(typeCode === 3) console.log('updating indexing ' + typeCode + ' ' + propertyCode + ': ' + JSON.stringify(obj));
			var index = primitiveIndexes[typeCode][propertyCode];
			//console.log('updating index ' + typeCode + ' ' + propertyCode + ' ' + JSON.stringify(primitiveIndexes))
			if(index !== undefined){
				index.update(obj, oldValue)
			}*/
			if(hasPvi(typeCode, propertyCode)){
				getPvi(typeCode, propertyCode, function(pvi){
					//TODO
					//_.errout('TODO')
					var newValue = obj[propertyCode]
					pvi.update(obj.meta.id, newValue, obj.meta.editId);
				})
			}
			//_.errout('TODO')
		}
	};
	
	cb(handle)
}

exports.load = load;
/*

var set = require('structures').set;

var indexingParser = parsicle.make(function(parser){

	parser('json', 'string', function(p){})
})


function loadIndexes(defStream, indexStream, schema, indexes, apState, ol){
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
		loadedIndex.keys = data.keys;
		_.each(data.map, function(idArray, value){
			//console.log('index has ' + idArray.length + ' of ' + index.code + ' ' + index.property);
			loadedIndex.map[value] = set.fromArray(idArray);
			if(!loadedIndex.keyExists[value]){
				loadedIndex.keyExists[value] = true;
				//loadedIndex.keys.push(value);
				//checkType(index.code,index.property,value)
			}
		});
	}
	function checkType(tc,pc,v,obj){
		var objSchema = schema._byCode[tc];
		var p = objSchema.propertiesByCode[pc];
		if(p.type.type === 'primitive' && p.type.primitive === 'int'){
			if(!_.isInteger(v)){
				_.errout('should be int(' + tc + ' ' + pc + '): ' + v + ' ' + typeof(v) + ' ' + JSON.stringify(obj));
			}
		}
	}
	loadPrimitive.makeNew = function(typeCode, propertyCode){
		_.assertLength(arguments, 2);
		_.assertInt(typeCode);
		_.assertInt(propertyCode);
		
		var loadedIndex = {keys: [], map: {}, keyExists: {}};

		var map = loadedIndex.map;
		var keyExists = loadedIndex.keyExists;
		var keys = loadedIndex.keys;
		
		function addRecord(id, v,obj){
			if(!keyExists[v]){
				keyExists[v] = true;
				checkType(typeCode,propertyCode,v,obj);
				keys.push(v);
				map[v] = set.fromSingle(id);
			}else{
				map[v].add(id);
			}
		}
		
		loadedIndex.update = function(obj, oldValue){
			var v = obj[propertyCode];
			var id = obj.meta.id
			if(oldValue === undefined){//the object wasn't indexed before
				if(v !== undefined){
					addRecord(id, v,obj)
				}
			}else{
				map[oldValue].remove(id);// = map[oldValue].getRemoved(id)
				if(v !== undefined){//the object is no longer indexed
					addRecord(id, v,obj)			
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

					//console.log('loading index for ' + index.code + ' ' + index.property + ' into memory.');
					//console.log(str);
					loader(index, data);
				
					//console.log('...loaded index for ' + index.code + ' ' + index.property + ' into memory.');
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
				}else{
					//console.log('rejected: ' + value);
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
		}else{
			_.errout('TODO');
		}
	}
	


	function initializeIndexFromAll(index, typeCode, cb){

		
			//TODO optimize - get desired property only?
			ol.getAllObjects(typeCode, function(objs){

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
		//}
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
			
			//console.log('selecting by index: ' + typeCode + ' ' + JSON.stringify(descentPath));
			//check that it is something we know how to index
			var property = schema._byCode[typeCode].propertiesByCode[descentPath[0]];
			if(property === undefined){
				_.errout('cannot follow path: ' + JSON.stringify(descentPath))
			}
			if(supportedPropertyIndex(property)){
			
				if(primitiveIndexes[typeCode][descentPath[0]] === undefined){
					var loader;
					if(descentPath.length === 1){
						loader = loadPrimitive;
					}else{
						loader = loadPrimitiveMap;
					}
					//console.log('loading index ' + typeCode + ' ' + descentPath[0]);
					var pic = primitiveIndexCodes[typeCode][descentPath[0]];
					if(pic){
						load(pic, loader, function(){
							//console.log('got load callback');
					
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
			//if(typeCode === 3) console.log('updating indexing ' + typeCode + ' ' + propertyCode + ': ' + JSON.stringify(obj));
			var index = primitiveIndexes[typeCode][propertyCode];
			//console.log('updating index ' + typeCode + ' ' + propertyCode + ' ' + JSON.stringify(primitiveIndexes))
			if(index !== undefined){
				index.update(obj, oldValue)
			}
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

	//console.log('primitiveIndexCodes: ' + JSON.stringify(primitiveIndexCodes));
	
	return handle;
}

function load(schema, m, apState, structure, objectState, raf, cb){
	_.assertLength(arguments, 7);

	var defStream, indexStream;
	
	if(structure !== undefined){
		
		var indexes = [];
		
		//console.log('index loading from structure ***********************');

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


		
		cb(handle);
	}
}

exports.load = load;
*/
