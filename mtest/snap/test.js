
var minnow = require('./../../client/client')//this is the minnow include

var _ = require('underscorem')

exports.basic = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('empty', function(err, c){

				c.make('entity')
			
				minnow.makeClient(config.port, function(otherClient){
					otherClient.snap('general', function(err, v){
						_.assertEqual(v.entities.count(), 1)
						done()
					})
				})
				
			})
		})
	})
}

