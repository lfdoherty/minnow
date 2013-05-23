
var fs = require('fs')
var path = require('path')

var file_matcher = /\.js$/;

var _ = require('underscorem')

var rimraf = require('rimraf')
var mh = require('matterhorn');

var start = Date.now()

var minnow = require('./../client/client')
var minnowXhr = require('./../http/js/minnow_xhr')

require('./../http/js/api/topobject').prototype.errorOnWarn = true
/*
try{
var agent = require('webkit-devtools-agent');
}catch(e){
	//throw e
	console.log(e)
}*/
/*
var count = 0
var old = console.log
console.log = function(msg){
	msg = ''+msg
	if(msg.indexOf('Error') === -1 && msg.indexOf('test ') === -1 && msg.indexOf('WARNING') === -1 && count > 0){
		console.log(new Error().stack)
		//throw new Error()
	}
	++count
	old(msg)
}
*/


var oldMakeClient = minnow.makeClient
var oldMakeServer = minnow.makeServer

require('./runtests_abstract').run(
	function(port, host, cb){
		oldMakeClient(port, host, cb)
	},
	function(config, cb){
		oldMakeServer(config, function(server){
			cb(server)
		})
	}
)

