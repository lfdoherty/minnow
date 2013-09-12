
var minnow = require('./../../client/client')//this is the minnow include

var _ = require('underscorem')

var seedrandom = require('seedrandom')

function makeWrapper(check, set){
	return function(config, done){
		minnow.makeServer(config, function(){
			minnow.makeClient(config.port, function(client){
				client.view('general', function(err, c){
			
					done.poll(function(){
						//console.log(c.has('v') + ' ')// + (c.v.intValue.value() === 20))
						if(c.has('v') && check(c)){	
							//console.log('doin')
							done()
							return true
						}
					})

					minnow.makeClient(config.port, function(otherClient){
						otherClient.view('general', function(err, v){
							var obj = v.make('entity')
							v.setProperty('v',obj)
							set(obj)
						})
					})
				
				})
			})
		})
	}
}

exports.setInt = makeWrapper(
	function(c){console.log(JSON.stringify(c.toJson()));return c.v.intValue.value() === 20}, 
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

var uuid = seedrandom.uid()//'ABABABABABABABABABABAB'
exports.setUuid = makeWrapper(
	function(c){return c.v.uuidValue.value()+'' === uuid}, 
	function(obj){obj.uuidValue.set(uuid)})


exports.insertStringBack = makeWrapper(
	function(c){return c.v.stringValue.value() === 'testB'}, 
	function(obj){
		obj.stringValue.set('test')
		obj.stringValue.set('testB')
	})
exports.insertStringFront = makeWrapper(
	function(c){return c.v.stringValue.value() === 'Btest'}, 
	function(obj){
		obj.stringValue.set('test')
		obj.stringValue.set('Btest')
	})

exports.insertStringMiddle = makeWrapper(
	function(c){return c.v.stringValue.value() === 'teBst'}, 
	function(obj){
		obj.stringValue.set('test')
		obj.stringValue.set('teBst')
	})

	/*
exports.setTimestamp = makeWrapper(
	function(c){return _.isNumber(c.v.timestampValue.value())}, 
	function(obj){obj.timestampValue.setNow()})
*/

