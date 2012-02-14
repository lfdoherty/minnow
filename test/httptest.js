
var http = require('http');
var querystring = require('querystring');

var _ = require('underscorem');

var mh = require('matterhorn');

var minnow = require('./../client/client');

var httpService = require('./../http/matterhorn_service');

var mh = require('matterhorn');

var config = {
	name: 'minnow-test',
	host: 'localhost',
	port: 8384
};

function makeParamStr(params){
	var key = '';
	for(var i=0;i<params.length;++i){
		if(i > 0) key += ';';
		key += querystring.escape(params[i]);
	}
	return key;
}

mh.prepare(config, function(local, doneCb){

	minnow.db('example', function(ex){

		var service = httpService.make(local, ex);

		local.include('minnow-service');
		
		var closeCb = doneCb(function(){
		
			var cdl = _.latch(2, function(){
				closeCb();
				ex.close();
			});
			
			http.get({
				host: 'localhost',
				port: 8384,
				path: '/mnw/snaps/example/40/-1/' + makeParamStr(['test group'])
			}, function(res){
				//console.log('got res');
				//console.log(res);
				
				_.assertDefined(res.header('Content-Length'));
				
				console.log('\n\n');
				console.log('snapshot state size is: ' + res.header('Content-Length') + ' bytes.');
				console.log('successfully got state snapshot\n\n');
				
				cdl();
			});
			
			service.getViewTags('groupevents', ['test group'], function(tagsStr){
				
				console.log('got tags str: ' + tagsStr);
				
				cdl();
			});
		});
	});
});
