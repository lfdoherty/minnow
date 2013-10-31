"use strict";

var querystring = require('querystring');

var _ = require('underscorem');
var seedrandom = require('seedrandom')

var log = require('quicklog').make('minnow/service')

var newViewSequencer = require('./../server/new_view_sequencer')
var pu = require('./js/paramutil')

var b64 = require('./js/b64')

var crypto = require('crypto')
function computeHash(str){
	var hash = crypto.createHash('md5');
	hash.update(str);
	var h = hash.digest('base64');
	h = removeHashPadding(h);
	return h;
}
function removeHashPadding(hash){
	return hash.replace(/=/gi,'').replace(/\+/gi,'_').replace(/\//gi,'_');
}
/*
function parseComplexId(ps){
	var nci = ps.indexOf('_')
	var a = ps.substr(0,nci)
	var b = ps.substr(nci+1)
	var ia = parseInt(a)
	var ib = parseInt(b)
	if(isNaN(ia)) _.errout('failed to parse id: ' + id)
	if(isNaN(ib)) _.errout('failed to parse id: ' + id)
	return innerify(ia,ib)
}*/

var innerify = require('./js/innerId').innerify

function parseParams(schema, params){
	var ps = schema.params;
	var result = [];
	_.assertArray(params)
	for(var i=0;i<ps.length;++i){
		var p = ps[i];
		var pv = params[i];
		if(pv == null) throw new Error('invalid params: ' + JSON.stringify(params))
		if(p.type.type === 'set'){
			if(pv.length === 0) pv = [];
			else pv = pv.split(',');
		}else if(p.type.type === 'primitive'){
			if(p.type.primitive === 'int'){
				pv = parseInt(pv);
			}else if(p.type.primitive === 'string'){
			}else if(p.type.primitive === 'uuid'){
				_.assertLength(pv, 22)
				pv = seedrandom.uuidBase64ToString(pv)
				//_.errout('TODO: ' + JSON.stringify(pv));
			}else{
				_.errout('TODO: ' + JSON.stringify(p));
			}
		}else if(p.type.type === 'object'){
			if(pv.length > 22){//pv.indexOf('_') !== -1){
				//console.log('*converting pv: ' + pv)
				//pv = newViewSequencer.parseInnerId(pv)
				var a = seedrandom.uuidBase64ToString(pv.substr(0, 8))
				var b = seedrandom.uuidBase64ToString(pv.substr(9))
				pv = innerify(a,b)
			}else{
				//console.log('converting pv: ' + pv)
				pv = seedrandom.uuidBase64ToString(pv)//parseInt(pv);
				//console.log('converted pv: ' + pv)
			}
		}else{
			_.errout('TODO: ' + JSON.stringify(p));
		}
		result.push(pv);
	}
	return result;
}

function doParseParams(paramsStr, s){
	if(paramsStr === '-') return []
	console.log(s.name + ' params: ' + paramsStr)
	if(paramsStr === 'NaN' || paramsStr === '[object Object]') _.errout('corrupted paramsStr: "' + paramsStr+'"')
	_.assertString(paramsStr)
	var parsedParams;
	if(s.isView){
		var params = paramsStr.split(';');
		for(var i=0;i<params.length;++i){
			if(params[i] == null) throw new Error('invalid paramsStr: ' + paramsStr)
			params[i] = querystring.unescape(params[i]);
		}
		parsedParams = parseParams(s.viewSchema, params);
	}else{
		parsedParams = parseInt(paramsStr);
	}
	return parsedParams
}
function stringifyParams(params){
	var str = ''
	for(var i=0;i<params.length;++i){
		if(i > 0) str += ';';
		str += querystring.escape(params[i]);
	}
	return str
}
exports.parseParams = doParseParams
exports.stringifyParams = stringifyParams

function viewExprHash(e){
	var s = ''
	if(e.type === 'view'){
		//console.log(JSON.stringify(e))
		e.params.forEach(function(ep){
			s += viewExprHash(ep)
		})
	}else if(e.type === 'value'){
		s += JSON.stringify(e.value)
	}else if(e.type === 'nil'){
		//s += JSON.stringify(e.value)
	}else if(e.type === 'int'){
		s += JSON.stringify(e.value)
	}else if(e.type === 'macro'){
		s += viewExprHash(e.expr)
	}else if(e.type === 'param'){
		//console.log('e: ' + JSON.stringify(e))
		_.assertObject(e.schemaType)
		s += JSON.stringify(e.schemaType)
	}else if(e.type === 'let'){
		s += JSON.stringify(e.expr.schemaType)+':'+JSON.stringify(e.rest.schemaType)
	}else{
		_.errout('TODO: ' + JSON.stringify(e))
	}
	return s
}
function schemaHash(schema){
	var s = ''
	_.each(schema, function(sch){
		if(sch.code === undefined) return
		
		s += sch.code+':'
		if(sch.properties){
			_.each(sch.properties, function(p){
				s += p.code+','
				if(sch.isView){
					var v = sch.viewSchema
					var vr = v.rels[p.name]
					_.assertObject(vr.schemaType)
					s += viewExprHash(vr)
				}
			})
		}
	})
	return s
}

function computeSnapParamsKey(s, params){
	
	var key
	if(s.isView){
		key = '';
		if(params.length === 0) key = '-'
		for(var i=0;i<params.length;++i){
			if(i > 0) key += ';';
			key += pu.paramStr(params[i], s.viewSchema.params[i])//querystring.escape(params[i]);
		}
	}else{
		key = params+'';
	}
	
	return key
	/*var key = ''
	return key*/
	//return newViewSequencer.paramsStr(params, s.viewSchema.params)
}
function makeGetSnapshotsCallback(serverStateUid, s, viewCode, params, pathPrefix, cb){
	return function(err, e){
		if(err){
			console.log(err)
			console.log(new Error().stack)
			cb(err)
			return
		}

		var snapshotIds = e.snapshotVersionIds.concat([-1]);
		var lastVersionId = snapshotIds[snapshotIds.length-2]//e.lastVersionId;
		//console.log(JSON.stringify(e))
		_.assertInt(lastVersionId)

		var key = computeSnapParamsKey(s, params)

		var paths = [];
		for(var i=0;i<snapshotIds.length;++i){
			var id = snapshotIds[i];
			var previousId = i > 0 ? snapshotIds[i-1] : -1;
			paths.push(pathPrefix + id + '/' + previousId + '/' + key);
		}
	
		cb(undefined, snapshotIds, paths, lastVersionId);
	}
}

exports.make = function(schema, cc){

	var sh = schemaHash(schema)
	var serverStateUid = computeHash(cc.serverInstanceUid()+sh)

	var handle = {
		
		makeSyncId: function(cb){
			cc.makeSyncId(cb);
		},
		/*getViewFilesHistorical: function(viewName, params, cb){
			_.assertLength(arguments, 3)
			_.assertDefined(params)
			
			var s = schema[viewName];
			if(s === undefined) _.errout('unknown view: ' + viewName)
			
			var viewCode = s.code;
			
			//log('getting snapshots: ' + JSON.stringify(params))
			var getMsg = {typeCode: viewCode, params: newViewSequencer.paramsStr(params), isHistorical: true}
			_.assert(getMsg.params != 'null')
			var pathPrefix = serverStateUid + '/' + viewCode + '/'
			
			var key = computeSnapParamsKey(params)
			var url = pathPrefix + '-1/-1/' + key
			//cc.getSnapshots(getMsg, _.once(makeGetSnapshotsCallback(serverStateUid, s, viewCode, params, pathPrefix, cb)));
		},*/
		//returns the paths for the snapshots for the view
		getViewFiles: function(viewName, params, cb){
			_.assertLength(arguments, 3)
			_.assertDefined(params)
			
			var s = schema[viewName];
			if(s === undefined) _.errout('unknown view: ' + viewName)
			
			var viewCode = s.code;
			
			//log('getting snapshots: ' + JSON.stringify(params))
			var getMsg = {typeCode: viewCode, params: pu.paramsStr(params, s.viewSchema.params)}
			_.assert(getMsg.params != 'null')
			var pathPrefix = serverStateUid + '/' + viewCode + '/'
			cc.getSnapshots(getMsg, _.once(makeGetSnapshotsCallback(serverStateUid, s, viewCode, params, pathPrefix, cb)));
		},
		
		getViewState: function(viewName, params, cb){
			_.assertDefined(params)
			
			var s = schema[viewName];
			if(s === undefined) _.errout('unknown view: ' + viewName)
			
			var viewCode = s.code;

			var pathPrefix = serverStateUid + '/' + viewCode + '/'
			
			try{
				var req = {typeCode: viewCode, params: pu.paramsStr(params, s.viewSchema.params)}
			}catch(e){
				console.log('ERROR: failed to stringify params: ' + s.viewSchema.name + ' ' + require('util').inspect(params) + ' ' + e.stack)
				cb(e)
				return
			}
			cc.getFullSnapshot(req, function(err, resp){
				if(err){
					cb(err)
					return
				}
				
				cb(err, viewCode, b64.encodeBuffer(resp.snapshot), resp.versionId)
			})
		},
		
		//returns the javascript string content of the view file
		/*getViewFile: function(viewCode, snapshotId, previousId, paramsStr, cb){
			_.assertLength(arguments, 5)

			handle.getViewJson(viewCode, snapshotId, previousId, paramsStr, function(err, json){
				cb(err, 'gotSnapshot(' + JSON.stringify(json) + ');\n');
			})
		},*/
		/*getViewFileHistorical: function(viewCode, snapshotId, previousId, paramsStr, cb){
			_.assertLength(arguments, 5)

			handle.getViewJsonHistorical(viewCode, snapshotId, previousId, paramsStr, function(err, json){
				cb(err, 'gotSnapshot(' + JSON.stringify(json) + ');\n');
			})
		},*/
		getViewBuffer: function(viewCode, snapshotId, previousId, paramsStr, cb){
			_.assertLength(arguments, 5)
			var s = schema._byCode[viewCode];

			var parsedParams = doParseParams(paramsStr, s)
			
			var snapReq = {typeCode: viewCode, params: pu.paramsStr(parsedParams, s.viewSchema.params), latestVersionId: snapshotId, previousVersionId: previousId};
			cc.getSnapshot(snapReq, function(err, response){
				if(err){
					cb(err)
				}else{
					//response.snap.id = snapshotId;
					cb(undefined, response.snap)
				}
			});
		},
		getViewJsonHistorical: function(viewCode, snapshotId, previousId, paramsStr, cb){
			_.assertLength(arguments, 5)
			
			var s = schema._byCode[viewCode];

			var parsedParams = doParseParams(paramsStr, s)
			
			var snapReq = {isHistorical: true, typeCode: viewCode, params: pu.paramsStr(parsedParams), latestVersionId: snapshotId, previousVersionId: previousId};
			cc.getSnapshot(snapReq, function(err, response){
				if(err){
					cb(err)
				}else{
					response.snap.id = snapshotId;
					cb(undefined, response.snap)
				}
			});
		},
		
		beginSync: function(viewCode, params, snapshotId, cb, readyCb){
			_.assertFunction(readyCb);
			var req = {typeCode: viewCode, params: pu.paramsStr(params), latestSnapshotVersionId: snapshotId};
			cc.beginSync(req, cb, readyCb);
		},
		
		endSync: function(syncId){
			_.assertLength(arguments, 1);
			_.assertInt(syncId)
			cc.endSync({syncId: syncId});
		},
		
		processEdit: function(id, op, edit, syncId){
			_.assertLength(arguments, 4);
			_.assertInt(syncId);
			_.assertInt(id);
			//console.log(arguments);
			cc.persistEdit({id: id, /*path: JSON.stringify(path),*/ edit: {type: op, object: edit}, syncId: syncId}, function(result){
				//_.errout('TODO')
				//TODO notify the source sync handle of the result
			});
		}
	};
	return handle
}

