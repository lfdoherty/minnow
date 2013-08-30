
var minnow = require('./../../client/client')//this is the minnow include

var _ = require('underscorem')

exports.twoCreationTimestamps = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', function(err, c){
			
				done.poll(function(){
					/*console.log(JSON.stringify(c.toJson()))
					if(c.has('names') && c.names.size() === 2){
						done()
						return true
					}*/
					if(c.all.count() === 2){
						var timestamps = []
						c.all.each(function(e){
							var firstVersion = e.versionsSelf()[0]
							timestamps.push(c.times.value(firstVersion))
						})
						console.log('timestamps: ' + JSON.stringify(timestamps))
						_.assert(timestamps[0] !== timestamps[1])
						
						done()
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('empty', function(err, v){
						v.make('entity')
						setTimeout(function(){
							v.make('entity')
						},100)
					})
				})
				
			})
		})
	})
}


exports.twoCreationTimestampsFromCopy = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('generalTrue', function(err, c){
			
				done.poll(function(){
					/*console.log(JSON.stringify(c.toJson()))
					if(c.has('names') && c.names.size() === 2){
						done()
						return true
					}*/
					if(c.all.count() === 2){
						var timestamps = []
						c.all.each(function(e){
							var vers = e.versionsSelf()
							console.log('vers: ' + JSON.stringify(vers))
							var firstVersion = vers[0]
							timestamps.push(c.times.value(firstVersion))
						})
						console.log('timestamps: ' + JSON.stringify(timestamps))
						_.assert(timestamps[0] !== timestamps[1])
						
						done()
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('empty', function(err, v){
						var ent = v.make('entity', {truth: false}, function(){
							ent.copy({truth: true})
							setTimeout(function(){
								ent.copy({truth: true})
							},100)
						})
					})
				})
				
			})
		})
	})
}
