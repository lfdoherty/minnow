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
	'selectProperty',
	'selectObject',
	'selectIntKey', 'selectStringKey', 'selectLongKey', 'selectBooleanKey',
	'selectObjectKey',
	'selectSubObject']

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
	/*
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
	}*/
	
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
	function mapTemporary(temp, real, syncId, editId){
		_.assertInt(syncId)
		_.assert(temp < -1)
		var te = temporaryIdsBySync[syncId]
		if(te === undefined){
			te = temporaryIdsBySync[syncId] = {
				/*mappedIds: {}, */
				temporaryIds: {},
				//editIdsHistory: [],
				//temporaryHistory: []
			}
		}
		
		/*if(te.mappedIds[real] !== undefined){
			_.errout('real id already mapped: ' + real);
		}*/
		if(te.temporaryIds[temp] !== undefined){
			_.errout('temporary id already mapped ' + temp + ' -> ' + temporaryIds[temp] + ', now being mapped to ' + real);
		}
		te.temporaryIds[temp] = real;
		//te.editIdsHistory.push(editId)
		//te.temporaryHistory.push(temp)
		//te.mappedIds[real] = true;
		
		//console.log('mapped temporary ' + temp + ' -> ' + real + ' ' + syncId + ' ' + editId)
	}

	function saveEdit(typeCode, id, op, e, syncId, timestamp){
		_.assertNumber(timestamp)
		_.assertInt(op)
		//TODO selectTopObject?
		
		//console.log('saving edit: ', id, op, e, syncId)

		if(op === editCodes.selectObject){
			if(e.id < 0) e.id = translateTemporary(e.id, syncId)
		}else if(op === editCodes.selectSubObject){
			if(e.id < 0) e.id = translateTemporary(e.id, syncId)
		}else if(op === editCodes.selectObjectKey){
			console.log('key: ' + e.key)
			if(e.key < 0) e.key = translateTemporary(e.key, syncId)
		}

		
		if(currentId !== id && id !== -1){
			ap.selectTopObject({id: id})
			//log('wrote selectTopObject(' + id + ')')
			currentId = id
		}
		
		ap[editNames[op]](e)

		/*var n = */ol.persist(op, e, syncId, timestamp, id)//{top: id, topTypeCode: typeCode})

		//log(n.editId, id, op, e, syncId)

		//TODO stop doing this here? - who cares if the path has been changed?
		//broadcaster.input.objectUpdated(typeCode, id, op, e, syncId, n.editId)	
	}
	var currentId
	var currentSyncId
	
	function persistEdit(state, op, e, syncId, computeTemporary, timestamp, reifyCb){
		//_.assertLength(arguments, 8);
				
		//_.assertInt(typeCode)
		_.assertInt(syncId);
		_.assertObject(state)
		_.assertFunction(computeTemporary)
		_.assertNumber(timestamp)
		//_.assertInt(id)

		/*if(op !== editCodes.make){// && op !== editCodes.makeFork){
			_.assertInt(state.topTypeCode)
			_.assertInt(state.objTypeCode)
		}	*/
		
		var stateTop = state.top
		
		//console.log('persisting: ' + JSON.stringify([state, editNames[op], e]))
		
		_.assertInt(op)
		
		if(pathControlEdits[op]){
			_.errout('invalid path edit being persisted instead of saved: ' + editNames[op])
		}
		if(op === editCodes.setObject){
			if(e.id < 0){
				e.id = translateTemporary(e.id, syncId)
			}
		}else if(op === editCodes.putExisting){
			if(e.id < 0) e.id = translateTemporary(e.id, syncId)
		}else if(op === editCodes.addExisting || op === editCodes.unshiftExisting || op === editCodes.addAfter){
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
		}
		
		if(op !== editCodes.make && stateTop < -1){//note that -1 is not a valid temporary id - that is reserved
			//_.assertInt(id)
			var newId = translateTemporary(top, syncId);
			//console.log('translated temporary id ' + id + ' -> ' + newId + ' (' + syncId + ')');
			_.assertInt(newId)
			stateTop = newId
		}
		
		if(currentSyncId !== syncId){
			ap.setSyncId({syncId: syncId})
			currentSyncId = syncId
		}
				
		//_.assertInt(id)
		//console.log(editNames[op])
		
		var newId = ol.persist(op, e, syncId, timestamp, stateTop)
		//var newId = n.id//may be undefined if not applicable for the edit type
		//var editId = n.editId
		//var realOp = n.op
		//var realEdit = n.edit

		if(op === editCodes.make/* || op === editCodes.makeFork*/){
			currentId = newId
		}else if(currentId !== stateTop && stateTop !== -1){
			ap.selectTopObject({id: stateTop})
			//console.log('wrote selectTopObject(' + id + ')')
			//log('wrote selectTopObject(' + id + ')')
			currentId = stateTop
		}
		
		var currentEditId = ol.getLatestVersionId()
		
		if(op === editCodes.putNew){
			var temporary = computeTemporary()
			mapTemporary(temporary, newId, syncId, currentEditId)
			if(reifyCb) reifyCb(temporary, newId, syncId)
		}else if(op === editCodes.setToNew){
			//e.id = newId
			var temporary = computeTemporary()
			mapTemporary(temporary, newId, syncId, currentEditId)
			if(reifyCb) reifyCb(temporary, newId, syncId)
		}else if(op === editCodes.addNew || op === editCodes.unshiftNew || op === editCodes.replaceInternalNew || op === editCodes.replaceExternalNew || op === editCodes.addNewAt || op === editCodes.addNewAfter){
			var temporary = computeTemporary()
			mapTemporary(temporary, newId, syncId, currentEditId)
			if(reifyCb) reifyCb(temporary, newId, syncId)
		}else if(op === editCodes.setToNew){
			var temporary = computeTemporary()
			//e.id = newId
			//TODO why no mapTemporary?
			mapTemporary(temporary, newId, syncId, currentEditId)
			if(reifyCb) reifyCb(temporary, newId, syncId)
		}
			
		//log(editId, id, path, op, edit, syncId)
		
		ap[editNames[op]](e)
		
		//if(Math.random() < .001) console.log('w: ' + JSON.stringify(temporaryIdsBySync).length)
	
		if(op === editCodes.make){
			var temporary = computeTemporary()
			_.assertInt(temporary)
			_.assertInt(newId)
			mapTemporary(temporary, newId, syncId, currentEditId)
			
			_.assertInt(newId)
			return newId;
		}
	}		
	var externalHandle = {
		/*setBroadcaster: function(b){
			broadcaster = b;
		},*/
		persistEdit: persistEdit,
		saveEdit: saveEdit,
		makeNewSyncId: makeNewSyncId,
		translateTemporaryId: function(id, syncId){
			return translateTemporary(id, syncId)
		},
		syntheticEditId: function(){
			ap.syntheticEdit({})
			return ol.syntheticEditId()
		},
		forgetTemporary: function(temporary, syncId){
			//console.log('forgetting temporary: ' + temporary)
			var te = temporaryIdsBySync[syncId]
			delete te.temporaryIds[temporary]
			//delete te.mappedIds[real]
			return
		},
		syncIdUpTo: function(syncId, upToEditId){
			//_.errout('TODO: ' + syncId + ' ' + editId)
			/*
			var te = temporaryIdsBySync[syncId]
			if(!te){
				console.log('no te: ' + syncId + ' ' + JSON.stringify(Object.keys(temporaryIdsBySync)))
				return
			}
			//var realHistory = te.realHistory
			var temporaryHistory = te.temporaryHistory
			var editIds = te.editIdsHistory
			for(var i=0;i<temporaryHistory.length;++i){
				var temporary = temporaryHistory[i]
				//var real = realHistory[i]
				var editId = editIds[i]
				if(editId > upToEditId) break
				delete te.temporaryIds[temporary]
				//delete te.mappedIds[real]
			}
			console.log('cleared ' + i + ' temporaries')
			te.temporaryHistory = te.temporaryHistory.slice(i-1)
			te.editIdsHistory = te.editIdsHistory.slice(i-1)
			*/
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
