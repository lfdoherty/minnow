
var minnow = require('./../../client/client')
var u = require('./../util')
u.reset(run)

var N = 2*1000*100

//59268ms

//38318ms

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
			
		var start = Date.now()
		
		poll(function(){
			if(Math.random() < .1) console.log('right: ' + c.right.value())
			//console.log(c.many.value() )
			if(c.many.value() === N){
				//console.log('d: ' + c.oldEnough.size())
				
				var remaining = 1000
				function repeatedlyCreate(){
					--remaining
					if(remaining === 0){
						console.log('*done: ' + (Date.now()-start))
						process.exit(0)
						//done()
					}else{
						//c.make('entity', {}, repeatedlyCreate)
						//c.make('person', {age: rand(Math.round(1/RATIO))}, repeatedlyCreate)
						c.make('person', {age: rand(Math.round(1/RATIO)), prink: rand(10)}, repeatedlyCreate)
					}
				}
				
				repeatedlyCreate()
				
				
				return true
			}
		})

		minnow.makeClient(port, function(otherClient){
			otherClient.view('general', function(err, v){
				if(err) throw err
				
				makePartially(v)
				//makeFully(v)
				console.log('done making')
			})
		})
		
	}
}

function makeFully(v){
	for(var i=0;i<N;++i){
		v.make('person', {age: Math.random()<.9?32:rand(Math.round(1/RATIO))}, true)
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
			v.make('person', {age: Math.random()<.9?32:rand(Math.round(1/RATIO)), prink: Math.random()<.9?5:rand(10)}, true)
		}
	},25)
}


function run(){
	var start = Date.now()
	
	//setTimeout(function(){

	var config = JSON.parse(JSON.stringify(u.config))
	config.pollrate = {fast: 1, slow: 1, medium: 1}
	
	minnow.makeServer(config, function(){
		console.log('made server')

		minnow.makeClient(u.config.port, function(client){
			client.view('specific', [32,5], testAgeThreshold(minnow, u.config.port, function(){
				console.log('done: ' + (Date.now()-start))
				process.exit(0)
				//done()
			}))
		})
	})
	
	//},15000)
}

