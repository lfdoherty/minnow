"use strict";

var _ = require('underscorem');

var objutil = require('./objutil');

//var IdSet = require('./idset').IdSet;
var set = require('structures').set;

function getParamByName(params, name, viewSchema){
	if(name === 'true') return true;
	
	var res;
	_.each(viewSchema.params, function(p, index){
		if(p.name === name){
			res = params[index];
			if(p.type.type === 'set') _.assert(!_.isPrimitive(res));
		}
	});	
	if(res === undefined) _.errout('undefined param: ' + name);
	_.assertDefined(res);
	return res;
}

function makeUpdateMatches(rel, objectState, viewCode){
	_.assertLength(arguments, 3);
	
	return function updateMatches(filterFunction, state, typeCode, id, paramsStr, includeObjectCb, cbs, editId){
		cbs.hold(editId);
		objectState.getObjectState(id, function(obj){
			//_.assertDefined(obj);
			if(obj == undefined) _.errout('object does not exist: ' + typeCode + ' ' + id);
			
			var id = obj.meta.id
			var changed = false;
			if(filterFunction(obj)){
				if(!state.didPass[id]){
					++state.many;
					state.didPass[id] = true;
					changed = true;
				}
			}else{
				if(state.didPass[id]){
					--state.many;
					state.didPass[id] = false;
					changed = true;
				}
			}
			if(changed){
				cbs.listener('set', {value: state.many}, editId);
			}
			cbs.release(editId);
		});
	}
}
function doSyncFilteringCount(updateMatches, viewTypeCode, objectState, broadcaster, descentPath){
	_.assertLength(arguments, 5);
	_.assertFunction(broadcaster.output.listenByType);

	return function(viewId, filterFunction, includeObjectCb, doneCb, cbs){
		_.assertLength(arguments, 5);
		_.assertFunction(filterFunction);

		var stopped = false;
		cbs.onStop(function(){
			stopped = true;
		});
		
		objectState.selectByPropertyConstraint(viewTypeCode, descentPath, filterFunction, function(ids){
			ids = ids.get();
			
			var many = ids.length;
			//console.log('many: ' + many);
			var state = {many: many, didPass: {}};
			for(var i=0;i<ids.length;++i){
				var id = ids[i];
				//var key = id[0] + ':' + id[1];
				_.assertInt(id);
				state.didPass[id] = true;
			}
			
			function typeListener(subjTypeCode, subjId, typeCode, id, path, edit, syncId, editId){
				_.assertLength(arguments, 8);
				updateMatches(filterFunction, state, subjTypeCode, subjId, viewId, includeObjectCb, cbs, editId);
			}
			function newListener(typeCode, id, editId){
				updateMatches(filterFunction, state, typeCode, id, viewId, includeObjectCb, cbs, editId);
			}
			
			if(!stopped){
				
				broadcaster.output.listenByType(viewTypeCode, typeListener);
				broadcaster.output.listenForNew(viewTypeCode, newListener);
		
				cbs.onStop(function(){
					broadcaster.output.stopListeningByType(viewTypeCode, typeListener);
					broadcaster.output.stopListeningForNew(viewTypeCode, newListener);			
				});
			}
		
			doneCb(many);
		});
	}
}


function doSyncFilteringObjectsWithPropertyConstraints(updateMatches, objTypeCode, objectState, broadcaster){
	_.assertLength(arguments, 4);
	_.assertFunction(broadcaster.output.listenByType);

	return function(viewId, dps, rfs, setFunc, includeObjectCb, doneCb, cbs){
		_.assertLength(arguments, 7);

		//_.assertFunction(filterFunction);

		console.log('in doSyncFilteringObjects');

		var stopped = false;
		cbs.onStop(function(){
			stopped = true;
		});
		
		objectState.selectByMultiplePropertyConstraints(objTypeCode, dps, rfs, function(idLists){

			var resultIds = setFunc(idLists)
			
			//console.log('got resultIds: ' + JSON.stringify(resultIds))
			
			var ids = resultIds.get();
			//resultIds = resultIds.get()

			objectState.getObjects(objTypeCode, ids, function(objs){
			
				var state = {didPass: {}};
			
				var relObj = [];
				for(var i=0;i<ids.length;++i){
					var id = ids[i];
					var obj = objs[id];
					var typeCode = obj.meta.typeCode
					//_.assertArray(obj[0]);
					_.assertInt(typeCode);

					state.didPass[id] = true;
					includeObjectCb(typeCode, id, obj);

					relObj.push(id);
				}
				
				console.log('done: ' + objTypeCode + ' ' + _.size(idLists[0]) + ' relObj: ' + JSON.stringify(relObj).length + ' chars');
			
				doneCb(relObj);
		
				function typeListener(subjTypeCode, subjId, typeCode, id, path, op, edit, syncId, editId){
					_.assertLength(arguments, 9);
					updateMatches(dps, rfs, setFunc, state, subjTypeCode, subjId, viewId, includeObjectCb, cbs, editId, op, edit, path, syncId);
				}
				function newListener(typeCode, id, editId){
					console.log('heard of new ' + typeCode + ' ' + id);
					updateMatches(dps, rfs, setFunc, state, typeCode, id, viewId, includeObjectCb, cbs, editId);
				}
			
				if(!stopped){
				
					console.log('listening for new ' + objTypeCode);
				
					broadcaster.output.listenByType(objTypeCode, typeListener);
					broadcaster.output.listenForNew(objTypeCode, newListener);
		
					cbs.onStop(function(){
						broadcaster.output.stopListeningByType(objTypeCode, typeListener);
						broadcaster.output.stopListeningForNew(objTypeCode, newListener);			
					});
				}else{
					console.log('already stopped, not listening');
				}
			
			});
		});
	}
}

function doSyncFilteringObjects(updateMatches, viewTypeCode, objectState, broadcaster){
	_.assertLength(arguments, 4);
	_.assertFunction(broadcaster.output.listenByType);

	return function(viewId, filterFunction, includeObjectCb, doneCb, cbs){
		_.assertLength(arguments, 5);

		_.assertFunction(filterFunction);

		console.log('in doSyncFilteringObjects');

		var stopped = false;
		cbs.onStop(function(){
			stopped = true;
		});
		
		objectState.getAllObjectsPassing(viewTypeCode, filterFunction, false, function(objs){
			var state = {didPass: {}};
			
			console.log('do-sync-filtering-objects got: ' + objs.length + ' objs. *****************************');
		
			//var ids = [];
			var relObj = [];
			_.each(objs, function(obj){
				_.assertArray(obj[0]);
				_.assertInt(typeCode);
				var id = obj.meta.id
				//ids.push(id);
				//var key = typeCode + ':' + id;
				state.didPass[id] = true;
				includeObjectCb(typeCode, id, obj);
				//console.log('adding: ' + typeCode + ' ' + id);
				//if(relObj[typeCode] === undefined) relObj[typeCode] = [];
				//relObj[typeCode].push(id);
				relObj.push(id)
			});
			
			//console.log('dunning: ' + JSON.stringify(relObj));
		
			doneCb(relObj);
		
			//console.log('in do-sync-filtering-objects cb');
		
			function typeListener(subjTypeCode, subjId, typeCode, id, path, edit, syncId, editId){
				_.assertLength(arguments, 8);
				updateMatches(filterFunction, state, subjTypeCode, subjId, viewId, includeObjectCb, cbs, editId);
			}
			function newListener(typeCode, id, editId){
				//console.log('in new-listener');
				updateMatches(filterFunction, state, typeCode, id, viewId, includeObjectCb, cbs, editId);
			}
			
			if(!stopped){
			
				console.log('listening for new ' + viewTypeCode);
				
				broadcaster.output.listenByType(viewTypeCode, typeListener);
				broadcaster.output.listenForNew(viewTypeCode, newListener);
		
				cbs.onStop(function(){
					broadcaster.output.stopListeningByType(viewTypeCode, typeListener);
					broadcaster.output.stopListeningForNew(viewTypeCode, newListener);			
				});
			}else{
				console.log('already stopped, not listening');
			}
		});
	}
}

