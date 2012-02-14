"use strict";

var _ = require('underscorem');

var getRvGetter = require('./sets_impl').getRvGetter;

var twomap = require('structures').twomap;

function wrapForHoldAndRelease(viewTypeCode, relListenerMakerList){
	_.assertLength(arguments, 2);
	
	return function(params, includeObjectCb, doneCb, lcb, onStopListening){
		//_.assertLength(arguments, 2);
		_.assert(arguments.length === 3 || arguments.length === 5);

		var paramsStr = JSON.stringify(params);
		
		if(lcb) _.assertFunction(lcb);
		if(onStopListening) _.assertFunction(onStopListening);

		var alreadyHadCache = {};
		function includeObject(typeCode, id, obj){
			_.assertObject(alreadyHadCache);
			if(alreadyHadCache[typeCode] === undefined){
				alreadyHadCache[typeCode] = {};
			}
			var aht = alreadyHadCache[typeCode];
			if(!aht[id]){
				aht[id] = true;
				includeObjectCb(typeCode, id, obj);
			}
		}		
		
		function complexWrap(){
			var held = [];
			var heldCount = {};
			var latestEditId;
			var waitingEdits = [];
			var alreadySent;

			function holdCb(editId){
				if(latestEditId !== undefined && editId < latestEditId){
					_.errout('got edit ids out of order, ' + latestEditId + ' before ' + editId);
				}
				latestEditId = editId;
				held.push(editId);
				if(heldCount[editId] === undefined) heldCount[editId] = 1;
				else ++heldCount[editId];
			}
			function releaseCb(editId){
				_.assertDefined(latestEditId);
				var hc = heldCount[editId];
				_.assertInt(hc);
				hc = --heldCount[editId];
				if(hc === 0){
					var index = held.indexOf(editId);
					_.assert(index >= 0);
					held.splice(index, 1);
					delete heldCount[editId];
					if(index === 0){
						//the released edit is the oldest one currently being held
						while(waitingEdits.length > 0 && waitingEdits[0][0] <= editId){
							var e = waitingEdits.shift();
							forwardCb.apply(undefined, e[1]);
						}
					}
				}
			}
			function forwardCb(typeCode, id, path, edit, syncId, editId){
				if(alreadySent === undefined || alreadySent < editId || 
						(alreadySent === editId && syncId === -1)//edits sourced from views may reuse the same editId
					){
					if(held.length === 0 || held[0] > editId){
						_.assertInt(syncId);
						lcb(typeCode, id, path, edit, syncId, editId);
					}else{
						waitingEdits.push([editId, Array.prototype.slice.call(arguments, 0)]);
					}
				}else{
					console.log('WARNING: ignoring already sent (or skipped, in error) edit(' + editId + '): ' + JSON.stringify(edit));
				}
				if(syncId !== -1) alreadySent = editId;
			}
			
		
			

			
			_.each(relListenerMakerList, function(m, i){
				function redone(result){
					doneCb(i, result);
				}

				_.assertInt(m.code);
				_.assertInt(viewTypeCode);
				function listenerCb(edit, editId, more){
				
					//_.assertLength(arguments, 1);
					_.assert(arguments.length >= 2);
					_.assert(arguments.length <= 3);
					//lcb(m.code, edit);
					//lcb(viewTypeCode, paramsStr, [m.code], edit);
					forwardCb(viewTypeCode, paramsStr, [m.code], edit, -1, editId);
				}
				listenerCb.isCbFunction = true;
				
				var cbs = {
					listener: listenerCb,//this is used for updates to the current view
					hold: holdCb, 
					release: releaseCb, 
					onStop: onStopListening,
					forward:forwardCb//this is used for edits to objects included by the view
				};
				m(params,includeObject, redone, cbs);
			});
		}
		
		if(lcb){
			complexWrap();
		}else{

			_.each(relListenerMakerList, function(m, i){
				m(params, includeObject, function(result){
					doneCb(i, result);
				});		
			});
		}
	}
}

