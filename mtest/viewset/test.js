
var minnow = require('./../../client/client')

var _ = require('underscorem')

function poll(f){var ci=setInterval(wf,10);function wf(){if(f()){clearInterval(ci)}}}

exports.addNewFromJson = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', function(c){
			
				poll(function(){
					//console.log('polling: ' + JSON.stringify(c.toJson()) + ' ' + c.has('s'))
					if(c.has('s') && c.s.size() === 1){
						var d;
						//console.log('got s to 1')
						c.s.each(function(dd){d = dd;})
						if(d.value.value() === 'test'){
							done()
							return true
						}
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('general', function(v){
						var obj = c.make('entity', {value: 'test'})
						_.assertDefined(obj)
						v.s.add(obj)
					})
				})
				
			})
		})
	})
}

