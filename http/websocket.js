"use strict";

var _ = require('underscorem')

exports.module = module

var fs = require('fs')

//var log = require('quicklog').make('minnow/longpoll')

var abstract = require('./abstract')
var websocketImpl = require('./websocket_impl')


exports.load = function(local, urlPrefix, schema, authenticateByToken, viewSecuritySettings, minnowClient, syncHandleCreationListener){

	_.assertFunction(minnowClient.make)
	
	if(syncHandleCreationListener !== undefined) _.assertFunction(syncHandleCreationListener)

	var impl = websocketImpl.make(authenticateByToken, local, urlPrefix)

	abstract.load(schema, viewSecuritySettings, minnowClient, syncHandleCreationListener, impl)
}
