
var minnow = require('./../../client/client')

var _ = require('underscorem')


exports.simple = function(config, done){
	config.indexPlugins = [
		require('./util/simple_index')
	]
	
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('search', ['blue green'], function(err, c){
			
				done.poll(function(){
					console.log('done.polling: ' + JSON.stringify(c.toJson()))
					if(c.has('results') && c.results.size() === 2){
						done()
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('empty', function(err, v){
						v.make('entity', {text: 'test blue green pink'}, true)
						v.make('entity', {text: 'test blue red'}, true)
						v.make('entity', {text: 'test orange purple'}, true)
					})
				})
			})
		})
	})
}

