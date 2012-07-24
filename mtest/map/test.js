
var minnow = require('./../../client/client')

var _ = require('underscorem')

function poll(f){var ci=setInterval(wf,10);function wf(){if(f()){clearInterval(ci)}}}

exports.put = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', function(c){
			
				poll(function(){
					if(c.has('s')){
						if(c.s.data.size() === 1){
							if(c.s.data.value('testKey') === 'testValueTwo'){
								done()
								return true
							}
						}else{
							console.log('here: ' + c.s.data.size())
						}
					}else{
						console.log('no s')
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('general', function(v){
						//console.log(''+v.setPropertyToNew)
						var obj = v.make('entity')
						v.s.set(obj)
						_.assertDefined(obj)
						_.assertDefined(obj.data)
						obj.data.put('testKey', 'testValue')
						obj.data.put('testKey', 'testValueTwo')
					})
				})
				
			})
		})
	})
}

exports.del = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', function(c){
			
				poll(function(){
					if(c.has('s') && c.s.data.size() === 1){
						if(c.s.data.value('testKey') === 'testValueTwo'){
							done()
							return true
						}
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('general', function(v){
						console.log(''+v.setPropertyToNew)
						var obj = v.make('entity')
						v.s.set(obj)
						_.assertDefined(obj)
						_.assertDefined(obj.data)
						obj.data.put('testKey', 'testValue')
						obj.data.put('testKey2', 'testValue')
						obj.data.del('testKey2')
						obj.data.put('testKey', 'testValueTwo')
					})
				})
				
			})
		})
	})
}

