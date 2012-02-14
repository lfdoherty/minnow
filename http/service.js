"use strict";

var querystring = require('querystring');

var _ = require('underscorem');

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
			//var objSchema = schema[p.type.object];
			//pv = [objSchema.code, pv];
		}else{
			_.errout('TODO: ' + JSON.stringify(p));
		}
		result.push(pv);
	}
	return result;
}

exports.make = function(schema, cc){
	return {
		
		getSyncId: function(cb){
			cc.getSyncId(cb);
		},
		//returns the paths for the snapshots for the view
		getViewFiles: function(viewName, params, cb){
			var s = schema[viewName];
			var viewCode = s.code;
			
			cc.getSnapshots(viewCode, params, function(snapshotIds, lastVersionId){
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
						paths.push(cc.serverInstanceUid() + '/' + viewCode + '/' + id + '/' + previousId + '/' + key);
					}
				
					cc.getSyncId(function(syncId){
						cb(snapshotIds, paths, syncId, lastVersionId);
					});
				}
			});
		},
		
		//returns the javascript string content of the view file
		getViewFile: function(viewCode, snapshotId, previousId, paramsStr, cb){

			var s = schema._byCode[viewCode];

			var parsedParams;
			//console.log('paramsStr: ' + paramsStr);
			if(s.isView){
				var params = paramsStr.split(';');
				for(var i=0;i<params.length;++i){
					params[i] = querystring.unescape(params[i]);
				}
				parsedParams = parseParams(s.viewSchema, params);
			}else{
				parsedParams = parseInt(paramsStr);
			}
			
			//console.log('got blah: ' + JSON.stringify(params));

			
			cc.getSnapshot(viewCode, parsedParams, snapshotId, previousId, function(snap){
				snap.id = snapshotId;
				cb('gotSnapshot(' + JSON.stringify(snap) + ');\n');
			});
		},
		
		beginSync: function(viewCode, params, snapshotId, cb, readyCb){
			_.assertFunction(readyCb);
			cc.beginSync(viewCode, params, snapshotId, cb, readyCb);
		},
		endSync: function(viewCode, params, cb){
			cc.endSync(viewCode, params, cb);
		},
		
		processEdit: function(typeCode, id, path, edit, syncId){
			_.assertLength(arguments, 5);
			_.assertInt(syncId);
			_.assertInt(typeCode);
			//console.log(arguments);
			cc.persistEdit(typeCode, id, path, edit, syncId);
		}
	};
}
