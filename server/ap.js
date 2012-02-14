"use strict";

var _ = require('underscorem');

var appendlog = require('./appendlog');

var objectstate = require('./objectstate');

exports.make = function(schema, m, structure, raf, cb){
	_.assertLength(arguments, 5);
	
	var apState;

	var apStream;
	var ap;
	
	var doingRafization;
		
	//Once we've CBed, we set up a periodic task to test whether it is time to flush the AP to a RAF
	function convertLogToRaf(incrementAp, size, count, rafName){
		_.assertNot(doingRafization);
		doingRafization = Date.now();
		
		var start = Date.now();
		
		if(incrementAp){
			var info = structure.beginRafization();
			rafName = info.rafName;
			apStream = m.stream(info.newApName);
			ap = appendlog.make(schema, apStream, true);
		}
		console.log('calling makeNewRaf: ' + JSON.stringify(info));

		var flushedCdl = _.latch(2, function(){
			console.log('all flushing finished - wrote rafization to structure');
			
			structure.doneRafization(indexingStructure);
			doingRafization = undefined;
		});

		raf.makeNewRaf(rafName, apState, function(){
			console.log('flushed raf to disk');
			flushedCdl();
		});
		
		var indexingStructure = indexing.snapshotToDisk(function(){
			console.log('flushed index to disk');
			flushedCdl();
		});

		if(incrementAp){
			apState.setAp(ap, true);
		}

		
		var end = Date.now();
		console.log('finished raf creation(' + count + ' ' + size + ') in ' + (end-start) + ' ms.');
	}

	var objectState, broadcaster, inv, indexing;

	function finish(){
		
		apState.setAp(ap);
		apState.external.setBroadcaster(broadcaster);
		cb(apState.external, indexing, objectState, broadcaster);
		
		function maybeConvertLogToRaf(){
			apStream.byteSize(function(size){
				apStream.count(function(count){
				 	if(shouldRafize(size, count)){
				 		if(doingRafization){
				 			var secs = (Date.now() - doingRafization)/1000;
				 			console.log('still syncing previous rafization (for ' + secs + '), and ap is getting big: ' + count + ' ' + size);
				 		}else{
					 		convertLogToRaf(true, size, count);
					 	}
					}
				})
			})
		}
		
		setInterval(maybeConvertLogToRaf, 1000);
	}	
	
	//uses actual disk space size as well as edit count (one for memory use, one for complexity...)
	function shouldRafize(size, count){ return count > 200000 || size > 1024*1024*100;}
	
	raf.getTypeCounts(function(counts){
		apState = require('./ap_state').make(schema, raf.getEditCount(), raf, counts);

		var remaining = 0;
		var apNames = structure.getAps();
		
		_.assert(apNames.length > 0);
		_.assert(apNames.length <= 2);

		var inv = require('./inverse').make(apState.external);
		broadcaster = require('./broadcast').make(inv);
		
		objectState = objectstate.make(schema, apState.external, broadcaster, raf);

		require('./indexing').load(schema, m, apState.external, structure.getIndexing(), objectState, raf, function(indexingObj){
			indexing = indexingObj;
		
			apState.setIndexing(indexing);
			objectState.setIndexing(indexing);
			
			var cur = 0;
			function loadNext(){
				var apName = apNames[cur];
			
				apStream = m.stream(apName);
				ap = appendlog.make(schema, apStream);

				++remaining;
		
				console.log('loading from ap: ' + apName);

				if(cur === 1){
					//we already started RAFizing the AP during the last loadNext, so we should flush it before
					//adding any more data to it
					apState.clearState();
				}
		
				ap.load(apState.internal, function(){
					--remaining;
					_.assert(remaining >= 0);
				
					++cur;
				
					if(cur === 1){
					
						//var inv = require('./inverse').make(apState.external);
						//broadcaster = require('./broadcast').make(inv);
					
						//objectState = objectstate.make(schema, apState.external, broadcaster, raf);

						/*require('./indexing').load(schema, m, apState.external, structure.getIndexing(), objectState, raf, function(i){
							indexing = i;
							objectState.setIndexing(indexing);
							//load(raf, ap, indexing, objectState, broadcaster, inv);
						
							if(cur === apNames.length){
								console.log('loaded single ap, finishing');
								finish();
							}else{
								if(cur === 1){
									console.log('minnow closed with incomplete rafization, starting conversion during load process for correctness');
									convertLogToRaf(false, 'forced', 'forced', structure.getNewRafName());
								}
								loadNext();
							}		
						});*/

						if(cur === apNames.length){
							console.log('loaded single ap, finishing');
							finish();
						}else{
							if(cur === 1){
								console.log('minnow closed with incomplete rafization, starting conversion during load process for correctness');
								convertLogToRaf(false, 'forced', 'forced', structure.getNewRafName());
							}
							loadNext();
						}		

					}else{
						_.assertEqual(cur, 2);

						if(cur === apNames.length){
							console.log('loaded ' + apNames.length + ' aps, finishing');
							finish();
						}
					}
				});
			}
			loadNext();
		});
		/*
		for(var i=0;i<apNames.length;++i){
			var apName = apNames[i];
			
			apStream = m.stream(apName);
			ap = appendlog.make(schema, apStream);

			openAps.push(ap);
			
			++remaining;
		
			console.log('loading from ap: ' + apName);
		
			ap.load(apState.internal, function(){
				--remaining;
				_.assert(remaining >= 0);
		
				if(remaining === 0){
					finish(ap, apStream);
				}
			});
		}*/
	});
}
