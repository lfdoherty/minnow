
var minnow = require('./../../client/client')//this is the minnow include

var _ = require('underscorem')


exports.append = function(config, done){
	//console.log('running list.append test')
	minnow.makeServer(config, function(){
		//console.log('got server')
		minnow.makeClient(config.port, function(client){
			//console.log('got client')
			client.view('general', function(err, c){
				//console.log('got general view')
				done.poll(function(){
					if(c.has('primitiveList')) console.log(c.primitiveList.data.size() + ' ' + JSON.stringify(c.toJson()))
					if(c.has('primitiveList') && c.primitiveList.data.size() === 1){
						done()
						return true
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('general', function(err, v){
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
			client.view('general', function(err, c){
			
				done.poll(function(){
					if(c.has('primitiveList') && c.primitiveList.data.size() === 2){
						var arr = c.primitiveList.data.toJson()
						if(arr[0] === 'a' && arr[1] === 'c'){
							done()
							return true
						}
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('general', function(err, v){
						var obj = v.make('stringList')
						v.setProperty('primitiveList',obj)
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
			client.view('general', function(err, c){
			
				done.poll(function(){
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
					otherClient.view('general', function(err, v){
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

