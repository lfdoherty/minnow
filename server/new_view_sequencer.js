"use strict";

var _ = require('underscorem')

//var wrap = require('./wrap')
var analytics = require('./analytics')

var snapshotSerialization = require('./snapshot_serialization')
var pathmerger = require('./pathmerger')
var pu = require('./../http/js/paramutil')

var editFp = require('./tcp_shared').editFp
var editCodes = editFp.codes
var editNames = editFp.names

var bw = require("buffered-writer");

var random = require('seedrandom')
var QuerySyncId = random.uid()



var vcModule = require('./viewfacade')


function makePoller(config){

	var fastPollFunctions = []
	var slowerPollFunctions = []
	var slowPollFunctions = []

	var FastPollRate = 10
	var SlowerPollRate = 100
	var SlowPollRate = 1000
	
	if(config.pollrate){
		FastPollRate = config.pollrate.fast||FastPollRate
		SlowerPollRate = config.pollrate.medium||SlowerPollRate
		SlowPollRate = config.pollrate.slow||SlowPollRate
	}

	//console.log(JSON.stringify(config))
	//console.log('fast poll rate: ' + FastPollRate)
	//console.log('slow poll rate: ' + SlowPollRate)

	var lastSlower = 0
	var lastSlow = 0
	var pollHandle = setInterval(function(){

		var now = Date.now()
		if(now - lastSlow > SlowPollRate){
			for(var i=0;i<slowPollFunctions.length;++i){
				var f = slowPollFunctions[i]
				f()
			}
			lastSlow = now = Date.now()
		}

		if(now - lastSlower > SlowerPollRate){
			for(var i=0;i<slowerPollFunctions.length;++i){
				var f = slowerPollFunctions[i]
				var s = Date.now()
				f()
				var elapsed = Date.now() - s
				if(elapsed > 5){
					slowerPollFunctions.splice(i, 1)
					--i
					slowPollFunctions.push(f)
				}
			}
		}

		for(var i=0;i<fastPollFunctions.length;++i){
			var f = fastPollFunctions[i]
			var s = Date.now()
			f()
			var elapsed = Date.now() - s
			if(elapsed > 1){
				fastPollFunctions.splice(i, 1)
				--i
				slowerPollFunctions.push(f)
			}
		}
	}, FastPollRate)

	function addPollFunction(f){
		fastPollFunctions.push(f)
	}
	function removePollFunctionFrom(f, arr){
		var index = arr.indexOf(f)
		if(index !== -1){
			arr.splice(index, 1)
		}
	}
	function removePollFunction(f){
		removePollFunctionFrom(f, fastPollFunctions)
		removePollFunctionFrom(f, slowerPollFunctions)
		removePollFunctionFrom(f, slowPollFunctions)
	}
	return {
		add: addPollFunction,
		remove: removePollFunction
	}
}

function remainer(initial, cb){
	_.assertFunction(cb)
	
	var remaining = initial
	if(initial === 0){
		cb()
		return
	}
	return {
		increase: function(v){
			_.assert(v >= 0)
			if(remaining === 0) _.errout('already done')
			remaining += v
		},
		decrease: function(v){
			_.assert(v >= 0)
			if(remaining === 0) _.errout('already done')
			if(v > remaining) _.errout('decreased by too much: ' + remaining + ' - ' + v)
			remaining -= v
			if(remaining === 0){
				cb()
			}
		}
	}
}

var analyticsLog = require('quicklog').make('analytics')

