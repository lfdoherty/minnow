
var fs = require('fs')
var path = require('path')

var keratin = require('keratin');
var baleen = require('baleen');
var _ = require('underscorem');
var fparse = require('fparse')

var sf = require('segmentedfile')

var bin = require('./../util/bin')

var editSchemaStr = fs.readFileSync(__dirname + '/edits.baleen', 'utf8');//TODO async
var editSchema = keratin.parse(editSchemaStr, baleen.reservedTypeNames);

var log = require('quicklog').make('minnow/apf')

var MaxDesiredSegmentSize = 1024*1024;

function load(dataDir, objectSchema, reader, olLatestVersionId, loadedCb){
	_.assertLength(arguments, 5);
	
	//var ex = baleen.makeFromSchema(editSchema)
	var ex = fparse.makeFromSchema(editSchema)

	var count = 0;
	
	var exReader = {}
	Object.keys(reader).forEach(function(key){
		var rf = reader[key];
		exReader[key] = function(e){
			++count;
			if(count >= olLatestVersionId){
				rf(e, count)
			}else{
				log('skipping: ' + count)
			}
		}
	})
	
	//var deser = ex.binary.stream.makeReader(exReader);
	var bufs = []
	function deser(){
		if(bufs.length > 1){
			bufs = [Buffer.concat(bufs)]
		}
		while(bufs[0].length >= 4){
			var buf = bufs[0]
		
			var len = bin.readInt(buf, 0)
			if(buf.length < 4 + len) return
			var frame = buf.slice(4, 4+len)
			//console.log('frame: ' + len)
			deserFrame(frame)
			bufs[0] = buf.slice(4+len)
		}
	}
	var rs = fparse.makeRs()
	function deserFrame(frame){
		var off = 0
		while(off < frame.length){
			var typeCode = frame[off];++off;
			var name = ex.names[typeCode]//TODO optimize fparse
			rs.put(frame.slice(off))//TODO optimize - let fparse take non-zero initial off
			var e = ex.readers[name](rs.s)
			//console.log('typeCode: ' + typeCode)
			//console.log('name: ' + name)
			//console.log('e: ' + JSON.stringify(e))
			//console.log(''+ex.readers[name])
			exReader[name](e)
			off += rs.getOffset()
		}
	}
	
	var dir = dataDir + '/minnow_data';
	_.assertString(dir);
	
	var fullName = dir+'/ap'

	
	var manyDesered = 0;
	
	var beginningSegment = true;
	
	
	function readCb(buf){
		if(beginningSegment){
			count = bin.readLong(buf, 0);
			buf = buf.slice(8)
			beginningSegment = false;
		}
		bufs.push(buf)
		deser();
	}
	function segmentCb(wasDiscarded){
		//TODO
		beginningSegment = true;
	}

	var start = Date.now()
	
	sf.open(fullName, readCb, segmentCb, function(sfw){
	
		var end = Date.now()

		//count +=  deser.manyRead;
		
		function writeCount(){
			var b = new Buffer(8)
			bin.writeLong(b, 0, count);
			sfw.write(b);
		}
		
		log('done loading ' + deser.manyRead + ' commands in ' + (end-start) + 'ms');

		//write the count for the initial segment
		if(count === 0){
			writeCount()
		}
				
		var handle = {}
		
		handle.close = function(cb){
			clearInterval(flushHandle)
			var cdl = _.latch(2, function(){
				cb()
			})
			//w.flush()
			doFlush()
			w.close(cdl)
			sfw.end()
			sfw.sync(function(){
				cdl()
			})
		}
	
		_.each(editSchema, function(s){
			handle[s.name] = function(json){
				_.errout('why this?')
			}
		})
	
		var segmentSize = sfw.getCurrentSegmentSize()
	
		function write(buf){
			//console.log('*writing buf: ' + buf.length);
			sfw.write(buf)
			segmentSize += buf.length;
			if(segmentSize > MaxDesiredSegmentSize){
				segmentSize = 0;
				sfw.segment();
				writeCount();
				//w.reset();//tells the writer to make the stream readable from this point ('keyframes' it.)
				initWriter()
			}
		}

		var w;

		function doFlush(){
			writeBufferedEdits()
			w.flush();
		}
		var flushHandle = setInterval(doFlush, 1000);
		
		var bufferedEditsForWriting = []
		function writeBufferedEdits(){
			if(bufferedEditsForWriting.length === 0) return
			w.startLength()
			bufferedEditsForWriting.forEach(function(e){
				w.putByte(ex.codes[e.name])
				//console.log('writing json: ' + JSON.stringify(e))
				ex.writers[e.name](w, e.json)
			})
			w.endLength()
			bufferedEditsForWriting = []
		}

		function initWriter(){
			/*w = deser.makeWriter(write, function(cb){
				if(cb) cb()
			});*/
			function end(cb){
				if(cb) cb()
			}
			w = fparse.makeWriter({write: write, end: end})
			
			_.each(ex.writers, function(writer, name){
				handle[name] = function(json){
					++count;
					//buffer(name, json)
					bufferedEditsForWriting.push({name: name, json: json})
					//writer(json);
					//TODO buffer edits for block writing
					return count;
				}
			});
		}
		initWriter()
		
		handle.getCurrentEditId = function(){return count;}
	
		loadedCb(handle);
	})
}

exports.load = load;
