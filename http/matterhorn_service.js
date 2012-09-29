"use strict";

/*

Attaches the appropriate bits to serve the schema, with exposed views and/or objects whitelisted

Handles socket.io sockets as well.

*/

var zlib = require('zlib');


var _ = require('underscorem');

//exports.name = 'minnow-service';
//exports.dir = __dirname;
exports.module = module
//exports.requirements = ['matterhorn-standard', 'minnow-service-core'];

require('matterhorn-standard');

var matterhorn = require('matterhorn');

var serviceModule = require('./service')

var log = require('quicklog').make('minnow/matterhorn-service')

function sendData(res, data){
	res.setHeader('Content-Encoding', 'gzip');
	res.setHeader('Content-Length', data.length);
	res.setHeader('Content-Type', 'text/javascript');
	res.setHeader('Cache-Control', 'max-age=2592000');
	res.end(data);
}

exports.make = function(appName, schema, local, minnowClient, authenticator, viewSecuritySettings, clientInfoBySyncId){
	_.assertLength(arguments, 7)
	_.assertString(appName)
	_.assertFunction(authenticator)
	
	var service = require('./service').make(minnowClient.schema, minnowClient.internalClient);
	
	var snapPath = '/mnw/snaps/' + appName + '/';
	
	var simplifiedSchema = JSON.parse(JSON.stringify(minnowClient.schema))
	Object.keys(simplifiedSchema).forEach(function(key){
		if(simplifiedSchema[key].isView){
			delete simplifiedSchema._byCode[simplifiedSchema[key].code].viewSchema
			delete simplifiedSchema[key].viewSchema
		}
	})
	
	var schemaUrl;
	var schemaStr = 'gotSchema(' + JSON.stringify(simplifiedSchema) + ');'
	local.serveJavascript(exports, appName, function(ccc){
		_.assertFunction(ccc);
		schemaUrl = ccc(schemaStr);
	});
	
	//var bb = {};
	
	local.get(exports, snapPath + ':serverUid/:viewId/:snapshotId/:previousId/:params', authenticator, function(req, res){

		var viewId = parseInt(req.params.viewId);
		var viewSchema = schema._byCode[viewId]
		var viewName = viewSchema.name
		
		var securitySetting
		if(_.isFunction(viewSecuritySettings)){
			securitySetting = viewSecuritySettings.bind(undefined,viewName)
		}else{
			securitySetting = viewSecuritySettings[viewName]
		}
		if(securitySetting === undefined){
			//console.log('vss: ' + viewSecuritySettings)
			log('security policy denied access to view (view is not accessible via HTTP): ' + viewName);
			console.log('WARNING: security policy denied access to view (view is not accessible via HTTP): ' + viewName);
			res.send(404)
			return
		}		
		var params = serviceModule.parseParams(req.params.params, viewSchema)
		securitySetting(function(passed){
			if(!passed){
				log('security policy denied access to view: ' + viewName);
				console.log('WARNING: security policy denied access to view: ' + viewName);
				res.send(404)
				return
			}
			var snapshotId = parseInt(req.params.snapshotId);
	
			//we shouldn't 304 on the terminal snapshot since it may get bigger (and we'd rather send the data that way 
			//than through socket.io.)
			if(snapshotId === -1 || !matterhorn.do304IfSafe(req, res)){
	
				var previousId = parseInt(req.params.previousId);
				var paramStr = req.params.params;

				var key = viewId+':'+paramStr+':'+snapshotId+':'+previousId;
				//TODO cache zipped snapshots
		
				/*if(bb[key]){
					sendData(res, bb[key]);
					return;
				}*/
		
				service.getViewFile(viewId, snapshotId, previousId, paramStr, function(err, jsStr){
				
					if(err){
						//console.log('err: ' + JSON.stringify(err))
						console.log(new Error().stack)
						console.log('code: ' + err.code)
						if(err.code === 'InvalidParamId'){
							res.send(400, err)
						}else{
							res.send(500, err)
						}
						return
					}

					zlib.gzip(jsStr, function(err, data){
						if(err) _.errout(err);
				
						//bb[key] = data;
				
						sendData(res, data);
					});
				});
			}
		}, params, req.userToken)
	});

	
	//local.serveJavascriptFile(exports, 
	//	__dirname + '/../node_modules/socket.io/node_modules/socket.io-client/dist/socket.io.js');
	
	return {
		getViewTags: function(viewName, params, vars, res, cb){
			_.assertLength(arguments, 5);
			
			var viewSchema = minnowClient.schema[viewName]
			if(viewSchema === undefined) _.errout('no view in schema named: ' + viewName)
			var viewCode = viewSchema.code
			service.getViewFiles(viewName, params, function(err, snapshotIds, paths, lastSeenVersionId){
				
				if(err){
					console.log('view files error: ' + JSON.stringify(err))
					res.send(500)
					return
				}
				
				var result = [];
			
				vars.snapshotIds = snapshotIds;
				vars.lastId = lastSeenVersionId;
				vars.baseTypeCode = viewCode;
				vars.baseId = vars.baseTypeCode+':'+JSON.stringify(params);
				vars.applicationName = appName
				vars.mainViewParams = params
				
				for(var i=0;i<paths.length;++i){
					var p = paths[i];
					result.push(snapPath + p);
				}
			
				result.push(schemaUrl);
			
				cb(vars, result);
			});
		}
	};
}
