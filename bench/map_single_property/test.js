/* 
	Time to beat (N,K,T ms): (200000,10,21219)
	
	since QER:
	(200*1000,10,23943)
*/

var N = 200000
var K = 10


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
			
				var h = setInterval(function(){
					//console.log('count: '+ c.m.size())
					//console.log('many: ' + c.many.value())
					//console.log(JSON.stringify(c.m.toJson()))
					if(c.many.value() === N){
						clearInterval(h)
						console.log('done: ' + (Date.now()-start))
						process.exit(0)
					}
				},10)
					
				console.log('got view, making')
					
				for(var i=0;i<N;++i){
					
					c.make('entity', {key: i%K, v: i}, true)
				}
			})
		})
	})
}
