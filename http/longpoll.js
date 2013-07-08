"use strict";

var _ = require('underscorem')

exports.module = module

var fs = require('fs')

//var log = require('quicklog').make('minnow/longpoll')

var abstract = require('./abstract')
var longpollImpl = require('./longpoll_impl')

exports.load = function(app, appName, prefix, schema, identifier, viewSecuritySettings, minnowClient, listeners){

	_.assertString(appName)
	_.assertFunction(minnowClient.make)
	
	//if(syncHandleCreationListener !== undefined) _.assertFunction(syncHandleCreationListener)

	var impl = longpollImpl.make(app, appName, prefix, identifier)

	abstract.load(schema, viewSecuritySettings, minnowClient, listeners, impl)
}
