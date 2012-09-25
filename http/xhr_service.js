
var zlib = require('zlib');
var pathModule = require('path')

var _ = require('underscorem');

//exports.name = 'minnow-xhr-service';
exports.module = module
//exports.requirements = ['matterhorn-standard', 'minnow/service-core'];

require('matterhorn-standard');

var serviceModule = require('./service')
//var longpoll = require('./longpoll')

var matterhorn = require('matterhorn');

function sendData(res, data){
	_.assertBuffer(data)
	res.setHeader('Content-Encoding', 'gzip');
	res.setHeader('Content-Length', data.length);
    res.setHeader('Content-Type', 'application/json');
	res.setHeader('Cache-Control', 'max-age=2592000');
	res.send(data);
}

var log = require('quicklog').make('minnow/xhr')

var urlModule = require('url')

exports.make = function(appName, schema, local, minnowClient, authenticator, viewSecuritySettings){//, clientInfoBySyncId){

	_.assertString(appName)
	_.assertFunction(authenticator)
	
	//console.log('auth: ' + authenticator)
	
	//log('setting up service for ' + appName + ' on port ' + local.getPort())
	
	//authenticator = authenticator || function(){return true;}
	
	var service = serviceModule.make(minnowClient.schema, minnowClient.internalClient);
	
	var snapPath = '/mnw/snapsjson/' + appName + '/';
	
	var schemaUrl;
	local.serveJson(exports, appName, function(ccc){
		_.assertFunction(ccc);
		schemaUrl = ccc(JSON.stringify(minnowClient.schema));
		//console.log('serve json: ' + schemaUrl)
	});
	
	function aa(req,res,next){
		//console.log('authenticating')
		authenticator(req,res,next)
	}
	local.get(exports, '/mnw/schema/'+appName, aa, function(req, httpRes){
		var url= 'http://'+req.headers.host+schemaUrl
		//console.log('redirected: ' + url + ' ' + JSON.stringify(req.headers))
		
		httpRes.redirect(url)
	})
	
	local.get(exports, '/mnw/meta/'+appName+'/:syncId/:viewName/:params', authenticator, function(req, httpRes){
		var viewName = req.params.viewName
		var syncId = parseInt(req.params.syncId)
		var viewSchema = schema[viewName]
		//console.log('url: ' + req.url)
		var params = serviceModule.parseParams(req.params.params, viewSchema)
		_.assert(params != null)
		_.assert(params !== 'null')
		_.assertDefined(params)
		
		//console.log('paramsStr: ' + req.params.params)
		//console.log('params: ' + JSON.stringify(params))

		var securitySetting// = viewSecuritySettings[viewName]
		if(_.isFunction(viewSecuritySettings)){
			securitySetting = viewSecuritySettings.bind(undefined,viewName)
		}else{
			securitySetting = viewSecuritySettings[viewName]
		}
		if(securitySetting === undefined){
			log('security policy denied access to view (view is not accessible via HTTP): ' + viewName);
			console.log('WARNING: security policy denied access to view (view is not accessible via HTTP - xhr): ' + viewName);
			return
		}
		securitySetting(function(passed){
			if(!passed){
				log('security policy denied access to view: ' + viewName);
				console.log('WARNING: security policy denied access to view: ' + viewName);
				return
			}
			service.getViewFiles(viewName, params, function(snapshotIds, paths, lastSeenVersionId){
				_.assertInt(lastSeenVersionId)
			
				var res = [];
		
				//clientInfoBySyncId[syncId] = [viewSchema.code, params, snapshotIds];

				for(var i=0;i<paths.length;++i){
					var p = paths[i];
					res.push(snapPath + p);
				}
			
				var vals = {
					schemaUrl: schemaUrl, 
					snapUrls: res, 
					syncId: syncId, 
					baseTypeCode: viewSchema.code, 
					lastId: lastSeenVersionId
				}
				//if(req.user.id) vals.userId = req.user.id

				var data = JSON.stringify(vals)
			
				data = new Buffer(data)
				httpRes.setHeader('Content-Type', 'application/json');
				httpRes.setHeader('Content-Length', data.length);
				httpRes.end(data)
			});
		}, params, req.userToken)
	})
	
	local.get(exports, snapPath + ':serverUid/:viewId/:snapshotId/:previousId/:params', authenticator, function(req, res){

		var viewId = parseInt(req.params.viewId);
		var viewName = schema._byCode[viewId].name
		
		var securitySetting// = viewSecuritySettings[viewName]
		if(_.isFunction(viewSecuritySettings)){
			securitySetting = viewSecuritySettings.bind(undefined,viewName)
		}else{
			securitySetting = viewSecuritySettings[viewName]
		}
		if(securitySetting === undefined){
			log('security policy denied access to view (view is not accessible via HTTP): ' + viewName);
			console.log('WARNING: security policy denied access to view (view is not accessible via HTTP): ' + viewName);
			return
		}
			
		var viewSchema = schema[viewName]
		var params = serviceModule.parseParams(req.params.params, viewSchema)
			
		securitySetting(function(passed){
			if(!passed){
				log('security policy denied access to view: ' + viewName);
				console.log('WARNING: security policy denied access to view: ' + viewName);
				return
			}

			var snapshotId = parseInt(req.params.snapshotId);
	
			//we shouldn't 304 on the terminal snapshot since it may get bigger (and we'd rather send the data that way 
			//than through updates
			if(snapshotId === -1 || !matterhorn.do304IfSafe(req, res)){
	
				var previousId = parseInt(req.params.previousId);
				var paramStr = req.params.params;

				var key = viewId+':'+paramStr+':'+snapshotId+':'+previousId;
				//TODO cache zipped snapshots
		
				service.getViewJson(viewId, snapshotId, previousId, paramStr, function(err, json){
					if(err){
						if(err.code === 'InvalidParamId'){
							res.send(400, JSON.stringify(err))
						}else{
							res.send(500, err)
						}
						return
					}

					var jsStr = JSON.stringify(json)
					
					//res.setHeader('Content-Encoding', 'gzip');
					res.setHeader('Content-Length', Buffer.byteLength(jsStr));
					res.setHeader('Content-Type', 'application/json');
					res.setHeader('Cache-Control', 'max-age=2592000');
					res.send(jsStr);
					
					//zlib.gzip(jsStr, function(err, data){
					//	if(err) _.errout(err);

						//sendData(res, data);
					//});
				});
			}
		}, params, req.userToken);
	})
	log('minnow xhr service set up');
	
}
