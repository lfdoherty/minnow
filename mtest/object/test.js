
var minnow = require('./../../client/client')//this is the minnow include

exports.setProperty = function(config, done){
	minnow.makeServer(config, function(s){
		minnow.makeClient(config.port, function(c){
			c.view('general', [], function(err, handle){
				var container = handle.make('container', function(id){
					
					var e2 = handle.make('entity', {name:  'test2'})
					container.setProperty('e', e2)
					
					setTimeout(function(){
						c.view('specific', [id], function(err, handle){
							console.log('e: ' + handle.subj.e.name.value())
							if(handle.subj.e.name.value() === 'test2'){
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
			c.view('general', [], function(err, handle){
				var container = handle.make('container', {e: {}}, function(id){
					c.view('specific', [id], function(err, handle){
						if(handle.subj.has('e')){
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
			c.view('general', [], function(err, handle){
				handle.make('container', {e: {}}, function(id){
					minnow.makeClient(config.port, function(c){
						c.view('specific', [id], function(err, handle){
							if(handle.subj.has('e')){
								done()
							}else{
								console.log(JSON.stringify(handle.toJson()))
							}
						})
					})
				})
			})
		})
	})
}


exports.deepTopLevelDescent = function(config, done){
	minnow.makeServer(config, function(s){
		minnow.makeClient(config.port, function(c){
			c.view('deep', [], function(err, handle){
				var bottom = handle.make('recursive', {name: 'bottom'})
				var a = handle.make('recursive', {p: bottom})
				var b = handle.make('recursive', {p: a})
				var c = handle.make('recursive', {p: b})
				var d = handle.make('recursive', {p: c})
				
				done.poll(function(){
					//console.log('handle: ' + handle)					
					if(handle.deepName.value() === 'bottom'){
						done()
						return true
					}
				})
			})
		})
	})
}
