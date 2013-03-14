
var minnow = require('./../../client/client')

var _ = require('underscorem')

function poll(f){var ci=setInterval(wf,10);function wf(){if(f()){clearInterval(ci)}}}

exports.complexRemoval = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', ['Pete'], function(err, c){

				var first = false			
				poll(function(){
					//console.log(JSON.stringify(c.toJson()))
					
					if(c.matches.size() === 2){
						first = true
					}else if(first && c.matches.size() === 1){
						done()
						return true
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('empty', function(err, v){
						var a = v.make('entity', {name: 'Pete'})
						var b = v.make('entity', {name: 'Pete'})
						
						setTimeout(function(){
							b.removed.set(true)
						},200)
					})
				})
				
			})
		})
	})
}


