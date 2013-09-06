
var minnow = require('./../../client/client')//this is the minnow include

var _ = require('underscorem')

exports.hasTopVersions = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', function(err, c){
			
				done.poll(function(){
					console.log(JSON.stringify(c.e.versions()))
					if(c.has('e') && c.e.versions().length === 4){
						done()
						return true
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('empty', function(err, v){
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
			client.view('general', function(err, c){
			
				done.poll(function(){
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
					otherClient.view('empty', function(err, v){
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
/*
exports.revertTop = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', function(err, c){
			
				var hasReverted = false
				
				done.poll(function(){
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
					otherClient.view('empty', function(err, v){
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
*/
exports.versionPrimitive = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', function(err, c){
			
				var hasReverted = false
				
				done.poll(function(){
					if(c.has('e')) console.log('versions: ' + c.e.text.value() + ' ' + JSON.stringify(c.e.text.versions()))
					if(c.has('e') && c.e.text.versions().length === 4){
						done()
						return true
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('empty', function(err, v){
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

exports.copyVersions = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', function(err, c){
			
				var hasReverted = false
				
				done.poll(function(){
					//if(c.has('e')) console.log('versions: ' + c.e.text.value() + ' ' + JSON.stringify(c.e.text.versions()))
					/*if(c.has('e') && c.e.text.versions().length === 4){
						done()
						return true
					}*/
					if(c.all.count() === 2){
						var versionSets = []
						c.all.each(function(v){
							versionSets.push(v.versionsSelf())
						})
						//versionSets.push([])
						versionSets.sort(function(a,b){return a.length - b.length;})
						
						console.log('version sets: ' + JSON.stringify(versionSets))
						
						_.assertEqual(versionSets[0].length, 1)
						_.assertEqual(versionSets[1].length, 1)
						
						done()
						
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('empty', function(err, v){
						var e = v.make('entity', {text: 'test1'}, function(){
							var c = e.copy({description: 'desc1', text: 'test2'})
						})
						//e.text.set('test1')
						/*e.text.set('test2')
						e.description.set('desc1')
						e.text.set('test3')	*/
					})
				})
				
			})
		})
	})
}
exports.copyVersionsAfterChange = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', function(err, c){
			
				var hasReverted = false
				
				done.poll(function(){
					//if(c.has('e')) console.log('versions: ' + c.e.text.value() + ' ' + JSON.stringify(c.e.text.versions()))
					/*if(c.has('e') && c.e.text.versions().length === 4){
						done()
						return true
					}*/
					if(c.all.count() === 2){
						var versionSets = []
						c.all.each(function(v){
							versionSets.push(v.versionsSelf())
						})
						//versionSets.push([])
						versionSets.sort(function(a,b){return a.length - b.length;})
						
						_.assertEqual(versionSets[0].length, 1)
						if(versionSets[1].length === 2){
							//_.assertEqual(versionSets[1].length, 2)
							
							done()
						}
						console.log('version sets: ' + JSON.stringify(versionSets))
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('empty', function(err, v){
						var e = v.make('entity', {text: 'test1'}, function(){
							var c = e.copy({description: 'desc1', text: 'test2'})
							c.text.set('test3')
						})
						//e.text.set('test1')
						/*e.text.set('test2')
						e.description.set('desc1')
						e.text.set('test3')	*/
					})
				})
				
			})
		})
	})
}

exports.copyManyVersionsAfterChange = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', function(err, c){
			
				var hasReverted = false
				
				done.poll(function(){
					//if(c.has('e')) console.log('versions: ' + c.e.text.value() + ' ' + JSON.stringify(c.e.text.versions()))
					/*if(c.has('e') && c.e.text.versions().length === 4){
						done()
						return true
					}*/
					if(c.all.count() === 2){
						var versionSets = []
						c.all.each(function(v){
							versionSets.push(v.versionsSelf())
						})
						//versionSets.push([])
						versionSets.sort(function(a,b){return a.length - b.length;})
						
						console.log('version sets: ' + JSON.stringify(versionSets))
						
						//_.assertEqual(versionSets[0].length, 1)
						//console.log(
						if(versionSets[0].length === 2){
							//_.assertEqual(versionSets[1].length, 2)
							
							done()
						}
						//console.log(versionSets[1].length)
						//
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('empty', function(err, v){
						var e = v.make('entity', {text: 'test1'}, function(){
						
							for(var i=0;i<20;++i){
								e.text.set(e.text.value()+'a')
							}
							setTimeout(function(){
						
								var c = e.copy({description: 'desc1', text: 'test2'})
								c.text.set('test3')
							},200)
						})
						//e.text.set('test1')
						/*e.text.set('test2')
						e.description.set('desc1')
						e.text.set('test3')	*/
					})
				})
				
			})
		})
	})
}