function makeIsValueFilterFunction(propertyCode, value){
	return function filterIsFunction(obj){
		//console.log('filtering is: ' + JSON.stringify(obj));

		for(var i=0;i<obj.length;++i){
			var entry = obj[i];
			if(entry[0] === propertyCode){
				_.assertDefined(entry[1]);
				return entry[1] === value;
			}
		}
		return false;
	}
}

function makeEqualFunction(value){
	//console.log('making equal function for value: ' + value);
	return function equalFunction(v){
		return v === value;
	}
}

//TODO refactor with better filter logic from non-count code
function makeCountMacroFilterGetter(rel, viewSchema, schema, broadcaster, objectState){
	_.assertLength(arguments, 5);
	_.assertFunction(broadcaster.output.listenByType);
	
	var macro = rel.params[0];
	var filter = macro.expr;
	var objSchema = schema[macro.context.name];

	if(filter.params[1].type === 'view' && filter.params[1].view === 'is'){//IS

		var is = filter.params[1];
	
		if(is.params[0].type === 'property' && 
			isAmpersand(is.params[0].context) &&
			is.params[1].type === 'value'){							
		
			var value = is.params[1].value;
			var propertyCode = objSchema.properties[is.params[0].name].code;
			
			//console.log('is filtering: ' + propertyCode);
			//var filterIsFunction = makeIsValueFilterFunction(propertyCode, value);

			var equalFunction = makeEqualFunction(value);
			
			var updateMatches = makeUpdateMatches(rel, objectState, viewSchema.code);
			var dsfc = doSyncFilteringCount(updateMatches, objSchema.code, objectState, broadcaster, [propertyCode]);
			
			
			return function(params, includeObjectCb, doneCb, cbs){
			
				if(cbs){
				
					var paramsStr = JSON.stringify(params);
					
					dsfc(paramsStr, equalFunction, includeObjectCb, doneCb, cbs);
				}else{
					//console.log('finding count by primitive property(' + propertyCode + '): ' + value);
					var start = Date.now();
					objectState.selectByPropertyConstraint(objSchema.code, [propertyCode], equalFunction, function(ids){
						var end = Date.now();
						//console.log('finding took: ' + (end-start) + 'ms, found: ' + ids.size());
						doneCb(ids.size());
					});
				}
			}
		}
	}else if(filter.params[1].type === 'view' && filter.params[1].view === 'in'){//IN

		var inPart = filter.params[1];
	
		if(inPart.params[0].type === 'property' && 
			isAmpersand(inPart.params[0].context) &&
			inPart.params[1].type === 'param'){
		
			var setParamName = inPart.params[1].name;
			var paramSet = getParamByName(params, setParamName, viewSchema);
			_.assertArray(paramSet);
			_.assertDefined(paramSet);
			if(paramSet === undefined) _.errout('ERROR');
		
			var propertyCode = objSchema.properties[inPart.params[0].name].code;

			var updateMatches = makeUpdateMatches(rel, objectState, viewSchema.code);
			var dsfc = doSyncFilteringCount(updateMatches, objectState, objSchema.code, objectState, broadcaster, [propertyCode]);
			
			//console.log('paramSet: ' + JSON.stringify(paramSet));
			return function(params, includeObjectCb, doneCb, cbs){
		
				function filterInFunction(v){
					return paramSet.indexOf(v) !== -1
				}

				if(cbs){

					var paramsStr = JSON.stringify(params);
					
					dsfc(paramsStr, filterInFunction, includeObjectCb, doneCb, cbs);

				}else{
					_.errout('TODO');
					/*
					objectState.getManyObjectsPassing(objSchema.code, filterInFunction, false, function(many){
						doneCb(many);
					});*/
				}
			}
		}
	}
}

function makeMaxGetter(rel, viewSchema, schema, broadcaster, objectState){

	_.assertLength(arguments, 5);
	_.assertFunction(broadcaster.output.listenByType);

	if(rel.params[0].type === 'property' && rel.params[0].context.type === 'type'){

		//console.log(JSON.stringify(rel.params[1]));
		
		var typeName = rel.params[0].context.name;
		var objSchema = schema[typeName];
		
		var defaultValue = Number(rel.params[1].name)
		
		var df = makeDescentFunction(schema, objSchema, rel.params[0]);
		
		return function(params, includeObjectCb, doneCb){
			var typeName = rel.params[0].name;
			objectState.getAllObjects(objSchema.code, function(objs){//TODO do this in a streaming manner
				var maxValue = defaultValue;
				_.each(objs, function(obj, idStr){
					//console.log('*obj: ' + JSON.stringify(obj))
					var value = df(obj);
					if(value == undefined) return;
					
					//console.log('property: ' + rel.params[0].name);
					_.assertNumber(value);
					if(value < defaultValue){
						console.log('WARNING: value is less than defaultValue(' + defaultValue+'): ' + value);
					}
					if(value > maxValue){
						maxValue = value;
					}
				});
				//console.log('maxValue: ' + maxValue);
				//_.assertInt(many);
				_.assertNumber(maxValue)
				doneCb(maxValue);
			});
		}

	}
	//console.log('rel: ' + JSON.stringify(rel));
	_.errout('TODO');
}

function makeCountGetter(rel, viewSchema, schema, broadcaster, objectState){

	_.assertLength(arguments, 5);
	_.assertFunction(broadcaster.output.listenByType);

	if(rel.params[0].type === 'type'){
		return function(params, includeObjectCb, doneCb){
			var typeName = rel.params[0].name;
			var many = objectState.getManyOfType(schema[typeName].code)//, function(many){
			_.assertInt(many);
			doneCb(many);
		}

	}else if(rel.params[0].type === 'macro'){
		var macro = rel.params[0];
		if(macro.expr.type === 'view' && macro.expr.view === 'filter'){
			var filter = macro.expr;
			if(isAmpersand(filter.params[0]) && macro.context.type === 'type'){
			
				return makeCountMacroFilterGetter(rel, viewSchema, schema, broadcaster, objectState);
			}
		}		
	}
	//console.log('rel: ' + JSON.stringify(rel));
	_.errout('TODO');
}

