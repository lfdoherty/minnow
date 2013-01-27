"use strict";

var fparse = require('fparse')
var _ = require('underscorem')

var bufw = require('./../util/bufw')
var bin = require('./../util/bin')

var shared = require('./tcp_shared')
var fp = shared.editFp

function serializeFrame(edits, w){
	w.putInt(edits.length)
	//console.log('putting int: ' + edits.length)
	//edits.forEach(function(e){
	for(var i=0;i<edits.length;++i){
		var e = edits[i]
		_.assertInt(e.op)
		w.putByte(e.op)//fp.codes[e.op])
		//console.log('code: ' + fp.codes[e.op] + ' ' + e.editId)
		w.putInt(e.editId)
		fp.writersByCode[e.op](w, e.edit)
	}
}

var rs = fparse.makeRs()
var r = rs.s
var readersByCode = fp.readersByCode
var skippersByCode = fp.skippersByCode
function deserializeFrame(frame){
	rs.put(frame)
	var many = r.readInt()
	var edits = []

	for(var i=0;i<many;++i){
		var b = r.readByte()
		_.assert(b > 0)
		var editId = r.readInt()
		var e = readersByCode[b](r)
		edits.push({op: b, edit: e, editId: editId})
	}
	rs.assertEmpty()
	return edits
}

function deserializePartOfFrame(frame, startEditId, endEditId){
	rs.put(frame)
	var many = r.readInt()
	var edits = []

	for(var i=0;i<many;++i){
		var b = r.readByte()
		_.assert(b > 0)
		var editId = r.readInt()
		if(editId >= startEditId && editId < endEditId){
			var e = readersByCode[b](r)
			edits.push({op: fp.names[b], edit: e, editId: editId})
		}else{
			skippersByCode[b](r)
		}
	}
	rs.assertEmpty()
	return edits
}

function appendSerializeFrame(rest, edits, w){
	_.assert(rest.length > 4)
	var manyBefore = bin.readInt(rest, 0)
	w.putInt(manyBefore + edits.length)
	w.putData(rest, 4, rest.length)//.slice(4))
	//var str = ''
	//for(var i=4;i<rest.length;++i){
	//	str += rest[i]+' '
	//}
	//console.log('@'+str)
	//console.log('& ' + JSON.stringify(deserializeFrame(rest)))
	//console.log('^ ' + JSON.stringify(edits))
	//edits.forEach(function(e){
	for(var i=0;i<edits.length;++i){
		var e = edits[i]
		w.putByte(e.op)//fp.codes[e.op])
		w.putInt(e.editId)
		fp.writersByCode[e.op](w, e.edit)
	}
	
	
}

exports.make = function(){

	var index = {}
	var buffers = []
	var bufferStarts = []//relatively fast way to work out what buffer a total offset is in

	var destroyed = {}
	
	var currentStart = 0	
	var ws = {
		write: function(buf){
			buffers.push({
				buf: buf,
				start: currentStart
			})
			bufferStarts.push(currentStart)
			currentStart += buf.length
		},
		end: function(){
		}
	}
	var w = new bufw.W(10*1024*1024, ws)
	
	
	var handle = {
		write: function(id, edits){
			_.assertInt(id)
			_.assertArray(edits)
			
			var offset = w.getCurrentOffset()
			
			if(edits.length >= 2) _.assertEqual(edits[1].edit.id, id)
			//write all edits
			w.startLength()//set up the length frame
			serializeFrame(edits, w)
			w.endLength()
			
			index[id] = offset
			
			//console.log('wrote edits')
			
			//if(Math.random() < .01) console.log('olbuf: ' + w.getCurrentOffset())
		},
		append: function(id, edits){
			_.assertInt(id)
			_.assertArray(edits)
			
			if(destroyed[id]){
				_.errout('tried to append edits to destroyed object: ' + JSON.stringify(edits))
			}

			var offset = currentStart + w.getCurrentOffset()
			
			//console.log('appending(' + offset + '): ' + JSON.stringify(edits))
			
			var rest = handle.getBinary(id)
			w.startLength()//set up the length frame
			appendSerializeFrame(rest, edits, w)
			w.endLength()
			
			var b =  w.getBackingBuffer()
			/*var str = ''
			for(var i=0;i<w.getCurrentOffset();++i){
				str += b[i]+' '
			}
			console.log('$'+str)*/
			
			var old = index[id]
			index[id] = offset
			_.assert(offset !== old)
			_.assert(rest.length < handle.getBinary(id).length)
			
			_.assert(handle.get(id).length >= 2)

			//if(Math.random() < .01) console.log('olbuf: ' + w.getCurrentOffset())

		},
		destroy: function(id){
			//index[id] = -1
			destroyed[id] = true
		},
		get: function(id){
			var res = deserializeFrame(handle.getBinary(id))
			if(res.length >= 2) _.assertEqual(res[1].edit.id, id)
			return res
		},
		getBinary: function(id){
			var offset = index[id]
			if(offset === undefined) throw new Error('object does not exist: ' + id)
			_.assert(offset !== -1)
			//console.log('getting ' + id + ' ' + offset)
			_.assertInt(offset)
			var off = 0
			var b
			var bOff
			for(var i=0;i<bufferStarts.length;++i){
				if(bufferStarts[i] > off){
					b = buffers[i-1].buf
					bOff = offset - b.start
				}
			}
			if(!b){
				b = w.getBackingBuffer()
				bOff = offset - currentStart
			}
			var len = bin.readInt(b, bOff)
			var frame = b.slice(bOff+4, bOff+4+len)
			return frame
		},
		serializeBinaryRange: function(id, startEditId, endEditId, w){//TODO optimize
			var frame = handle.getBinary(id)
			//_.errout('TODO: ' + startEditId + ' ' + endEditId)
			//deserializePartOfFrame(frame, startEditId, endEditId) 
			if(startEditId > 0 && endEditId > 0) _.assert(startEditId < endEditId)
			//console.log('sbr: ' + startEditId + ', ' + endEditId)
			var edits = deserializeFrame(frame)
			var actual = []
			for(var i=0;i<edits.length;++i){
				var e = edits[i]
				_.assertInt(e.editId)
				if(startEditId <= e.editId && (endEditId === -1 || e.editId <= endEditId)){
					actual.push(e)
				}
			}
			serializeFrame(actual, w)
		},
		isNew: function(id){
			return index[id] === undefined
		},
		isTopLevelObject: function(id){
			//console.log('looking in: ' + JSON.stringify(Object.keys(index)))
			return index[id] !== undefined
		},
		serializeEdits: function(edits, w){
			serializeFrame(edits, w)
		}
	}
	return handle;
}
