
var minnow = require('./../../client/client')//this is the minnow include

var _ = require('underscorem')

function poll(f){var ci=setInterval(wf,10);function wf(){if(f()){clearInterval(ci)}}}

exports.emptyArray = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', function(err, c){
			
				poll(function(){
					//console.log(JSON.stringify(c.toJson()))
					if(c.has('names') && c.names.size() === 2){
						done()
						return true
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('empty', function(err, v){
						v.make('entity')
						var n = v.make('blah')
						n.names.add('Bill')
						n.names.add('Ted')	
					})
				})
				
			})
		})
	})
}

