"use strict";

var _ = require('underscorem');

function make(m, cb){

	
	function write(e){
		s.append(new Buffer(JSON.stringify(e)));
	}
	
	function rafName(r){
		return 'raf_' + r[0] + '_' + r[1]
	}
	function apName(i){
		return 'appendlog_' + i;
	}
	
	var earliestAppendLog = 0;
	var latestAppendLog = 0;
	//var appendLogIndex = 0;
	var latestRaf = -1;
	
	var rafs = [];
	
	var rafsMerging;
	var rafsMergingIndex;
	
	var latestIndexing;

	var duringRafization = false;
		
	function processEvent(e){
		if(e.type === 'beginRafization'){
			++latestAppendLog;		
			duringRafization = true;
		}else if(e.type === 'doneRafization'){
			duringRafization = false;
			++earliestAppendLog;
			++latestRaf;
			earliestAppendLog = latestAppendLog;
			latestIndexing = e.indexing;
			rafs.push([latestRaf,latestRaf]);
		}else{
			_.errout('unknown event type: ' + JSON.stringify(e));
		}
	}
	
	var handle = {
		beginRafization: function(){//note that beginRafization does not modify the structure (it is not a persisted event.)
			_.assertNot(duringRafization);
			var e = {type: 'beginRafization'}
			processEvent(e);
			write(e);
			var rafIndex = earliestAppendLog;
			var r = [rafIndex,rafIndex];
			return {
				newApName: apName(latestAppendLog),
				rafName: rafName(r),
				rafDescription: r
			};
		},
		doneRafization: function(indexingStructure){
			_.assert(duringRafization);
			var e = {type: 'doneRafization', indexing: indexingStructure}
			processEvent(e);
			write(e);
		},
		beginRafMerge: function(){
			if(rafs.length < 2) _.errout('invalid to merge now, only 1 raf');
			if(rafsMerging) _.errout('you are already/still merging: ' + JSON.stringify(rafsMerging));
			var smallestMass;
			var smallest;
			for(var i=1;i<rafs.length;++i){
				var a = rafs[i-1];
				var b = rafs[i];
				var mass = a[1]-a[0];
				mass += b[1]-b[0];
				if(smallestMass === undefined || mass <= smallestMass){//we use <= so that the latest ones get merged first
					smallestMass = mass;
					smallest = i;
				}
			}
			rafsMergingIndex = smallest-1;
			rafsMerging = rafs.slice(rafsMergingIndex, rafsMergingIndex+1);
			return rafsMerging;
		},
		doneRafMerge: function(){
			_.assertDefined(rafsMerging);
			var newRaf = [rafsMerging[0][0],rafsMerging[1][1]];
			rafs.splice(rafsMergingIndex,2,newRaf);
			var newRafName = rafName(newRaf);
			var oldRafNames = [rafName(rafsMerging[0]),rafName(rafsMerging[1])];
			rafsMerging = undefined;
			rafsMergingIndex = undefined;
			
			return {
				newRaf: newRafName,
				oldRafs: oldRafNames
			}
		},
		
		canMergeRafs: function(){
			return rafs.length >= 2;
		},
		getRafs: function(cb){
			for(var i=0;i<rafs.length;++i){
				var r = rafs[i];
				cb(rafName(r));
			}
			return rafs.length;
		},
		getAps: function(){
			//_.assertNot(duringRafization);
			//return apName(appendLogIndex);
			var results = [];
			for(var i=earliestAppendLog;i<=latestAppendLog;++i){
				//console.log('ap: ' + apName(i));
				results.push(apName(i));
			}
			return results;
		},
		getIndexing: function(){
			return latestIndexing;
		},
		getNewRafName: function(){
			return rafName([earliestAppendLog,earliestAppendLog]);
		}
	}
	
	
	var s = m.stream('structure');

	var read = s.read(0);
	read.onBlock = function(blob, off, len){
		var str = blob.slice(off, off+len).toString('utf8');
		var json = JSON.parse(str);
		
		processEvent(json);
	}

	read.onEnd = function(){
		//console.log('done structure read');
		cb(handle);
	}
}

exports.make = make;
