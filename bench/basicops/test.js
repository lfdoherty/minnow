
var minnow = require('./../../client/client')

var _ = require('underscorem')

function poll(f){var ci=setInterval(wf,10);function wf(){if(f()){clearInterval(ci)}}}

var N = 10*1000*1000

require('quicklog').setLevelErr()

function rand(n){return Math.floor(Math.random()*n)}

var RATIO = .0001
function testAgeThreshold(minnow, port, done){
	return function(c){
			
		poll(function(){
			if(Math.random() < .1) console.log('adults: ' + c.oldEnough.size())
			if(c.oldEnough.size() >= (N*RATIO*.90)){
				console.log('done')
				done()
				return true
			}
		})

		minnow.makeClient(port, function(otherClient){
			otherClient.view('general', function(v){
				makePartially(v)
				//makeFully(v)
				console.log('done making')
			})
		})
		
	}
}

function makeFully(v){
	for(var i=0;i<N;++i){
		v.make('entity', {age: rand(Math.round(1/RATIO))}, true)
	}
}

function makePartially(v){
	var n = 0
	var ci = setInterval(function(){
		++n
		if(n === 100){
			clearInterval(ci)
		}
		for(var i=0;i<N/100;++i){
			//console.log('making')
			v.make('entity', {age: rand(Math.round(1/RATIO))}, true)
		}
	},25)
}

var mtrace = require('mtrace');

exports.singlePropertySubset = function(config, done){//benchmark to beat: N=10M in 101 seconds (~99000/sec)
	minnow.makeServer(config, function(){
		console.log('made server')
		//setTimeout(function(){
		//var filename = mtrace.mtrace();
		//console.log('Saving mtrace to ' + filename);

		minnow.makeClient(config.port, function(client){
			client.view('specific', [18], testAgeThreshold(minnow, config.port, function(){
				//mtrace.gc();
			//	mtrace.muntrace()
				done()
				//setTimeout(	done, 20000)
			}))
		})
		//},30000)
	})
}

//not a very important benchmark - probably unrealistic (for performance, use the makeEmpty approach if creating objects in bulk)
exports.make = function(config, done){
	minnow.makeServer(config, function(){
		console.log('made server')
		minnow.makeClient(config.port, function(client){
			client.view('general', [], function(c){
				var rn = 0
				function counter(){
					//console.log('made')
					++rn
					if(rn === N){
						console.log('done making')
						//done()
					}
				}
				for(var i=0;i<N;++i){
					c.make('entity', {age: rand(20)}, counter)
				}
			})
		})
	})
}

var NE = 10000
exports.makeEmpty = function(config, done){
	minnow.makeServer(config, function(){
		console.log('made server')
		minnow.makeClient(config.port, function(client){
			client.view('general', [], function(c){
				for(var i=0;i<NE;++i){
					c.make('entity', {age: rand(20)}, true)
				}

				c.make('entity', {age: rand(20)}, function(){
					console.log('done making')
					done()
				})

				//setTimeout(done,1000)
			})
		})
	})
}

var FPN = 50000
exports.fastPersist = function(config, done){

	function reload(doneCb){
		console.log('persist test reloading server')
		//var reloadStart = Date.now()
		minnow.makeServer(config, function(s){
			minnow.makeClient(config.port, function(c){
				c.view('counter', [], function(handle){
					if(handle.manyEntities.value() !== FPN) throw new Error('persistence failure: ' + handle.manyEntities.value())
					
					//console.log('reload took: ' + (Date.now()-reloadStart))
					//done()
					c.close(function(){
						s.close(function(){
							doneCb()
						})
					})
				})
			})
		})
	}

	minnow.makeServer(config, function(s){
		minnow.makeClient(config.port, function(c){
			for(var i=0;i<FPN;++i){
				c.make('entity', {age: rand(20)})
			}
			
			var start = Date.now()
			var NS = 20
			var isDone = false
			var cdl = _.latch(NS, function(){
				console.log('restarting ' + NS + ' times with ' + FPN + ' small objects took: ' + (Date.now()-start) + 'ms.')
				isDone = true
				done()
			})
			
			function doReload(){
				cdl()
				if(!isDone){
					reload(doReload)
				}
			}

			c.close(function(){
				s.close(function(){
					reload(doReload)
				})
			})
		})
	})
}

