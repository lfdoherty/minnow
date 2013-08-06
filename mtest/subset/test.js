
var minnow = require('./../../client/client')

var _ = require('underscorem')

exports.complexRemoval = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', ['Pete'], function(err, c){

				var first = false			
				done.poll(function(){
					//console.log(JSON.stringify(c.toJson()))
					
					if(c.matches.size() === 2){
						first = true
					}else if(first && c.matches.size() === 1){
						done()
						return true
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('empty', function(err, v){
						var a = v.make('entity', {name: 'Pete'})
						var b = v.make('entity', {name: 'Pete'})
						
						setTimeout(function(){
							b.removed.set(true)
						},200)
					})
				})
				
			})
		})
	})
}

exports.globalForEq = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('empty', function(err, vv){
				var strConfig = vv.make('config', {str: 'Pete'}, function(){
					client.view('specific', [strConfig], function(err, c){
						if(err) throw err

						var first = false			
						done.poll(function(){
							console.log(JSON.stringify(c.toJson()))
					
							if(c.matches.size() === 2){
								first = true
							}else if(first && c.matches.size() === 1){
								done()
								return true
							}
						})

						minnow.makeClient(config.port, function(otherClient){
							otherClient.view('empty', function(err, v){
								var a = v.make('entity', {name: 'Pete'})
								var b = v.make('entity', {name: 'Pete'})
						
								setTimeout(function(){
									b.removed.set(true)
								},200)
							})
						})
					})
				})
			})
		})
	})
}

exports.globalForEqWithChange = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('empty', function(err, vv){
				var strConfig = vv.make('config', {str: 'Pete'}, function(){
					client.view('specific', [strConfig], function(err, c){
						if(err) throw err

						var first = false			
						done.poll(function(){
							//console.log(JSON.stringify(c.toJson()))
					
							if(c.matches.size() === 2){
								first = true
							}else if(first && c.matches.size() === 1){
								done()
								return true
							}
						})

						minnow.makeClient(config.port, function(otherClient){
							otherClient.view('empty', function(err, v){
								var a = v.make('entity', {name: 'Pete'})
								var b = v.make('entity', {name: 'Pete'})
						
								setTimeout(function(){
									strConfig.str.set('Bill')
									b.removed.set(true)
									strConfig.str.set('Pete')
								},200)
							})
						})
					})
				})
			})
		})
	})
}