exports.copyManyVersionsImmediate = function(config, done){
	minnow.makeServer(config, function(){
		/*minnow.makeClient(config.port, function(client){
			client.view('general', function(err, c){
			
				var hasReverted = false
				
				done.poll(function(){
					//if(c.has('e')) console.log('versions: ' + c.e.text.value() + ' ' + JSON.stringify(c.e.text.versions()))

					if(c.all.count() === 2){
						var versionSets = []
						c.all.each(function(v){
							versionSets.push(v.versionsSelf())
						})
						//versionSets.push([])
						versionSets.sort(function(a,b){return a.length - b.length;})
						
						console.log('version sets: ' + JSON.stringify(versionSets))
						
						//_.assertEqual(versionSets[0].length, 1)
						//console.log(
						if(versionSets[0].length === 2){
							//_.assertEqual(versionSets[1].length, 2)
							
							done()
						}
						//console.log(versionSets[1].length)
						//
					}
				})*/

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('empty', function(err, v){
						var e = v.make('entity', {text: 'test1'}, function(){
						
							for(var i=0;i<20;++i){
								e.text.set(e.text.value()+'a')
							}
							setTimeout(function(){
						
								var c = e.copy({description: 'desc1', text: 'test2'})
								//c.text.set('test3')
								console.log(JSON.stringify(c.versionsSelf()))
								_.assertEqual(c.versionsSelf().length, 1)	
								done()
							},200)
						})
						//e.text.set('test1')
						/*e.text.set('test2')
						e.description.set('desc1')
						e.text.set('test3')	*/
					})
				})
				
			//})
		//})
	})
}
exports.copyVersionsWithUuid = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general_canno', function(err, c){
			
				var hasReverted = false
				
				done.poll(function(){
					//if(c.has('e')) console.log('versions: ' + c.e.text.value() + ' ' + JSON.stringify(c.e.text.versions()))
					/*if(c.has('e') && c.e.text.versions().length === 4){
						done()
						return true
					}*/
					if(c.all.count() === 2){
						var versionSets = []
						c.all.each(function(v){
							versionSets.push(v.versionsSelf())
						})
						//versionSets.push([])
						versionSets.sort(function(a,b){return a.length - b.length;})
						
						console.log('version sets: ' + JSON.stringify(versionSets))
						
						_.assertEqual(versionSets[0].length, 1)
						_.assertEqual(versionSets[1].length, 1)
						
						done()
						
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('empty', function(err, v){
						var e = v.make('canno', {text: 'test1'}, function(){
							var c = e.copy({description: 'desc1', text: 'test2'})
						})
						//e.text.set('test1')
						/*e.text.set('test2')
						e.description.set('desc1')
						e.text.set('test3')	*/
					})
				})
				
			})
		})
	})
}
/*
exports.revertPrimitive = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', function(err, c){
			
				var hasReverted = false
				
				done.poll(function(){
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
					otherClient.view('empty', function(err, v){
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
			client.view('general', function(err, c){
			
				var hasReverted = false
				
				done.poll(function(){
					if(c.has('e') && c.e.text.versions().length === 4 && !hasReverted){

						_.assertEqual(c.e.text.value(), 'test3')
						_.assertEqual(c.e.description.value(), 'desc2')

						hasReverted = true
						c.e.text.revert(c.e.text.versions()[2])
						c.e.description.revert(c.e.description.versions()[1])
						//console.log('reverted')
					}
					if(c.has('e')) console.log('versions: ' + JSON.stringify(c.e.description.versions()))
					if(hasReverted && c.e.text.versions().length === 5 && c.e.description.versions().length === 4){
						//console.log('versions: ' + JSON.stringify(c.e.description.versions()))
						_.assertEqual(c.e.text.value(), 'test2')
						_.assertEqual(c.e.description.value(), 'desc1')
						done()
						return true
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('empty', function(err, v){
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
*/
exports.versionMapValue = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', function(err, c){
			
				var hasReverted = false
				
				done.poll(function(){
					//if(c.has('e')) console.log('*versions: ' + JSON.stringify(c.e.versions()))
					if(c.has('e')) console.log('versions: ' + JSON.stringify(c.e.values.get('kb').versions()))
					if(c.has('e') && c.e.versions().length === 5 && c.e.values.get('kb').versions().length === 3){
						//var kb = e.values.get('kb')
						//var versions = kb.versions()
						done()
						return true
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('empty', function(err, v){
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
/*
exports.revertMapValue = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', function(err, c){
			
				var hasReverted = false
				
				done.poll(function(){
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
					otherClient.view('empty', function(err, v){
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
*/
exports.versionsQuery = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('generalWithVersions', function(err, c){
			
				done.poll(function(){
					//if(c.has('e')) console.log('versions: ' + JSON.stringify(c.ev.toJson()))
					if(c.ev.toJson().length === 5){
						var ts = c.ev.toJson()[1]						
						_.assert(ts > 0)
						done()
						return true
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('empty', function(err, v){
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

exports.lastVersionQuery = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('generalWithLastVersion', function(err, c){
			
				done.poll(function(){
					//if(c.has('e')) console.log('versions: ' + JSON.stringify(c.ev.toJson()))
					if(c.has('ev') && c.ev.value() > 0){
						//_.assert(ts > 0)
						done()
						return true
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('empty', function(err, v){
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
			client.view('generalWithManyVersions', function(err, c){
			
				done.poll(function(){
					//if(c.has('e')) console.log('versions: ' + JSON.stringify(c.ev.toJson()))
					if(c.ev.toJson().length === 10){
						var ts = c.ev.toJson()[1]						
						_.assert(ts > 0)
						done()
						return true
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('empty', function(err, v){
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
			client.view('generalWithTimestamps', function(err, c){
			
				done.poll(function(){
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
					otherClient.view('empty', function(err, v){
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


exports.lastVersionTimestamp = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('generalWithSingleTimestamp', function(err, c){
			
				done.poll(function(){
					//if(c.has('e')) console.log('timestamps: ' + JSON.stringify(c.et.toJson()))
					if(c.has('et') && c.et.value() > 0 && Date.now() - c.et.value() < 60*1000){
						//var ts = c.et.toJson()[1]						
						//_.assert(ts > 0)
						//_.assert(Date.now() - ts < 60*1000)
						done()
						return true
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('empty', function(err, v){
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
