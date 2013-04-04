
var minnow = require('./../../client/client')

var _ = require('underscorem')

exports.wrapped = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', function(err, c){
			
				done.poll(function(){
					//console.log('done.polling: ' + JSON.stringify(c.toJson()) + ' ' + c.has('s'))
					if(c.has('s') && c.s.size() === 1){
						var d;
						//console.log('got s to 1')
						c.s.each(function(dd){d = dd;})
						if(d.wrappedValue.value() === 'test'){
							done()
							return true
						}
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('general', function(err, v){
						var obj = c.make('entity', {v: 'test'})
						
					})
				})
				
			})
		})
	})
}

exports.wrappedFromObjectSet = function(config, done){
	minnow.makeServer(config, function(){	
		minnow.makeClient(config.port, function(otherClient){
			otherClient.view('empty', function(err, v){
				var obj = v.make('entity', {v: 'test'})
				var n = v.make('context', function(){
				
					

					minnow.makeClient(config.port, function(client){
						client.view('specific', [n], function(err, c){
							if(err) throw err
							
							n.entities.add(obj)
	
							done.poll(function(){
								//console.log('done.polling: ' + JSON.stringify(c.toJson()) + ' ' + c.has('s'))
								if(c.has('s') && c.s.size() === 1){
									var d;
									//console.log('got s to 1')
									c.s.each(function(dd){d = dd;})
									if(d.wrappedValue.value() === 'test'){
										done()
										return true
									}
								}
							})
						})
					})
				})
			})
		})
	})
}

