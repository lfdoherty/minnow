"use strict";

var _ = require('underscorem');

var versions = require('./versions');

var set = require('structures').set;

//var pathupdater = require('./pathupdater')

var pathmerger = require('./pathmerger')
var pathsplicer = require('./pathsplicer')

function couldHaveForeignKey(objSchema){
	return _.any(objSchema.properties, function(p){
		if(p.type.type === 'object') return true;
		if(p.type.type === 'list' || p.type.type === 'set'){
			_.assert(p.type.members.type === 'primitive' || p.type.members.type === 'object');
			return p.type.members.type === 'object';
		}
	});
}

var log = require('quicklog').make('minnow/objectstate')

function makeSelectByMultiplePropertyConstraints(indexing, handle){

	return function(typeCode, descentPaths, filterFunctions, cb){
		var start = Date.now();
	
		var matchedList = [];
		var failed = false;
	
		var cdl = _.latch(descentPaths.length, finish);

		_.times(descentPaths.length, function(k){
			var descentPath = descentPaths[k];
			var filterFunction = filterFunctions[k];
			indexing.selectByPropertyConstraint(typeCode, descentPath, filterFunction, function(m){
				if(m === undefined) failed = true
				matchedList[k] = m;
				cdl();
			});
		})
	
		function finish(){
			if(!failed){
				cb(matchedList);
			}else{
				log('going slow, failed');
				handle.getAllObjects(typeCode, function(objs){
		
					var matchedList = [];
					for(var k=0; k<descentPaths.length;++k){
						var descentPath = descentPaths[k];
						var filterFunction = filterFunctions[k];
						var matched = set.make()
						_.each(objs, function(obj){
							//TODO use a more complete descent method that can descend along FKs to top-level objects
							var v = objutil.descendObject(schema, typeCode, obj, descentPath);
							if(filterFunction(v)){
								matched.add(obj.meta.id);
							}
						});
						matchedList.push(matched);
						log('slow result ' + k + ': ' + matched.size() + ' - ' + typeCode + ' ' + JSON.stringify(descentPath));
					}
						
					cb(matchedList);
				});
			}
		}
	}
}

function errorStub(){_.errout('this should never be called');}

function makePathTracker(path){
	
	_.assert(path.length > 0)
	
	//console.log('\n\nhere: ' + JSON.stringify(path))
	
	var matchingDepth = 0
	var depth = 0
	
	return function(e){
		var op = e.op
		//console.log(depth + ' ' + JSON.stringify(e))
		if(op === 'selectProperty'){
			if(matchingDepth === depth && path.length > depth){
				if(e.edit.typeCode === path[depth].edit.typeCode){
					++matchingDepth
				}
			}
			++depth
		}else if(op.indexOf('Key') !== -1){
			if(op.indexOf('select') === 0){
				++depth
			}else{
				//reselect, no depth change
			}
		}else if(op === 'reselectProperty'){
			if(matchingDepth >= depth-1){
				log('reselecting: ' + JSON.stringify(path) + ' ' + e.edit.typeCode + ' ' + depth)
				if(path[depth-1].edit.typeCode === e.edit.typeCode){
					matchingDepth = depth
				}else{
					matchingDepth = depth-1
				}
			}
		}else if(op === 'selectObject' || op === 'made'){
			//console.log('dd: ' + matchingDepth + ' ' + depth + ' ' + JSON.stringify(path))
			if(matchingDepth === depth && path.length > depth && path[depth].op === 'selectObject' && path[depth].edit.id === e.edit.id){
				++matchingDepth
			}
			++depth
		}else if(op === 'reselectObject'){
			if(matchingDepth >= depth-1){
				if(path[depth-1].edit.id === e.edit.id){
					matchingDepth = depth
				}else{
					matchingDepth = depth-1
				}
			}
		}else if(op === 'ascend1'){
			depth -= 1
		}else if(op === 'ascend2'){
			depth -= 2
		}else if(op === 'ascend3'){
			depth -= 3
		}else if(op === 'ascend4'){
			depth -= 4
		}else if(op === 'ascend5'){
			depth -= 5
		}else if(op === 'ascend'){
			depth -= e.edit.many
		}
		
		_.assert(depth >= 0)
		
		if(matchingDepth > depth) matchingDepth = depth
		log(matchingDepth + ' -(' + depth + ')- ' + path.length)
		log(JSON.stringify(e))
		return depth === matchingDepth && matchingDepth === path.length
	}
}

