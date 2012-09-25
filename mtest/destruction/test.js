
var minnow = require('./../../client/client')

var _ = require('underscorem')

function poll(f){var ci=setInterval(wf,10);function wf(){if(f()){clearInterval(ci)}}}

exports.addNewFromJson = function(config, done){
	//console.log('destruction config: ' + JSON.stringify(config))
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', function(c){
			
				var added = false
				poll(function(){
					if(c.s.size() === 1){
						//console.log('added')
						added = true
					}
					if(added && c.s.size() === 0){
						//console.log('deleted')
						done()
						return true
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					//console.log('got client for destroy')
					otherClient.view('general', function(v){
						var obj = c.make('entity', {value: 'test'})
						setTimeout(function(){
							obj.del()
						},500)
					})
				})
				
			})
		})
	})
}

exports.gracefulFailureForDestroyedIdView = function(config, done){
	//console.log('destruction config: ' + JSON.stringify(config))
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', function(c){
			
				var e = c.make('entity', function(id){
					e.del()
					minnow.makeClient(config.port, function(otherClient){
						//console.log('got client for destroy')
						otherClient.view('specific', [id], function(v){
							//console.log(JSON.stringify(v.toJson()))
							_.assertNot(v.has('e'))
							done()
						})
					})
				})				
			})
		})
	})
}

exports.gracefulFailureNonexistentIdView = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.on('error', function(e){
				_.assert(e.indexOf('invalid object id') !== -1)
				done()
			})
			client.view('specific', [5005], function(v){
				//console.log(JSON.stringify(v.toJson()))
				//_.assertNot(v.has('e'))
				//done()
				done.fail()
			})
		})
	})
}