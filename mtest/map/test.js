
var minnow = require('./../../client/client')

var _ = require('underscorem')

function poll(f){var ci=setInterval(wf,10);function wf(){if(f()){clearInterval(ci)}}}

exports.put = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', function(err, c){
			
				poll(function(){
					if(c.has('s')){
						if(c.s.data.size() === 1){
							if(c.s.data.value('testKey') === 'testValueTwo'){
								done()
								return true
							}
						}else{
							//console.log('here: ' + c.s.data.size())
						}
					}else{
						//console.log('no s')
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('general', function(err, v){
						//console.log(''+v.setPropertyToNew)
						var obj = v.make('entity')
						v.setProperty('s', obj)
						_.assertDefined(obj)
						_.assertDefined(obj.data)
						obj.data.put('testKey', 'testValue')
						obj.data.put('testKey', 'testValueTwo')
					})
				})
				
			})
		})
	})
}

exports.putSeries = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', function(err, c){
			
				poll(function(){
					if(c.has('s')){
						if(c.s.data.size() === 3){
							if(c.s.data.value('a') === 'a' && c.s.data.value('b') === 'b' && c.s.data.value('c') === 'c'){
								done()
								return true
							}
						}else{
							//console.log('here: ' + c.s.data.size())
						}
					}else{
						//console.log('no s')
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('general', function(err, v){
						//console.log(''+v.setPropertyToNew)
						var obj = v.make('entity')
						v.setProperty('s',obj)
						_.assertDefined(obj)
						_.assertDefined(obj.data)
						obj.data.put('a', 'a')
						obj.data.put('a', 'b')
						obj.data.put('a', 'c')
						obj.data.put('b', 'c')
						obj.data.put('c', 'b')
						obj.data.put('b', 'a')
						obj.data.put('c', 'c')
						obj.data.put('a', 'a')
						obj.data.put('b', 'b')
					})
				})
				
			})
		})
	})
}

exports.del = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', function(err, c){
			
				poll(function(){
					//console.log(JSON.stringify(c.toJson()))
					if(c.has('s') && c.s.data.size() === 1){
						if(c.s.data.value('testKey') === 'testValueTwo'){
							done()
							return true
						}
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('general', function(err, v){
						//console.log(''+v.setPropertyToNew)
						var obj = v.make('entity')
						v.setProperty('s',obj)
						_.assertDefined(obj)
						_.assertDefined(obj.data)
						obj.data.put('testKey', 'testValue')
						obj.data.put('testKey2', 'testValue')
						obj.data.del('testKey2')
						obj.data.put('testKey', 'testValueTwo')
					})
				})
				
			})
		})
	})
}


exports.putNew = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('genc', function(err, c){
			
				poll(function(){
					if(c.has('s')){
						if(c.s.members.size() === 1 && c.s.members.has('testKey')){
							if(c.s.members.get('testKey').has('name') && c.s.members.get('testKey').name.value() === 'Bill'){
								done()
								return true
							}
						}else{
							//console.log('here: ' + c.s.data.size())
						}
					}else{
						//console.log('no s')
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('general', function(err, v){
						//console.log(''+v.setPropertyToNew)
						var obj = v.make('container')
						obj.members.putNew('testKey', {name: 'Bill'})
					})
				})
				
			})
		})
	})
}

exports.values = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('valuesView', function(err, c){
			
				poll(function(){
					//console.log(JSON.stringify(c.toJson()))
					if(c.vs.size() === 2){
						done()
						return true
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('empty', function(err, v){
						//console.log(''+v.setPropertyToNew)
						var obj = v.make('entity')
						//v.s.set(obj)
						_.assertDefined(obj)
						_.assertDefined(obj.data)
						obj.data.put('testKey', 'testValue')
						obj.data.put('testKey2', 'testValue')
						obj.data.del('testKey2')
						obj.data.put('testKey', 'testValueTwo')
					})
				})
				
			})
		})
	})
}

exports.nestedInnerValues = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('containerValuesView', function(err, c){
			
				poll(function(){
					//console.log(JSON.stringify(c.toJson()))
					if(c.vs.size() === 2){
						done()
						return true
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('empty', function(err, v){
						//console.log(''+v.setPropertyToNew)
						var cont = v.make('container')
						var obj = cont.members.putNew('testb', 'entity')

						_.assertDefined(obj)
						_.assertDefined(obj.data)
						obj.data.put('testKey', 'testValue')
						obj.data.put('testKey2', 'testValue')
						obj.data.del('testKey2')
						obj.data.put('testKey', 'testValueTwo')
						
					})
				})
				
			})
		})
	})
}
exports.nestedExternalValues = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('containerValuesView', function(err, c){
			
				poll(function(){
					//console.log(JSON.stringify(c.toJson()))
					if(c.vs.size() === 2){
						done()
						return true
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('empty', function(err, v){
						//console.log(''+v.setPropertyToNew)
						var obj = v.make('entity')

						_.assertDefined(obj)
						_.assertDefined(obj.data)
						obj.data.put('testKey', 'testValue')
						obj.data.put('testKey2', 'testValue')
						obj.data.del('testKey2')
						obj.data.put('testKey', 'testValueTwo')
						
						var cont = v.make('container')
						cont.members.put('testb', obj)
					})
				})
				
			})
		})
	})
}

exports.mapPart = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('stringForContained', ['test'], function(err, c){
			
				poll(function(){
					//console.log(JSON.stringify(c.toJson()))
					if(c.names.size() === 1 && c.names.toJson()[0] === 'billy'){
						done()
						return true
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('empty', function(err, v){
						//console.log(''+v.setPropertyToNew)
						var obj = v.make('entity', {name: 'billy'})
						var obj2 = v.make('entity', {name: 'mark'})
						
						var cont = v.make('container')
						cont.members.put('test2', obj2)
						cont.members.put('test', obj)
					})
				})
				
			})
		})
	})
}

exports.accessObjectKeys = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('objkeys', function(err, c){
			
				c.on('set', function(propertyName, objkeyer){
					if(propertyName === 's'){
						//console.log('got keyer')
						objkeyer.members.on('put', function(key, value){
							//console.log('got put')
							if(!key.name){
								done.fail('invalid key: ' + key)
							}
							if(value === 'testValue' && key.name.value() === 'bill'){
								done()
							}
						})
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('empty', function(err, v){
						//console.log(''+v.setPropertyToNew)
						var obj = v.make('entity', {name: 'bill'})

						var keyer = v.make('objkeyer')
						setTimeout(function(){
							keyer.members.put(obj, 'testValue')
						},100)
					})
				})
				
			})
		})
	})
}
