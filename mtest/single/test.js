
var minnow = require('./../../client/client')//this is the minnow include

exports.getSpecificView = function(config, done){
	minnow.makeServer(config, function(s){
		minnow.makeClient(config.port, function(c){
			c.view('general', [], function(handle){
				handle.make('entity', {name: 'test name'}, function(id){
					console.log('GOT ID')
					c.view('specific', [id], function(handle){
						if(handle.object.name.value() === 'test name'){
							done()
						}else{
							console.log('single.getSpecificView - TEST FAILED: WRONG VALUE: ' + handle.object.name.value());
						}
					})
				})
			})
		})
	})
}

exports.getSpecificViewWithTemporaryErrors = function(config, done){
	minnow.makeServer(config, function(s){
		minnow.makeClient(config.port, function(c){
			c.view('general', [], function(handle){
				var obj = handle.make('entity', {name: 'test name'})
				try{
					c.view('specific', [obj.id()], function(handle){})
				}catch(e){
					done()
				}
			})
		})
	})
}


exports.changeObjectGotten = function(config, done){
	minnow.makeServer(config, function(s){
		minnow.makeClient(config.port, function(c){
			c.view('general', [], function(handle){
				var obj = handle.make('entity', {name: 'test name'}, function(id){
					console.log('GOT ID')
					c.view('specific', [id], function(handle){
					
						//this is sort of weird, but it's for timing purposes
						obj.name.set('better name')
						
						if(handle.object.name.value() === 'better name'){
							done()
						}else{
							console.log('single.getSpecificView - TEST FAILED: WRONG VALUE: ' + handle.object.name.value());
						}
					})
				})
			})
		})
	})
}
