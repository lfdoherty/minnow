
var minnow = require('./../../client/client')//this is the minnow include

var _ = require('underscorem')

function poll(f){var ci=setInterval(wf,10);function wf(){if(f()){clearInterval(ci)}}}

exports.append = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', function(c){
			
				poll(function(){
					//if(c.has('primitiveList')) console.log(c.primitiveList.data.size())
					if(c.has('primitiveList') && c.primitiveList.data.size() === 1){
						done()
						return true
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('general', function(v){
						var n = v.make('stringList')
						v.setProperty('primitiveList', n)
						_.assertDefined(n)
						_.assertDefined(n.data)
						n.data.push('test')
					})
				})
				
			})
		})
	})
}

exports.removePrimitive = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', function(c){
			
				poll(function(){
					if(c.has('primitiveList') && c.primitiveList.data.size() === 2){
						var arr = c.primitiveList.data.toJson()
						if(arr[0] === 'a' && arr[1] === 'c'){
							done()
							return true
						}
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('general', function(v){
						var obj = v.make('stringList')
						v.setProperty('primitiveList', obj)
						_.assertDefined(obj)
						_.assertDefined(obj.data)
						obj.data.push('a')
						obj.data.push('b')
						obj.data.push('c')
						
						obj.data.remove('b')
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
					//console.log(c.has('primitiveList'))// + ' ' + c.primitiveList.data.size())
					if(c.has('primitiveList')){
						//console.log(c.primitiveList.data.size() + ' ' + JSON.stringify(c.primitiveList.toJson()))
						if(c.primitiveList.data.size() === 2){
							var arr = c.primitiveList.data.toJson()
							//console.log('*trying: ' + JSON.stringify(arr))
							if(arr[0] === 'b' && arr[1] === 'c'){
								done()
								return true
							}
						}
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('general', function(v){
						var obj = v.make('stringList')
						v.setProperty('primitiveList', obj)
						_.assertDefined(obj)
						_.assertDefined(obj.data)
						obj.data.push('a')
						obj.data.push('b')
						obj.data.push('c')
						
						obj.data.shift()
					})
				})
				
			})
		})
	})
}

