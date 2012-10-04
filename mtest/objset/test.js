
var minnow = require('./../../client/client')//this is the minnow include

var _ = require('underscorem')

function poll(f){var ci=setInterval(wf,10);function wf(){if(f()){clearInterval(ci)}}}

exports.append = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', function(err, c){
			
				poll(function(){
					if(c.has('s') && c.s.data.size() === 1){
						done()
						return true
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('general', function(err, v){
						var obj = v.make('obj')
						//v.setProperty('s', obj)
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
			client.view('general', function(err, c){
			
				poll(function(){
					if(c.has('s') && c.s.data.size() === 1){
						var d;
						c.s.data.each(function(dd){d = dd;})
						if(d.value.value() === 'something'){
							done()
							return true
						}
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('general', function(err, v){
						var obj = v.make('obj')
						v.s.set(obj)//setProperty('s', obj)
						_.assertDefined(obj)
						_.assertDefined(obj.data)
						var newObj = obj.data.addNew()
						_.assertDefined(newObj)
						
						poll(function(){
							if(obj.data.size() === 1){
								//var d;
								//obj.data.each(function(dd){d = dd;})
								//d.value.set('something')
								newObj.value.set('something')
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
			
				poll(function(){
					if(c.has('s') && c.s.data.size() === 1 && c.s.data.toJson()[0].value === 'it'){
						done()
						return true
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('general', function(err, v){
						var obj = v.make('obj')
						v.s.set(obj)//setProperty('s', obj)
						_.assertDefined(obj)
						_.assertDefined(obj.data)
						var tempObj = obj.data.addNew()
						obj.data.remove(tempObj)
						var tempObj = obj.data.addNew({value: 'it'})
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
			
				poll(function(){
					if(c.has('s')){
						if(c.s.data.size() === 1 && c.s.data.toJson()[0].value === 'it'){
							done()
							return true
						}
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('general', function(err, v){
						var obj = v.make('obj')
						v.s.set(obj)//setProperty('s', obj)
						_.assertDefined(obj)
						_.assertDefined(obj.data)
						var tempObj = v.make('entity', {value: 'not it'})
						obj.data.add(tempObj)
						obj.data.remove(tempObj)
						obj.data.addNew({value: 'it'})
					})
				})
				
			})
		})
	})
}

