"use strict";

var _ = require('underscorem')

var variables = require('./variables')
var newViewSequencer = require('./new_view_sequencer')

var log = require('quicklog').make('minnow/viewstate')

function makeGetAllSubtypes(schema){
	function getAllSubtypes(typeCode){
		var objSchema = schema._byCode[typeCode]
		var result = {}
		result[objSchema.code] = objSchema
		if(objSchema.subTypes){
			Object.keys(objSchema.subTypes).forEach(function(stName){
				var subs = getAllSubtypes(schema[stName].code)
				subs.forEach(function(objSchema){
					result[objSchema.code] = objSchema
				})
			})
		}
		var real = []
		Object.keys(result).forEach(function(codeStr){
			real.push(result[codeStr])
		})
		return real
	}
	return getAllSubtypes
}
exports.makeGetAllSubtypes = makeGetAllSubtypes

var analyticsLog = require('quicklog').make('minnow/analytics')

exports.make = function(schema, globalMacros, objectState, viewSequencer){
	//_.assertFunction(broadcaster.output.listenForNew)

	function checkParams(typeCode, params, errCb){
		_.assertFunction(errCb)
		
		var viewSchema = schema._byCode[typeCode]
		var failed = false
		//console.log(JSON.stringify(viewSchema))
		var ps = viewSchema.viewSchema.params
		for(var i=0;i<ps.length;++i){
			var t = ps[i]
			if(t.type.type === 'object'){
				/*if(!objectState.isTopLevelObject(params[i])){
					var e = new Error('parameters include an invalid object id') 
					e.code = 'InvalidParamId'
					errCb(e)
					return false
				}else */if(objectState.isDeleted(params[i])){
					var e = new Error('parameters include a object id for a deleted object') 
					e.code = 'InvalidParamId'
					errCb(e)
					return false
				}/*else{
					//console.log('param is fine: ' + params[i])
				}*/
			}
		}
		return true
	}
	
	//var viewSequencer = newViewSequencer.make(schema, objectState)
	
	var handle = {
		beginView: function(e, seq, readyPacketCb){
			_.assertLength(arguments, 3)
			
			//var viewId = e.typeCode + ':'+e.params
			//console.log('added view: ' + viewId + ' after ' +  e.latestSnapshotVersionId + ' ' + JSON.stringify(e))
			seq.addView(e.viewId, e.latestSnapshotVersionId, readyPacketCb, e.isHistorical)
			
		},
		//TODO: implement halving algorithm
		//TODO: randomize halving points by hash of view id
		getSnapshots: function(typeCode, params, historicalKey, cb){
			var c = objectState.getCurrentEditId()
			var realVersions = [c-1]//would be -1, except we want to keep the *previous* editId open for time-triggered appends
		//	log('GOT SNAPSHOTS: ', realVersions[0])
			//log(new Error().stack)
			cb(undefined, realVersions)
		},
		getAllSnapshotStates: function(typeCode, params, snapshotIds, isHistorical, cb, errCb){

			_.assertFunction(errCb)
			
			var passed = checkParams(typeCode, params, errCb)
			
			if(!passed){
				return
			}

			var list = [];

			var cdl = _.latch(snapshotIds.length, function(){
				cb({snapshots: list});
			});
			_.each(snapshotIds, function(snId, index){
				_.assertInt(snId);
				var prevSnId = index > 0 ? snapshotIds[index-1] : -1;
				if(snId === -1) snId = curEditId-1
				_.assert(snId === -1 || prevSnId <= snId)

				var viewId = newViewSequencer.viewIdStr(typeCode, params,'')//TODO mutatorKey?
				viewSequencer.makeSnapshot(viewId, prevSnId, snId, isHistorical, _.assureOnce(function(snap){
					//console.log('got snap')
					_.assertBuffer(snap)
					list[index] = snap;
					cdl();
				}));
			})
		},
		getSnapshotState: function(typeCode, params, snapshotId, previousSnapshotId, isHistorical, cb, errCb){
			_.assertFunction(errCb)
			
			if(snapshotId === -1) {
				snapshotId = objectState.getCurrentEditId()-1
			}
			
			var passed = checkParams(typeCode, params, errCb)
			
			if(!passed){
				return
			}
			
			var viewId = newViewSequencer.viewIdStr(typeCode, params,'')//TODO mutatorKey?//typeCode+':'+JSON.stringify(params)
			viewSequencer.makeSnapshot(viewId, previousSnapshotId, snapshotId, isHistorical, _.assureOnce(function(snap){
				//console.log('got snap')
				_.assertBuffer(snap)
				cb(snap)
			}));
		}
	}
	return handle;
}
