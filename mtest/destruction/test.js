
var minnow = require('./../../client/client')

var _ = require('underscorem')

//function done.poll(f){var ci=setInterval(wf,10);function wf(){if(f()){clearInterval(ci)}}}

exports.addNewFromJson = function(config, done){
	//console.log('destruction config: ' + JSON.stringify(config))
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', function(err, c){
				if(err) throw err
				
				var added = false
				done.poll(function(){
					if(c.s.size() === 1){
						//console.log('added')
						added = true
					}
					if(added && c.s.size() === 0){
						//console.log('deleted')
						done()
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					//console.log('got client for destroy')
					otherClient.view('general', function(err, v){
						var obj = v.make('entity', {v: 'test'})
						setTimeout(function(){
							//console.log('deleted')
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
			client.view('general', function(err, c){
				if(err) throw err
				
				var e = c.make('entity', function(id){
					e.del()
					//setTimeout(function(){
						minnow.makeClient(config.port, function(otherClient){
							//console.log('got client for destroy')
							otherClient.view('specific', [id], function(err, v){
								if(err){
									console.log(err)
									done()
									return
								}
								//console.log(v)
								_.assertNot(v.has('e'))
								done()
							})
						})
					//},1000)
				})				
			})
		})
	})
}

exports.gracefulFailureNonexistentIdView = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			/*client.on('error', function(e){
				console.log('error: ' + JSON.stringify(e))
				_.assert(e.code === 'InvalidParamId')//indexOf('invalid object id') !== -1)
				done()
			})*/
			client.view('specific', [5005], function(err, v){
				//console.log(JSON.stringify(v.toJson()))
				//_.assertNot(v.has('e'))
				if(err){
					done()
				}else{
					done.fail()
				}
			})
		})
	})
}


exports.delFromTypeset = function(config, done){
	//console.log('destruction config: ' + JSON.stringify(config))
	var theObj
	var theOtherClient
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', function(err, c){
				if(err) throw err
				
				var added = false
				var oldHandle
				done.poll(function(){
					if(c.s.size() === 1){
						//console.log('added')
						c.s.each(function(obj){
							oldHandle = obj
						})
						if(client === theOtherClient){
							_.assert(theObj === oldHandle)
						}
						added = true
					}
					if(added && c.s.size() === 0){
						//console.log('deleted: ' + oldHandle + ' ' + oldHandle._destroyed)
						_.assert(oldHandle.isDestroyed())
						done()
						return true
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					//console.log('got client for destroy')
					theOtherClient = otherClient
					otherClient.view('general', function(err, v){
						var obj = v.make('entity', {v: 'test'})
						console.log('created entity')
						theObj = obj
						setTimeout(function(){
							obj.del()
						},500)
					})
				})
				
			})
		})
	})
}

exports.retrieveAfterDel = function(config, done){
	//console.log('destruction config: ' + JSON.stringify(config))
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(otherClient){
			//console.log('got client for destroy')
			otherClient.view('empty', function(err, v){
				var obj = v.make('entity', {v: 'test'})
				setTimeout(function(){
					obj.del()

					setTimeout(function(){
						minnow.makeClient(config.port, function(client){
							console.log('opening general view')
							client.view('general', function(err, c){
								if(err) throw err
		
								_.assert(c.s.size() === 0)
								done()
								return true
							})
						})
					},200)
				},200)
			})
		})
	})
}

exports.destroyedInIndex = function(config, done){
	//console.log('destruction config: ' + JSON.stringify(config))
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('byString', ['test'], function(err, c){
				if(err) throw err
				
				var added = false
				done.poll(function(){
					if(c.s.size() === 1){
						//console.log('added')
						added = true
					}
					if(added && c.s.size() === 0){
						//console.log('deleted')
						done()
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					//console.log('got client for destroy')
					otherClient.view('empty', function(err, v){
						var obj = v.make('entity', {v: 'test'})
						setTimeout(function(){
							//console.log('deleted')
							obj.del()
						},500)
					})
				})
				
			})
		})
	})
}

exports.stringsFromDestroyed = function(config, done){
	//console.log('destruction config: ' + JSON.stringify(config))
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('stringsFrom', function(err, c){
				if(err) throw err
				
				var added = false
				done.poll(function(){
					if(!added && c.s.size() === 1){
						console.log('added')
						added = true
					}
					if(added && c.s.size() === 0){
						console.log('deleted')
						done()
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					//console.log('got client for destroy')
					otherClient.view('empty', function(err, v){
						var obj = v.make('entity', {v: 'test'})
						setTimeout(function(){
							//console.log('deleted')
							obj.del()
						},500)
					})
				})
				
			})
		})
	})
}
