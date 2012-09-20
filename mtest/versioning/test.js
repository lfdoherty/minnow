
var minnow = require('./../../client/client')//this is the minnow include

var _ = require('underscorem')

function poll(f){var ci=setInterval(wf,10);function wf(){
	try{
		if(f()){
			clearInterval(ci)
		}
	}catch(e){
		clearInterval(ci)
		throw e
	}
}}


exports.hasTopVersions = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', function(c){
			
				poll(function(){
					//console.log(JSON.stringify(c.e.versions()))
					if(c.has('e') && c.e.versions().length === 4){
						done()
						return true
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('empty', function(v){
						var e = v.make('entity')
						e.text.set('test1')
						e.text.set('test2')
						e.text.set('test3')						
					})
				})
				
			})
		})
	})
}

exports.getTopVersion = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', function(c){
			
				poll(function(){
					//console.log(JSON.stringify(c.toJson()))
					if(c.has('e') && c.e.versions().length === 4){
						var olderVersion = c.e.version(c.e.versions()[2])
						//console.log('version text: ' + olderVersion.text.value())
						_.assertEqual(olderVersion.text.value(), 'test2')
						done()
						return true
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('empty', function(v){
						var e = v.make('entity')
						e.text.set('test1')
						e.text.set('test2')
						e.text.set('test3')						
					})
				})
				
			})
		})
	})
}

exports.revertTop = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', function(c){
			
				var hasReverted = false
				
				poll(function(){
					if(c.has('e') && c.e.versions().length === 4 && !hasReverted){
						hasReverted = true
						c.e.revert(c.e.versions()[2])
					}else if(hasReverted && c.e.versions().length === 5){
						_.assertEqual(c.e.text.value(), 'test2')
						done()
						return true
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('empty', function(v){
						var e = v.make('entity')
						e.text.set('test1')
						e.text.set('test2')
						e.text.set('test3')	
					})
				})
				
			})
		})
	})
}

exports.versionPrimitive = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', function(c){
			
				var hasReverted = false
				
				poll(function(){
					//if(c.has('e')) console.log('versions: ' + JSON.stringify(c.e.text.versions()))
					if(c.has('e') && c.e.text.versions().length === 4){
						done()
						return true
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('empty', function(v){
						var e = v.make('entity')
						e.text.set('test1')
						e.text.set('test2')
						e.description.set('desc1')
						e.text.set('test3')	
					})
				})
				
			})
		})
	})
}

exports.revertPrimitive = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', function(c){
			
				var hasReverted = false
				
				poll(function(){
					//if(c.has('e')) console.log('versions: ' + JSON.stringify(c.e.text.versions()))
					if(c.has('e') && c.e.text.versions().length === 4 && !hasReverted){
						hasReverted = true

						_.assertEqual(c.e.text.value(), 'test3')
						_.assertEqual(c.e.description.value(), 'desc2')

						c.e.text.revert(c.e.text.versions()[2])
						//console.log('reverted')
					}
					if(hasReverted && c.e.text.versions().length === 5){
						_.assertEqual(c.e.text.value(), 'test2')
						done()
						return true
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('empty', function(v){
						var e = v.make('entity')
						e.text.set('test1')
						e.text.set('test2')
						e.description.set('desc1')
						e.text.set('test3')	
						e.description.set('desc2')
					})
				})
				
			})
		})
	})
}

exports.revertPrimitiveDouble = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', function(c){
			
				var hasReverted = false
				
				poll(function(){
					if(c.has('e') && c.e.text.versions().length === 4 && !hasReverted){

						_.assertEqual(c.e.text.value(), 'test3')
						_.assertEqual(c.e.description.value(), 'desc2')

						hasReverted = true
						c.e.text.revert(c.e.text.versions()[2])
						c.e.description.revert(c.e.description.versions()[1])
						//console.log('reverted')
					}
					//if(c.has('e')) console.log('versions: ' + JSON.stringify(c.e.description.versions()))
					if(hasReverted && c.e.text.versions().length === 5 && c.e.description.versions().length === 4){
						_.assertEqual(c.e.text.value(), 'test2')
						_.assertEqual(c.e.description.value(), 'desc1')
						done()
						return true
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('empty', function(v){
						var e = v.make('entity')
						e.text.set('test1')
						e.text.set('test2')
						e.description.set('desc1')
						e.text.set('test3')	
						e.description.set('desc2')
					})
				})
				
			})
		})
	})
}

