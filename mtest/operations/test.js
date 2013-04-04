
var minnow = require('./../../client/client')//this is the minnow include

var _ = require('underscorem')

exports.orCombination = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', function(err, c){

				var e = c.make('entity', function(){
					e.friends.add(c.make('entity'))
					e.friends.add(c.make('entity', {truth: true}))
					e.friends.add(c.make('entity'))

					minnow.makeClient(config.port, function(otherClient){
						otherClient.view('specific', [e.id()], function(err, v){
							if(v.truly.value()){
								done()
							}else{
								done.fail()
							}
						})
					})
				})
			})
		})
	})
}

