
var minnow = require('./../../client/client')//this is the minnow include

var _ = require('underscorem')

function poll(f){var ci=setInterval(wf,10);function wf(){if(f()){clearInterval(ci)}}}

function makeWrapper(check, set){
	return function(config, done){
		minnow.makeServer(config, function(){
			minnow.makeClient(config.port, function(client){
				client.view('general', function(err, c){
			
					poll(function(){
						if(c.has('v') && check(c)){
							done()
							return true
						}
					})

					minnow.makeClient(config.port, function(otherClient){
						otherClient.view('general', function(err, v){
							var obj = v.make('entity')
							v.v.set(obj)
							set(obj)
						})
					})
				
				})
			})
		})
	}
}

exports.setInt = makeWrapper(
	function(c){return c.v.intValue.value() === 20}, 
	function(obj){obj.intValue.set(20)})
	
exports.setLong = makeWrapper(
	function(c){return c.v.longValue.value() === 20}, 
	function(obj){obj.longValue.set(20)})
	
exports.setBoolean = makeWrapper(
	function(c){return c.v.booleanValue.value() === true}, 
	function(obj){obj.booleanValue.set(true)})
	
exports.setString = makeWrapper(
	function(c){return c.v.stringValue.value() === 'test'}, 
	function(obj){obj.stringValue.set('test')})
	/*
exports.setTimestamp = makeWrapper(
	function(c){return _.isNumber(c.v.timestampValue.value())}, 
	function(obj){obj.timestampValue.setNow()})
*/

