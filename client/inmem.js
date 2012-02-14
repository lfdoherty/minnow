"use strict";

var morlock = require('morlock');

var server = require('./../server/server');

exports.db = function(dbName, dbSchema, cb){
	
	var dir = process.cwd() + '/' + dbName;
	
	morlock.makeSmall(function(mk){

		var m = mk.application(dbName);
	
		server.make(m, dbSchema, cb);
	});
}