function differentPathEdits(a, b){
	if(a.op !== b.op || JSON.stringify(a.edit) !== JSON.stringify(b.edit)) return true
}

function differentPaths(a,b){
	if(a.length !== b.length) return true
	for(var i=0;i<a.length;++i){
		var av = a[i];
		var bv = b[i]
		if(differentPathEdits(av,bv)) return true
	}
}

//note that the path must not descend into a top-level object for this function
function makePropertyStream(broadcaster, path, edits, editId, cb, continueListening){

	//if(path.length !== 2) _.errout('TODO: ' + JSON.stringify(path))	

	var objId = path[0].edit.id
	var propertyCode = path[1].edit.typeCode

	var prop;

	log('streamProperty got ' + edits.length + ' edits')
	//console.log('streamProperty got ' + edits.length + ' edits')
		
	var tracker = makePathTracker(path)
	
	//console.log(JSON.stringify(edits))
	
	edits.forEach(function(e){
		
		var op = e.op
		var matching = tracker(e)

		log(matching + ' ' + JSON.stringify(path) + ' <- ' + JSON.stringify(e))

		if(!matching) return
		
		if(op.indexOf('set') === 0){
			if(op === 'setString' || op === 'setLong' || op === 'setBoolean' || op === 'setInt'){
				if(e.edit.value !== prop){
					prop = e.edit.value
				}
			}else if(op === 'setExisting' || op === 'setObject'){
				if(e.edit.id !== prop){
					prop = e.edit.id
				}
			}else if(op === 'setSyncId'){
			}else{
				_.errout('TODO: ' + op)
			}
		}else if(op.indexOf('add') === 0){
			if(prop === undefined) prop = []
			if(op === 'addString' || op === 'addLong' || op === 'addInt'){
				if(prop.indexOf(e.edit.value) === -1){
					prop.push(e.edit.value)
				}
			}else if(op === 'addExisting' || op === 'addedNew'){
				if(prop.indexOf(e.edit.id) === -1){
					prop.push(e.edit.id)
				}
			}else{
				_.errout('TODO: ' + JSON.stringify(e))
			}
		}else if(op.indexOf('remove') === 0){
			if(op === 'remove'){
				var i = prop.indexOf(e.edit.id)
				if(i !== -1){
					console.log('removing object from property')
					prop.splice(i, 1)
				}else{
					log('warning: removed object not in set: ' + e.edit.id)
				}							
			}else if(op === 'removeString' || op === 'removeInt' || op === 'removeLong' || op === 'removeBoolean'){
				var i = prop.indexOf(e.edit.value)
				if(i !== -1){
					prop.splice(i, 1)
				}else{
					_.errout('TODO: ' + JSON.stringify([op, edit]))
				}
			}else{
				_.errout('TODO: ' + op)
			}
		}
	})
	log('streaming ' + JSON.stringify(path) + ': ' + JSON.stringify(prop))
	cb(prop, editId)
	
	broadcaster.output.listenByObject(objId, function(subjTypeCode, subjId, typeCode, id, editPath, op, edit, syncId, editId){
		//if(path.length > 1) return
		var fullPath = [{op:'selectObject', edit: {id: id}}].concat(editPath)//[id].concat(path)
		
		var matched = false

		if(differentPaths(fullPath, path)){
			log('edit does not match: ' + JSON.stringify(fullPath) + ' ' + JSON.stringify(path) + ' ' + JSON.stringify([op, edit]))
			return//id ===objId && path.length === 1 && path[0] === propertyCode){
		}
		
		log('broadcaster provided edit matching property filter: ' + JSON.stringify(path) + ' : ' + JSON.stringify(fullPath))
		log(op + ' ' + JSON.stringify(edit))
	
		if(op.indexOf('set') === 0){
			if(op === 'setString' || op === 'setLong' || op === 'setBoolean' || op === 'setInt'){
				if(edit.value !== prop){
					prop = edit.value
					cb(prop, editId)
				}
			}else if(op === 'setObject'){
				if(edit.id !== prop){
					prop = edit.id
					cb(prop, editId)
				}
			}else{
				_.errout('TODO: ' + op)
			}
		}else if(op === 'wasSetToNew'){
			//_.errout('TODO')
			if(edit.id !== prop){
				prop = edit.id
				cb(prop, editId)
			}
		}else if(op.indexOf('add') === 0){
			//_.errout('TODO: ' + op)
			if(op === 'addString' || op === 'addInt' || op === 'addLong' || op === 'addBoolean'){
				if(prop === undefined) prop = []
				if(prop.indexOf(edit.value) === -1){
					prop.push(edit.value)
					cb(prop, editId)
				}
			}else if(op === 'addExisting' || op === 'addedNew'){
				if(prop === undefined) prop = []
				if(prop.indexOf(edit.id) === -1){
					prop.push(edit.id)
					cb(prop, editId)
				}
			}else{
				_.errout('TODO: ' + op)
			}
		}else if(op.indexOf('remove') === 0){
			if(op === 'remove'){
				var i = prop.indexOf(edit.id)
				if(i !== -1){
					//console.log('removing object from property')
					prop.splice(i, 1)
					cb(prop, editId)
				}else{
					_.errout('TODO: ' + JSON.stringify([op, edit]))
				}
			}else if(op === 'removeString' || op === 'removeInt' || op === 'removeLong' || op === 'removeBoolean'){
				var i = prop.indexOf(edit.value)
				if(i !== -1){
					prop.splice(i, 1)
					cb(prop, editId)
				}else{
					_.errout('TODO: ' + JSON.stringify([op, edit]))
				}
			}else{
				_.errout('TODO: ' + op)
			}
		}
	})
}

