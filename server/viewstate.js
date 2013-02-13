
var _ = require('underscorem')

var variables = require('./variables')
var viewSequencer = require('./view_sequencer')
var variableView = require('./variables/view')

var Cache = require('./variable_cache')

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

/*function replaceObjectState(s){
	var oldOs = s.objectState
	var os = s.objectState = {}
	Object.keys(oldOs).forEach(function(key){
		os[key] = oldOs[key]
	})
	os.getCurrentEditId = function(){
		_.errout('TODO')
	}
	os.isFork = function(id){
		_.errout('TODO')
		//return ol.isFork(id)
	}
	os.getForked = function(id){
		_.errout('TODO')
		//return ol.getForked(id)
	}
	os.getAllForked = function(id){
		_.errout('TODO')
		//return ol.getAllForked(id)
	}
	os.isDeleted = function(id){
		_.errout('TODO')
		//return ol.isDeleted(id)
	}
	
	os.getSyncIds = function(id, cb){
		_.errout('TODO')
		//ol.getSyncIds(id, cb)
	}
	os.getVersions = function(id, cb){
		_.errout('TODO')
		//ol.getVersions(id, cb)
	}
	os.getLastVersion = function(id, cb){
		_.errout('TODO')
		//ol.getLastVersion(id, cb)
	}
	os.getVersionTimestamp = function(id){
		_.errout('TODO')
		//return ol.getVersionTimestamp(id)
	}
	os.streamPropertyTypes = function(path, editId, cb, continueListening, mustMatch){
		_.errout('TODO')
	}
	os.streamProperty = function(path, editId, cb, continueListening){
		_.errout('TODO')
	}
	os.streamMapProperty = function(path, editId, cb, continueListening){
		_.errout('TODO')
	}
	os.streamObjectState = function(already, id, startEditId, endEditId, cb, endCb){
		_.errout('TODO')
	}
	os.updateObject = function(objId, editId, cb, doneCb){
		_.errout('TODO')
	}
	os.streamObject = function(objId, editId, cb){
		_.errout('TODO')
	}
	os.streamAllPropertyValues = function(objTypeCode, propertyCodes, attachmentEditId, cb, liveCb, destroyedCb){
		_.errout('TODO')
	}
	os.streamAllPropertyValuesForSet = function(objTypeCode, propertyCodes, attachmentEditId, cb, liveCb, destroyedCb){
		_.errout('TODO')
	}
	os.getManyOfType = function(typeCode){
		_.errout('TODO')
	},
	os.getObjects = function(typeCode, ids, cb){
		_.errout('TODO')		
	}
	os.getAllIdsOfType = function(typeCode, cb){
		_.errout('TODO')
	}
	os.getAllObjects = function(typeCode, cb){
		_.errout('TODO')
	}
	
	return os
}*/

