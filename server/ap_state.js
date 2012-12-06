"use strict";

var _ = require('underscorem');

//var editstreamer = require('./editstreamer')

var fs = require('fs')

var stub = function(){}

var indexingStub = {
	updateIndexingOnProperty: stub
}

var log = require('quicklog').make('minnow/ap')

var editFp = require('./tcp_shared').editFp
var editCodes = editFp.codes
var editNames = editFp.names

var pathControlEdits = {}

var pce = ['reset', 
	'selectProperty', 'reselectProperty', 
	'selectObject', 'reselectObject', 
	'selectIntKey', 'selectStringKey', 'selectLongKey', 'selectBooleanKey',
	'reselectIntKey', 'reselectStringKey', 'reselectLongKey', 'reselectBooleanKey',
	'selectObjectKey', 'reselectObjectKey',
	'ascend', 'ascend1', 'ascend2', 'ascend3', 'ascend4', 'ascend5']

pce.forEach(function(v){
		pathControlEdits[editCodes[v]] = true
})


function make(schema, ol){
	
	_.assertLength(arguments, 2);

	var indexing = indexingStub;
	
	var ap;
	
	var syncIdCounter = 1
	
	function makeNewSyncId(){
		ap.madeSyncId({})
		var syncId = syncIdCounter + ol.getInitialManySyncIdsMade()
		log('created new sync id: ' + syncId)
		++syncIdCounter;
		return syncId;
	}
	
	var broadcaster
	
	function translateWithTemporaries(path, syncId){
		var ti = temporaryIdsBySync[syncId];

		var result = [].concat(path);
	
		for(var i=0;i<path.length;++i){
			var temporary = result[i]
			if(temporary >= 0) continue
			var id = ti[temporary]
			_.assertInt(id)
			result[i] = id
		}
		
		for(var i=0;i<result.length;++i){
			if(result[i] < 0){
				console.log(JSON.stringify(path) + ' -> ' + JSON.stringify(result));
				console.log(JSON.stringify(tp));
				_.errout('failed to fully translate path');
			}
		}
		
		return result;
	}
	
	var temporaryIdsBySync = {};
	function translateTemporary(temp, syncId){
		_.assertInt(temp)
		_.assertInt(syncId)
		_.assert(temp < -1)
		var real = temporaryIdsBySync[syncId].temporaryIds[temp];
		//console.log('translating ' + temp + ' -> ' + real + ' (' + syncId + ')')
		//console.log(JSON.stringify(temporaryIdsBySync[syncId]))
		_.assertInt(real)
		return real;
	}
	function mapTemporary(temp, real, syncId){
		_.assertInt(syncId)
		_.assert(temp < -1)
		var te = temporaryIdsBySync[syncId]
		if(te === undefined) te = temporaryIdsBySync[syncId] = {mappedIds: {}, temporaryIds: {}}
		
		if(te.mappedIds[real] !== undefined){
			_.errout('real id already mapped: ' + real);
		}
		if(te.temporaryIds[temp] !== undefined){
			_.errout('temporary id already mapped ' + temp + ' -> ' + temporaryIds[temp] + ', now being mapped to ' + real);
		}
		te.temporaryIds[temp] = real;
		te.mappedIds[real] = true;
		
		//console.log('mapped temporary ' + temp + ' -> ' + real)
	}

	function saveEdit(typeCode, id, op, e, syncId, timestamp){
		_.assertNumber(timestamp)
		_.assertInt(op)
		//TODO selectTopObject?
		
		//console.log('saving edit: ', id, op, e, syncId)

		if(op === editCodes.selectObject){
			if(e.id < 0) e.id = translateTemporary(e.id, syncId)
		}else if(op === editCodes.reselectObject){
			if(e.id < 0) e.id = translateTemporary(e.id, syncId)
		}else if(op === editCodes.selectObjectKey){
			if(e.key < 0) e.key = translateTemporary(e.key, syncId)
		}else if(op === editCodes.reselectObjectKey){
			if(e.key < 0) e.key = translateTemporary(e.key, syncId)
		}

		
		if(currentId !== id && id !== -1){
			ap.selectTopObject({id: id})
			//log('wrote selectTopObject(' + id + ')')
			currentId = id
		}
		
		ap[editNames[op]](e)

		var n = ol.persist(id, op, e, syncId, timestamp)

		//log(n.editId, id, op, e, syncId)

		broadcaster.input.objectUpdated(typeCode, id, op, e, syncId, n.editId)	
	}
	var currentId
	var currentSyncId
	
	function persistEdit(typeCode, id, path, op, edit, syncId, computeTemporary, timestamp, reifyCb){
		//_.assertLength(arguments, 8);
				
		_.assertInt(typeCode)
		_.assertInt(syncId);
		_.assertArray(path)
		_.assertFunction(computeTemporary)
		_.assertNumber(timestamp)
		_.assertInt(id)
		
		//_.assertFunction(cb)
		
		//console.log('persisting: ' + JSON.stringify([typeCode, id, path, editNames[op], edit]))
		
		_.assertInt(op)
		
		var e = edit
		
		if(pathControlEdits[op]){
			_.errout('invalid path edit being persisted instead of saved: ' + editNames[op])
		}
		if(op === editCodes.setObject){
			if(e.id < 0){
				e.id = translateTemporary(e.id, syncId)
			}
		}else if(op === editCodes.putExisting){
			if(e.id < 0) e.id = translateTemporary(e.id, syncId)
		}else if(op === editCodes.addExisting){
			_.assert(e.id !== -1)
			if(e.id < 0) e.id = translateTemporary(e.id, syncId)
		}else if(op === editCodes.replaceInternalExisting){
			if(e.newId < 0){
				e.newId = translateTemporary(e.newId, syncId)
			}
			if(e.oldId < 0){
				e.oldId = translateTemporary(e.oldId, syncId)
			}
			ap.replaceInternalExisting(e)
		}else if(op === editCodes.replaceExternalExisting){
			if(e.newId < 0){
				e.newId = translateTemporary(e.newId, syncId)
			}
			if(e.oldId < 0){
				e.oldId = translateTemporary(e.oldId, syncId)
			}
		}else if(op === editCodes.remove){
			if(e.id < 0){
				e.id = translateTemporary(e.id, syncId)
			}
		}else if(op === editCodes.replaceInternalNew){
			if(e.id < 0){
				e.id = translateTemporary(e.id, syncId)
			}
		}else if(op === editCodes.replaceExternalNew){
			if(e.id < 0){
				e.id = translateTemporary(e.id, syncId)
			}
		}else if(op === editCodes.selectObject){
			if(e.id < 0) e.id = translateTemporary(e.id, syncId)
		}else if(op === editCodes.reselectObject){
			if(e.id < 0) e.id = translateTemporary(e.id, syncId)
		}

		if(op !== editCodes.make && id < -1){//note that -1 is not a valid temporary id - that is reserved
			//_.assertInt(id)
			var newId = translateTemporary(id, syncId);
			//console.log('translated temporary id ' + id + ' -> ' + newId + ' (' + syncId + ')');
			id = newId;
			_.assertInt(id)
		}
		
		if(currentSyncId !== syncId){
			ap.setSyncId({syncId: syncId})
			currentSyncId = syncId
		}
				
		_.assertInt(id)
		//console.log(editNames[op])
		var n = ol.persist(id, op, edit, syncId, timestamp)
		var newId = n.id//may be undefined if not applicable for the edit type
		var editId = n.editId
		var realOp = n.op
		var realEdit = n.edit

		if(op === editCodes.make){
			currentId = newId
		}else if(currentId !== id && id !== -1){
			ap.selectTopObject({id: id})
			//console.log('wrote selectTopObject(' + id + ')')
			//log('wrote selectTopObject(' + id + ')')
			currentId = id
		}
		
		if(op === editCodes.putNew){
			var temporary = computeTemporary()
			mapTemporary(temporary, newId, syncId)
			if(reifyCb) reifyCb(temporary, newId)
		}else if(op === editCodes.setToNew){
			e.id = newId
			var temporary = computeTemporary()
			mapTemporary(temporary, newId, syncId)
			if(reifyCb) reifyCb(temporary, newId)
		}else if(op === editCodes.addNew || op === editCodes.replaceInternalNew || op === editCodes.replaceExternalNew || op === editCodes.addNewAt){
			var temporary = computeTemporary()
			mapTemporary(temporary, newId, syncId)
			if(reifyCb) reifyCb(temporary, newId)
		}else if(op === editCodes.setToNew){
			var temporary = computeTemporary()
			e.id = newId
			if(reifyCb) reifyCb(temporary, newId)
		}
			
		//log(editId, id, path, op, edit, syncId)
		
		ap[editNames[op]](e)
	
		if(op === editCodes.make){

			var temporary = computeTemporary()
			//_.assertInt(temporary)
			//_.assertInt(newId)
			mapTemporary(temporary, newId, syncId)
			
			//_.assert(newId >= 0)
			broadcaster.input.objectCreated(e.typeCode, newId, editId)
			return newId;
		}
		
		if(op === editCodes.destroy){
			broadcaster.input.objectDeleted(typeCode, id, editId)
		}

		//_.assertInt(id);
	
		broadcaster.input.objectUpdated(e.typeCode, id, realOp, realEdit, syncId, editId)	

		broadcaster.input.objectChanged(typeCode, id, path, realOp, realEdit, syncId, editId)	
	}		
	var externalHandle = {
		setBroadcaster: function(b){
			broadcaster = b;
			//_.assertUndefined(es)
			//es = editstreamer.make(ol, b)
		},
		persistEdit: persistEdit,
		saveEdit: saveEdit,
		//getInverse: function(id){
			//_.errout('TODO, somewhere')
			/*_.assertLength(arguments, 1);
			//TODO when we implement the edits that cause this, implement the lookup/indexing for this
			//var lk = inverses[typeCode];
			var ts = inverses[id];
			if(ts === undefined) return [];
			else{
			
				var arr = [];
				_.each(ts, function(nts, typeCodeStr){
					var typeCode = parseInt(typeCodeStr);
					_.assertInt(typeCode)
					_.each(nts, function(count, idStr){
						arr.push([true, typeCode, parseInt(idStr)]);
					});
				});
				return arr;
			}*/
		//},
		
		makeNewSyncId: makeNewSyncId,
		//getSyncIdCounter: function(){//for RAFization only
		//	return syncIdCounter;
		//},
		translateTemporaryId: function(id, syncId){
			return translateTemporary(id, syncId)
		},
		syntheticEditId: function(){
			ap.syntheticEdit({})
			return ol.syntheticEditId()
		},
		forgetTemporary: function(real, temporary, syncId){
			//console.log('forgetting temporary: ' + temporary + ' ' + real)
			var te = temporaryIdsBySync[syncId]
			delete te.temporaryIds[temporary]
			delete te.mappedIds[real]
			return
		}
	};
		
	return {
		external: externalHandle,
		setAp: function(newAp){
			ap = newAp;
		},
		setIndexing: function(newIndexing){
			indexing = newIndexing;
		}
	}
}

exports.make = make