function makeQueryHandle(syncId, viewCache){
	var qhEditId=-1//this will always get a moveTo current call before the first add call happens anyway
	var alreadyGot = {}
	var gotIds = []
	
	var gotObjectIds = []
	var gotViewObjectIds = []
	
	var addedViewObjects = []
	var addedObjects = []
	
	var lastCache = {}
	
	return {
		got: alreadyGot,
		moveTo: function(editId, blockChangesCb/*changesCb, inclusionsCb, viewInclusionsCb,*/){
			_.assertLength(arguments, 2)
			
			if(gotIds.length === 0 && addedViewObjects.length === 0 && editId === qhEditId){
				//console.log(syncId + ' none: ' +  editId + ' ' + qhEditId)
				blockChangesCb()
			}else{

				
				//console.log(syncId+' adding(' + qhEditId+'->'+editId + '): ' + JSON.stringify([addedObjects, addedViewObjects]))
				//console.log(syncId+' updating: ' + JSON.stringify([gotObjectIds, gotViewObjectIds]))
				//console.log(syncId+' got: ' + JSON.stringify(alreadyGot))
				
				//TODO make added-but-already-got a error condition?
				for(var i=0;i<addedObjects.length;++i){
					var addedId = addedObjects[i]
					if(alreadyGot[addedId]){
						gotObjectIds.push(addedId)
						addedObjects.splice(i, 1)
					}
				}
				for(var i=0;i<addedViewObjects.length;++i){
					var addedId = addedViewObjects[i]
					if(alreadyGot[addedId]){
						gotViewObjectIds.push(addedId)
						addedViewObjects.splice(i, 1)
					}
				}

				//_.errout(JSON.stringify(gotIds))
				var newCache = {}
				
				var diff = viewCache.update(addedObjects, addedViewObjects, gotObjectIds, gotViewObjectIds, qhEditId, alreadyGot, lastCache, newCache)
				
				diff.destinationSyncId = syncId
				
				lastCache = newCache

				//console.log('diff: ' + qhEditId + ' -> ' + editId + ' for ' + syncId + ' ' + JSON.stringify([gotObjectIds,addedObjects]))

				//console.log('result diff: ' + JSON.stringify(diff))
				//console.log(JSON.stringify(diff.addedViewObjects))
				
				diff.addedViewObjects.forEach(function(v){
					_.assertString(v.id)
					//if(gotViewObjectIds.indexOf(v.id) !== -1) _.errout('TODO FIXME: ' + v.id)
					gotViewObjectIds.push(v.id)
				})
				diff.addedObjects.forEach(function(v){
					_.assertString(v.id)
					//if(gotObjectIds.indexOf(v.id) !== -1) _.errout('TODO FIXME: ' + v.id)
					gotObjectIds.push(v.id)
				})
				
				if(diff.edits.length > 0 || diff.addedObjects.length > 0 || diff.addedViewObjects.length > 0){
					/*diff.addedObjects.forEach(function(v){
						_.assertInt(v.id)
						//_.assertArray(v.edits)
						console.log(syncId + ' added object: ' + v.id)
						inclusionsCb(v.id, v.edits)//TODO use snap directly
					})
					diff.addedViewObjects.forEach(function(v){
						_.assertString(v.id)
						_.assertArray(v.edits)
						viewInclusionsCb(v.id, v.edits)//TODO use snap directly
					})					
					changesCb(diff.edits)*/
					blockChangesCb(diff)
				}
				
				addedViewObjects.forEach(function(avo){
					avo.cb()
				})
				addedViewObjects = []
				addedObjects = []
				
				qhEditId = editId
				
				//doneCb()
			}
			
		},
		addObject: function(id){//, cb){
			//_.errout('TODO DO NOT DO THIS')
			//_.errout('TODO: ' + id)
			
			_.assertString(id)
			if(alreadyGot[id]){
				
				//cb()
				return
			}else{
				//console.log('adding object: ' + id)
				//alreadyGot[id] = true
				//gotIds.push(id)
				_.assertString(id)
				addedObjects.push(id)
				//cb()
			}
			//TODO include foreign ids?  might not be checked for later... edits maybe too?
		},
		add: function(id, lastEditId, changesCb, inclusionsCb, doneCb){
		
			//console.log(syncId + ' adding: ' + id + ' at ' + lastEditId)
			
			if(alreadyGot[id]){
				doneCb();
				return;
			}else{
				addedViewObjects.push({id: id, lastEditId: lastEditId, cb: doneCb})
			}
			
			
		}
	}
}

var log = require('quicklog').make('minnow/new_view_sequencer')

var syncView = require('./sync_view')

