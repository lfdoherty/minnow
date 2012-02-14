
var _ = require('underscorem');

function make(m, rafName, typeCode, apState, syncedCb){


	var objs = apState.external.getAllObjects(typeCode);

	var ids = [];
	_.each(objs, function(obj){
		var id = obj[0][2];
		ids.push(id);
	});

	var many = ids.length;
	if(many === 0){
		syncedCb();
		return;
	}
	
	console.log('adding new raf');
	
	var rafData =  m.stream(rafName + '.' + typeCode + '.data', true);
	var rafIndex = m.stream(rafName + '.' + typeCode + '.index', true);

	console.log('writing all of type: ' + typeCode + ' ' + many);
	
	var typeCodeBuffer = new Buffer(8);
	bin.writeInt(typeCodeBuffer,0,many);
	bin.writeInt(typeCodeBuffer,4,apState.external.getManyCreatedOfType(typeCode));
	rafIndex.append(typeCodeBuffer);
	
	
	ids.sort(function(a,b){return a - b;});
	
	var switchBuffer = new Buffer(1);
	if(ids[ids.length-1] - ids[0] === ids.length-1){
	
		console.log('making fast index');

		switchBuffer[0] = 0;
		rafIndex.append(switchBuffer);

		var idsBuffer = new Buffer(12);
		bin.writeInt(idsBuffer,0,ids[0]);
		bin.writeInt(idsBuffer,4,ids[ids.length-1]);
		bin.writeInt(idsBuffer,8,ids.length);
		
		var off = 0;
		var index = {};
		index.isFast = true;
		index.first = ids[0];
		index.last = ids[ids.length-1];
		index.many = ids.length;
		for(var i=0;i<ids.length;++i){
			var id = ids[i];
			var obj = objs[id];

			var data = new Buffer(JSON.stringify(obj));
			rafData.append(data);
		}
	
		rafIndex.append(idsBuffer);
	}else{
		console.log('making slow index: ' + ids.length + ' ' + ids[0] + ' ' + ids[ids.length-1]);

		var idOff = 0;
		
		var idsBuffer = new Buffer(many*4);

		switchBuffer[0] = 1;
		rafIndex.append(switchBuffer);
		
		var off = 0;
		var index = {};
		for(var i=0;i<ids.length;++i){
			var id = ids[i];
			var obj = objs[id];
			bin.writeInt(idsBuffer,idOff,id);
			idOff += 4;

			var data = new Buffer(JSON.stringify(obj));
			rafData.append(data);

			index[id] = off;
			++off;
		}
	
		rafIndex.append(idsBuffer);
	}

	var h = {
		dataStream: rafData,
		manyCreated: apState.external.getManyCreatedOfType(typeCode),
		many: many,
		index: index
	};
	
	var cdl = _.latch(2, function(){
		console.log('raf merge synced');
		syncedCb();
	});
	rafIndex.sync(cdl);
	rafData.sync(cdl);	
	
	return h;
}

function load(m, rafName, typeCode, doneCb){

	var rafIndex = m.stream(rafName + '.' + typeCode + '.index');
	var rafData = m.stream(rafName + '.' + typeCode + '.data');

	var objOff = 0;
	
	console.log('reading for type ' + typeCode);
	
	rafIndex.count(function(count){
	
		if(count === 0){
		
			doneCb();
		}else{

			rafIndex.readSingle(0, function(blob, off, len){
				var b = blob.slice(off, off+len)
				var many = bin.readInt(b,0)
				var manyMoreCreated = bin.readInt(b,4)

				rafIndex.readSingle(1, function(blob, off, len){
					var b = blob.slice(off, off+len)
					var switching = b[0];
					
					rafIndex.readSingle(2, function(blob, off, len){
						
						var index = {}
						if(switching === 0){
							index.first = bin.readInt(blob, off);
							index.last = bin.readInt(blob, off+4);
							index.many = bin.readInt(blob, off+8);
							index.isFast = true;
						}else{
							//readRafObjects(index,many,blob.slice(off,off+len))
							var indexOff = off;
							//console.log('buffer size: ' + indexBuffer.length);
							for(var i=0;i<many;++i){
								var id = bin.readInt(blob,indexOff);

								_.assert(id >= 0);

								index[id] = i;
								indexOff += 4;
							}
						}
		
						doneCb({
							//indexStream: rafIndex,
							dataStream: rafData,
							manyCreated: manyMoreCreated,
							many: many,
							index: index
						});
					});
				});
			});
		}
	});
}

exports.load = load;
exports.make = make;
