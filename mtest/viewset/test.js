
var minnow = require('./../../client/client')

var _ = require('underscorem')

exports.addNewFromJson = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', function(err, c){
			
				done.poll(function(){
					if(c.s.size() === 1){
						var d;
						c.s.each(function(dd){d = dd;})
						if(d.v.value() === 'test'){
							done()
							return true
						}
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('general', function(err, v){
						var obj = c.make('entity', {v: 'test'})
						_.assertDefined(obj)
						v.s.add(obj)
					})
				})
				
			})
		})
	})
}

exports.wrapped = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('wrapped', function(err, c){
			
				done.poll(function(){
					//console.log(c.s.size())
					if(c.s.size() === 1){
						var d;
						//console.log('got 1')
						c.s.each(function(dd){d = dd;})
						//console.log(': ' + JSON.stringify(c.toJson()))
						if(d.v && d.v.value() === 'test'){
							done()
							return true
						}
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('general', function(err, v){
						var obj = c.make('entity', {v: 'test'})
						_.assertDefined(obj)
						//v.s.add(obj)
					})
				})
				
			})
		})
	})
}

exports.wrappedRemoval = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(otherClient){
			otherClient.view('empty', function(err, v){
				var obj = v.make('entity', {v: 'test'})
				var cont = v.make('container', {members: [obj]}, function(){
				
					minnow.makeClient(config.port, function(client){
						client.view('contained', function(err, c){
			
							var had = false
							done.poll(function(){
								//console.log('$$$$ ' + had + ' ' + JSON.stringify(c.toJson()))
								if(c.has('c')){
									//console.log('rand: ' + c.c.rand)
								}
								if(c.has('c') && c.c.members.count() === 1){
									had = true
								}else if(had && c.has('c') && c.c.members.count() === 0){
									done()
									return true
								}
							})

				
							setTimeout(function(){
								console.log('removing: ' + obj.id())
								cont.members.remove(obj)
							},500)
						})
					})
				})
			})
		})
	})
}

