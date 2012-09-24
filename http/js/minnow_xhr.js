/*

This is an XHR-based version of the minnow browser client.

It uses long polling for server push.

*/

var _ = require('underscorem')

var update = require('./minnow_update')

var getJson = require('./xhr').getJson

exports.setup = setup

function setup(host, appName, cb){
    if(typeof(cb) !== 'function') throw new Error('setup(token, hostStr, schemaName, cb) - cb must be a function')

	getJson(host+'/mnw/schema/'+appName, function(schema){
		update.establishSocket(appName, schema, host, cb)
	})
}



