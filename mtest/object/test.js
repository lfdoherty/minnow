
var minnow = require('./../../client/client')//this is the minnow include

exports.setProperty = function(config, done){
	minnow.makeServer(config, function(s){
		minnow.makeClient(config.port, function(c){
			c.view('general', [], function(handle){
				var container = handle.make('container', function(id){
					
					var e2 = handle.make('entity', {name:  'test2'})
					container.setProperty('e', e2)
					
					setTimeout(function(){
						c.view('specific', [id], function(handle){
							console.log('e: ' + handle.object.e.name.value())
							if(handle.object.e.name.value() === 'test2'){
								done()
							}
						})
					},500)
				})
				var e = handle.make('entity', {name:  'test1'})
				container.setProperty('e', e)
			})
		})
	})
}

exports.makeWithEmptyObject = function(config, done){
	minnow.makeServer(config, function(s){
		minnow.makeClient(config.port, function(c){
			c.view('general', [], function(handle){
				var container = handle.make('container', {e: {}}, function(id){
					c.view('specific', [id], function(handle){
						if(handle.object.has('e')){
							done()
						}
					})
				})
			})
		})
	})
}


exports.prepareWasSetToNew = function(config, done){
	minnow.makeServer(config, function(s){
		minnow.makeClient(config.port, function(c){
			c.view('general', [], function(handle){
				handle.make('container', {e: {}}, function(id){
					minnow.makeClient(config.port, function(c){
						c.view('specific', [id], function(handle){
							if(handle.object.has('e')){
								done()
							}
						})
					})
				})
			})
		})
	})
}

