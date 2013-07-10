/* 

The goal here is to minimize the last poll time, mostly.
It should be very small - perhaps as low as 1ms.

				  first poll, second poll,... full time
(500,2000,10) -> (5,87,7, 25165)

*/

var N = 5*100
var K = 2000
var OVERLAP = 10

var PLUSSED = (K*2-OVERLAP)*N

var minnow = require('./../../client/client')
var u = require('./../util')
u.reset(run)

function run(){

	minnow.makeServer(u.config, function(){
		console.log('made server')

	
		minnow.makeClient(u.config.port, function(client){
	
			console.log('made client')
			var start = Date.now()
		
			client.view('general', function(err, c){
				if(err) throw err
				
				//var readied = false
			
				var h = setInterval(function(){
					//console.log('v: '+ JSON.stringify(c.toJson()))//c.plussed.value())
					//console.log(PLUSSED)
					if(c.plussed.value() === PLUSSED){
						//readied = true
						c.make('container', {eId: 10, numbers: [10]}, function(){
							c.make('container', {eId: 10, numbers: [10]}, function(){
								clearInterval(h)
								console.log('done: ' + (Date.now()-start))
								console.log(PLUSSED)
								process.exit(0)
							})
						})
					}
				},10)
						
				for(var i=0;i<N;++i){
					(function(i){
					
						var a = []
						for(var j=0;j<K;++j){
							a.push(j)
						}
						var b = []
						for(var j=0;j<K;++j){
							b.push(j+(K-OVERLAP))
						}
						//console.log('genned: ' + JSON.stringify(genned))
						var entity = c.make('entity', function(eId){
							//console.log(entity.id())
							c.make('container', {eId: entity.id(), numbers: a, more: b}, true)
						})
					
					})(i)
				}
			})
		})
	})
}
