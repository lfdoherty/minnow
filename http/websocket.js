"use strict";

var _ = require('underscorem')

//exports.name = 'minnow-service-core';
//exports.dir = __dirname;
exports.module = module
//exports.requirements = ['matterhorn-standard'];

var fs = require('fs')

//var log = require('quicklog').make('minnow/longpoll')

var abstract = require('./abstract')
var websocketImpl = require('./websocket_impl')


exports.load = function(local, schema, authenticateByToken, viewSecuritySettings, minnowClient, syncHandleCreationListener){

	_.assertFunction(minnowClient.make)
	
	if(syncHandleCreationListener !== undefined) _.assertFunction(syncHandleCreationListener)

	var impl = websocketImpl.make(authenticateByToken, local)

	abstract.load(schema, viewSecuritySettings, minnowClient, syncHandleCreationListener, impl)//app, appName, schema, authenticateByToken, viewSecuritySettings, minnowClient, syncHandleCreationListener, impl)
}
