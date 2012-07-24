
var minnow = require('./../../client/client')//this is the minnow include

function poll(f){var ci=setInterval(wf,10);function wf(){if(f()){clearInterval(ci)}}}

exports.includeReference = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', function(c){
			
				poll(function(){
					if(c.has('s') && 
						c.s.ref.isDefined() && 
						c.s.ref.name.value() === 'test name'){
						
						done()
						return true
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('general', function(v){

						var e = v.make('entity')
						var second = v.make('secondary', {name: 'test name'})
						e.ref.set(second)
					})
				})
				
			})
		})
	})
}