function makeUpdateMatchingObjects(rel, objectState, viewCode){
	return function updateMatching(filterFunction, state, typeCode, id, paramsStr, includeObjectCb, cbs, editId){
		cbs.hold(editId);
		objectState.getObjectState(id, function(obj){
			var id = obj.meta.id;
			var changed = false;
			console.log('filtering ' + key);
			if(filterFunction(obj)){
				if(!state.didPass[id]){
					//console.log('calling include-object-cb: ' + typeCode + ' ' + id);
					includeObjectCb(typeCode, id, obj);
						
					cbs.listener('addExisting', {id: id}, editId);
					
					state.didPass[id] = true;
					changed = true;
				}
			}else{
				if(state.didPass[id]){

					cbs.listener('remove', {id: id}, editId);
					
					state.didPass[id] = false;
					changed = true;
				}
			}
			cbs.release(editId);
		});
	}
}

function matchesPropertyConstraints(schema, typeCode, obj, descentPaths, filterFunctions, setFunc){
//	console.log('many paths: ' + descentPaths.length);
	var setList = [];
	for(var k=0;k<descentPaths.length;++k){

		var descentPath = descentPaths[k];
		var filterFunction = filterFunctions[k];
		
		var v = objutil.descendObject(schema, typeCode, obj, descentPath);
		var id = obj.meta.id
		if(filterFunction(v)){
			setList.push(set.fromArray([id]));
		}else{
			setList.push(set.empty);
		}
	}
	return setFunc(setList);
}

function makeUpdateMatchingObjectsWithPropertyConstraints(schema, rel, objectState, viewCode){

	return function updateMatching(dps, rfs, setFunc, state, typeCode, id, paramsStr, includeObjectCb, cbs, editId, op, edit, path, syncId){
		
		_.assert(arguments.length === 14 || arguments.length === 10);
		
		cbs.hold(editId);
		_.assertDefined(schema._byCode[typeCode]);
		objectState.getObjectState(id, function(obj){
			var id = obj.meta.id
			var changed = false;
			
			if(matchesPropertyConstraints(schema, typeCode, obj, dps, rfs, setFunc)){
				if(!state.didPass[id]){
					includeObjectCb(typeCode, id, obj);
					cbs.listener('addExisting', {id: id}, editId, {obj: obj});
					
					state.didPass[id] = true;
					changed = true;
				}else{

					console.log('still included');
					
					console.log('forwarding edit: ' + JSON.stringify(edit));
					cbs.forward(typeCode, id, path, op, edit, syncId, editId);
				}
			}else{
				if(state.didPass[key]){

					console.log('changed to exclude it from the set');
					
					cbs.listener('remove', {id: id}, editId, {obj: obj});
					
					state.didPass[id] = false;
					changed = true;
				}else{
					console.log('still excluded');
				}
			}
			cbs.release(editId);
		});
	}
}

function processObjects(includeObjectCb, doneCb, typeCode, ids, objs){

	for(var i=0;i<ids.length;++i){
		var id = ids[i];
		var obj = objs[id];
		includeObjectCb(typeCode, id, obj);
	}

	var obj = [].concat(ids)
	doneCb(obj);
}
function handleObjectIds(objectState, includeObjectCb, objSchema, objectIds, doneCb){
	_.assertLength(arguments, 5);

	var ids = objectIds.get();
	var typeCode = objSchema.code;
	
	//console.log('getting objects')
	var ff = processObjects.bind(undefined, includeObjectCb, doneCb, typeCode, ids)
	if(ids.length === 0){
		ff({})
		return;
	}
	objectState.getObjects(typeCode, ids, function(objs){
		//console.log('got objects')
		ff(objs)
	});
}

function makeObjectsPassingHandler(includeObjectCb, objSchema, doneCb){
	return function(objs){

		_.assertArray(objs);
		
		var ids = [];
		for(var i=0;i<objs.length;++i){
			var obj = objs[i];
			ids.push(obj.meta.id)
			includeObjectCb(objSchema.code, obj.meta.id, obj);
		}
		
		doneCb(ids);
	}
}

function findMapValue(key, mapValues){
	for(var i=0;i<mapValues.length;++i){
		var entry = mapValues[i];
		if(entry[0] === key){
			return entry[1];
		}
	}
}

function getAllPropertiesFor(schema, objSchema){
	var res = {};
	_.extend(res, objSchema.properties);
	_.each(objSchema.superTypes, function(dummy, sn){
		var st = schema[sn];
		if(st){
			_.extend(res, getAllPropertiesFor(schema, st))
		}
	})
	return res;
}


function makeDescentPath(schema, objSchema, expr){
	var cur = expr;
	var curSchema = objSchema;
	var funcs = [];
	var reversed = [];
	while(cur.type === 'property'){
		reversed.unshift(cur.name);
		cur = cur.context;
	}
	var path = []
	//reversed.forEach(function(r, index){
	for(var i=0;i<reversed.length;++i){
		var r = reversed[i]
		var ps = getAllPropertiesFor(schema, curSchema)[r];
		path.push(ps.code)
		if(ps.type.type === 'object'){
			curSchema = schema[ps.type.object];
		}else if(ps.type.type === 'map'){
			path.push(r)
			++i
		}else{
			if(reversed.length > i+1) _.errout(
				'TODO(' + i+'): ' + JSON.stringify(expr) + '\n'+
				JSON.stringify(reversed)+'\n'+
				JSON.stringify(ps)+'\n'+
				JSON.stringify(path))
		}
	}
	//})
	return path
}
/*
function makeDescentPath(schema, objSchema, expr){
	var cur = expr;
	var curSchema = objSchema;
	var funcs = [];
	var reversed = [];
	while(cur.type === 'property'){
		reversed.unshift(cur.name);
		cur = cur.context;
	}
	if(reversed.length === 1){
		var n = reversed[0];
		var ps = getAllPropertiesFor(schema, curSchema)[n];
		return [ps.code];
	}else if(reversed.length === 2){
		var n = reversed[0];
		var ps = curSchema.properties[n];
		_.assertEqual(ps.type.type, 'map');
		var n2 = reversed[1];
		return [ps.code, n2];
	}else{
		_.errout("TODO: " + JSON.stringify(expr));
	}
	_.errout("TODO");
}
*/

function makeDescentFunction(schema, objSchema, expr){
	var cur = expr;
	var curSchema = objSchema;
	var funcs = [];
	var reversed = [];
	while(cur.type === 'property'){
		reversed.unshift(cur.name);
		cur = cur.context;
	}
	if(reversed.length === 1){
		var n = reversed[0];
		var ps = curSchema.properties[n];
		return function(obj){
			//console.log('descending property ' + ps.name + ' on object of type ' + objSchema.name);
			var pv = objutil.findPropertyValue(ps.code, obj);
			//console.log(JSON.stringify(obj));
			return pv;
		}
	}else if(reversed.length === 2){
		var n = reversed[0];
		var ps = curSchema.properties[n];
		_.assertEqual(ps.type.type, 'map');
		var n2 = reversed[1];
		return function(obj){
			return findMapValue(n2, objutil.findPropertyValue(ps.code, obj));
		}
	}else{
		_.errout("TODO: " + JSON.stringify(expr));
	}
	_.errout("TODO");
}

