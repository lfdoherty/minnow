
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

exports.name = 'test-minnow-browser';
exports.dir = __dirname;
exports.requirements = ['minnow-service'];

mh.prepare(config, function(local, doneCb){

	minnow.db('example', function(ex){

		var service = ex.makeService(local);

		var mod = ex.modify;
		mod.get('event', 0, function(h){
	
			setInterval(function(){
				h.property('time').setNow();
			}, 1000);
		});
		
		var filterPage = {
			css: [],
			js: ['examplepage'],
			title: 'View Example Test Page',
			url: '/example',
			cb: function(req, res, cb){
							
				service.getViewTags('groupevents', ['test group'], {}, cb);
			}
		};	

		app.page(exports, filterPage);

		local.include('test-minnow-browser');
		
		doneCb();
	});
});
