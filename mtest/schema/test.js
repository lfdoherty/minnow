
var minnow = require('./../../client/client')//this is the minnow include

var _ = require('underscorem')

exports.nestedMacroBugCheck = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', function(err, c){
			
				done.poll(function(){
					/*if(c.has('v') && c.v.value() === 'entity'){
						done()
						return true
					}*/
					if(c.mapping.count() === 1){
						done()
						return true
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('empty', function(err, v){
						//v.make('entity')
						var e = c.make('entity', {})
						var hash = 'a'+Math.random()
						c.make('wrap', {parentEntity: e, hash: hash})
						c.make('wrapwrap', {parentHash: hash, name: 'billy'})
					})
				})
				
			})
		})
	})
}
