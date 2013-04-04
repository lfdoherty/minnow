
var minnow = require('./../../client/client')//this is the minnow include

var _ = require('underscorem')

exports.append = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', function(err, c){
			
				done.poll(function(){
					if(c.has('s') && c.s.data.size() === 1){
						done()
						return true
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('general', function(err, v){
						var obj = v.make('obj')
						v.setProperty('s',obj)
						_.assertDefined(obj)
						_.assertDefined(obj.data)
						obj.data.addNew()
					})
				})
				
			})
		})
	})
}
exports.backandforth = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', function(err, c){
			
				done.poll(function(){
					if(c.has('s') && c.s.data.size() === 1){
						var d = c.s.data.at(0)
						if(d.v.value() === 'something'){
							done()
							return true
						}
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('general', function(err, v){
						var obj = v.make('obj')
						v.setProperty('s',obj)
						_.assertDefined(obj)
						_.assertDefined(obj.data)
						var newObj = obj.data.addNew()
						_.assertDefined(newObj)
						
						done.poll(function(){
							if(obj.data.size() === 1){
								var d;
								obj.data.each(function(dd){d = dd;})
								d.v.set('something')
								return true
							}
						})
					})
				})
				
			})
		})
	})
}

exports.replaceNew = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', function(err, c){
			
				done.poll(function(){
					if(c.has('s') && c.s.data.size() === 1){
						var d = c.s.data.at(0)
						if(d.v.value() === 'something'){
							done()
							return true
						}
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('general', function(err, v){
						var obj = v.make('obj')
						v.setProperty('s',obj)
						_.assertDefined(obj)
						_.assertDefined(obj.data)
						var newObj = obj.data.addNew()
						
						obj.data.replaceNew(newObj, {v: 'something else'})
						
						done.poll(function(){
							if(obj.data.size() === 1){
								var d;
								obj.data.each(function(dd){d = dd;})
								d.v.set('something')
								return true
							}
						})
					})
				})
				
			})
		})
	})
}

exports.replaceNewMore = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', function(err, c){
			
				done.poll(function(){
					if(c.has('s') && c.s.data.size() === 1){
						var d = c.s.data.at(0)
						if(d.v.value() === 'something else'){
							done()
							return true
						}
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('general', function(err, v){
						var obj = v.make('obj')
						v.setProperty('s',obj)
						_.assertDefined(obj)
						_.assertDefined(obj.data)

						var oldObj = obj.data.addNew({v: 'something'})						
						var newObj = obj.data.replaceNew(oldObj, {v: 'something else'})
					})
				})
				
			})
		})
	})
}
exports.replaceExistingWithNew = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', function(err, c){
			
				done.poll(function(){
					if(c.has('s') && c.s.data.size() === 1){
						var d = c.s.data.at(0)
						if(d.v.value() === 'something'){
							done()
							return true
						}
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('general', function(err, v){
						var obj = v.make('obj')
						v.setProperty('s',obj)
						_.assertDefined(obj)
						_.assertDefined(obj.data)
						var newObj = v.make('entity')
						obj.data.add(newObj)//obj.data.addNew()
						
						obj.data.replaceNew(newObj, {v: 'something else'})
						
						done.poll(function(){
							if(obj.data.size() === 1){
								var d;
								obj.data.each(function(dd){d = dd;})
								d.v.set('something')
								return true
							}
						})
					})
				})
				
			})
		})
	})
}
exports.replaceExisting = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', function(err, c){
			
				done.poll(function(){
					if(c.has('s') && c.s.data.size() === 1){
						var d = c.s.data.at(0)
						if(d.v.value() === 'something else'){
							done()
							return true
						}
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('general', function(err, v){
						var obj = v.make('obj')
						v.setProperty('s',obj)
						_.assertDefined(obj)
						_.assertDefined(obj.data)

						var oldObj = obj.data.addNew({v: 'something'})
						
						var newObj = v.make('entity', {v: 'something else'})
						obj.data.replaceExisting(oldObj, newObj)
					})
				})
				
			})
		})
	})
}

exports.replaceExistingExternalWithNew = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', function(err, c){
			
				done.poll(function(){
					if(c.has('s') && c.s.data.size() === 1){
						var d = c.s.data.at(0)
						if(d.v.value() === 'something else'){
							done()
							return true
						}
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('general', function(err, v){
						var obj = v.make('obj')
						v.setProperty('s',obj)
						_.assertDefined(obj)
						_.assertDefined(obj.data)

						var oldObj = v.make('entity', {v: 'something'})
						obj.data.add(oldObj)						
						var newObj = v.make('entity', {v: 'something else'})
						obj.data.replaceExisting(oldObj, newObj)
					})
				})
				
			})
		})
	})
}

exports.add = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', function(err, c){
			
				done.poll(function(){
					//if(c.has('s')) console.log('DATA SIZE: ' + c.s.data.size())
					//console.log(JSON.stringify(c.toJson()))
					if(c.has('s') && c.s.data.size() === 1){
						var d = c.s.data.at(0)
						if(d.v.value() === 'something else'){
							done()
							return true
						}
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('general', function(err, v){
						var obj = v.make('obj')
						v.setProperty('s',obj)
						_.assertDefined(obj)
						_.assertDefined(obj.data)

						//var oldObj = obj.data.addNew({v: 'something'})
						
						var newObj = v.make('entity', {v: 'something else'})
						obj.data.add(newObj)
						//console.log('real: ' + obj.data.size())
						//obj.data.shift()
					})
				})
				
			})
		})
	})
}
exports.shift = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', function(err, c){
			
				done.poll(function(){
					//if(c.has('s')) console.log('DATA SIZE: ' + c.s.data.size())
					if(c.has('s') && c.s.data.size() === 1){
						var d = c.s.data.at(0)
						if(d.v.value() === 'something else'){
							done()
							return true
						}
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('general', function(err, v){
						var obj = v.make('obj')
						v.setProperty('s',obj)
						_.assertDefined(obj)
						_.assertDefined(obj.data)

						var oldObj = obj.data.addNew({v: 'something'})
						
						var newObj = v.make('entity', {v: 'something else'})
						obj.data.add(newObj)
						//console.log('real: ' + obj.data.size())
						obj.data.shift()
					})
				})
				
			})
		})
	})
}