exports.make = function(schema, ol){

	var baseStaticBindings = {
		makePropertyIndex: ol.propertyIndex.facade.makePropertyIndex,
		makeReversePropertyIndex: ol.propertyIndex.facade.makeReversePropertyIndex
	}
	
	function makeViewRelFunction(viewSchema, rel){
		//_.errout('TODO: ' + JSON.stringify(rel))
		return syncView.makeRelFunction(s, baseStaticBindings, rel)
	}
	
	function makeViewStateFunction(viewSchema){
		var relFuncs = []
		Object.keys(viewSchema.rels).forEach(function(relName){
			var rel = viewSchema.rels[relName]
			relFuncs.push({code: rel.code, func: makeViewRelFunction(viewSchema, rel)})
		})
		function makeViewBindings(parsedViewId){
			var bindings = {}
			_.assertObject(parsedViewId)

			//console.log('making view bindings: ' + JSON.stringify([parsedViewId, viewSchema.params]))
			//_.assertEqual(parsedViewId.rest.length, viewSchema.params.length)
			
			for(var i=0;i<viewSchema.params.length;++i){
				var p = viewSchema.params[i]
				bindings[p.name] = parsedViewId.rest[i]
			}
			return bindings
		}
		return function(parsedViewId){
			var state = {}
			var bindings = makeViewBindings(parsedViewId)
			
			for(var i=0;i<relFuncs.length;++i){
				var rf = relFuncs[i]
				_.assertInt(rf.code)
				state[rf.code] = rf.func(bindings)
			}
			return state
		}
	}

	
	
	//console.log('making new view sequencer...')
	var facade = require('./objectfacade').make(schema, ol)
	var objectState
	
	var afters = []
	var s = {
		facade: facade,
		schema: schema,
		propertyIndex: ol.propertyIndex,
		after: function(cb){
			afters.push(cb)
		}
	}
	
	var viewStateFuncs = {}
	_.each(schema, function(objSchema){
		if(objSchema.isView){
			viewStateFuncs[objSchema.code] = makeViewStateFunction(objSchema.viewSchema)
		}
	})
	
	function getViewState(viewId){
		_.assert(viewId.indexOf('[') !== -1)
		var id = pu.parseViewId(viewId, schema)
		//console.log('parsed viewId: ' + JSON.stringify(id))
		return viewStateFuncs[id.typeCode](id)
		//_.errout('TODO: ' + JSON.stringify(id))
	}
	
	function getSnapshotInner(id, lastEditId, endEditId, readyCb){
	
		var result = {objects: [], viewObjects: []}
		/*var result =*/ viewCache.snap(id, {}, result)

		var objectEditBuffers = [].concat(result.objects)
		var viewObjectEditBuffers = [].concat(result.viewObjects)
		
		
		/*result.forEach(function(r){
			if(_.isString(r.id)){
				viewObjectEditBuffers.push(r)
			}else{
				//_.assertBuffer(r.edits)
				objectEditBuffers.push(r)
			}
		})*/
		
		//console.log(id + ' ' + lastEditId + ' ' + endEditId + ' ' + JSON.stringify(result).slice(0,1000))
		//console.log('snapshot ' + id + ' ' + lastEditId + ' ' + endEditId + ' ' + objectEditBuffers.length, viewObjectEditBuffers.length)
		
		var snap = snapshotSerialization.serializeSnapshot(lastEditId, endEditId, objectEditBuffers, viewObjectEditBuffers)
		readyCb(snap)

		return
		
	}
	
	var viewCache
		

	var handle = {
		initialize: function(objs, config){
			objectState = objs
			s.objectState = objs
			
			s.poller = makePoller(config)

			console.log('initialized new_view_sequencer')
			//_.errout('here')
			
			afters.forEach(function(cb){
				cb()
			})
			afters = undefined
			
			var queryHandle = {
				get: function(viewId){
					return getViewState(viewId)
				}
			}
			viewCache = vcModule.make(schema, objectState, queryHandle)
		},
		makeStream: function(blockChangesCb, /*includeObjectCb, editCb, sendViewObjectCb, */syncId){
			_.assertLength(arguments, 2)
		
			//console.log('making stream')
	
			var queryHandle = makeQueryHandle(syncId, viewCache)

			var lastEditId = -1
			var paused = false
			
			var addViewTasks = []
			var addObjectTasks = []
			var addUpdateTasks = []
			
			function maintain(endEditId){
				_.assertInt(endEditId)
				
				if(addObjectTasks.length > 0){
					//console.log('processing add object tasks: ' + addObjectTasks.length)
					var copy = [].concat(addObjectTasks)
					addObjectTasks = []
					
					copy.forEach(function(task){
						queryHandle.addObject(task)
					})
					maintain(endEditId)
				}else if(addViewTasks.length > 0){
					//console.log('processing view tasks: ' + addViewTasks.length)
					var copy = [].concat(addViewTasks)
					addViewTasks = []
					
					copy.forEach(function(task){
						addView(task.id, task.lastEditId, endEditId, task.cb)
					})
					maintain(endEditId)
				}else{
					//console.log('done polling ' + endEditId)
					lastEditId = endEditId
					paused = false
				}
			}
			
			function poll(){
				if(paused){
					console.log('already in polling')//: ' + JSON.stringify(queryHandle.got))
					return
				}
				paused = true
				
				//console.log('polling...')
				
				var endEditId = objectState.getCurrentEditId()-1
				
				
				var edits = []
				//console.log('moving to: ' + endEditId + ' from ' + lastEditId)
				var start = Date.now()
				
				queryHandle.moveTo(endEditId, function(diff){
					if(diff){
						diff.endEditId = endEditId
						//_.errout('TODO')
						blockChangesCb(diff)
					}
					
	
					//console.log('poll took: ' + (Date.now()-start))
				})
				/*
				queryHandle.moveTo(endEditId, function(changes){
					//console.log('moving')
					edits = edits.concat(changes)
	
					console.log('poll took: ' + (Date.now()-start))
					
					//console.log('moving changes: ' + JSON.stringify(changes))
				},
				function(id, snap){
					//console.log('moving adds: ' + id)
					//console.log('edits: ' + JSON.stringify(snap))
					_.assertDefined(snap)
					includeObjectCb(id, snap)
				},function(id, snap){
					//console.log('moving adds: ' + id)
					//console.log('edits: ' + JSON.stringify(snap))
					_.assertDefined(snap)
					sendViewObjectCb(id, snap)
				}, function(){
					
					edits.forEach(function(e){
						editCb(e)
					})
					//rem.decrease(1)
				})*/
				
				finish()

				function finish(){
					//console.log('finishing poll')

					if(addUpdateTasks.length > 0){
						//console.log('calling update: ' + endEditId)
						var temp = addUpdateTasks
						addUpdateTasks = []
						temp.forEach(function(cb){
							cb()
						})
					}

					maintain(endEditId)
					
				}
			}

			s.poller.add(poll)
			
			function addView(id, lastEditId, endEditId, readyCb, isHistorical){

				if(isHistorical) _.errout('TODO')
				
				var rem = remainer(1, finish)

				var edits = []
				var snapshots = []
				
				console.log('adding view ' + id + ' ' + lastEditId + ' ' + endEditId)
				
				queryHandle.add(id, lastEditId, function(changedId, changes){
					//console.log('appending edits: ' + JSON.stringify(changes))
					edits = edits.concat(changes)
				}, function inclusion(includedId){
					//console.log('including: ' + includedId)
					if(!_.isString(includedId)){
						//_.errout('TODO')
//						includeObjectCb(id,function(){})//TODO is this right?
						snapshots.push([includedId])
					}
					rem.increase(1)
					getObjectEditsBetween(includedId, -1, endEditId, function(snap){
						//console.log('adding view included object: ' + JSON.stringify(snap))
						snapshots.push([includedId,snap])
						rem.decrease(1)
					})
				}, function(){
					rem.decrease(1)
					//console.log('finished qh add')
				})
				
				function finish(){
					//console.log('finishing add view: ' + id + ' ' + JSON.stringify(snapshots))
					
					edits.sort(function(a,b){
						return a.editId - b.editId
					})
					
					//send snapshots, then edits
					
					snapshots.forEach(function(snap){
						var id = snap[0]
						snap = snap[1]
						if(_.isString(id)){
							_.assertObject(snap)

							var resultEdits = computeStateEditsForViewObject(id, snap)

							sendViewObjectCb(id, resultEdits)
						}else{
							includeObjectCb(id,function(){})
						}
					})
					
					edits.forEach(function(e){
						editCb(e)
					})
					
					readyCb()	
				}
			}
			
			var hasViews = false
			
			var handle = {
				end: function(){
					//console.log('ended new view sequencer')
					//clearInterval(analyticsLogIntervalHandle)
					//clearInterval(pollHandle)
					s.poller.remove(poll)
					
					//analyticsLog.close()
					//_.errout('TODO')
				},
				subscribeToObject: function(id){
					//_.errout('TODO push subscribe task, etc')					
					_.assertString(id)
					addObjectTasks.push(id)
				},
				afterNextUpdate: function(cb){
					addUpdateTasks.push(cb)
				},
				//changes before lastEditId will already be known to the client
				addView: function(id, lastEditId, readyCb){
					//console.log('adding view task: ' + id + ' ' + lastEditId + ' ' + new Error().stack)
					addViewTasks.push({id: id, lastEditId: lastEditId, cb: readyCb})
					if(!hasViews){
						poll()
					}
					hasViews = true
				}
			}
			
			return handle
		},
		/*
			- entire state of up endEditId of objects added during the snapshot edit range
			- changes between lastEditId and endEditId for objects already present before lastEditId
		*/
		makeSnapshot: function(id, lastEditId, endEditId, isHistorical, readyCb){
			getSnapshotInner(id, lastEditId, endEditId, readyCb)
		}
	}
	
	return handle
}


function computeStateEditsForViewObject(id, edits){
	var oldState = {top: id}
	var resultEdits = []
	edits.forEach(function(e){
		//if(e.op === editCodes.putLong) _.assertInt(e.state.property)
		pathmerger.editToMatch(oldState, e.state, function(op, edit){
			resultEdits.push({op: op, edit: edit, editId: e.editId, syncId: QuerySyncId})
		})
		resultEdits.push(e)
		oldState = e.state
	})
	return resultEdits
}



