/* 

(50000) -> 124791ms (~90ms per poll)
 (5000) ->  24891ms

*/

var N = 5*1000*10

var minnow = require('./../../client/client')
var u = require('./../util')
u.reset(run)

function run(){

	var config = JSON.parse(JSON.stringify(u.config))
	config.pollrate = {fast: 1, slow: 1, medium: 1}

	minnow.makeServer(config, function(){
		console.log('made server')

	
		minnow.makeClient(u.config.port, function(client){
	
			console.log('made client')
			var start = Date.now()
		
			client.view('general', function(err, c){
				if(err) throw err
				
				var remaining = 1000
				function repeatedlyCreate(){
					--remaining
					if(remaining === 0){
						console.log('done: ' + (Date.now()-start))
						process.exit(0)
					}else{
						c.make('entity', {}, repeatedlyCreate)
					}
				}
			
				var h = setInterval(function(){

					//console.log(c.mapping.count())
					if(c.mapping.count() === N){
						clearInterval(h)
						/*c.make('entity', {},function(){
							c.make('entity', {},function(){
								console.log('done: ' + (Date.now()-start))
								process.exit(0)
							})
						}*/
						repeatedlyCreate()
					}
				},10)
						
				for(var i=0;i<N;++i){

					var e = c.make('entity', {})
					var hash = 'a'+Math.random()
					c.make('wrap', {parentEntity: e, hash: hash}, true)
					c.make('wrapwrap', {parentHash: hash, name: 'billy'}, true)
				}
			})
		})
	})
}
