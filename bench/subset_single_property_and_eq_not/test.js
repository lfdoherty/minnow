
var minnow = require('./../../client/client')
var u = require('./../util')
u.reset(run)

var N = 1*1000*1000

/*
N=1M: 76361ms
N=100K: 8376ms //9400/9170
*/

try{
var agent = require('webkit-devtools-agent');
}catch(e){
}

function poll(f){var ci=setInterval(wf,10);function wf(){if(f()){clearInterval(ci)}}}

function rand(n){return Math.floor(Math.random()*n)}

var RATIO = .0001
function testAgeThreshold(minnow, port, done){
	return function(err, c){
		if(err) throw err
			
		poll(function(){
			if(Math.random() < .1) console.log('right: ' + c.right.size())
			console.log(JSON.stringify(process.memoryUsage()))
			//console.log(c.many.value() )
			if(c.many.value() === N){
				console.log('d: ' + c.right.size())
				done()
				return true
			}
		})

		minnow.makeClient(port, function(otherClient){
			otherClient.view('general', function(err, v){
				if(err) throw err
				
				makePartially(v)
				console.log('done making')
			})
		})
		
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
			v.make('person', {age: rand(Math.round(1/RATIO)), prink: rand(10), filbert: rand(10) === 5}, true)
		}
	},25)
}


function run(){
	var start = Date.now()
	
	//setTimeout(function(){
	
	minnow.makeServer(u.config, function(){
		console.log('made server')

		minnow.makeClient(u.config.port, function(client){
			client.view('specific', [32,5], testAgeThreshold(minnow, u.config.port, function(){
				console.log('done: ' + (Date.now()-start))
				process.exit(0)
				//done()
			}))
		})
	})
	
	//},30000)
}