function makePropertyTypesStream(ol, broadcaster, path, edits, editId, cb, continueListening){

	//if(path.length !== 2) _.errout('TODO: ' + JSON.stringify(path))	
	_.assertEqual(path[0].op, 'selectObject')
	var objId = path[0].edit.id
	_.assertInt(objId)

	var prop = {}

	log('streamPropertyTypes got ' + edits.length + ' edits')
	//console.log('streamPropertyTypes got ' + edits.length + ' edits')
	//console.log(JSON.stringify(edits))
	
	var tracker = makePathTracker(path)
	
	edits.forEach(function(e){
		
		var op = e.op
		var matching = tracker(e)

		log(matching + ' ' + JSON.stringify(path) + ' <- ' + JSON.stringify(e))
		//console.log(matching + ' ' + JSON.stringify(path) + ' <- ' + JSON.stringify(e))

		if(!matching) return
		
		if(op.indexOf('set') === 0){
			if(op === 'setExisting' || op === 'setObject'){
				if(e.edit.id !== prop){
					prop = e.edit.id
				}
			}else if(op === 'setSyncId'){
			}else{
				_.errout('TODO: ' + op)
			}
		}else if(op.indexOf('add') === 0){
			if(op === 'addExisting'){
				prop[e.edit.id] = ol.getObjectType(e.edit.id)
			}else if(op === 'addedNew'){
				prop[e.edit.id] = e.edit.typeCode
			}else{
				_.errout('TODO: ' + JSON.stringify(e))
			}
		}else if(op.indexOf('remove') === 0){
			//TODO deal with
			
		}
	})
	log('streaming types ' + JSON.stringify(path) + ': ' + JSON.stringify(prop))
	function getType(id){
		var typeCode = prop[id]
		if(typeCode === undefined) _.errout('requested type code of unknown id: ' + id + ', only got: ' + JSON.stringify(Object.keys(prop)))
		return typeCode
	}
	cb(getType, editId)
	
	broadcaster.output.listenByObject(objId, function(subjTypeCode, subjId, typeCode, id, editPath, op, edit, syncId, editId){
		//if(path.length > 1) return
		var fullPath = [{op: 'selectObject', edit: {id: id}}].concat(editPath)//[id].concat(path)
		
		var matched = false

		if(differentPaths(fullPath, path)){
			log('edit does not match: ' + JSON.stringify(fullPath) + ' ' + JSON.stringify(path))
			return//id ===objId && path.length === 1 && path[0] === propertyCode){
		}
		
		console.log(JSON.stringify(path) + ' <- ' + JSON.stringify(fullPath))
		
		log('broadcaster provided edit matching property filter: ' + JSON.stringify(path) + ' : ' + JSON.stringify(fullPath))
		log(op + ' ' + JSON.stringify(edit))
	
		if(op.indexOf('set') === 0){
			if(op === 'setObject'){
				if(prop[edit.id] === undefined){
					prop[edit.id] = ol.getObjectType(edit.id)
					cb(getType, editId)
				}
			}else{
				_.errout('TODO: ' + op)
			}
		}else if(op === 'wasSetToNew'){
			if(prop[edit.id] === undefined){
				prop[edit.id] = edit.typeCode
				cb(prop, editId)
			}
		}else if(op.indexOf('add') === 0){
			if(op === 'addExisting'){
			}else if(op === 'addedNew'){
				prop[edit.id] = edit.typeCode
				cb(getType, editId)
			}else{
				_.errout('TODO: ' + op)
			}
		}else if(op.indexOf('remove') === 0){
			//TODO
			/*if(op === 'remove'){
				var i = prop.indexOf(edit.id)
				if(i !== -1){
					//console.log('removing object from property')
					prop.splice(i, 1)
					cb(getType, editId)
				}else{
					_.errout('TODO: ' + JSON.stringify([op, edit]))
				}
			}else if(op === 'removeString' || op === 'removeInt' || op === 'removeLong' || op === 'removeBoolean'){
				var i = prop.indexOf(edit.value)
				if(i !== -1){
					prop.splice(i, 1)
					cb(getType, editId)
				}else{
					_.errout('TODO: ' + JSON.stringify([op, edit]))
				}
			}else{
				_.errout('TODO: ' + op)
			}*/
		}
	})
}

