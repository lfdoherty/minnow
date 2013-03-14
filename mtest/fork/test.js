
var minnow = require('./../../client/client')//this is the minnow include

var _ = require('underscorem')

function poll(f){var ci=setInterval(wf,10);function wf(){try{if(f()){clearInterval(ci)}}catch(e){clearInterval(ci);throw e;}}}

exports.basicFork = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', function(err, c){
				if(err) throw err
				
				poll(function(){
					//console.log(c.e._isFork + ' ' + c)
					if(c.has('e') && c.e.name.value() === 'original'){
						done()
						return true
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('empty', function(err, v){
						var ev = v.make('entity', {name: 'original'})
						var n = ev.fork()
						n.reallyAFork.set(true)
					})
				})
				
			})
		})
	})
}

exports.forkChangedAfter = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', function(err, c){
			
				poll(function(){
					if(c.has('e')) console.log((c.e.has('name')?c.e.name.rally:'noname') + ' ' + c.e._gg + ' ' + c.e.special + ' ' + c.e._isFork + ' ' + c)
					if(c.has('e') && c.e.name.value() === 'original'){
						done()
						return true
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('empty', function(err, v){
						var ev = v.make('entity')
						var n = ev.fork()
						n.reallyAFork.set(true)
						setTimeout(function(){
							ev.name.set('original')
							//_.assertEqual(n.name.value(),'original')
						},100)
						
					})
				})
				
			})
		})
	})
}
exports.forkChangedImmediately = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', function(err, c){
			
				/*poll(function(){
					if(c.has('e')) console.log((c.e.has('name')?c.e.name.rally:'noname') + ' ' + c.e._gg + ' ' + c.e.special + ' ' + c.e._isFork + ' ' + c)
					if(c.has('e') && c.e.name.value() === 'original'){
						done()
						return true
					}
				})*/

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('empty', function(err, v){
						var ev = v.make('entity')
						var n = ev.fork()
						n.reallyAFork.set(true)
						//setTimeout(function(){
							ev.name.set('original')
							_.assertEqual(n.name.value(),'original')
							done()
						//},100)
						
					})
				})
				
			})
		})
	})
}
exports.forkQuery = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('forkQuery', function(err, c){
			
				poll(function(){
					//console.log(c.e._gg + ' ' + c.e.special + ' ' + c.e._isFork + ' ' + c)
					if(c.has('e') && c.e.name.value() === 'original'){
						done()
						return true
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('empty', function(err, v){
						var ev = v.make('entity', {name: 'original'})
						var n = ev.fork()
						n.reallyAFork.set(true)
						//setTimeout(function(){
						//},100)
					})
				})
				
			})
		})
	})
}
exports.forkQueryWithSlightlyLaterOriginalChange = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('forkQuery', function(err, c){
			
				poll(function(){
					//console.log(c.e._gg + ' ' + c.e.special + ' ' + c.e._isFork + ' ' + c)
					if(c.has('e') && c.e.name.value() === 'original'){
						done()
						return true
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('empty', function(err, v){
						var ev = v.make('entity')
						ev.name.set('original')
						var n = ev.fork()
						n.reallyAFork.set(true)
						//setTimeout(function(){
						//},100)
					})
				})
				
			})
		})
	})
}

exports.refork = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('forkQueryTwo', function(err, c){
			
				poll(function(){
					//console.log(c.e._gg + ' ' + c.e.special + ' ' + c.e._isFork + ' ' +  c.e._forkedObject + ' ' +c)
					if(c.has('e') && c.e.name.value() === 'purpled'){
						done()
						return true
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('empty', function(err, v){
						var ev = v.make('entity')
						ev.name.set('original')

						var n = ev.fork()
						n.reallyAFork.set(true)
						setTimeout(function(){

							var e2 = v.make('entity', {name: 'purpled'})
							n.setForked(e2)
							
						},100)
					})
				})
				
			})
		})
	})
}

exports.reforkUnforked = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('forkQueryTwo', function(err, c){
			
				poll(function(){
					//console.log(c.e._gg + ' ' + c.e.special + ' ' + c.e._isFork + ' ' +  c.e._forkedObject + ' ' +c)
					if(c.has('e') && c.e.has('name') && c.e.name.value() === 'purpled'){
						done()
						return true
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('empty', function(err, v){
						var ev = v.make('entity')
						ev.name.set('original')

						var n = v.make('entity')//ev.fork()
						n.reallyAFork.set(true)
						setTimeout(function(){

							var e2 = v.make('entity', {name: 'purpled'})
							n.setForked(e2)
							
						},100)
					})
				})
				
			})
		})
	})
}

exports.changeOriginalAfterRefork = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', function(err, c){
			
				poll(function(){
					if(c.has('e')){
						//console.log(c.e._gg + ' ' + c.e.special + ' ' + c.e._isFork + ' ' +  c.e._forkedObject + ' ' +c)
						if(c.e.name.value() === 'blue'){
							console.log('INVALID CHANGE HAPPENED')
							done.fail()
							return true
						}else if(c.e.name.value() === 'pink'){
							done()
							return true
						}
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('empty', function(err, v){
						var ev = v.make('entity')
						ev.name.set('original')

						var n = ev.fork()
						n.reallyAFork.set(true)
						setTimeout(function(){

							var e2 = v.make('entity', {name: 'purpled'})
							n.setForked(e2)
							
							ev.name.set('blue')
							
							setTimeout(function(){
								n.name.set('pink')
							},100)
						},100)
					})
				})
				
			})
		})
	})
}

exports.queryRefork = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('forkQueryTwo', function(err, c){
			
				poll(function(){
					//console.log(c.e._gg + ' ' + c.e.special + ' ' + c.e._isFork + ' ' +  c.e._forkedObject + ' ' +c)
					if(c.has('e') && c.e.name.value() === 'purpled'){
						done()
						return true
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('empty', function(err, v){
						var ev = v.make('entity')
						//ev.name.set('original')

						var n = ev.fork()
						n.reallyAFork.set(true)
						setTimeout(function(){

							var e2 = v.make('entity', {name: 'test'})
							n.setForked(e2)

							setTimeout(function(){
								e2.name.set('purpled')
							},100)
						},100)
					})
				})
				
			})
		})
	})
}

exports.allForked = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('forkQueryAllForked', function(err, c){
				if(err) throw err
			
				poll(function(){
					//console.log(c.es.count())
					if(c.es.count() === 2){
						done()
						return true
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('empty', function(err, v){
						var ev = v.make('entity')
						ev.name.set('original')

						var a = v.make('entity')
						var b = a.fork()
						a.setForked(ev)
					})
				})
				
			})
		})
	})
}

exports.preforkedQuery = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('forkQueryPreforked', function(err, c){
			
				poll(function(){
					//console.log(c.has('e') + ' ' + c.e._gg + ' ' + c.e.special + ' ' + c.e._isFork + ' ' +  c.e._forkedObject + ' ' +c)
					if(c.has('e') && c.e.name.value() !== 'purpled' && c.e.reallyAFork.value()){
						done()
						return true
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('empty', function(err, v){
						var ev = v.make('entity', {name: 'purpled'})
						var n = v.make('entity')
						n.reallyAFork.set(true)
					})
				})
				
			})
		})
	})
}

exports.forkWithLocalEdits = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('empty', function(err, c){
	
				var ev = c.make('entity', {name: 'original'})
				var nc = c.make('container')
				nc.objs.add(ev)

				var n = nc.fork()

				//setTimeout(function(){

					if(!n.objs.has(ev)){
						done.fail('fork did not bring over object property')
						return
					}
			
					done()
				
				//},200)
			})
		})
	})
}
