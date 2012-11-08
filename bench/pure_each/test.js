/* 
	Time to beat (N,K,T ms): (500000,2,65963)
*/

var N = 500000
var K = 2

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
				//	console.log('v: '+ c.many.value())
					if(c.many.value() === N){
						clearInterval(h)
						console.log('done: ' + (Date.now()-start))
						process.exit(0)
					}
				},10)
						
				for(var i=0;i<N;++i){
					var genned = []
					for(var j=0;j<K;++j){
						genned.push(j)
					}
					//console.log('genned: ' + JSON.stringify(genned))
					c.make('entity', {numbers: genned}, true)
				}
			})
		})
	})
}
