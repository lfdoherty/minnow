
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
						var obj = v.make('thing')
						//v.setProperty('s', obj)
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
						var d;
						c.s.data.each(function(dd){d = dd;})
						if(d.v.value() === 'something'){
							done()
							return true
						}
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('general', function(err, v){
						var obj = v.make('thing')
						v.setProperty('s',obj)//setProperty('s', obj)
						_.assertDefined(obj)
						_.assertDefined(obj.data)
						var newObj = obj.data.addNew()
						_.assertDefined(newObj)
						
						done.poll(function(){
							if(obj.data.size() === 1){
								//var d;
								//obj.data.each(function(dd){d = dd;})
								//d.value.set('something')
								newObj.v.set('something')
								return true
							}
						})
					})
				})
				
			})
		})
	})
}

exports.removeTemporariedInternalObject = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', function(err, c){
			
				done.poll(function(){
					//console.log(JSON.stringify(c.toJson()))
					if(c.has('s') && c.s.data.size() === 1 && c.s.data.toJson()[0].v === 'it'){
						done()
						return true
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('general', function(err, v){
						var obj = v.make('thing')
						v.setProperty('s',obj)//setProperty('s', obj)
						_.assertDefined(obj)
						_.assertDefined(obj.data)
						var tempObj = obj.data.addNew()
						obj.data.remove(tempObj)
						var tempObj = obj.data.addNew({v: 'it'})
					})
				})
				
			})
		})
	})
}

exports.removeTemporariedExternalObject = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', function(err, c){
			
				done.poll(function(){
					if(c.has('s')){
						if(c.s.data.size() === 1 && c.s.data.toJson()[0].v === 'it'){
							done()
							return true
						}
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('general', function(err, v){
						var obj = v.make('thing')
						v.setProperty('s',obj)//setProperty('s', obj)
						_.assertDefined(obj)
						_.assertDefined(obj.data)
						var tempObj = v.make('entity', {v: 'not it'})
						obj.data.add(tempObj)
						obj.data.remove(tempObj)
						obj.data.addNew({v: 'it'})
					})
				})
				
			})
		})
	})
}

exports.plus = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('adder', function(err, c){
				if(err) throw err
				
				done.poll(function(){
					if(c.has('plussed') && c.plussed.size() === 3){
						done()
						return true
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('general', function(err, v){
						v.make('blah', {numbers: [4,5,3]})
						
					})
				})
				
			})
		})
	})
}
