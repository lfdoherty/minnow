
var minnow = require('./../../client/client')

var _ = require('underscorem')

function poll(f){var ci=setInterval(wf,0);function wf(){
	try{if(f()){clearInterval(ci)}}
	catch(e){clearInterval(ci);throw e;}
}}

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
						v.setProperty('s',obj)
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
						v.setProperty('s',obj)
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
						v.setProperty('s',obj)
						_.assertDefined(obj)
						_.assertDefined(obj.data)
						obj.data.add('test')
						obj.data.add('test2')
						setTimeout(function(){
							try{
								obj.data.remove('test2')
								obj.data.remove('test')
							}catch(e){}
						},200)
					})
				})
				
			})
		})
	})
}

exports.appendAndAll = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('contained', function(err, c){
			
				poll(function(){
				//	console.log(c.has('s'))
					//console.log(JSON.stringify(c.toJson()))
					if(c.has('all') && c.all.size() === 1){
						done()
						return true
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('general', function(err, v){
						var obj = v.make('entity')
						v.setProperty('s',obj)
						_.assertDefined(obj)
						_.assertDefined(obj.data)
						obj.data.add('test')
						
						var cont = v.make('container')
						cont.contained.add(obj)
					})
				})
				
			})
		})
	})
}

exports.appendAndCreateAll = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('contained', function(err, c){
			
				poll(function(){
				//	console.log(c.has('s'))
					//console.log(JSON.stringify(c.toJson()))
					if(c.has('all') && c.all.size() === 3){
						done()
						return true
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('general', function(err, v){
						var obj = v.make('entity')
						v.setProperty('s', obj)
						_.assertDefined(obj)
						_.assertDefined(obj.data)
						obj.data.add('test')
						obj.data.add('test2')
						
						var cont = v.make('container')
						cont.contained.add(obj)
						
						cont.contained.addNew('entity', {data: ['test3']})
					})
				})
				
			})
		})
	})
}

exports.removeAndAll = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('contained', function(err, c){
			
				var foundFirst = false
				poll(function(){
				//	console.log(c.has('s'))
					if(Math.random() < .3) console.log(JSON.stringify(c.toJson()))
					if(c.has('all') && c.all.size() === 3){
						foundFirst = true
					}else if(foundFirst && c.all.size() === 1){
						_.assertEqual(JSON.stringify(c.all.toJson()), '["test2"]')
						done()
						return true
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('empty', function(err, v){
						var obj = v.make('entity')
						//v.setProperty('s',obj)
						_.assertDefined(obj)
						_.assertDefined(obj.data)
						obj.data.add('test')
						obj.data.add('test2')
						
						var cont = v.make('container')
						cont.contained.add(obj)
						
						var e = cont.contained.addNew('entity', {data: ['test3']})
						
						setTimeout(function(){
							//console.log('removing ' + e.id() + ' from ' + cont.id())
							cont.contained.remove(e)
							obj.data.remove('test')
						},200)
					})
				})
				
			})
		})
	})
}

