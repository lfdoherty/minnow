/*

This is an XHR-based version of the minnow browser client.

It uses long polling for server push.

*/

var _ = require('underscorem')

var update = require('./minnow_update')

var getJson = require('./bxhr').getJson

var timers = require('timers')

exports.setup = setup

function setup(host, appName, cb, errCb){
    if(typeof(cb) !== 'function') throw new Error('setup(token, hostStr, schemaName, cb) - cb must be a function')

	function tryToConnect(){
		getJson(host+'/mnw/schema/'+appName, function(schema){
			console.log('got json')
			update.establishSocket(appName, schema, host, cb, errCb)
		}, function(){
			console.log('get json failed, retrying in 1 second')
			timers.setTimeout(tryToConnect, 1000)
		})
	}
	
	tryToConnect()
}