function makePropertyFilterGetter(rel, viewSchema, schema, broadcaster, objectState, selfCall){
	_.assertLength(arguments, 6);
	
	var objSchema = schema[rel.context.name];
	var fExpr = rel.expr.params[1];
	
	var df = makeDescentFunction(schema, objSchema, fExpr.params[0]);
	//console.log(JSON.stringify(rel));
	var pfa = makePartialFunctionMaker(selfCall, schema, viewSchema, df, fExpr);

	var updateMatching = makeUpdateMatchingObjects(rel, objectState, viewSchema.code);
	var dsfc = doSyncFilteringObjects(updateMatching, objSchema.code, objectState, broadcaster);
	
	return function(params, includeObjectCb, doneCb, cbs){
		//console.log('is-property-equal-to-cb');
		
		var fa = pfa(params);
		
		if(cbs){

			var paramsStr = JSON.stringify(params);
			
			dsfc(paramsStr, fa, includeObjectCb, doneCb, cbs);
		}else{
			objectState.getAllObjectsPassing(objSchema.code, fa, false,
				makeObjectsPassingHandler(includeObjectCb, objSchema, doneCb));
		}
	}
}

//TODO remove this function (replace with *Smart version)
function makePartialFunctionMaker(selfCall, schema, viewSchema, df, expr){
	_.assertLength(arguments, 5);
	//console.log('expr: ' + JSON.stringify(expr));
	var sp = expr.params[1];

	function f(obj){
		var v = df(obj);
		//console.log('comparing ' + v + ' ' + sp.value);
		return v === sp.value;
	}
	
	if(expr.view === 'is'){
		if(sp.type === 'value'){
			_.assertDefined(sp.value);
			//console.log('sp.value: ' + sp.value);

			return function(params,cb){
				_.assertLength(arguments, 2);
				cb(f);
			}
		}else if(sp.type === 'param'){
			return function(params, cb){
				_.assertLength(arguments, 2);
				var paramValue = getParamByName(params, sp.name, viewSchema);
				//_.assertDefined(paramValue);
				cb(function(obj){
					var v = df(obj);
					//console.log('*comparing ' + v + ' ' + paramValue);
					return paramValue === v;
				})
			}
		}else{
			_.errout('TODO');
		}
	}else if(expr.view === 'in'){
		if(sp.type === 'param'){
			return function(params,cb){
				_.assertLength(arguments, 2);
				var paramSet = getParamByName(params, sp.name, viewSchema);
				_.assertDefined(paramSet);
				_.assertArray(paramSet);
				
				cb(function(obj){
					var v = df(obj);
					var iv = paramSet.indexOf(v);
					//console.log('paramSet: ' + JSON.stringify(paramSet));	
					return iv !== -1;
				})
			}
		}else if(sp.type === 'property'){
			if(sp.context.type === 'view'){
				var vs = schema[sp.context.view];
				_.assertDefined(vs);
				_.assert(vs.isView);
				var vsRel = vs.rels[sp.name];

				//produces function(params, includeObjectCb, doneCb, cbs)
				var relFunc = selfCall(vsRel, vs);
				
				var paramFuncs = [];
				_.each(sp.context.params, function(p){
					//console.log('p: ' + JSON.stringify(p));
					paramFuncs.push(selfCall(p, viewSchema));
				});
				
				//TODO handle changes to view params, or at least explicitly determine whether that is a possibility
				//and errout-todo if it is.
				
				return function(params,cb){
					_.assertLength(arguments, 2);
					console.log('params: ' + JSON.stringify(params));
					//TODO translate params, etc., into vs params
					
					var paramValues = [];
					var cdl = _.latch(paramFuncs.length, function(){
						relFunc(paramValues, function(){
							//include object callback
							_.errout('TODO ok?');							
						},
						function(results){
							//results.push(values);
							//console.log('**** in-set values: ' + JSON.stringify(results).substr(0,300));
							//results = values;
							cb(function(obj){
								var v = df(obj);
								//console.log('**** in-set: ' + JSON.stringify(results).substr(0,300));
								//console.log('**** v: ' + v);
								return results.indexOf(v) !== -1;
							})
						});
					});
					
					_.each(paramFuncs, function(pf, i){
						pf(params, function(){
							//include object callback
							_.errout('TODO ok?');
						}, function(values){
							console.log('got param ' + i + ' out of ' + JSON.stringify(Object.keys(paramFuncs)));
							paramValues[i] = values;
							cdl();
						});
					});
					
					
				}
			}else{
				_.errout('pTODO: ' + JSON.stringify(sp));
			}
		}else{
			_.errout('TODO: ' + JSON.stringify(sp));
		}
	}else{
		_.errout('TODO');
	}
}

function makePartialFunctionMakerSmart(selfCall, schema, viewSchema, dff, expr){
	_.assertLength(arguments, 5);
	//console.log('expr: ' + JSON.stringify(expr));
	_.assertDefined(expr.params);
	
	var dp;
	var pdf;
	if(isPropertiesEndingInAmpersand(expr.params[0])){
		dp = dff(expr.params[0]);
	}else{
		pdf = makePartialFunctionMakerSmart(selfCall, schema, viewSchema, dff, expr.params[0])
	}

	var sp = expr.params[1];

	function f(v){
		return v === sp.value;
	}
	
	if(expr.view === 'is'){
		if(sp.type === 'value'){
			_.assertDefined(sp.value);
			//console.log('sp.value: ' + sp.value);
			return [[dp, function(params,cb){
				_.assertLength(arguments, 2);
				cb(f);
			}]]
		}else if(sp.type === 'param'){
			return [[dp, function(params, cb){
				_.assertLength(arguments, 2);
				var paramValue = getParamByName(params, sp.name, viewSchema);
				//_.assertDefined(paramValue);
				cb(function(v){
					return paramValue === v;
				})
			}]]
		}else{
			_.errout('TODO');
		}
	}else if(expr.view === 'or' || expr.view === 'and'){
		var sdf = makePartialFunctionMakerSmart(selfCall, schema, viewSchema, dff, expr.params[1])

		return pdf.concat(sdf);
	}else if(expr.view === 'in'){
		if(sp.type === 'param'){
			return [[dp, function(params, cb){
				_.assertLength(arguments, 2);
				var paramSet = getParamByName(params, sp.name, viewSchema);
				_.assertDefined(paramSet);
				_.assertArray(paramSet);

				cb(function(v){
					var iv = paramSet.indexOf(v);
					//console.log('in: ' + iv + ' ' + v + ' ' + JSON.stringify(dp));
					return iv !== -1;
				})
			}]]
		}else if(sp.type === 'property'){
			if(sp.context.type === 'view'){
				var vs = schema[sp.context.view];
				_.assertDefined(vs);
				_.assert(vs.isView);
				vs = vs.viewSchema;
				var vsRel = vs.rels[sp.name];

				//produces function(params, includeObjectCb, doneCb, cbs)
				var relFunc = selfCall(vsRel, vs);
				
				var paramFuncs = [];
				_.each(sp.context.params, function(p){
					//console.log('p: ' + JSON.stringify(p));
					paramFuncs.push(selfCall(p, viewSchema));
				});
				
				//TODO handle changes to view params, or at least explicitly determine whether that is a possibility
				//and errout-todo if it is.
				
				return [[dp, function(params, cb){
					_.assertLength(arguments, 2);
					//console.log('params: ' + JSON.stringify(params));
					//TODO translate params, etc., into vs params
					
					var paramValues = [];
					var cdl = _.latch(paramFuncs.length, function(){
						//console.log('calling relFunc: ' + JSON.stringify(paramValues));
						relFunc(paramValues, function(){
							//include object callback
							_.errout('TODO ok?');							
						},
						_.once(function(results){
							//console.log('in-set results(' + sp.context.view + '): ' + JSON.stringify(results));
							cb(function(v){
								return results.indexOf(v) !== -1;
							})
						}));
					});
					
					_.each(paramFuncs, function(pf, i){
						pf(params, function(){
							//include object callback
							_.errout('TODO ok?');
						}, function(values){
							paramValues[i] = values;
							cdl();
						});
					});
				}]]
			}else{
				_.errout('pTODO: ' + JSON.stringify(sp));
			}
		}else{
			_.errout('TODO: ' + JSON.stringify(sp));
		}
	}else{
		_.errout('TODO');
	}
}

