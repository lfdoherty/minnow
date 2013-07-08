"use strict";

var _ = require('underscorem')

exports.module = module

var fs = require('fs')

//var log = require('quicklog').make('minnow/longpoll')

var abstract = require('./abstract')
var websocketImpl = require('./websocket_impl')


exports.load = function(local, urlPrefix, schema, authenticateByToken, viewSecuritySettings, minnowClient, listeners){

	_.assertFunction(minnowClient.make)
	
	//if(syncHandleCreationListener !== undefined) _.assertFunction(syncHandleCreationListener)

	var impl = websocketImpl.make(authenticateByToken, local, urlPrefix, listeners)

	abstract.load(schema, viewSecuritySettings, minnowClient, listeners, impl)
}
