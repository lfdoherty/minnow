
var minnow = require('./../../client/client')//this is the minnow include

var _ = require('underscorem')

function poll(f){var ci=setInterval(wf,10);function wf(){if(f()){clearInterval(ci)}}}

exports.append = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', function(c){
			
				poll(function(){
					if(c.has('s') && c.s.data.size() === 1){
						done()
						return true
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('general', function(v){
						var obj = v.make('obj')
						v.s.set(obj)
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
			client.view('general', function(c){
			
				poll(function(){
					if(c.has('s') && c.s.data.size() === 1){
						var d = c.s.data.at(0)
						if(d.value.value() === 'something'){
							done()
							return true
						}
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('general', function(v){
						var obj = v.make('obj')
						v.s.set(obj)
						_.assertDefined(obj)
						_.assertDefined(obj.data)
						var newObj = obj.data.addNew()
						_.assertDefined(newObj)
						
						poll(function(){
							if(obj.data.size() === 1){
								var d;
								obj.data.each(function(dd){d = dd;})
								d.value.set('something')
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
			client.view('general', function(c){
			
				poll(function(){
					if(c.has('s') && c.s.data.size() === 1){
						var d = c.s.data.at(0)
						if(d.value.value() === 'something'){
							done()
							return true
						}
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('general', function(v){
						var obj = v.make('obj')
						v.s.set(obj)
						_.assertDefined(obj)
						_.assertDefined(obj.data)
						var newObj = obj.data.addNew()
						
						obj.data.replaceNew(newObj, {value: 'something else'})
						
						poll(function(){
							if(obj.data.size() === 1){
								var d;
								obj.data.each(function(dd){d = dd;})
								d.value.set('something')
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
			client.view('general', function(c){
			
				poll(function(){
					if(c.has('s') && c.s.data.size() === 1){
						var d = c.s.data.at(0)
						if(d.value.value() === 'something else'){
							done()
							return true
						}
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('general', function(v){
						var obj = v.make('obj')
						v.s.set(obj)
						_.assertDefined(obj)
						_.assertDefined(obj.data)

						var oldObj = obj.data.addNew({value: 'something'})						
						var newObj = obj.data.replaceNew(oldObj, {value: 'something else'})
					})
				})
				
			})
		})
	})
}
exports.replaceExistingWithNew = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', function(c){
			
				poll(function(){
					if(c.has('s') && c.s.data.size() === 1){
						var d = c.s.data.at(0)
						if(d.value.value() === 'something'){
							done()
							return true
						}
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('general', function(v){
						var obj = v.make('obj')
						v.s.set(obj)
						_.assertDefined(obj)
						_.assertDefined(obj.data)
						var newObj = v.make('entity')
						obj.data.add(newObj)//obj.data.addNew()
						
						obj.data.replaceNew(newObj, {value: 'something else'})
						
						poll(function(){
							if(obj.data.size() === 1){
								var d;
								obj.data.each(function(dd){d = dd;})
								d.value.set('something')
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
			client.view('general', function(c){
			
				poll(function(){
					if(c.has('s') && c.s.data.size() === 1){
						var d = c.s.data.at(0)
						if(d.value.value() === 'something else'){
							done()
							return true
						}
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('general', function(v){
						var obj = v.make('obj')
						v.s.set(obj)
						_.assertDefined(obj)
						_.assertDefined(obj.data)

						var oldObj = obj.data.addNew({value: 'something'})
						
						var newObj = v.make('entity', {value: 'something else'})
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
			client.view('general', function(c){
			
				poll(function(){
					if(c.has('s') && c.s.data.size() === 1){
						var d = c.s.data.at(0)
						if(d.value.value() === 'something else'){
							done()
							return true
						}
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('general', function(v){
						var obj = v.make('obj')
						v.s.set(obj)
						_.assertDefined(obj)
						_.assertDefined(obj.data)

						var oldObj = v.make('entity', {value: 'something'})
						obj.data.add(oldObj)						
						var newObj = v.make('entity', {value: 'something else'})
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
			client.view('general', function(c){
			
				poll(function(){
					//if(c.has('s')) console.log('DATA SIZE: ' + c.s.data.size())
					if(c.has('s') && c.s.data.size() === 1){
						var d = c.s.data.at(0)
						if(d.value.value() === 'something else'){
							done()
							return true
						}
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('general', function(v){
						var obj = v.make('obj')
						v.s.set(obj)
						_.assertDefined(obj)
						_.assertDefined(obj.data)

						//var oldObj = obj.data.addNew({value: 'something'})
						
						var newObj = v.make('entity', {value: 'something else'})
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
			client.view('general', function(c){
			
				poll(function(){
					//if(c.has('s')) console.log('DATA SIZE: ' + c.s.data.size())
					if(c.has('s') && c.s.data.size() === 1){
						var d = c.s.data.at(0)
						if(d.value.value() === 'something else'){
							done()
							return true
						}
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('general', function(v){
						var obj = v.make('obj')
						v.s.set(obj)
						_.assertDefined(obj)
						_.assertDefined(obj.data)

						var oldObj = obj.data.addNew({value: 'something'})
						
						var newObj = v.make('entity', {value: 'something else'})
						obj.data.add(newObj)
						//console.log('real: ' + obj.data.size())
						obj.data.shift()
					})
				})
				
			})
		})
	})
}