exports.versionMapValue = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', function(c){
			
				var hasReverted = false
				
				poll(function(){
					//if(c.has('e')) console.log('*versions: ' + JSON.stringify(c.e.versions()))
					//if(c.has('e')) console.log('versions: ' + JSON.stringify(c.e.values.get('kb').versions()))
					if(c.has('e') && c.e.versions().length === 5 && c.e.values.get('kb').versions().length === 3){
						//var kb = e.values.get('kb')
						//var versions = kb.versions()
						done()
						return true
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('empty', function(v){
						var e = v.make('entity')
						e.values.put('ka', 'vWrong')
						e.values.put('kb', 'vb')
						e.values.put('ka', 'va')
						e.values.put('kb', 'vWrong')
						
					})
				})
				
			})
		})
	})
}

exports.revertMapValue = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', function(c){
			
				var hasReverted = false
				
				poll(function(){
					//if(c.has('e')) console.log('versions: ' + JSON.stringify(c.e.text.versions()))

					if(!hasReverted && c.has('e') && c.e.versions().length === 5 && c.e.values.get('kb').versions().length === 3){
						hasReverted = true
						var kb = c.e.values.get('kb')
						_.assertEqual(kb.value(), 'vWrong')
						var versions = kb.versions()
						kb.revert(versions[1])
					}else if(hasReverted && c.e.values.get('kb').versions().length === 4){
						_.assertEqual(c.e.values.value('kb'), 'vb')
						done()
						return true
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('empty', function(v){
						var e = v.make('entity')
						e.values.put('ka', 'vWrong')
						e.values.put('kb', 'vb')
						e.values.put('ka', 'va')
						e.values.put('kb', 'vWrong')
					})
				})
				
			})
		})
	})
}

exports.versionsQuery = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('generalWithVersions', function(c){
			
				poll(function(){
					//if(c.has('e')) console.log('versions: ' + JSON.stringify(c.ev.toJson()))
					if(c.ev.toJson().length === 5){
						var ts = c.ev.toJson()[1]						
						_.assert(ts > 0)
						done()
						return true
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('empty', function(v){
						var e = v.make('entity')
						e.text.set('test1')
						e.text.set('test2')
						e.description.set('desc1')
						e.text.set('test3')	
					})
				})
				
			})
		})
	})
}

exports.versionsQueryMany = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('generalWithManyVersions', function(c){
			
				poll(function(){
					//if(c.has('e')) console.log('versions: ' + JSON.stringify(c.ev.toJson()))
					if(c.ev.toJson().length === 10){
						var ts = c.ev.toJson()[1]						
						_.assert(ts > 0)
						done()
						return true
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('empty', function(v){
						var e = v.make('entity')
						e.text.set('test1')
						e.text.set('test2')
						e.description.set('desc1')
						e.text.set('test3')
						var e = v.make('entity')
						e.text.set('test1')
						e.text.set('test2')
						e.description.set('desc1')
						e.text.set('test3')		
					})
				})
				
			})
		})
	})
}

exports.versionTopTimestamp = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('generalWithTimestamps', function(c){
			
				poll(function(){
					//if(c.has('e')) console.log('timestamps: ' + JSON.stringify(c.et.toJson()))
					if(c.et.count() === 5){
						var ts = c.et.toJson()[1]						
						_.assert(ts > 0)
						_.assert(Date.now() - ts < 60*1000)
						done()
						return true
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('empty', function(v){
						var e = v.make('entity')
						e.text.set('test1')
						e.text.set('test2')
						e.description.set('desc1')
						e.text.set('test3')	
					})
				})
				
			})
		})
	})
}

