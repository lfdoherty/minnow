
var minnow = require('./../../client/client')//this is the minnow include

var _ = require('underscorem')

exports.type = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', function(err, c){
			
				done.poll(function(){
					if(c.has('v') && c.v.value() === 'entity'){
						done()
						return true
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('general', function(err, v){
						v.make('entity')
					})
				})
				
			})
		})
	})
}

exports.innerTypeSwitch = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('subs', function(err, c){
			
				done.poll(function(){
					console.log(JSON.stringify(c.toJson()))
					var json = c.va.toJson()
					if(json.length === 2 && json.indexOf('Bill') !== -1 && json.indexOf('anon') !== -1){
						done()
						return true
					}
					//if(c.has('va') && c.v.value() === 'entity'){
						//done()
						//return true
					//}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('empty', function(err, v){
						var e = v.make('entity')
						e.subs.addNew('suba', {name: 'Bill'})
						e.subs.addNew('subb', {name: 'hidden'})
					})
				})
				
			})
		})
	})
}