exports.make = function(schema, broadcaster, objectState){
	_.assertLength(arguments, 3);
	_.assertFunction(broadcaster.output.listenByType);

	//TODO improve closure lifetimes
	function getViewState(typeCode, params, includeObjectCb, doneCb, listenerCb, onStopListening){
		
		if(listenerCb) _.assertFunction(listenerCb);
		if(onStopListening) _.assertFunction(onStopListening);
	
		var failed = false;
		function doFailure(){
			failed = true;
			doneCb();
		}

		var paramsStr = JSON.stringify(params);

		var obj = {0: [-1,-1, paramsStr, typeCode]};
		
		var viewSchema = schema._byCode[typeCode].viewSchema;
		
		var alreadyDone = false;

		//console.log('getting view state: ' + _.size(viewSchema.rels));
		var manyRels = _.size(viewSchema.rels);
		var cdl = _.latch(manyRels, 30000, function(){			
			if(failed) return;
			alreadyDone = true;
			//console.log('done(' + _.size(viewSchema.rels) + ')');
			//console.log(JSON.stringify(obj));
			doneCb([typeCode, obj]);
		}, function(c){
			console.log('have completed ' + c + ' rels out of ' + manyRels);
			_.errout('failed to complete construction of view state within 30 seconds');
		});

		_.assertInt(viewSchema.code);
		var vrv = viewRvs[viewSchema.code];

		var relCodes = vrv[0];

		//var already = twomap.make();
		
		function includeObject(typeCode, id, objToInclude){
			//console.log('including object: ' + typeCode + ' ' + id);
			//top-level objects to include (i.e. includeObject(...))
	
			//if(!already.has(typeCode, id)){
			_.assertDefined(id);
			_.assertObject(objToInclude);
			includeObjectCb(typeCode, id, objToInclude);
				//already.set(typeCode, id, true);
			//}
			if(obj[0][1] < objToInclude[0][1]){
				obj[0][1] = objToInclude[0][1];
			}
		}
		function doneRel(relIndex, values){
			_.assertLength(arguments, 2);
			_.assertInt(relIndex);
			//the ids/values
			if(failed){
				cdl();
				console.log('doneRel already failed');
				return;
			}
			
			if(values === undefined){
				console.log('doneRel failed');
				doFailure();
				cdl();
				_.errout('values is null');				
			}else{
				//console.log('doneRel called');
			
				var relCode = relCodes[relIndex];
				var viewSchema = schema._byCode[typeCode];
				var ps = viewSchema.propertiesByCode[relCode];
	
				/*if(ps.type.type === 'view'){
					//singleton property, use list-style
					console.log(JSON.stringify(values[0][2]));
					console.log(JSON.stringify(ps));
					_.assertPrimitive(values[0][2]);
					includeObject(ps.type.viewCode, values[0][2], values);
					_.assertDefined(values);
					values = [ps.type.viewCode, values[0][2]];
				}else */if(ps.type.type === 'object'){
					_.assertArray(values);
					_.assertLength(values, 2);
					_.assertInt(values[0]);
					//_.assertInt(values[1]);
					//_.assertInt(values[0][2]);
					//values = [values[0][2], values];
				}
				//console.log('ps: ' + JSON.stringify(ps));
				//console.log('set rel ' + relCode + ' to ' + JSON.stringify(values).substr(0, 100));

				_.assertNot(alreadyDone);
				//obj.push([relCode, values]);
				obj[relCode] = values;
				cdl();
			}
		}
		
		if(listenerCb){
			vrv[1](params, includeObject, doneRel, listenerCb, onStopListening);
		}else{
			vrv[1](params, includeObject, doneRel);
		}
		
	}
	
	var viewRvs = {};
	_.each(schema, function(vs){
		if(vs.isView){
			vs = vs.viewSchema;
			_.assertDefined(vs.rels);
			var list = [];
			var relCodes = [];
			_.each(vs.rels, function(rel){
				_.assertInt(rel.code);
				relCodes.push(rel.code);
				var vf = getRvGetter(rel, vs, schema, broadcaster, objectState, getViewState);
				vf.code = rel.code;
				list.push(vf);
			});
			_.assertInt(vs.code);
			viewRvs[vs.code] = [relCodes, wrapForHoldAndRelease(vs.code, list)];
		
		}
	});
		
	var handle = {
		getView: function(typeCode, params, includeObjectCb, doneCb){
			getViewState(typeCode, params, includeObjectCb, doneCb);
		},
		getViewAndListen: function(typeCode, params, includeObjectCb, doneCb, listenerCb, onStopListening){
			_.assertFunction(listenerCb);
			_.assertFunction(onStopListening);
			getViewState(typeCode, params, includeObjectCb, doneCb, listenerCb, onStopListening);
		}
	}
	
	return handle;
}
