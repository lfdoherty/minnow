
var minnow = require('./../../client/client')//this is the minnow include

var _ = require('underscorem')

exports.falseValueCopy = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', function(err, c){
			
				done.poll(function(){
					if(c.has('e')){
						_.assertNot(c.e.state.value())
						done()
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('empty', function(err, v){
						var e = v.make('entity', {text: 'test1', state: true}, function(){
							var nv = e.copy({state: false})
							
							_.assertNot(nv.state.value())
						})
						
					})
				})
				
			})
		})
	})
}

exports.copySource = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('sourcing', function(err, c){
			
				done.poll(function(){
					if(c.has('e')){
						console.log('e: ' + JSON.stringify(c.e.toJson()))
						//console.log(JSON.stringify(c.m.toJson()))
						_.assertNot(c.e.state.value())
						done()
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('empty', function(err, v){
						var e = v.make('entity', {text: 'test1', state: true}, function(){
							var nv = e.copy({state: false})
							
							_.assertNot(nv.state.value())
						})
						
					})
				})
				
			})
		})
	})
}
