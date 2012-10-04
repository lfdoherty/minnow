
var minnow = require('./../../client/client')

var _ = require('underscorem')

function poll(f){var ci=setInterval(wf,10);function wf(){if(f()){clearInterval(ci)}}}

exports.append = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', function(err, c){
			
				poll(function(){
				//	console.log(c.has('s'))
					if(c.has('s') && c.s.data.size() === 1){
						done()
						return true
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('general', function(err, v){
						var obj = v.make('entity')
						v.s.set(obj)
						_.assertDefined(obj)
						_.assertDefined(obj.data)
						obj.data.add('test')
					})
				})
				
			})
		})
	})
}

exports.remove = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', function(err, c){
			
				var hasRemoved = false
				poll(function(){
				//	console.log(c.has('s'))
					if(c.has('s') && c.s.data.size() === 1){
						c.s.data.remove('test')
						hasRemoved = true
					}else if(hasRemoved && c.s.data.size() === 0){
						done()
						return true
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('general', function(err, v){
						var obj = v.make('entity')
						v.s.set(obj)
						_.assertDefined(obj)
						_.assertDefined(obj.data)
						obj.data.add('test')
					})
				})
				
			})
		})
	})
}


exports.removeNonexistent = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', function(err, c){
			
				var hasRemoved = false
				poll(function(){
					if(c.has('s') && c.s.data.size() === 2){
						c.s.data.remove('test')
						hasRemoved = true
					}else if(hasRemoved && c.s.data.size() === 0){
						done()
						return true
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('general', function(err, v){
						var obj = v.make('entity')
						v.s.set(obj)
						_.assertDefined(obj)
						_.assertDefined(obj.data)
						obj.data.add('test')
						obj.data.add('test2')
						setTimeout(function(){
							obj.data.remove('test')
							obj.data.remove('test2')
						},200)
					})
				})
				
			})
		})
	})
}

