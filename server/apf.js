"use strict";

//var MaxDesiredSegmentSize = 1024*1024;

var FlushInterval = 1000//this is purely a performance-tuning parameter

//lower values improve the resolution of the timestamps included with each write frame, at the cost of more overhead
//keep in mind that client->server latencies, GC delays, etc., may dominate this anyway
var WriteInterval = 100

var fs = require('fs')
var path = require('path')

var _ = require('underscorem');
var keratin = require('keratin');
var fparse = require('fparse')
//var sf = require('segmentedfile')

var mkdirp = require('mkdirp')

var bin = require('./../util/bin')

var editSchemaStr = fs.readFileSync(__dirname + '/edits.baleen', 'utf8');
var editSchema = keratin.parse(editSchemaStr, ['type'])

var log = require('quicklog').make('minnow/apf')
var ex = require('./tcp_shared').editFp

function load(dataDir, objectSchema, reader, olLatestVersionId, loadedCb){
	_.assertLength(arguments, 5);
	

	var count = 0;
	
	var exReader = {}
	Object.keys(ex.codes).forEach(function(key){
		//var rf = reader[key];
		exReader[key] = function(e, timestamp){
			++count;
			if(count >= olLatestVersionId){
				reader[key](e, timestamp)
			}else{
				log('skipping: ' + count)
			}
		}
	})
	
	var bufs = []
	function deser(){
		if(bufs.length > 1){
			bufs = [Buffer.concat(bufs)]
		}
		while(bufs[0].length >= 4){
			var buf = bufs[0]
		
			var len = bin.readInt(buf, 0)
			if(buf.length < 4 + len) return
			var timestamp = bin.readLong(buf,4)
			//console.log('read timestamp: ' + timestamp)
			var frame = buf.slice(12, 4+len)
			//console.log('frame: ' + len)
			deserFrame(frame,timestamp)
			bufs[0] = buf.slice(4+len)
		}
	}
	var rs = fparse.makeRs()
	function deserFrame(frame, timestamp){
		var off = 0
		while(off < frame.length){
			var typeCode = frame[off];++off;
			rs.put(frame.slice(off))//TODO optimize - let fparse take non-zero initial off
			var e = ex.readersByCode[typeCode](rs.s)
			var name = ex.names[typeCode]
			//console.log('*timestamp: ' + timestamp)
			//console.log('reading ' + name)
			exReader[name](e, timestamp)//TODO optimize to use code instead of name?
			off += rs.getOffset()
		}
	}
	
	var dir = dataDir + '/minnow_data';
	_.assertString(dir);

	mkdirp.sync(dir)
	
	var fullName = dir+'/ap.data'

	
	var manyDesered = 0;
	
	var beginningSegment = true;
	
	
	function readCb(buf){
		/*if(beginningSegment){
			count = bin.readLong(buf, 0);
			buf = buf.slice(8)
			beginningSegment = false;
		}*/
		bufs.push(buf)
		deser();
	}
	/*function segmentCb(wasDiscarded){
		//TODO
		beginningSegment = true;
	}*/

	var start = Date.now()
	
	//sf.open(fullName, readCb, segmentCb, function(sfw){
	
	var apfRs = fs.createReadStream(fullName);
	
	apfRs.on('data', readCb)
	
	
	apfRs.on('error', function(err){
		if(err.code === 'ENOENT'){
			beginWritePhase()
		}else{
			throw err
		}
	})
	apfRs.on('end', beginWritePhase)
	
	function beginWritePhase(){
	
		var sfw = fs.createWriteStream(fullName, {flags: 'a'});
	
		var end = Date.now()

		//count +=  deser.manyRead;
		
		/*function writeCount(){
			var b = new Buffer(8)
			bin.writeLong(b, 0, count);
			sfw.write(b);
		}
		

		//write the count for the initial segment
		if(count === 0){
			writeCount()
		}*/

		log('done loading ' + deser.manyRead + ' commands in ' + (end-start) + 'ms');
		
		deser = undefined
				
		var handle = {}
		
		handle.close = function(cb){
			clearInterval(flushHandle)
			clearInterval(writeHandle)
			//console.log('closing apf')
			//var cdl = _.latch(2, function(){
			//	cb()
			//})
			doFlush()
			
			w.close(function(){
				//console.log('closed w')
				//cdl()
				sfw.end()
				sfw.on('close', function(){
					cb()
				})
			})
			//sfw.end()
			//sfw.sync(function(){
				//console.log('synced sfw')
			//	cdl()
			//})
		}//
	
		_.each(editSchema, function(s){
			handle[s.name] = function(json){
				_.errout('why this?')
			}
		})
	
		//var segmentSize = sfw.getCurrentSegmentSize()
	
		function write(buf){
			//console.log('*writing buf: ' + buf.length);
			sfw.write(buf)
			/*segmentSize += buf.length;
			if(segmentSize > MaxDesiredSegmentSize){
				segmentSize = 0;
				sfw.segment();
				writeCount();
				initWriter()
			}*/
		}

		var w;

		function doWrite(){
			writeBufferedEdits()
		}
		function doFlush(){
			doWrite()
			w.flush();
		}
		var flushHandle = setInterval(doFlush, FlushInterval)
		var writeHandle = setInterval(doWrite, WriteInterval);
				
		var bufferedEditsForWriting = []
		function writeBufferedEdits(){
			if(bufferedEditsForWriting.length === 0) return
			w.startLength()
			w.putLong(Date.now())
			for(var i=0;i<bufferedEditsForWriting.length;++i){
				var e = bufferedEditsForWriting[i]
				w.putByte(ex.codes[e.name])
				ex.writers[e.name](w, e.json)
			}
			w.endLength()
			bufferedEditsForWriting = []
		}

		function initWriter(){
			function end(cb){
				//console.log('in w close')
				if(cb) cb()
			}
			w = fparse.makeWriter({write: write, end: end})
			
			_.each(ex.writers, function(writer, name){
				handle[name] = function(json){
					++count;
					bufferedEditsForWriting.push({name: name, json: json})
					return count;
				}
			});
		}
		initWriter()
		
		handle.getCurrentEditId = function(){return count;}
	
		loadedCb(handle);
	}
}

exports.load = load;
