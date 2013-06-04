
var _ = require('underscorem')

var minnow = require('./../../client/client')
var u = require('./../util')
u.reset(run)

var Concurrency = 400
var Steps = 100

/*
try{
var agent = require('webkit-devtools-agent');
}catch(e){
}
*/

function poll(f){var ci=setInterval(wf,10);function wf(){if(f()){clearInterval(ci)}}}
function rand(n){return Math.floor(Math.random()*n)}


function startClient(serverPort, cb){
	minnow.makeClient(serverPort, function(client){
		client.view('general', function(err, v){
			if(err) throw err
			
			cb(function(){
				v.make('entity', {}, true)
			}, function(many){
				return v.count.value() === many
			})
		})
	})

}

function run(){
	var start = Date.now()
	
	//setTimeout(function(){
	
	minnow.makeServer(u.config, function(){
		console.log('made server')
		
		var update = []
		var check = []
		var step = 0

		var latencies = []

		function updateAll(){
			++step
			//console.log('updating')
			if(step === Steps){
				console.log('done after ' + (Date.now()-start)+'ms')
				latencies.sort(function(a,b){return b - a;})
				console.log(JSON.stringify(latencies.slice(0,100)))
				process.exit(0)
			}
			for(var i=0;i<update.length;++i){
				var f = update[i]
				f()
			}
			beginCheck()
		}

		var startedCheck
		var passed
		function beginCheck(){
			passed = {}//[].concat(check)
			startedCheck = Date.now()
			tryCheck()
		}
		
		function tryCheck(){
			var unpassed = 0
			for(var i=0;i<check.length;++i){
				if(passed[i]){
					continue
				}else{
					if(!check[i](step*Concurrency)){
						++unpassed
					}else{
						passed[i] = true
						latencies.push(Date.now() - startedCheck)
					}
				}
			}
			if(unpassed === 0){
				updateAll()
			}else{
				//console.log('waiting for: ' + unpassed)
				setTimeout(tryCheck,1)
			}
		}
		
		var cdl = _.latch(Concurrency, function(){
			console.log('all started, beginning updates')
			
			updateAll()
		})
		
		var started = 0
		for(var i=0;i<Concurrency;++i){
			startClient(u.config.port, function(updateFunc, checkFunc){
				++started
				console.log(started)
				update.push(updateFunc)
				check.push(checkFunc)
				cdl()
			})
		}
	})
	
	//},15000)
}