var basicSetOp = {
	len: 1, 
	f: function(sets){
		_.assertLength(sets, 1);
		return sets[0];
	}
}

function makeBooleanSetFunction(selfCall, schema, viewSchema, dff, expr, f){
	var pdf = makeSetOperationFunction(selfCall, schema, viewSchema, dff, expr.params[0])
	var sdf = makeSetOperationFunction(selfCall, schema, viewSchema, dff, expr.params[1])
	
	var r = {len: pdf.len+sdf.len, 
		f: function(sets){
			_.assertLength(sets, r.len);
			var a = sdf.f(sets.slice(0, sdf.len));
			var b = pdf.f(sets.slice(sdf.len));
			return f(a,b);
		}
	}	
	return r;
}

function makeSetOperationFunction(selfCall, schema, viewSchema, dff, expr){
	_.assertLength(arguments, 5);
	//console.log('expr: ' + JSON.stringify(expr));

	var sp = expr.params[1];

	if(expr.view === 'or'){
		
		return makeBooleanSetFunction(selfCall, schema, viewSchema, dff, expr, function(a, b){
			//console.log(a);
			//console.log('finding union: ' + JSON.stringify(a) + ' ' + JSON.stringify(b));
			return a.getUnion(b);
		});
	}else if(expr.view === 'and'){

		return makeBooleanSetFunction(selfCall, schema, viewSchema, dff, expr, function(a, b){return a.getIntersection(b);});
	}else{
		if(!isPropertiesEndingInAmpersand(expr.params[0])){
			_.errout('cannot make set operation for: ' + JSON.stringify(expr));
		}
		return basicSetOp;
	}
}

function makeGeneralFilterGetter(rel, boolFunc, viewSchema, schema, broadcaster, objectState, selfCall){
	_.assertLength(arguments, 7);

	var objSchema = schema[rel.context.name];
	
	function descentPathMaker(expr){
		return makeDescentPath(schema, objSchema, expr);
	}

	var dpAndFilterFuncs = makePartialFunctionMakerSmart(selfCall, schema, viewSchema, descentPathMaker, boolFunc);

	var dps = [];
	var fss = [];
	for(var i=0;i<dpAndFilterFuncs.length;++i){
		var b = dpAndFilterFuncs[i];
		dps.push(b[0]);
		fss.push(b[1]);
	}

	var setFuncRes = makeSetOperationFunction(selfCall, schema, viewSchema, descentPathMaker, boolFunc);
	var setFunc = setFuncRes.f;
	_.assertEqual(setFuncRes.len, dps.length);

	var updateMatching = makeUpdateMatchingObjectsWithPropertyConstraints(schema, rel, objectState, viewSchema.code);
	var dsfc = doSyncFilteringObjectsWithPropertyConstraints(updateMatching, objSchema.code, objectState, broadcaster);
	
	return function(params, includeObjectCb, doneCb, cbs){

		var cdl = _.latch(fss.length, function(){
			if(cbs){
				//console.log('general filter cbs');

				var paramsStr = JSON.stringify(params);			
				dsfc(paramsStr, dps, rfs, setFunc, includeObjectCb, doneCb, cbs);
			}else{
		
				//console.log('general filter - no cbs: ' + new Error().stack);

				var timeoutHandle = setTimeout(function(){
					console.log('objectState.selectByMultiplePropertyConstraints taking a long time to finish');
					_.errout('computing general filter rel set has taken more than 10 seconds without completing');
				}, 30000);			
			
				//console.log('selecting by constraints')
				objectState.selectByMultiplePropertyConstraints(objSchema.code, dps, rfs, function(idLists){
					//console.log('got select results')

					var resultIds = setFunc(idLists);
				
					clearTimeout(timeoutHandle);

					handleObjectIds(objectState, includeObjectCb, objSchema, resultIds, doneCb);
				});
			
			}
		});
		var rfs = [];
		_.each(fss, function(f,index){
			f(params, function(res){
				rfs[index] = res;
				cdl();
			});
		});

	}		
}

function isPropertiesEndingInAmpersand(expr){
	var cur = expr;
	while(cur.type === 'property'){
		cur = cur.context;
	}
	return cur.type === 'param' && cur.name === '&';
}

function isIs(expr){
	return expr.type === 'view' && expr.view === 'is';
}
function isIn(expr){
	return expr.type === 'view' && expr.view === 'in';
}
function isAmpersand(expr){
	return expr.type === 'param' && expr.name === '&';
}
function nextNotPropertyIsFilterMacro(expr){
	var cur = getNextNotProperty(expr);
	return cur.type === 'macro' && cur.expr.type === 'view' && cur.expr.view === 'filter';
}
function getNextNotProperty(expr){
	var cur = expr;
	while(cur.type === 'property'){
		cur = cur.context;
	}
	return cur;
}
function ignore(){}

function andFunc(aIds, bIds){
	return aIds.intersection(bIds);
}
function orFunc(aIds, bIds){
	return aIds.union(bIds);
}

function getTypeAndSubtypeCodes(schema, objSchema){
	var res = [objSchema.code];
	_.each(objSchema.subTypes, function(v, subType){
		res = res.concat(getTypeAndSubtypeCodes(schema, schema[subType]));
	});
	return res;
}