exports.make = function(schema, ap, broadcaster, ol){
	_.assertLength(arguments, 4);
	
	var includeFunctions = {};
	
	function emptyIncludeFunction(id, obj, addObjectCb, endCb){endCb();}

	var indexing;
	
	var pm = pathmerger.make(schema, ol, ap.saveEdit, ap.persistEdit, ap.forgetTemporary, function(id, syncId){
		_.assert(id < -1)
		return ap.translateTemporaryId(id, syncId)
	})//,function(typeCode, id, path, op, edit, syncId, editId){
		//var editId = e.editId
		//_.assertInt(editId)
		/*var subs = subscriptions[id]
		//console.log('ooking for subs: ' + id + ' ' + JSON.stringify(Object.keys(subscriptions)))
		if(subs){
			//subs.forEach(function(s){
			for(var i=0;i<subs.length;++i){
				var s = subs[i]
				log('sending to subscription')
				//s(typeCode, id, path, op, edit, syncId, editId)
				s({typeCode: typeCode, id: id, op: op, edit: edit, syncId: syncId, editId: editId})
			}
		}*/
		//cb(e)				
	//})
	/*
	function makeFullIncludeFunction(objSchema){
		var funcs = {};
		_.each(objSchema.properties, function(p){
			if(p.type.type === 'object'){
				var os = schema[p.type.object];
				funcs[p.code] = function(entry, addObjectCb, endCb){
					if(_.isInteger(entry[1])){
						//console.log('including ' + JSON.stringify(entry))
						handle.streamObjectState(entry[0], entry[1], function(tc, id, obj){
							//_.assertDefined(obj)
							if(obj === undefined){
								_.errout('got undefined object: ' + tc + ' ' + id);
							}
							addObjectCb(tc,id,obj);
						}, function(){
							endCb();
						});
						return 1;
					}
					return 0;
				}
			}else if(p.type.type === 'list'){
				var os = schema[p.type.members.object];
				funcs[p.code] = function(list, addObjectCb, endCb){
					var manyFound = 0;
					_.each(list, function(listEntry){
						//_.assertArray(listEntry);
						_.assertInt(listEntry);
						if(_.isInteger(listEntry)){
							handle.streamObjectState(listEntry, addObjectCb, endCb);
							++manyFound;
						}
					});
					return manyFound;
				}
			}else if(p.type.type === 'set'){
				var os = schema[p.type.members.object];
				funcs[p.code] = function(map, addObjectCb, endCb){
					var manyFound = 0;
					_.each(map, function(list, typeCodeStr){
						var typeCode = parseInt(typeCodeStr);
						_.each(list, function(v){
							if(_.isInteger(v)){
								handle.streamObjectState(typeCode, v, addObjectCb, endCb);
								++manyFound;
							}
						});
					});
					return manyFound;
				}
			}else if(p.type.type === 'map'){
				if(p.type.key.type === 'primitive' && p.type.value.type === 'primitive'){
				}else if(p.type.key.type === 'primitive'){
					var os = schema[p.type.value.object];
					funcs[p.code] = function(map, addObjectCb, endCb){
						var manyFound = 0;

						_.errout('TODO')
					}
				}else{
					_.errout('TODO: ' + JSON.stringify(p));
				}
			}else{
				if(p.type.type !== 'primitive') _.errout('TODO: ' + JSON.stringify(p));
			}
		});
		var propertyCodes = [];
		_.each(objSchema.properties, function(p, pName){
			propertyCodes.push(p.code);
		});
		return function(id, obj, addObjectCb, endCb){				
			_.assertDefined(obj.meta);
			var remainingCount = 0;
			var finished = false;

			for(var i=0;i<propertyCodes.length;++i){
				var propertyCode = propertyCodes[i];
				var v = obj[propertyCode];
				if(v !== undefined){
					var f = funcs[propertyCode];
					if(f !== undefined){
						var manyToWait = f(v, addObjectCb, function(){
							--remainingCount;
							if(finished && remainingCount === 0){
								endCb();
								endCb = undefined;
							}
						});
						remainingCount += manyToWait;
					}
				}
			}
			finished = true;
			if(remainingCount === 0){
				endCb();
				endCb = undefined;
			}
		}
	}*/
	
	/*_.each(schema, function(objSchema){
		includeFunctions[objSchema.code] = emptyIncludeFunction;
		if(!objSchema.isView && couldHaveForeignKey(objSchema)){
			includeFunctions[objSchema.code] = makeFullIncludeFunction(objSchema);
		}
	});*/
	
	function computeRealPath(path){
		var realPath = path			
		var index = path.length-2
		while(index > 0){
			var id = path[index].edit.id
			if(ol.isTopLevelObject(id)){
				realPath = path.slice(index)
				break;
			}
			index -= 2
		}
		return realPath
	}
	//var subscriptions = {}
	
	var handle = {
		getCurrentEditId: function(){
			return ol.getLatestVersionId()
		},
		/*setIndexing: _.once(function(i){
			_.assertUndefined(indexing);
			indexing = i;
			handle.selectByMultiplePropertyConstraints = makeSelectByMultiplePropertyConstraints(indexing, handle);
		}),*/
		forgetTemporary: function(temporary, syncId){
			//pm(-1000, undefined, 'forgetTemporary', undefined, syncId)
			var real = ap.translateTemporaryId(temporary, syncId)
			pm.forgetTemporary(real, temporary, syncId)
		},
		addEdit: function(id, op, path, edit, syncId, computeTemporary){
			//_.assertLength(arguments, 7);
			if(op !== 'make' && op !== 'forgetTemporary') _.assertInt(id);
			_.assertInt(syncId);
			_.assertString(op)
			//TODO support merge models
			
			if(op === 'make'){
				return ap.persistEdit(-1, -1, [], op, edit, syncId, computeTemporary)
			}else{
				_.assert(id < -1 || id > 0)
				
				if(id < -1){
					id = ap.translateTemporaryId(id, syncId)
				}
				_.assert(id > 0)
				pm(id, path, op, edit, syncId, computeTemporary)
			}
		},
		translateTemporaryId: function(id, syncId){
			_.assertInt(id)
			_.assertInt(syncId)
			_.assert(id < 0)
			_.assert(syncId >= 0)
			return ap.translateTemporaryId(id, syncId)
		},
		syntheticEditId: function(){
			return ap.syntheticEditId()
		},
		
		streamPropertyTypes: function(path, editId, cb, continueListening){
			_.assert(arguments.length >= 3)
			_.assert(arguments.length <= 4)
			_.assertArray(path)
			_.assertInt(editId)
			_.assertFunction(cb)

			_.assert(path.length >= 2)
			
			_.assertEqual(path[0].op, 'selectObject')

			var realPath = computeRealPath(path)
			
			var objId = realPath[0].edit.id

			ol.get(objId, -1, editId, function(edits){
				makePropertyTypesStream(ol, broadcaster, realPath, edits, editId, cb, continueListening)
			})
		},
	
		//TODO add specialize methods for streaming collection properties vs single-value properties?
		streamProperty: function(path, editId, cb, continueListening){
			_.assert(arguments.length >= 3)
			_.assert(arguments.length <= 4)
			_.assertArray(path)
			_.assertInt(editId)
			_.assertFunction(cb)

			_.assert(path.length >= 2)

			var realPath = computeRealPath(path)
			
			_.assertEqual(realPath[0].op, 'selectObject')
			
			var objId = realPath[0].edit.id
			//console.log(JSON.stringify(path))
			_.assertInt(objId)

			ol.get(objId, -1, editId, function(edits){
				makePropertyStream(broadcaster, realPath, edits, editId, cb, continueListening)
			})
		},

		streamObjectState: function(already, id, startEditId, endEditId, cb, endCb){
			_.assertLength(arguments, 6)
			_.assertInt(startEditId)
			_.assertInt(endEditId)
			_.assertObject(already)
			_.assert(id > 0)

			ol.streamVersion(already, id, startEditId, endEditId, cb, endCb)
		},

		updateObject: function(objId, editId, cb, doneCb){
			ol.get(objId, -1, -1, function(res){
				var pu = pathsplicer.make()
				var typeCode = ol.getObjectType(objId)
				res.forEach(function(e){
					var ignorable = pu.update(e)
					if(!ignorable && e.editId >= editId){
						cb(typeCode, objId, typeCode, objId, pu.getPath(), e.op, e.edit, pu.getSyncId(), e.editId)
					}
				})
				doneCb(objId)
			})
		},
		streamObject: function(objId, editId, cb){

			handle.updateObject(objId, editId, cb, function(){
				broadcaster.output.listenByObject(objId, cb)
			})
		},
		
		/*subscribeToObject: function(id, listenerCb){
			handle.streamObject(id, ol.getLatestVersionId(), listenerCb)
		},	*/	
		/*includeContainedObjects: function(typeCode, id, obj, addObjectCb, endCb){
			includeFunctions[typeCode](id, obj, addObjectCb, endCb);
		},*/
		
		streamAllPropertyValues: function(objTypeCode, propertyCodes, cb, liveCb){

			var outstandingEditIds = []

			var isPc = {}
			for(var i=0;i<propertyCodes.length;++i){
				isPc[propertyCodes[i]] = true
			}
			
			var objSchema = schema._byCode[objTypeCode]
			
			function computeMap(id, res){
				var pu = pathsplicer.make()
				var map = {}
				for(var i=0;i<res.length;++i){
					var e = res[i]
					var ignorable = pu.update(e)

					
					if(!ignorable && pu.getPath().length === 1){
						var pc = pu.getPath()[0].edit.typeCode
						if(!isPc[pc]) continue
						if(e.op === 'setInt' || e.op === 'setString'){
							map[pc] = e.edit.value
						}else if(e.op === 'addInt'){
							if(map[pc] === undefined) map[pc] = []
							map[pc].push(e.edit.value)
						}else{
							_.errout('TODO: ' + JSON.stringify(e))
						}
					}
				}
				for(var i=0;i<propertyCodes.length;++i){
					var pc = propertyCodes[i]
					if(map[pc] === undefined){
						var t = objSchema.propertiesByCode[pc].type
						if(t.type === 'set' || t.type === 'list'){
							map[pc] = []
						}
					}
				}
				cb(id, map, res.length > 0 ? res[res.length-1].editId : -1)
			}
			
			ol.getAllObjectsOfType(objTypeCode, computeMap, function(){
				liveCb(true)

				broadcaster.output.listenByType(objTypeCode, function(subjTypeCode, subjId, typeCode, id, path, op, edit, syncId, editId){
					outstandingEditIds.push(editId)
					//liveCb(false, editId)
					if(outstandingEditIds.length === 1){
						liveCb(false, editId)
					}
					
					ol.get(subjId, -1, -1, function(res){
					
						computeMap(subjId, res)
						/*var i = outstandingEditIds.indexOf(editId)
						outstandingEditIds.splice(i, 1)
						if(i === 0){
							if(outstandingEditIds.length > 0){
								liveCb(false, outstandingEditIds[0])
							}else{*/
								liveCb(true)
						/*	}
						}*/
					})
				})
			})
		},
		
		//Note that these method's implementations will always return a result that is up-to-date,
		//by fetching the async parts and then synchronously merging them with the AP parts
		getManyOfType: function(typeCode){
			_.assertLength(arguments, 1)
			return ol.getMany(typeCode)
		},
		getObjects: function(typeCode, ids, cb){
			_.assertFunction(cb);
			_.assertArray(ids)
			
			if(ids.length === 0){
				cb({})
				return;
			}

			//console.log('getting objects: ' + ids.length)

			var objs = {}
			var cdl = _.latch(ids.length, function(){
				//console.log('got all objects, done')
				cb(objs)
			})
			ol.getSet(ids, function(obj){
				objs[obj.meta.id] = obj
				//console.log('got obj')
				cdl()
			})
		},
		getAllIdsOfType: function(typeCode, cb){
			ol.getAllIdsOfType(typeCode, cb)
		},
		getAllObjects: function(typeCode, cb){
			ol.getAllOfType(typeCode, cb)//function(objs){
				//cb(objs)
			//})
		},
		//Returns the set of permutations of values for the given descent path, 
		//and the means for retrieving the objects belonging to each member of that set (i.e. each partition)
		//the descent paths must terminate in a primitive value for each object.
		//Effectively, we run each filter on the little bits of the objects it needs rather than the entire
		//object, but if those bits are the same for many objects we need only run the filter once,
		//and we can store the bits->ids mapping in an index.
		/*selectByPropertyConstraint: function(typeCode, descentPath, filterFunction, cb){
		
			handle.selectByMultiplePropertyConstraints(typeCode, [descentPath], [filterFunction], function(result){
				//console.log('result: ' + JSON.stringify(result))
				cb(result[0]);
			});
		},
		//selectByMultiplePropertyConstraints: selectByMultiplePropertyConstraints,
		getManyObjectsPassing: function(typeCode, filter, filterIsAsync, cb){
			_.assertLength(arguments, 4);
			handle.getAllObjectsPassing(typeCode, filter, filterIsAsync, function(objs){
				cb(objs.length);
			});
		},
		getAllObjectIdsPassing: function(typeCode, filter, filterIsAsync, cb){
			handle.getAllObjectsPassing(typeCode, filter, filterIsAsync, function(objs){
				var ids = [];
				for(var i=0;i<objs.length;++i){
					var obj = objs[i];
					ids.push([ obj.meta.typeCode, obj.meta.id ]);
				}
				cb(ids);
			});
		},*/
		getObjectType: function(id){
			_.assertLength(arguments, 1)
			return ol.getObjectType(id)
		}
	};
	
	return handle;
}
