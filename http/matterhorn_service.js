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
var newViewSequencer = require('./../server/new_view_sequencer')

function sendData(req, res, data, zippedData){
	var compHeader = req.header('Accept-Encoding');
	res.setHeader('Content-Type', 'text/javascript');
	res.setHeader('Cache-Control', 'max-age=2592000');
	if(compHeader && compHeader.indexOf('gzip') !== -1){
		//console.log('sending zipped 
		res.setHeader('Content-Encoding', 'gzip');
		res.setHeader('Content-Length', zippedData.length);
		res.end(zippedData);
	}else{	
		res.setHeader('Content-Length', data.length);
		res.end(data);
	}
}

exports.make = function(prefix, appName, schema, local, secureLocal, minnowClient, authenticator, viewSecuritySettings, clientInfoBySyncId){
	_.assertLength(arguments, 9)
	_.assertString(appName)
	_.assertFunction(authenticator)
	
	var service = require('./service').make(minnowClient.schema, minnowClient.internalClient);
	
	var snapPath = '/mnw/snaps/' + appName + '/';
	//var snapPathHistorical = '/mnw/snaps_historical/' + appName + '/';
	
	//var simplifiedSchema = JSON.parse(JSON.stringify(minnowClient.schema))
	var simplifiedSchema = {}
	Object.keys(minnowClient.schema).forEach(function(key){
		if(key === '_byCode') return
		var cur = simplifiedSchema[key] = {}
		var from = minnowClient.schema[key]
		Object.keys(from).forEach(function(kk){
			if(kk === 'viewSchema') return
			cur[kk] = from[kk]
		})
	})
	simplifiedSchema = JSON.parse(JSON.stringify(simplifiedSchema))
	/*Object.keys(simplifiedSchema).forEach(function(key){
		delete simplifiedSchema[key].viewSchema
	})*/
	//require('fs').writeFileSync('schema.txt', JSON.stringify(simplifiedSchema, null, 2))
	
	var schemaUrl;
	var schemaStr = 'gotSchema(' + JSON.stringify(simplifiedSchema) + ');'
	function generateSchemaUrl(ccc){
		_.assertFunction(ccc);
		schemaUrl = ccc(schemaStr);
	}
	local.serveJavascript(exports, appName, generateSchemaUrl);
	secureLocal.serveJavascript(exports, appName, generateSchemaUrl);
	
	function generateSnapHistorical(req, res){
		generateSnapInner(req, res, function(viewId, snapshotId, previousId, paramStr, cb){
			service.getViewFileHistorical(viewId, snapshotId, previousId, paramStr, cb)
		})	
	}
	function generateSnap(req, res){
		generateSnapInner(req, res, service.getViewFile)
	}
	function generateSnapInner(req, res, getViewFile){
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
		
				getViewFile(viewId, snapshotId, previousId, paramStr, function(err, jsStr){
				
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
				
						sendData(req, res, jsStr, data);
					});
				});
			}
		}, params, req.userToken)
	}
	local.get(snapPath + ':serverUid/:viewId/:snapshotId/:previousId/:params', authenticator, generateSnap);
	secureLocal.get(snapPath + ':serverUid/:viewId/:snapshotId/:previousId/:params', authenticator, generateSnap);
	//local.get(snapPathHistorical + ':serverUid/:viewId/:snapshotId/:previousId/:params', authenticator, generateSnapHistorical);
	//secureLocal.get(snapPathHistorical + ':serverUid/:viewId/:snapshotId/:previousId/:params', authenticator, generateSnapHistorical);

	
	//local.serveJavascriptFile(exports, 
	//	__dirname + '/../node_modules/socket.io/node_modules/socket.io-client/dist/socket.io.js');
	
	return {
		/*getViewTagsHistorical: function(viewName, params, vars, res, cb){
			_.assertLength(arguments, 5);
			
			console.log('getting view tags historical')
			
			var viewSchema = minnowClient.schema[viewName]
			if(viewSchema === undefined) _.errout('no view in schema named: ' + viewName)
			var viewCode = viewSchema.code
			//var historicalKey = 'historical_'+Math.random()
			service.getViewFilesHistorical(viewName, params, function(err, snapshotIds, paths, lastSeenVersionId){
				
				if(err){
					console.log('view files error: ' + JSON.stringify(err))
					res.send(500)
					return
				}
				
				var result = [];

				console.log('got historical paths:  ' + JSON.stringify(paths))
			
				vars.snapshotIds = snapshotIds;
				vars.lastId = lastSeenVersionId;
				vars.baseTypeCode = viewCode;
				vars.baseId = newViewSequencer.viewIdStr(vars.baseTypeCode,params)//vars.baseTypeCode+':'+newViewSequencer.paramsStr(params)//JSON.stringify(params);
				vars.applicationName = appName
				//vars.mainViewParams = params
				vars.mainViewHistorical = true
				
				vars.UrlPrefix = prefix
				//vars.httpPort = local.getPort()
				//vars.httpsPort = secureLocal.getSecurePort()
				
				for(var i=0;i<paths.length;++i){
					var p = paths[i];
					result.push(snapPathHistorical + p);
				}
			
				result.push(schemaUrl);
			
				cb(vars, result);
			});
		},*/
		getViewState: function(viewName, params, vars, res, cb){
			_.assertLength(arguments, 5);

			var viewSchema = minnowClient.schema[viewName]
			if(viewSchema === undefined) _.errout('no view in schema named: ' + viewName)
			var viewCode = viewSchema.code

			//TODO convert inner id strings to innerify objects
			var newParams = []
			viewSchema.viewSchema.params.forEach(function(p, index){
				if(p.type.type === 'object'){
					var id = params[index]
					if(_.isString(id)){
						newParams[index] = newViewSequencer.parseInnerId(id)
					}else{
						newParams[index] = id
					}
				}else{
					//console.log(JSON.stringify(p.type))
					newParams[index] = params[index]
				}
			})
			//_.errout('TODO')
			params = newParams

			//if(params.length === 4 && _.isString(params[3]) && params[3] === '54_39') _.errout('FIXME: ' + JSON.stringify(params))
			
			service.getViewState(viewName, params, function(err, baseTypeCode, snap, lastSeenVersionId){
			
				if(err){
					console.log('view files error: ' + JSON.stringify(err))
					res.send(500)
					return
				}
				
				var result = [];
			
				vars.snapshotIds = [lastSeenVersionId]
				vars.lastId = lastSeenVersionId;
				vars.baseTypeCode = viewCode;
				vars.baseId = newViewSequencer.viewIdStr(baseTypeCode,params)
				vars.applicationName = appName
				vars.UrlPrefix = prefix
				vars.minnowSnap = snap//JSON.parse(snap)
			
				cb(vars, [schemaUrl])
			})
		},
		getViewTags: function(viewName, params, vars, res, cb){
			_.assertLength(arguments, 5);

			var viewSchema = minnowClient.schema[viewName]
			if(viewSchema === undefined) _.errout('no view in schema named: ' + viewName)
			var viewCode = viewSchema.code

			var newParams = []
			viewSchema.viewSchema.params.forEach(function(p, index){
				if(p.type.type === 'object'){
					var id = params[index]
					if(_.isString(id)){
						newParams[index] = newViewSequencer.parseInnerId(id)
					}else{
						newParams[index] = id
					}
				}else{
					//console.log(JSON.stringify(p.type))
					newParams[index] = params[index]
				}
			})

			params = newParams

			if(params.length === 4 && _.isString(params[3]) && params[3] === '54_39') _.errout('FIXME: ' + JSON.stringify(params))
			
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
				vars.baseId = newViewSequencer.viewIdStr(vars.baseTypeCode,params)
				vars.applicationName = appName
				vars.UrlPrefix = prefix
				
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
