
var _ = require('underscorem')

var variables = require('./variables')
var viewSequencer = require('./view_sequencer')
var variableView = require('./variables/view')


var log = require('quicklog').make('minnow/viewstate')

function makeGetAllSubtypes(schema){
	function getAllSubtypes(typeCode){
		var objSchema = schema._byCode[typeCode]
		var result = {}
		result[objSchema.code] = objSchema
		Object.keys(objSchema.subTypes).forEach(function(stName){
			var subs = getAllSubtypes(schema[stName].code)
			subs.forEach(function(objSchema){
				result[objSchema.code] = objSchema
			})
		})
		var real = []
		Object.keys(result).forEach(function(codeStr){
			real.push(result[codeStr])
		})
		return real
	}
	return getAllSubtypes
}
exports.makeGetAllSubtypes = makeGetAllSubtypes
	
exports.make = function(schema, globalMacros, broadcaster, objectState){
	//var variableGetter = variables.makeGetter(schema, objectState, broadcaster)
	_.assertFunction(broadcaster.output.listenForNew)
	
	var selfGetter = variables.makeGetter(schema, globalMacros, objectState, broadcaster.output, log)//variableGetter.bind(undefined, s)

	//cache variable makers for each view type	
	var viewGettersByTypeCode = {}
	var s = {schema: schema, globalMacros: globalMacros, broadcaster: broadcaster.output, objectState: objectState}
	s.log = log
	_.assertFunction(s.log)
	
	s.getAllSubtypes = makeGetAllSubtypes(schema)
	
	var variableGetter = variableView.makeTopLevel.bind(undefined, s, selfGetter)//, setExpr)
	Object.keys(schema._byCode).forEach(function(typeCodeStr){
		var viewSchema = schema._byCode[typeCodeStr]
		if(viewSchema.isView){
			var bindingsMaker = variables.makeBindingsForViewGetter(s, viewSchema.viewSchema)
			//console.log(JSON.stringify(viewSchema))
			_.assertString(viewSchema.name)
			var synthesizedViewCall = {type: 'view', view: viewSchema.name}
			viewGettersByTypeCode[typeCodeStr] = {getter: variableGetter(synthesizedViewCall), binder: bindingsMaker}
		}
	})
	
	var handle = {
		beginView: function(e, seq, listenerCb, readyPacketCb){
			function includeObjectCb(id, editId){
				_.assertInt(editId)
				//leave it up to the sync handle to deduplicate and retrieve that state
				listenerCb({op: 'includeObject', id: id, editId: editId})
			}
			var readyPacket = []
			function editCb(e){
				if(readyPacket === undefined){
					listenerCb(e)
				}else{
					readyPacket.push[e]
				}
			}

			//console.log('BEGINNING VIEW:' + JSON.stringify(e))
			
			function readyCb(){
				log('GOT READY PACKET:' + JSON.stringify(readyPacket))
				readyPacketCb(readyPacket)
				readyPacket = undefined
			}
			log('params: ' + e.params)
			_.assertString(e.params)
			var vg = viewGettersByTypeCode[e.typeCode]
			
			var parsedParams = JSON.parse(e.params)//e.params.split(';')
			_.assertArray(parsedParams)
			
			log('beginning view after ' + e.latestSnapshotVersionId)
			
			var bindings = vg.binder(parsedParams, e.latestSnapshotVersionId)
			var viewVariable = vg.getter(e.params, bindings, objectState.getCurrentEditId()-1)
			seq.addView(e.typeCode, viewVariable, e.latestSnapshotVersionId, readyCb)
			
			return {
				end: function(){
					//_.errout('TODO')
					seq.end()
				}
			}
		},
		//TODO: implement halving algorithm
		//TODO: randomize halving points by hash of view id
		getSnapshots: function(typeCode, params, cb){
			var c = objectState.getCurrentEditId()
			var realVersions = [c-1]//would be -1, except we want to keep the *previous* editId open for time-triggered appends
			log('GOT SNAPSHOTS: ' + realVersions[0])
			//log(new Error().stack)
			cb(realVersions)
		},
		getAllSnapshotStates: function(typeCode, params, snapshotIds, cb){
			var vg = viewGettersByTypeCode[typeCode]
			var bindings = vg.binder(params, snapshotIds[snapshotIds.length-1])
			var curEditId = objectState.getCurrentEditId()-1
			log('curEditId: ' + curEditId)
			var viewVariable = vg.getter(JSON.stringify(params), bindings, curEditId)

			var list = [];
			log('GETTING SNAPSHOT STATES: ' + JSON.stringify(snapshotIds))
			var cdl = _.latch(snapshotIds.length, function(){
				log('GOT ALL SNAPSHOT STATES')
				cb({snapshots: list});
			});
			_.each(snapshotIds, function(snId, index){
				_.assertInt(snId);
				var prevSnId = index > 0 ? snapshotIds[index-1] : -1;
				if(snId === -1) snId = curEditId-1//would be -1, except we want to keep the *previous* editId open for time-triggered appends
				//console.log(prevSnId + ' ' + snId)
				_.assert(snId === -1 || prevSnId <= snId)
				//handle.getSnapshotState(typeCode, params, snId, prevSnId, function(snap){
				viewSequencer.makeSnapshot(schema, objectState, typeCode, viewVariable, prevSnId, snId, _.assureOnce(function(snap){
					log('GOT A SNAP')
					_.assertBuffer(snap)
					list[index] = snap;
					cdl();
				}));
			})
			//viewSequencer.makeSnapshot(typeCode, viewVariable, previousSnapshotId, snapshotId, cb)
			
		},
		getSnapshotState: function(typeCode, params, snapshotId, previousSnapshotId, cb){
			var vg = viewGettersByTypeCode[typeCode]
			var bindings = vg.binder(params, snapshotId)
			if(snapshotId === -1) {
				snapshotId = objectState.getCurrentEditId()-1
			}
			var viewVariable = vg.getter(JSON.stringify(params), bindings, snapshotId)//TODO is snapshotId the right editId here?
			viewSequencer.makeSnapshot(schema, objectState, typeCode, viewVariable, previousSnapshotId, snapshotId, cb)
		}
	}
	return handle;
}