function makeSimpleMapMacro(schema, rel, objectState, broadcaster){
	
	var objSchema = schema[rel.context.name];
	var baseTypeCodes = getTypeAndSubtypeCodes(schema, objSchema)//gobjSchema.code;

	_.assert(baseTypeCodes.length >= 1)
	//_.assertInt(baseTypeCode);
	
	var keyDf;
	var valueDf;
	
	if(rel.keyExpr.name === 'id'){
		keyDf = function(obj){return obj.meta.id;}
	}else{
		var keyPropertyCode = objSchema.properties[rel.keyExpr.name].code;
		_.assertInt(keyPropertyCode);
		keyDf = function(obj){
			return obj[keyPropertyCode];
		}
	}
	if(rel.valueExpr.name === 'id'){
		valueDf = function(obj){return obj.meta.id;}
	}else{
		var valuePropertyCode = objSchema.properties[rel.valueExpr.name].code;
		_.assertInt(valuePropertyCode);
	
		valueDf = function(obj){
			return obj[valuePropertyCode];
		}
	}
	
	return function(params, includeObjectCb, doneCb, cbs){
	
		var timeoutHandle = setTimeout(function(){
			_.errout('computing type rel set has taken more than 10 seconds without completing');
		}, 10000);

		var stopped = false;
		if(cbs){
			cbs.onStop(function(){
				stopped = true;
			});
		}
		
		var relObj = {};
		function handler(typeCode, doneTypeCb, objs){
			//console.log('****objs: ' + JSON.stringify(objs));
			
			var objectKeys = {};

			var gotKeys = {};
			function addObjectToRel(obj, editId){
				var id = obj.meta.id
				
				var key = keyDf(obj);
				objectKeys[id] = key;
				if(key !== undefined){
					var value = valueDf(obj);
					//relObj.push([key, value]);
					relObj[key] = value;
					//console.log('added map-macro(' + baseTypeCode + ') ' + key + ' ' + value);
					
					if(editId !== undefined && cbs){
						cbs.listener('put', {key: key, value: value}, editId);
					}
				}else{
					//console.log('null key: ' + JSON.stringify(obj));
				}
			}
			_.each(objs, function(obj){
				//console.log('obj: ' + JSON.stringify(obj))
				var typeCode = obj.meta.typeCode
				_.assertInt(typeCode);
				addObjectToRel(obj);
			});
			//console.log('relObj: ' + JSON.stringify(relObj));
			
			clearTimeout(timeoutHandle);
			
			doneTypeCb();

			function typeListener(subjTypeCode, subjId, typeCode, id, path, op, edit, syncId, editId){
				_.assertLength(arguments, 9);
				_.assertInt(syncId);
				//cbs.forward(typeCode, id, path, edit, syncId, editId);
				//console.log('WARNING: TODO map-macro type listener update');

				cbs.hold(editId);
				objectState.getObjectState(id, function(obj){
				
					//console.log('updating map for object: ' + typeCode + ' ' + id);

					var key = keyDf(obj);
					var id = obj.meta.id;
					var oldKey = objectKeys[id];
					if(key !== oldKey){
						//console.log('oldKey: ' + oldKey + ', newKey: ' + key);
						cbs.listener('remove', {key: oldKey}, editId);
					}
						
					if(key !== undefined){
						var value = valueDf(obj);
						//console.log('checking if we need to change value: ' + key + '->' + value);
						//var foundDifferent = true;
						var found = relObj[key];
						
						if(found !== undefined){
							if(found !== value){
								//console.log('putting new value');
								cbs.listener('put', {key: key, value: value}, editId);
								relObj[key] = found;//[key, value];
							}else{
								//console.log('same value');
							}
						}else{
							cbs.listener('put', {key: key, value: value}, editId);
							relObj[key] = value;
						}
					}else{
						delete objectKeys[id];
					}
					
					
					cbs.release(editId);
				});
			}
			function newListener(typeCode, id, editId){
				cbs.hold(editId);
				objectState.getObjectState(id, function(obj){
					addObjectToRel(obj, editId);
					cbs.release(editId);
				});
			}		
			
			if(cbs && !stopped){

				broadcaster.output.listenByType(baseTypeCode, typeListener);
				broadcaster.output.listenForNew(baseTypeCode, newListener);
	
				cbs.onStop(function(){
					broadcaster.output.stopListeningByType(baseTypeCode, typeListener);
					broadcaster.output.stopListeningForNew(baseTypeCode, newListener);			
				});
			}
		}
		var cdl = _.latch(baseTypeCodes.length, function(){
			doneCb(relObj)
		})
		for(var i=0;i<baseTypeCodes.length;++i){
			var baseTypeCode = baseTypeCodes[i];
			objectState.getAllObjects(baseTypeCode, handler.bind(undefined,baseTypeCode, cdl));
		}
	}
}

function getById(rel, typeCode, objectState, viewSchema, selfCall){
	_.assertInt(typeCode)
	var inner = selfCall(rel.params[0], viewSchema);//expression for id
	return function(params, includeObjectCb, doneCb, cbs){
		function ourDoneCb(id){
			if(id === undefined){
				doneCb();
			}else{
				_.assertInt(id);
				objectState.getObjectState(id, function(obj){
					includeObjectCb(typeCode, id, obj);
					doneCb(id);
				});
			}
		}
		if(cbs){
			//TODO listen for edits to object, forward them
		}
		inner(params, includeObjectCb, _.once(ourDoneCb));
	}
}

