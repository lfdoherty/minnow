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
			_.assertLength(arguments, 3);
			//_.assertInt(typeCode);
			_.assertObject(alreadyHadCache);
			//if(alreadyHadCache[typeCode] === undefined){
			//	alreadyHadCache[typeCode] = {};
			//}
			/*var aht = alreadyHadCache[typeCode];
			if(!aht[id]){
				aht[id] = true;
				includeObjectCb(typeCode, id, obj);
			}*/
			//console.log('including ' + typeCode + ' ' + id)
			if(!alreadyHadCache[id]){
				alreadyHadCache[id] = true;
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
						//console.log('releasing edits: ' + waitingEdits.length);
						while(waitingEdits.length > 0 && waitingEdits[0][0] <= editId){
							var e = waitingEdits.shift();
							forwardCbOn.apply(undefined, e[1]);
						}
					}
				}
			}
			function forwardCbOn(typeCode, id, path, op, edit, syncId, editId){
				_.assertLength(arguments, 7);
				_.assertInt(syncId);
				_.assertString(op)
				_.assert(_.isString(id) || _.isInt(id))
				lcb(typeCode, id, path, op, edit, syncId, editId);
			}
			var rrr = Math.random()
			function forwardCb(typeCode, id, path, op, edit, syncId, editId){
				_.assertLength(arguments, 7);
				_.assert(_.isString(id) || _.isInt(id))
				console.log(rrr + ' *forwarding edit(' + editId + ' sid: ' + syncId + '): ' + JSON.stringify(edit));
				if(alreadySent === undefined || alreadySent < editId || 
						(alreadySent === editId && syncId === -1)//edits sourced from views may reuse the same editId
					){
					if(held.length === 0 || held[0] > editId){
						_.assertInt(syncId);
						lcb(typeCode, id, path, op, edit, syncId, editId);
					}else{
						//console.log('holding edit');
						waitingEdits.push([editId, Array.prototype.slice.call(arguments, 0)]);
					}
				}else{
					console.log(rrr + ' WARNING(' + alreadySent + '): ignoring already sent (or skipped, in error) edit(' + editId + '): ' + JSON.stringify(edit));
				}
				if(syncId !== -1) alreadySent = editId;
			}
			
		
			

			
			_.each(relListenerMakerList, function(m, i){
				function redone(result){
					doneCb(i, result);
				}

				_.assertInt(m.code);
				_.assertInt(viewTypeCode);
				function listenerCb(op, edit, editId, more){
				
					//_.assertLength(arguments, 1);
					_.assert(arguments.length >= 3);
					_.assert(arguments.length <= 4);

					_.assertString(op)
					if(edit.op === 'objectSnap'){
						forwardCb(viewTypeCode, viewTypeCode+':'+paramsStr, [], op, edit, -1, editId);
					}else{
						forwardCb(viewTypeCode, viewTypeCode+':'+paramsStr, [m.code], op, edit, -1, editId);
					}
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

		var obj = {meta: {id: typeCode+':'+paramsStr, typeCode: typeCode, editId: -1}};
		
		var viewSchema = schema._byCode[typeCode].viewSchema;
		
		var alreadyDone = false;

		//console.log('getting view state: ' + _.size(viewSchema.rels));
		var manyRels = _.size(viewSchema.rels);
		var em = manyRels
		var cdl = _.latch(manyRels, 20000, function(){			
			if(failed) return;
			alreadyDone = true;
			console.log('done getting view state:'+ typeCode)
			doneCb(obj);
		}, function(c){
			/*console.log('view ' + typeCode + ' with params: ' + paramsStr);
			console.log('have not yet completed ' + c + ' rels out of ' + manyRels);
			console.log('completed: ' + JSON.stringify(Object.keys(obj)));
			console.log('failed to complete construction of view state within 30 seconds');
			console.log(new Error().stack);*/
		});
		var oldCdl = cdl
		cdl = function(){
			--em
			//console.log('completed part of view state: ' + em)
			oldCdl()
		}

		_.assertInt(viewSchema.code);
		var vrv = viewRvs[viewSchema.code];

		var relCodes = vrv[0];

		function includeObject(objTypeCode, id, objToInclude){
			_.assertDefined(objToInclude)
			_.assertInt(objTypeCode);
	
			_.assertDefined(id);
			_.assertObject(objToInclude);
			includeObjectCb(objTypeCode, id, objToInclude);

			_.assertInt(objToInclude.meta.editId)
			if(obj.meta.editId === undefined || obj.meta.editId < objToInclude.meta.editId){
				obj.meta.editId = objToInclude.meta.editId;
			}
		}
		function doneRel(relIndex, values){
			//_.assertLength(arguments, 2);
			//_.assertInt(values);
			_.assertInt(relIndex);
			//the ids/values
			if(failed){
				cdl();
				console.log('doneRel already failed');
				return;
			}
			
			//console.log('rel done: ' + relIndex);

			var relCode = relCodes[relIndex];
			var viewSchema = schema._byCode[typeCode];
			var ps = viewSchema.propertiesByCode[relCode];
			
			if(values === undefined){
				if(ps.type.type === 'set' || ps.type.type === 'list'){
					//we should always be able to construct the empty set/list
					console.log('doneRel failed');
					doFailure();
					cdl();
					_.errout('values is null');			
				}else{
					cdl();
				}
			}else{
				/*if(ps.type.type === 'object'){
					//_.assertArray(values);
					_//.assertLength(values, 2);
					//_.assertInt(values[0]);
				}else{
					_.errout('TODO?');
				}*/
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
			//console.log(JSON.stringify(vs));
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
