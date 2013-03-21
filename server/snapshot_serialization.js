"use strict";

/*

Given a view, creates an initial snapshot and emits an edit stream suitable for a sync handle.

Also handles creating an initial state for the view.

*/

var buckets = require('./../deps/buckets')
var _ = require('underscorem')

var fparse = require('fparse')

var shared = require('./tcp_shared')
var pathmerger = require('./pathmerger')

var editFp = require('./tcp_shared').editFp
var editCodes = editFp.codes
var editNames = editFp.names


function orderEditsByEditIdAndOrder(a,b){
	if(a.editId !== b.editId){
		return a.editId - b.editId
	}else{
		return a.order - b.order
	}
}

var fp = shared.editFp

var log = require('quicklog').make('minnow/viewsequencer')

// The structure of a snapshot is just an edit stream, with selectTopObject and selectTopViewObject edits added

exports.serializeSnapshot = serializeSnapshot

function serializeSnapshot(startEditId, endEditId, objectEditBuffers, viewObjectEditBuffers){
	_.assertLength(arguments, 4)
	_.assertArray(objectEditBuffers)
	_.assertArray(viewObjectEditBuffers)
	
	var codes = fp.codes
	var writersByCode = fp.writersByCode

	var w = fparse.makeSingleBufferWriter()
	w.putInt(startEditId)
	w.putInt(endEditId)
	
	var realObjBufs = []
	for(var i=0;i<objectEditBuffers.length;++i){
		var eb = objectEditBuffers[i]
		//if(eb.edits.length > 4){
			realObjBufs.push(eb)
		/*	console.log('pushing: ' + eb.id + ' ' + eb.edits.length)
		}else{
			console.log('discarding: ' + eb.id + ' ' + eb.edits.length)//TODO eliminate the need for this upstream
		}*/
	}
	
	w.putInt(realObjBufs.length)
	//console.log('put objs count: ' + realObjBufs.length)

	for(var i=0;i<realObjBufs.length;++i){
		var e = realObjBufs[i]

		writersByCode[editCodes.selectTopObject](w, {id: e.id})

		if(!Buffer.isBuffer(e.edits)){
			serializeViewObject(w, codes, writersByCode, e.edits)
		}else{
			_.assertBuffer(e.edits)
			w.putData(e.edits, 0, e.edits.length)
		}
	}

	serializeViewObjects(w, codes, writersByCode, viewObjectEditBuffers)
	
	var b = w.finish()
	return b
}

function serializeViewObjects(w, codes, writersByCode, viewObjectEditBuffers){
	//var viewIds = Object.keys(viewObjectEditBuffers)
	w.putInt(viewObjectEditBuffers.length)

	for(var i=0;i<viewObjectEditBuffers.length;++i){
		var e = viewObjectEditBuffers[i]
		var id = e.id//viewIds[i]
		var list = e.edits//viewObjectEditBuffers[id]
		

		writersByCode[editCodes.selectTopViewObject](w, {id: id})

		serializeViewObject(w, codes, writersByCode, list)
	}
}

function serializeViewObject(w, codes, writersByCode, list){
	w.putInt(list.length)//number of edits
	
	for(var j=0;j<list.length;++j){
		var e = list[j]
		_.assertInt(e.op)
		w.putByte(e.op)//codes[e.op])
		_.assertInt(e.editId)
		w.putInt(e.editId)
		try{
			//console.log(JSON.stringify(writersByCode))
			writersByCode[e.op](w, e.edit)
		}catch(err){
			throw new Error('error writing op: (' + e.op + ') ' + JSON.stringify(e)+'\n'+err)
		}	
	}
}

exports.serializeViewObject = serializeViewObject