function getRvGetter(rel, viewSchema, schema, broadcaster, objectState, getView){
	_.assertLength(arguments, 6);
	_.assertFunction(broadcaster.output.listenByType);
	
	var selfCall = function(rel, viewSchema){
		return getRvGetter(rel, viewSchema, schema, broadcaster, objectState, getView);
	}
	
	if(rel.type === 'view' && rel.view === 'count'){
		return makeCountGetter(rel, viewSchema, schema, broadcaster, objectState);
	}else if(rel.type === 'view' && rel.view === 'max'){
		return makeMaxGetter(rel, viewSchema, schema, broadcaster, objectState);
	}else if(rel.type === 'view' && rel.view === 'get'){
		var paramName = rel.params[1].name;
		//console.log('paramName: ' + paramName);
		//console.log('rel.params[1]: ' + JSON.stringify(rel.params[1]));
		var typeCode = schema[rel.params[0].name].code;
		
		var idFunction = selfCall(rel.params[1], viewSchema);
		return function(params, includeObjectCb, doneCb, cbs){
		
			idFunction(params, includeObjectCb, _.once(ourDoneCb), cbs);
			
			function ourDoneCb(results){
				_.assertLength(arguments, 1);
				var id = results;
				//console.log('params: ' + JSON.stringify(params));
				_.assertInt(id);
				objectState.getObjectState(id, function(obj){
					//console.log(JSON.stringify([typeCode, id]))
					if(obj === undefined){
						doneCb();
					}else{
						_.assertDefined(obj)
						includeObjectCb(typeCode, id, obj);
					
						if(cbs){
							broadcaster.output.listenByObject(typeCode, id, cbs.forward);						
							cbs.onStop(function(){
								broadcaster.output.stopListeningByObject(typeCode, id, cbs.forward);						
							})
						}
					
					
						doneCb(id);
					}
				});
			}
		}		
	}else if(rel.type === 'view' && rel.view === 'one'){

		var inner = selfCall(rel.params[0], viewSchema);
		return function(params, includeObjectCb, doneCb, cbs){
			function ourDoneCb(results){
				_.assertArray(results);
				if(results.length === 0){
					doneCb();
				}else{
					console.log(JSON.stringify(results));
					var id;
					//var typeCode;
					_.assertLength(results, 1);
					id = results[0];

					if(id === undefined){
						doneCb();
					}else{
						doneCb(id);
					}
				}
			}
			var wcbs
			if(cbs){
				var wcbs = {};
				_.extend(wcbs, cbs);

				wcbs.listener = function(op, edit, editId, more){
					_.assertLength(arguments, 4);
					_.assertString(op)
					console.log(JSON.stringify(arguments));
					var object = more.obj;
					if(op === 'addExisting'){
						//console.log('HERE#*$#()@$*_#@$');
						//cbs.listener({op: 'object-snap', id: edit.id, value: object, type: edit.type});
						var typeCode = object.meta.typeCode;
						_.assertInt(typeCode)
						includeObjectCb(typeCode, edit.id, object);
						cbs.listener('setObject', {id: edit.id}, editId);
						//_.errout('TODO: set super-property!');
					}else{
						cbs.listener.apply(undefined, Array.prototype.slice.call(arguments));
					}
				}
				//throw new Error(JSON.stringify(Object.keys(cbs)) + '\n' + JSON.stringify(Object.keys(wcbs)))
			}
			inner(params, includeObjectCb, _.once(ourDoneCb), wcbs);
		}
	}else if(rel.type === 'macro'){
		if(rel.expr.type === 'view' && rel.expr.view === 'filter' && isAmpersand(rel.expr.params[0]) &&
			rel.context.type === 'type'){
		
			var filter = rel.expr;
			var objSchema = schema[rel.context.name];

			var boolFunc = filter.params[1];
			
			return makeGeneralFilterGetter(rel, boolFunc, viewSchema, schema, broadcaster, objectState, selfCall);
		}else if(rel.context.type === 'property' && rel.expr.type === 'view' && 
				rel.expr.params.length === 1 && isAmpersand(rel.expr.params[0])){
			//pattern is: _.property{view(&)}
			
			var inputPropertyFunction = getRvGetter(rel.context, viewSchema, schema, broadcaster, objectState, getView);			
			
			var macroViewFunction = getRvGetter(rel.expr, viewSchema, schema, broadcaster, objectState, getView);
			
			return function(params, includeObjectCb, doneCb, cbs){
				console.log('calling property function');
				function incl(typeCode, id, object){
					console.log('wants to include: ' + typeCode + ' ' + id);
				}
				
				function processValues(valuesSet){
					_.assertLength(arguments, 1);

					var results = [];					
					var cdl = _.latch(valuesSet.length, function(){
						doneCb(results);
					});
					
					_.assertArray(valuesSet);

					_.each(valuesSet, function(v){
						var np = {};
						_.assertDefined(v);
						np['&'] = v;

						var reqIncl = [];
						function incl(typeCode, id, object){
							_.assertInt(typeCode);
							//console.log('wants to include: ' + typeCode + ' ' + id);
							reqIncl.push([typeCode, id, object]);
						}

						//console.log('calling macro view function');
						macroViewFunction(np, incl, function(resultValue){

							if(resultValue === undefined){
								cdl();
								return;
							}

							for(var i=0;i<reqIncl.length;++i){
								var e = reqIncl[i];
								includeObjectCb(e[0], e[1], e[2]);
							}

							results.push(resultValue);
							cdl();
						});
					});
				}
				if(cbs){
					inputPropertyFunction(params, incl, processValues, cbs);
				}else{
					inputPropertyFunction(params, incl, processValues);
				}
			}
		}
	}else if(rel.type === 'map-macro' && rel.context.type === 'type' && 
		rel.keyExpr.type === 'property' && isAmpersand(rel.keyExpr.context) &&
		rel.valueExpr.type === 'property' && isAmpersand(rel.valueExpr.context)){
		
		if((rel.keyExpr.name === 'id' || schema[rel.context.name].properties[rel.keyExpr.name].type.type === 'primitive') &&
			(rel.valueExpr.name === 'id' || schema[rel.context.name].properties[rel.valueExpr.name].type.type === 'primitive')){
			return makeSimpleMapMacro(schema, rel, objectState, broadcaster);
		}
	}else if(rel.type === 'property'){
		if(nextNotPropertyIsFilterMacro(rel)){

			var macroExpr = getNextNotProperty(rel);
			var macroFunction = getRvGetter(macroExpr, viewSchema, schema, broadcaster, objectState, getView);
			
			var objSchema = schema[macroExpr.context.name];


			var df = makeDescentFunction(schema, objSchema, rel);

			return function(params, includeObjectCb, doneCb, cbs){
				
				var timeoutHandle = setTimeout(function(){
					_.errout('computing property rel set has taken more than 10 seconds without completing');
				}, 30000);

				var result = [];

				var wrappedCbs;
				if(cbs){
					var propertyCode = objSchema.properties[rel.name].code;
					_.assert(rel.context.type !== 'property');
					wrappedCbs = {
						listener: function(op, edit, editId, more){
							//_.assertLength(arguments, 1);
							_.assert(arguments.length >= 2);
							_.assert(arguments.length <= 3);
							_.assertString(op)
							
							if(op === 'addExisting'){
								var nv = df(more.obj);
								if(result.indexOf(nv) === -1){
									result.push(nv);
									cbs.listener('add', {id: nv}, editId);
								}else{
									//_.errout('already got property: ' + nv + ' of type ' + objSchema.name + '.' + rel.name);
									console.log('already got property: ' + nv + ' of type ' + objSchema.name + '.' + rel.name);
								}
							}else if(op === 'remove'){
								console.log('WARNING: TODO(' + edit.op + ') ' + new Error().stack);
							}else{
								console.log('WARNING: TODO(' + edit.op + ') ' + new Error().stack);
							}
						}, 
						hold: cbs.hold, 
						release: cbs.release, 
						onStop: cbs.onStop
					};
				}
				
				macroFunction(params, ignore, function(valuesSet){

					//console.log('got macro-property values: ' + JSON.stringify(valuesSet).substr(0,300));
					
					var totalCount = valuesSet.length;
					//_.each(valuesSet, function(arr, typeCodeStr){
					//	totalCount += arr.length;
					//});
					//
					var alreadyGot = {};
					
					var cdl = _.latch(totalCount, function(){
						//console.log('calling back done(' + result.length + '): ' + JSON.stringify(result).substr(0,300));
						clearTimeout(timeoutHandle);
						doneCb(result);
					});
											
					_.assertArray(valuesSet);
						
					var arr = valuesSet;
					
					_.each(arr, function(id){
						_.assertInt(id);
						objectState.getObjectState(id, function(obj){
						
							var res = df(obj);
							if(!_.isPrimitive(res)) _.errout('TODO');
							
							if(res === undefined){
								//console.log(JSON.stringify(rel));
								//if(Math.random() < .05) console.log('no value for: ' + JSON.stringify(obj));
							}else{

								_.assertDefined(res);
								if(alreadyGot[res] === undefined) result.push(res);
								alreadyGot[res] = true;
							}
							
							cdl();
						});
					});
					
				}, wrappedCbs);
			}
		}else if(rel.context.type === 'view'){
			
			var actualView = schema[rel.context.view];
			_.assertDefined(actualView);
			//console.log(JSON.stringify(actualView));
			var actualExpression = actualView.rels[rel.name];
			_.assertDefined(actualExpression);

			_.errout('TODO: ');

			var viewFunction = getRvGetter(rel.context, viewSchema, schema, broadcaster, objectState, getView);
			
			return function(params, includeObjectCb, doneCb, cbs){
				
				function incl(typeCode, id, obj){
					_.errout('HERE: ' + typeCode + ' ' + id);
				}
				
				viewFunction(params, incl, function(arr){

					_.errout('arr: ' + JSON.stringify(arr));
				});
			}
		}
	}else if(rel.type === 'param'){
		var paramName = rel.name;
		
		var paramDef = viewSchema.paramsByName[paramName];
		//_.assertDefined(paramDef);
		if(paramDef === undefined) _.errout('unknown param: ' + paramName);

		
		if(paramDef.type.type === 'object'){
			if(schema[paramDef.type.object] === undefined) _.errout('unknown object type: ' + paramDef.type.object);
			var objectTypeCode = schema[paramDef.type.object].code;

			return function(params, includeObjectCb, doneCb, cbs){

				var timeoutHandle = setTimeout(function(){
					_.errout('computing param-object rel set has taken more than 10 seconds without completing');
				}, 30000);

				var paramValue = getParamByName(params, paramName, viewSchema);
				//console.log('paramValue: ' + paramValue);
				_.assertInt(paramValue);
				objectState.getObjectState(paramValue, function(obj){
					if(obj === undefined){
						clearTimeout(timeoutHandle);
						console.log('Error: cannot find object ' + objectTypeCode + ' ' + paramValue);
						doneCb();
					}else{
						includeObjectCb(objectTypeCode, paramValue, obj);
					
						if(cbs){
							console.log('listening for related param object changes: ' + objectTypeCode + ' ' + paramValue)
							broadcaster.output.listenByObject(objectTypeCode, paramValue, cbs.forward);
						}
						clearTimeout(timeoutHandle);
						doneCb(paramValue);
					}
				});
			}
		}else if(paramDef.type.type === 'primitive'){

			return function(params, includeObjectCb, doneCb){
				
				var timeoutHandle = setTimeout(function(){
					_.errout('computing param-primitive rel set has taken more than 10 seconds without completing');
				}, 30000);

				var paramValue = getParamByName(params, paramName, viewSchema);
				clearTimeout(timeoutHandle);
				doneCb(paramValue);
			}
		}else if(paramDef.type.type === 'set'){
			if(paramDef.type.members.type === 'primitive'){
				return function(params, includeObjectCb, doneCb){

					var timeoutHandle = setTimeout(function(){
						_.errout('computing param-set-primitive rel set has taken more than 10 seconds without completing');
					}, 30000);

					var paramSet = getParamByName(params, paramName, viewSchema);
					_.assert(!_.isPrimitive(paramSet));
					clearTimeout(timeoutHandle);
					doneCb(paramSet);
				}
			}
		}
	}else if(rel.type === 'view'){
	
		if(!schema[rel.view].isView){
			//console.log('rel: ' + JSON.stringify(rel))
			var typeCode = schema[rel.view].code;
			return getById(rel, typeCode, objectState, viewSchema, selfCall);
		}

		var subView = schema[rel.view];
		//_.assertDefined(subView);
		if(subView === undefined) _.errout('cannot find view: ' + rel.view);
	
		var viewParamFunctions = [];

		_.each(rel.params, function(vp){
			var vpf;
			if(vp.name === '&'){
				vpf = function(params, includeObjectCb, cb){
					_.assertDefined(params['&']);
					//return params['&'];
					cb(params['&']);
				}
			}else{
				vpf = getRvGetter(vp, viewSchema, schema, broadcaster, objectState, getView);
				_.assertFunction(vpf);
			}
			viewParamFunctions.push(vpf);
		});
	
		return function(params, includeObjectCb, doneCb, cbs){

			//_.assertNot(cbs);
			//if(cbs) _.assertNot(cbs.listener.isCbFunction);
			//console.log(new Error().stack);
			//var beganView = false;
			var timeoutHandle = setTimeout(function(){
				console.log('computing view rel set has taken more than 30 seconds without completing');
				console.log(new Error().stack);
			}, 35000);
		
			var subParams = [];
			var cdl = _.latch(viewParamFunctions.length, function(){

				//beganView = true;
				
				function gotViewCb(viewObj){
					_.assertLength(arguments, 1);
					//_.assertArray(viewObjData);
					//var typeCode = viewObjData[0];
					//var viewObj = viewObjData[1];
					clearTimeout(timeoutHandle);
					//console.log('got view object: ' + subView.code);
					//_.assertNot(_.isArray(viewObj));
					//console.log(doneCb);
					//console.log(JSON.stringify(viewObj));
					//doneCb(viewObj);
					var viewId = viewObj.meta.id;
					var typeCode = viewObj.meta.typeCode;
					_.assertString(viewId);
					includeObjectCb(typeCode, viewId, viewObj);
					doneCb(viewId);
				}

				function listenerCb(typeCode, id, path, op, edit, syncId, editId){
					_.assertLength(arguments, 7);
					_.assertString(op)
					_.assertInt(typeCode)
					cbs.forward(typeCode, id, path, op, edit, syncId, editId);
				}
				
				if(cbs){
					getView(subView.code, subParams, includeObjectCb, gotViewCb, listenerCb, cbs.onStop);
				}else{
					getView(subView.code, subParams, includeObjectCb, gotViewCb);
				}
			});
		
			_.each(viewParamFunctions, function(vpf, i){
				vpf(params, includeObjectCb, function(paramValue){
					subParams[i] = paramValue;
					cdl();
				});
			});
		
			//if(cbs){
			//	console.log('WARNING TODO: set_impl.js, rel.type === view does not handle the listening case');
			//}
		}
	}else if(rel.type === 'type'){
		
		var baseTypeCode = schema[rel.name].code;
		
		return function(params, includeObjectCb, doneCb, cbs){
		
			var timeoutHandle = setTimeout(function(){
				_.errout('computing type rel set has taken more than 10 seconds without completing');
			}, 10000);

			var stopped = false;
			if(cbs){
				cbs.onStop(function(){
					stopped = true;
				});
			}		
			objectState.getAllObjects(baseTypeCode, function(objs){
				//console.log('objs: ' + JSON.stringify(objs));

				var relObj = [];
				_.each(objs, function(obj){
					var typeCode = obj.meta.typeCode
					//_.assertArray(obj[0]);
					_.assertInt(typeCode);
					var id = obj.meta.id;
					includeObjectCb(typeCode, id, obj);
					//if(relObj[typeCode] === undefined) relObj[typeCode] = [];
					relObj.push(id);
				});
				//console.log('relObj: ' + JSON.stringify(relObj));
				
				clearTimeout(timeoutHandle);
				
				doneCb(relObj);

				var lastForwarded = -1;
				var uid = Math.random();
				function typeListener(subjTypeCode, subjId, typeCode, id, path, op, edit, syncId, editId){
					_.assertLength(arguments, 9);
					_.assertInt(syncId);
					if(rel.name === 'map'){
						console.log(uid);
						console.log('map forwarding(' + lastForwarded + ')(' + editId + '): ' + JSON.stringify(edit));
					}
					if(editId <= lastForwarded){
						console.log('type listener got dup: ' + editId);
						return;
					}
					lastForwarded = editId;
					cbs.forward(typeCode, id, path, op, edit, syncId, editId);
				}
				function newListener(typeCode, id, editId){
					cbs.hold(editId);
					console.log("NEW LISTENER *************************************************");
					objectState.getObjectState(id, function(obj){
						includeObjectCb(typeCode, id, obj);

						//(op, edit, editId, more){
						cbs.listener('addExisting', {id: id}, editId, {obj: obj});

						cbs.release(editId);
					});
				}		
				
				if(cbs && !stopped){

					broadcaster.output.listenByType(baseTypeCode, typeListener);
					broadcaster.output.listenForNew(baseTypeCode, newListener);
		
					cbs.onStop(function(){
						broadcaster.output.stopListeningByType(baseTypeCode, typeListener);
						broadcaster.output.stopListeningForNew(baseTypeCode, newListener);			
					});
				}
			});
		}
	}
	console.log('rel: ' + JSON.stringify(rel));
	_.errout('TODO');
}

exports.getRvGetter = getRvGetter;

