
var zlib = require('zlib');
var pathModule = require('path')

var _ = require('underscorem');

exports.name = 'minnow-xhr-service';
exports.module = module
exports.requirements = ['matterhorn-standard', 'minnow-service-core'];

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

var log = require('quicklog').make('minnow-xhr')

exports.make = function(appName, schema, local, minnowClient, authenticator, viewSecuritySettings, clientInfoBySyncId){

	_.assertString(appName)
	_.assertFunction(authenticator)
	
	//log('loading xhr')
	
	//authenticator = authenticator || function(){return true;}
	
	var service = serviceModule.make(minnowClient.schema, minnowClient.internalClient);
	
	var snapPath = '/mnw/snapsjson/' + appName + '/';
	
	var schemaUrl;
	local.serveJson(exports, appName, function(ccc){
		_.assertFunction(ccc);
		schemaUrl = ccc(JSON.stringify(minnowClient.schema));
	});
	
	local.get(exports, '/mnw/schema/'+appName, authenticator, function(req, httpRes){

		var json = JSON.stringify(schemaUrl)
		var data = new Buffer(json)
		httpRes.setHeader('Content-Type', 'application/json');
		httpRes.setHeader('Content-Length', data.length);
		httpRes.end(data)
	})
	
	local.get(exports, '/mnw/meta/'+appName+'/:syncId/:viewName/:params', authenticator, function(req, httpRes){

		var viewName = req.params.viewName
		var syncId = parseInt(req.params.syncId)
		var viewSchema = schema[viewName]
		var params = serviceModule.parseParams(req.params.params, viewSchema)
		_.assert(params != null)
		_.assert(params !== 'null')
		_.assertDefined(params)
		
		//console.log('paramsStr: ' + req.params.params)
		//console.log('params: ' + JSON.stringify(params))

		var securitySetting = viewSecuritySettings[viewName]
		if(securitySetting === undefined){
			log('security policy denied access to view (view is not accessible via HTTP): ' + viewName);
			return
		}
		securitySetting(function(passed){
			if(!passed){
				log('security policy denied access to view: ' + viewName);
				return
			}
			service.getViewFiles(viewName, params, function(snapshotIds, paths, lastSeenVersionId){
				_.assertInt(lastSeenVersionId)
			
				var res = [];
		
				clientInfoBySyncId[syncId] = [viewSchema.code, params, snapshotIds];

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
				if(req.user.id) vals.userId = req.user.id

				var data = JSON.stringify(vals)
			
				data = new Buffer(data)
				httpRes.setHeader('Content-Type', 'application/json');
				httpRes.setHeader('Content-Length', data.length);
				httpRes.end(data)
			});
		}, params, req)
	})
	
	local.get(exports, snapPath + ':serverUid/:viewId/:snapshotId/:previousId/:params', authenticator, function(req, res){

		var viewId = parseInt(req.params.viewId);
		var viewName = schema._byCode[viewId].name
		
		var securitySetting = viewSecuritySettings[viewName]
		if(securitySetting === undefined){
			log('security policy denied access to view (view is not accessible via HTTP): ' + viewName);
			return
		}
			
		var viewSchema = schema[viewName]
		var params = serviceModule.parseParams(req.params.params, viewSchema)
			
		securitySetting(function(passed){
			if(!passed){
				log('security policy denied access to view: ' + viewName);
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
		
				service.getViewJson(viewId, snapshotId, previousId, paramStr, function(json){

					var jsStr = JSON.stringify(json)
							
					zlib.gzip(jsStr, function(err, data){
						if(err) _.errout(err);
				
						sendData(res, data);
					});
				});
			}
		}, params, req);
	})
	log('minnow xhr service set up');
	
}
