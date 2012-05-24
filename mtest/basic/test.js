
var minnow = require('./../../client/client')//this is the minnow include

exports.connect = function(dir, serverDir, port, done){
	minnow.makeServer(dir, serverDir, port, function(){
		minnow.makeClient(port, function(c){
			done()
		})
	})
}

exports.view = function(dir, serverDir, port, done){
	minnow.makeServer(dir, serverDir, port, function(){
		minnow.makeClient(port, function(c){
			c.view('general', [], function(handle){
				done()
			})
		})
	})
}

exports.viewReuse = function(dir, serverDir, port, done){
	minnow.makeServer(dir, serverDir, port, function(){
		minnow.makeClient(port, function(c){
			c.view('general', [], function(handle){
				c.view('general', [], function(otherHandle){
					if(handle !== otherHandle) throw new Error('a request for the same view with same parameters should return the same handle')
					done()
				})
			})
		})
	})
}

exports.serverShutdown = function(dir, serverDir, port, done){
	minnow.makeServer(dir, serverDir, port, function(s){
		s.close(function(){
			done()
		})
	})
}

exports.restart = function(dir, serverDir, port, done){
	minnow.makeServer(dir, serverDir, port, function(s){
		s.close(function(){
			minnow.makeServer(dir, serverDir, port, function(s){
				done()
			})
		})
	})
}

exports.clientRestart = function(dir, serverDir, port, done){
	minnow.makeServer(dir, serverDir, port, function(s){
		minnow.makeClient(port, function(c){
			c.close(function(){
				s.close(function(){
					minnow.makeServer(dir, serverDir, port, function(s){
						done()
					})
				})
			})
		})
	})
}

exports.slowPersist = function(dir, serverDir, port, done){
	minnow.makeServer(dir, serverDir, port, function(s){
		minnow.makeClient(port, function(c){
			c.view('general', [], function(handle){
				handle.make('entity', {name: 'test name'})
				setTimeout(function(){
				c.close(function(){
					s.close(function(){
						console.log('persist test reloading server')
							minnow.makeServer(dir, serverDir, port, function(s){
								minnow.makeClient(port, function(c){
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
exports.fastPersist = function(dir, serverDir, port, done){
	minnow.makeServer(dir, serverDir, port, function(s){
		minnow.makeClient(port, function(c){
			c.view('general', [], function(handle){
				handle.make('entity', {name: 'test name'})
				c.close(function(){
					s.close(function(){
						console.log('persist test reloading server')
						minnow.makeServer(dir, serverDir, port, function(s){
							minnow.makeClient(port, function(c){
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
