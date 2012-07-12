
var minnow = require('./../../client/client')

var _ = require('underscorem')

function poll(f){var ci=setInterval(wf,10);function wf(){if(f()){clearInterval(ci)}}}

var N = 1000*100

/*
exports.count = function(dir, serverDir, port, done){
	
	minnow.makeServer(dir, serverDir, port, function(server){
		minnow.makeClient(port, function(client){
			client.view('general', function(c){
			
				poll(function(){
					if(c.c.value() === N){
						client.close(function(){
							server.close(function(){
								console.log('got all closed')
								done()
							})
						})
						return true
					}
				})

				minnow.makeClient(port, function(otherClient){
					otherClient.view('general', function(v){
						for(var i=0;i<N;++i){
							v.make('entity', true)
						}
					})
				})
				
			})
		})
	})
}*/

function rand(n){return Math.floor(Math.random()*n)}

function testAgeThreshold(minnow, port, done){
	return function(c){
			
		poll(function(){
			console.log('adults: ' + c.oldEnough.size())
			if(c.oldEnough.size() === (N/9)){
				done()
				return true
			}
		})

		minnow.makeClient(port, function(otherClient){
			otherClient.view('general', function(v){
				for(var i=0;i<N;++i){
					v.make('entity', {age: rand(20)})
				}
			})
		})
		
	}
}

exports.parameterizeEachFiltered = function(dir, serverDir, port, done){
	minnow.makeServer(dir, serverDir, port, function(){
		minnow.makeClient(port, function(client){
			client.view('specific', [18], testAgeThreshold(minnow, port, done))
		})
	})
}

