
var minnow = require('./../../client/client')//this is the minnow include

exports.includeReference = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', function(err, c){
			
				done.poll(function(){
					if(c.has('s') && 
						c.s.ref.isDefined() && 
						c.s.ref.name.value() === 'test name'){
						
						done()
						return true
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('general', function(err, v){

						var e = v.make('entity')
						var second = v.make('secondary', {name: 'test name'})
						e.setProperty('ref', second)
					})
				})
				
			})
		})
	})
}

