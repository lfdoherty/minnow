
var minnow = require('./../../client/client')//this is the minnow include

exports.connect = function(config, done){
	minnow.makeServer(config, function(){
		//console.log('made server')
		minnow.makeClient(config.port, function(c){
			done()
		})
	})
}

exports.view = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(c){
			c.view('general', [], function(handle){
				done()
			})
		})
	})
}

exports.viewReuse = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(c){
			c.view('general', [], function(handle){
				c.view('general', [], function(otherHandle){
					if(handle !== otherHandle) throw new Error('a request for the same view with same parameters should return the same handle')
					done()
				})
			})
		})
	})
}

exports.serverShutdown = function(config, done){
	minnow.makeServer(config, function(s){
		s.close(function(){
			done()
		})
	})
}

exports.restart = function(config, done){
	minnow.makeServer(config, function(s){
		s.close(function(){
			minnow.makeServer(config, function(s){
				done()
			})
		})
	})
}

exports.clientRestart = function(config, done){
	minnow.makeServer(config, function(s){
		minnow.makeClient(config.port, function(c){
			c.close(function(){
				//console.log('closed client')
				s.close(function(){
					//console.log('closed server')
					minnow.makeServer(config, function(s){
						done()
					})
				})
			})
		})
	})
}

exports.slowPersist = function(config, done){
	minnow.makeServer(config, function(s){
		minnow.makeClient(config.port, function(c){
			c.view('general', [], function(handle){
				handle.make('entity', {name: 'test name'})
				setTimeout(function(){
				c.close(function(){
					s.close(function(){
						//console.log('persist test reloading server')
							minnow.makeServer(config, function(s){
								minnow.makeClient(config.port, function(c){
									c.view('general', [], function(handle){
										if(handle.objects.size() !== 1) throw new Error('persistence failure: ' + handle.objects.size())
										done()
									})
								})
							})
					})
				})
				}, 250)
			})
		})
	})
}
exports.fastPersist = function(config, done){
	minnow.makeServer(config, function(s){
		minnow.makeClient(config.port, function(c){
			c.view('general', [], function(handle){
				handle.make('entity', {name: 'test name'})
				c.close(function(){
					s.close(function(){
						//console.log('persist test reloading server')
						minnow.makeServer(config, function(s){
							minnow.makeClient(config.port, function(c){
								c.view('general', [], function(handle){
									if(handle.objects.size() !== 1) throw new Error('persistence failure: ' + handle.objects.size())
									done()
								})
							})
						})
					})
				})
			})
		})
	})
}
