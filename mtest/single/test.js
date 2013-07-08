
var minnow = require('./../../client/client')//this is the minnow include

exports.getSpecificView = function(config, done){
	minnow.makeServer(config, function(s){
		minnow.makeClient(config.port, function(c){
			c.view('general', [], function(err, handle){
				handle.make('entity', {name: 'test name'}, function(id){
					//console.log('GOT ID')
					if(typeof(id) !== 'number') throw new Error('id is not valid: ' + id)
					
					c.view('specific', [id], function(err, handle){
						if(handle.subj.name.value() === 'test name'){
							done()
						}else{
							console.log('single.getSpecificView - TEST FAILED: WRONG VALUE: ' + handle.subj.name.value());
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
			c.view('general', [], function(err, handle){
				var obj = handle.make('entity', {name: 'test name'})
				try{
					c.view('specific', [obj.id()], function(err, handle){})
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
			c.view('general', [], function(err, handle){
				var obj = handle.make('entity', {name: 'test name'}, function(id){
					//console.log('GOT ID')
					c.view('specific', [id], function(err, handle){
					
						//this is sort of weird, but it's for timing purposes
						obj.name.set('better name')
						
						if(handle.subj.name.value() === 'better name'){
							done()
						}else{
							console.log('single.getSpecificView - TEST FAILED: WRONG VALUE: ' + handle.subj.name.value());
						}
					})
				})
			})
		})
	})
}
