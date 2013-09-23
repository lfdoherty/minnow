/*

This is an XHR-based version of the minnow browser client.

It uses long polling for server push.

*/

var _ = require('underscorem')

var update = require('./minnow_update_websocket')

var getJson = require('./bxhr').getJson

exports.setup = setup

function setup(host, appName, cb){
    if(typeof(cb) !== 'function') throw new Error('setup(token, hostStr, schemaName, cb) - cb must be a function')
	_.assertString(host)
	
	function errCb(err){
		throw err
	}
	
	function closeCb(){
		console.log('got close cb')
	}
	
	getJson(host+'/mnw/schema/'+appName, function(schema){
		schema._byCode = {}
		Object.keys(schema).forEach(function(key){
			var obj = schema[key]
			schema._byCode[obj.code] = obj
		})
		//appName, host, cb, errCb, closeCb
		update.openSocket(appName, host, function(f){
			//console.log('got f')
			f(schema, cb)
		}, errCb, closeCb)
	})
}



