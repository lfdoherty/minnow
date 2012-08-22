"use strict";

var querystring = require('querystring');

var _ = require('underscorem');

var log = require('quicklog').make('minnow/service')

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


function parseParams(schema, params){
	var ps = schema.params;
	var result = [];
	for(var i=0;i<ps.length;++i){
		var p = ps[i];
		var pv = params[i];
		
		if(p.type.type === 'set'){
			if(pv.length === 0) pv = [];
			else pv = pv.split(',');
		}else if(p.type.type === 'primitive'){
			if(p.type.primitive === 'int'){
				pv = parseInt(pv);
			}else if(p.type.primitive === 'string'){
			}else{
				_.errout('TODO: ' + JSON.stringify(p));
			}
		}else if(p.type.type === 'object'){
			pv = parseInt(pv);
		}else{
			_.errout('TODO: ' + JSON.stringify(p));
		}
		result.push(pv);
	}
	return result;
}

function doParseParams(paramsStr, s){
	if(paramsStr === '-') return []
	
	var parsedParams;
	if(s.isView){
		var params = paramsStr.split(';');
		for(var i=0;i<params.length;++i){
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
		e.params.forEach(function(ep){
			s += viewExprHash(ep)
		})
	}else if(e.type === 'value'){
		s += JSON.stringify(e.value)
	}else if(e.type === 'array'){
		s += JSON.stringify(e.value)
	}else if(e.type === 'int'){
		s += JSON.stringify(e.value)
	}else if(e.type === 'macro'){
		s += viewExprHash(e.expr)
	}else if(e.type === 'param'){
		//console.log('e: ' + JSON.stringify(e))
		_.assertObject(e.schemaType)
		s += JSON.stringify(e.schemaType)
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
		_.each(sch.properties, function(p){
			s += p.code+','
			if(sch.isView){
				var v = sch.viewSchema
				var vr = v.rels[p.name]
				_.assertObject(vr.schemaType)
				s += viewExprHash(vr)
			}
		})
	})
	return s
}
exports.make = function(schema, cc){

	var sh = schemaHash(schema)
	var serverStateUid = computeHash(cc.serverInstanceUid()+sh)

	var handle = {
		
		makeSyncId: function(cb){
			cc.makeSyncId(cb);
		},
		//returns the paths for the snapshots for the view
		getViewFiles: function(viewName, params, cb){
			_.assertLength(arguments, 3)
			_.assertDefined(params)
			
			var s = schema[viewName];
			if(s === undefined) _.errout('unknown view: ' + viewName)
			
			var viewCode = s.code;
			
			log('getting snapshots: ' + JSON.stringify(params))
			var getMsg = {typeCode: viewCode, params: JSON.stringify(params)}
			_.assert(getMsg.params != 'null')
			cc.getSnapshots(getMsg, _.once(function(e){

				var snapshotIds = e.snapshotVersionIds.concat([-1]);
				var lastVersionId = snapshotIds[snapshotIds.length-2]//e.lastVersionId;
				//console.log(JSON.stringify(e))
				_.assertInt(lastVersionId)

				if(arguments.length === 0){
					cb();
				}else{
					var key;

					if(s.isView){
						key = '';
						for(var i=0;i<params.length;++i){
							if(i > 0) key += ';';
							key += querystring.escape(params[i]);
						}
					}else{
						key = params+'';
					}
				
					var paths = [];
					for(var i=0;i<snapshotIds.length;++i){
						var id = snapshotIds[i];
						var previousId = i > 0 ? snapshotIds[i-1] : -1;
						paths.push(serverStateUid + '/' + viewCode + '/' + id + '/' + previousId + '/' + key);
					}
				
					cb(snapshotIds, paths, lastVersionId);
				}
			}));
		},
		
		//returns the javascript string content of the view file
		getViewFile: function(viewCode, snapshotId, previousId, paramsStr, cb){

			handle.getViewJson(viewCode, snapshotId, previousId, paramsStr, function(json){
				cb('gotSnapshot(' + JSON.stringify(json) + ');\n');
			})
		},
		getViewJson: function(viewCode, snapshotId, previousId, paramsStr, cb){
			var s = schema._byCode[viewCode];

			var parsedParams = doParseParams(paramsStr, s)
			//console.log('paramsStr: ' + paramsStr);
			
			//console.log('got blah: ' + JSON.stringify(params));

			
			var snapReq = {typeCode: viewCode, params: JSON.stringify(parsedParams), latestVersionId: snapshotId, previousVersionId: previousId};
			cc.getSnapshot(snapReq, function(response){
				response.snap.id = snapshotId;
				cb(response.snap)
			});
		},
		
		beginSync: function(viewCode, params, snapshotId, cb, readyCb){
			_.assertFunction(readyCb);
			var req = {typeCode: viewCode, params: JSON.stringify(params), latestSnapshotVersionId: snapshotId};
			cc.beginSync(req, cb, readyCb);
		},
		
		endSync: function(syncId){
			_.assertLength(arguments, 1);
			_.assertInt(syncId)
			cc.endSync({syncId: syncId});
		},
		
		processEdit: function(id, path, op, edit, syncId){
			_.assertLength(arguments, 5);
			_.assertInt(syncId);
			_.assertInt(id);
			//console.log(arguments);
			cc.persistEdit({id: id, path: JSON.stringify(path), edit: {type: op, object: edit}, syncId: syncId}, function(result){
				//_.errout('TODO')
				//TODO notify the source sync handle of the result
			});
		}
	};
	return handle
}

