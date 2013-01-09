
var minnow = require('./../../client/client')

var _ = require('underscorem')

function poll(f){var ci=setInterval(wf,10);function wf(){if(f()){clearInterval(ci)}}}

exports.addNewFromJson = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', function(err, c){
			
				poll(function(){
					if(c.s.size() === 1){
						var d;
						c.s.each(function(dd){d = dd;})
						if(d.v.value() === 'test'){
							done()
							return true
						}
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('general', function(err, v){
						var obj = c.make('entity', {v: 'test'})
						_.assertDefined(obj)
						v.s.add(obj)
					})
				})
				
			})
		})
	})
}

exports.wrapped = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('wrapped', function(err, c){
			
				poll(function(){
					//console.log(c.s.size())
					if(c.s.size() === 1){
						var d;
						//console.log('got 1')
						c.s.each(function(dd){d = dd;})
						console.log(': ' + JSON.stringify(c.toJson()))
						if(d.v && d.v.value() === 'test'){
							done()
							return true
						}
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('general', function(err, v){
						var obj = c.make('entity', {v: 'test'})
						_.assertDefined(obj)
						v.s.add(obj)
					})
				})
				
			})
		})
	})
}

exports.wrappedRemoval = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('contained', function(err, c){
			
				var had = false
				poll(function(){
					//console.log(had + ' ' + JSON.stringify(c.toJson()))
					if(c.has('c') && c.c.members.count() === 1){
						had = true
					}else if(had && c.has('c') && c.c.members.count() === 0){
						done()
						return true
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('general', function(err, v){
						var obj = c.make('entity', {v: 'test'})
						var cont = c.make('container', {members: [obj]})
						
						setTimeout(function(){
							console.log('removing')
							cont.members.remove(obj)
						},500)
					})
				})
				
			})
		})
	})
}

