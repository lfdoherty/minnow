"use strict";

var _ = require('underscorem');
var util = require('util');

var bin = require('./../util/bin');
//var IdSet = require('./idset').IdSet;
var set = require('structures').set;
var objutil = require('./objutil');

var rafCache = require('./rafcache');

var rafMerge = require('./raf_merge');

function getOffsetFromIndex(index, id){
	if(index.isFast){
		if(id < index.first || id > index.last) return;
		return id - index.first;
	}else{
		return index[id];
	}
}
function make(schema, m, structure, cb){

	var rafs = {};
	
	var manyCreated = {};
	
	var latestEditCount = 0;
	
	_.each(schema._byCode, function(objSchema, typeCodeStr){
		var typeCode = objSchema.code;
		manyCreated[typeCode] = 0;
		rafs[typeCode] = [];
	});
	
	function getObjectsWithRanges(typeCode, ids, cb){
		_.assertLength(arguments, 3);
		_.assertFunction(cb);
		
		if(rafs.length === 0 || ids.length === 0){
			cb({});
			return;
		}
		
		//console.log('getting objects with ranges: ' + typeCode + ' ' + ids.length);
		
		
		var objs = {};
		var remaining = 0;
		
		var foundIds = {};

		var typeRafs = rafs[typeCode];

		_.times(typeRafs.length, function(ii){
			var i = typeRafs.length-1-ii;

			var raf = typeRafs[i];
			var objIndex = raf.index;//typeIndex[i];
			//console.log('objIndex: ' + JSON.stringify(objIndex));
			if(objIndex){
				
				if(objIndex.isFast){
					var smallest = ids[0];
					var biggest = ids[ids.length-1];
					if(objIndex.first > biggest || objIndex.last < smallest){
						console.log('fast skip - all wrong(' + smallest + ',' + biggest + ') (' + objIndex.first + ',' + objIndex.last + ')');
					}
				}
				
				var seqs = [];
				var prevOff;
				var cur;
				
				for(var j=0;j<ids.length;++j){
					var id = ids[j];
					if(foundIds[id]) continue;

					var objOff = getOffsetFromIndex(objIndex, id);
					if(objOff != undefined){
						_.assertInt(objOff);
						if(objOff !== prevOff+1){
							cur = [];
							seqs.push(cur);
						}
						cur.push(objOff);
						foundIds[id] = true;
						prevOff = objOff;
					}
				}
				if(seqs.length === 0){
					//console.log('no matches in this raf (' + i + ')');
					//if(objIndex.isFast) console.log('fast ' + objIndex.first + ' ' + objIndex.last + ' sample: ' + ids[0]);
					return;
				}
				_.assert(seqs.length > 0);
				
				//console.log('sequences are: ' + JSON.stringify(seqs));

				remaining += seqs.length;

				var rafData = raf.dataStream;//typeRafs[i];
				
				_.each(seqs, function(seq, index){
					var start = seq[0];
					var many = seq.length;
					
					var alreadyFinished = false;
					rafData.readImmediate(start, many, function(b,off,len){
						var json = JSON.parse(b.toString('utf8', off, off+len));
						objs[json[0][2]] = json;
					},
					function(){
						--remaining;
						if(remaining === 0){
							console.log('finished sequence(' + many + '): ' + typeCode + ' ' + JSON.stringify(seq));
							_.assertNot(alreadyFinished);
							console.log('so finished');
							alreadyFinished = true;
							finish();
						}
					});
				});
			}else{
				console.log('no index of that type in this raf (' + i + ')');
			}
		})
		
		var running = setInterval(function(){
			console.log('still remaining: ' + remaining);
		}, 500);
		function finish(){
			clearInterval(running);
			_.assertEqual(_.size(foundIds), _.size(objs));
			//console.log('raf got: ' + _.size(objs));
			cb(objs);
		}
		
		if(remaining === 0){
			finish();
			return;
		}
	}
	
	var cachedCbs = {};
	function getAllObjects(typeCode){
		_.assertLength(arguments, 1);
		_.assertFunction(cb);
		var objs = {};
		var remaining = 0;

		var typeRafs = rafs[typeCode];
		for(var i=typeRafs.length-1;i>=0;--i){
			
			var raf = typeRafs[i];
			
			var rafData = raf.dataStream;//typeRafs[i];
			var r = rafData.read(0,raf.many);
			++remaining;
			var actualMany = 0;
			r.onBlock = function(b,off,len){
				var json = b.toString('utf8', off, off+len);
				objs[json[0][2]] = JSON.parse(json);
				//console.log('got object ' + typeCode + ' ' + json[0][2]);
				++actualMany;
			}
			r.onEnd = function(){
				--remaining;
				if(remaining === 0){
					//console.log('actualMany: ' + actualMany);
					finish();
				}
			}
		}
		
		function finish(){
			var cbs = cachedCbs[typeCode];
			for(var i=0;i<cbs.length;++i){
				cbs[i](objs);
			}
			delete cachedCbs[typeCode];
		}
		
		if(remaining === 0){
			finish();
			return;
		}
	}
	
	var handle = {
		makeNewRaf: function(rafName, apState, syncedCb){
			_.assertLength(arguments, 3);
			_.assertFunction(syncedCb);
			
			var syncedCdl = _.latch(2, function(){
				console.log('makeNewRaf finished sync');
				syncedCb();
			});//TODO temporary error

			var typeCodes = [];
			var remaining = _.size(schema._byCode);
			function scb(){
				--remaining;
				console.log('scb remaining: ' + remaining);
				if(remaining === 0){
					console.log('scb synced');
					syncedCdl();
				}
			}
			_.each(schema._byCode, function(objSchema){
				var typeCode = objSchema.code;
				var result = rafMerge.make(m, rafName, typeCode, apState, scb);
				if(result !== undefined){
					typeCodes.push(typeCode);
					rafs[typeCode].push(result);
					manyCreated[typeCode] += result.manyCreated;
				}
			})

			var rafMeta = m.stream(rafName +'.meta', true);
		
			var editCount = apState.getEditCount();
			var startingEditCount = apState.getStartingEditCount();
			var b = new Buffer(16+(typeCodes.length*4));
			bin.writeLong(b,0,startingEditCount);
			bin.writeLong(b,8,editCount);
			for(var i=0;i<typeCodes.length;++i){
				bin.writeInt(b, 16+(i*4), typeCodes[i]);
			}
			rafMeta.append(b);
			rafMeta.sync(syncedCdl);
		},
		getEditCount: function(){
			return latestEditCount;
		},
		getObject: function(typeCode, id, cb){

			var typeRafs = rafs[typeCode];
			for(var i=typeRafs.length-1;i>=0;--i){

				var raf = typeRafs[i];
				var objIndex = raf.index;

				var objOff = getOffsetFromIndex(objIndex, id);
				if(objOff != undefined){
					var rafData = typeRafs[i].dataStream;
					util.debug('raf reading single ' + typeCode + ' ' + id + ' at ' + objOff);
					rafData.readSingle(objOff, function(b, off, len){

						var json = JSON.parse(b.toString('utf8', off, off+len));
						console.log('...reading single done ' + typeCode + ' ' + id + ' ' + b.length + ' ' + len);
						cb(json);
					});
					return;
				}
			}
			cb(undefined);
		},
		getManyOfType: function(typeCode, cb){
			var count = manyCreated[typeCode] || 0;
			console.log('count: ' + typeCode + ' ' + count);
			cb(count);
		},
		objectExists: function(typeCode, id, cb){

			var typeRafs = rafs[typeCode];
			for(var i=typeRafs.length-1;i>=0;--i){
			
				var objIndex = typeRafs[i].index;

				var objOff = getOffsetFromIndex(objIndex, id);
				if(objOff != undefined){
					cb(true);
					return;
				}
			}
			cb(false);
		},
		getObjects: function(typeCode, ids, cb){
			_.assertArray(ids);

			ids.sort(function(a,b){return a - b;});
			//console.log('ids: ' + JSON.stringify(ids));
			
			getObjectsWithRanges(typeCode, ids, cb);
		},
		getAllObjects: function(typeCode, cb){
			if(cachedCbs[typeCode] === undefined){
				cachedCbs[typeCode] = [cb];
				getAllObjects(typeCode);
			}else{
				cachedCbs[typeCode].push(cb);
			}
		},
		getTypeCounts: function(cb){
			var result = {};
			_.each(manyCreated, function(m, typeCodeStr){
				result[typeCodeStr] = m;
			});
			cb(result);
		}
	}
	
	rafCache.wrap(schema, handle);
	
	
	function readRaf(rafName, doneCb){


		var rafMeta = m.stream(rafName + '.meta');
		console.log('reading meta raf: ' + rafName + '.meta');
		rafMeta.readSingle(0, function(blob, off, len){

			var b = blob.slice(off, off+len);
			var startingEditCount = bin.readLong(b,0);
			latestEditCount = bin.readLong(b,8);
			
			var typeCodes = [];
			for(var i=16;i<b.length;i+=4){
				typeCodes.push(bin.readInt(b,i));
			}

			var rafs = {};

			var cdl = _.latch(typeCodes.length, function(){
				doneCb(rafs)
			});
			
			console.log('read meta ' + startingEditCount + ' ' + latestEditCount);

			
			
			_.each(typeCodes, function(typeCode){

				rafMerge.load(m, rafName, typeCode, function(raf){
					rafs[typeCode] = raf;
					cdl();
				});
			})
		})
	}
	
	var todoRafNames = [];
	//TODO read rafs backward and skip already-gotten objects for memory efficiency
	//note all the issues with sequencing in readRaf (don't overwrite latestEditCount, unshift instead of push, etc.)
	var remaining = structure.getRafs(function(rafName){
		todoRafNames.push(rafName);
	});
	processRafNames();
	
	function processRafNames(){
		if(todoRafNames.length === 0){
			cb(handle);
			return;
		}
		var rafName = todoRafNames.shift();
		console.log('loading raf: ' + rafName);
		readRaf(rafName, _.once(function(partialRafs){
			
			_.each(partialRafs, function(raf, typeCodeStr){
				rafs[typeCodeStr].push(raf);
				manyCreated[typeCodeStr] += raf.manyCreated;
			});

			processRafNames();			
		}));
	}
	
}

exports.make = make;