exports.make = function(schema, globalMacros, broadcaster, objectState){
	_.assertFunction(broadcaster.output.listenForNew)

	var s = {schema: schema, globalMacros: globalMacros, broadcaster: broadcaster.output, objectState: objectState}
	s.log = log
	_.assertFunction(s.log)
	
	s.analytics = variables.makeAnalytics({name: 'make'},{children:[]})
	s.analytics.cachePut()
	
	s.makeCache = function(){
		return new Cache(s.analytics)
	}
	
	//cache variable makers for each view type	
	var viewGettersByTypeCode = {}

	function scheduleAnalytics(delay){
		setTimeout(function(){
			analyticsLog(s.analytics.report()+'\n'+JSON.stringify(objectState.ol.stats, null, 2))
			analyticsLog(s.analytics.reportResident())
			var newDelay = delay*2
			if(newDelay > 1000*60*30) newDelay = 1000*60*30//maximum analytics logging delay is 30 minutes
			scheduleAnalytics(newDelay)
		},delay)	
	}
	scheduleAnalytics(500)
		
	s.getAllSubtypes = makeGetAllSubtypes(schema)
	
	Object.keys(schema._byCode).forEach(function(typeCodeStr){
		var viewSchema = schema._byCode[typeCodeStr]
		if(viewSchema.isView){
			var bindingsMaker = variables.makeBindingsForViewGetter(s, viewSchema.viewSchema)
			//console.log(JSON.stringify(viewSchema))
			_.assertString(viewSchema.name)
			var synthesizedViewCall = {type: 'view', view: viewSchema.name}
		
			//var variableGetter = variableView.makeTopLevel.bind(undefined, s, variables.variableGetter)//, setExpr)
			var getter = variableView.makeTopLevel(s, variables.variableGetter, synthesizedViewCall)
			
			//var historicalVariableGetter = variableView.makeTopLevel.bind(undefined, )//, setExpr)
			//var historicalS = s//TODO need to adjust this on each call
			var historicalS = {}
			Object.keys(s).forEach(function(key){
				historicalS[key] = s[key]
			})
			historicalS.isHistorical = true
			var historicalGetter = variableView.makeTopLevel(historicalS, variables.variableGetter, synthesizedViewCall)
			
			//unlike normal views, each historical view is created in its own context
			//this is so that caches don't interfere, and most importantly so that we can modify
			//the objectstate to stream all historical edits in sequentially.
			
			//TODO eventually we should support reusing the edit streams of these views and appending to them			
			/*function historicalGetter(paramStr, bindings, curEditId){
				console.log('USED HISTORICAL GETTER')
				var historicalS = {}
				Object.keys(s).forEach(function(key){
					historicalS[key] = s[key]
				})
				historicalS.isHistorical = true
				replaceObjectState(historicalS)
				return variableView.makeTopLevel(historicalS, variables.variableGetter, synthesizedViewCall)(paramStr, bindings, curEditId)
			}*/

			viewGettersByTypeCode[typeCodeStr] = {historicalGetter: historicalGetter, getter: getter, binder: bindingsMaker}
		}
	})
	
	function checkParams(typeCode, params, errCb){
		_.assertFunction(errCb)
		
		var viewSchema = schema._byCode[typeCode]
		var failed = false
		//console.log(JSON.stringify(viewSchema))
		var ps = viewSchema.viewSchema.params
		for(var i=0;i<ps.length;++i){
			var t = ps[i]
			if(t.type.type === 'object'){
				if(!objectState.isTopLevelObject(params[i])){
					var e = new Error('parameters include an invalid object id') 
					e.code = 'InvalidParamId'
					errCb(e)
					return false
				}else if(objectState.isDeleted(params[i])){
					var e = new Error('parameters include a object id for a deleted object') 
					e.code = 'InvalidParamId'
					errCb(e)
					return false
				}else{
					//console.log('param is fine: ' + params[i])
				}
			}
		}
		return true
	}
	
	var handle = {
		beginView: function(e, seq, readyPacketCb){
			_.assertLength(arguments, 3)

			function readyCb(){
				//log('GOT READY PACKET:', readyPacket)
				readyPacketCb()
				//readyPacket = undefined
			}
			//log('params:', e.params)
			_.assertString(e.params)
			var vg = viewGettersByTypeCode[e.typeCode]
			
			var parsedParams = JSON.parse(e.params)//e.params.split(';')
			_.assertArray(parsedParams)
			
			
			var passed = checkParams(e.typeCode, parsedParams, readyPacketCb)
			
			if(!passed){
				return
			}
		
			//log('beginning view after', e.latestSnapshotVersionId)
		
			var bindings = vg.binder(parsedParams, e.latestSnapshotVersionId)
			var viewVariable
			if(e.historicalKey){
				console.log('beginviewhistorical')
				viewVariable = vg.historicalGetter(e.params, bindings, objectState.getCurrentEditId()-1)
			}else{
				viewVariable = vg.getter(e.params, bindings, objectState.getCurrentEditId()-1)
			}
			seq.addView(e.typeCode, viewVariable, e.latestSnapshotVersionId, readyCb)
			
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
		getAllSnapshotStates: function(typeCode, params, snapshotIds, historicalKey, cb, errCb){

			_.assertFunction(errCb)
			
			var passed = checkParams(typeCode, params, errCb)
			
			if(!passed){
				return
			}


			var vg = viewGettersByTypeCode[typeCode]
			var bindings = vg.binder(params, snapshotIds[snapshotIds.length-1])
			var curEditId = objectState.getCurrentEditId()-1
			
			var viewVariable
			if(historicalKey){
				viewVariable = vg.historicalGetter(JSON.stringify(params), bindings, curEditId)
			}else{
				viewVariable = vg.getter(JSON.stringify(params), bindings, curEditId)				
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

				viewSequencer.makeSnapshot(schema, objectState, typeCode, viewVariable, prevSnId, snId, _.assureOnce(function(snap){
					_.assertBuffer(snap)
					list[index] = snap;
					cdl();
				}));
			})
		},
		getSnapshotState: function(typeCode, params, snapshotId, previousSnapshotId, cb, errCb){
			_.assertFunction(errCb)
			
			var vg = viewGettersByTypeCode[typeCode]
			var bindings = vg.binder(params, snapshotId)
			if(snapshotId === -1) {
				snapshotId = objectState.getCurrentEditId()-1
			}
			
			var passed = checkParams(typeCode, params, errCb)
			
			if(!passed){
				return
			}
			
			var viewVariable = vg.getter(JSON.stringify(params), bindings, snapshotId)//TODO is snapshotId the right editId here?
			viewSequencer.makeSnapshot(schema, objectState, typeCode, viewVariable, previousSnapshotId, snapshotId, cb)
		}
	}
	return handle;
}
