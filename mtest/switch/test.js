
var minnow = require('./../../client/client')

var _ = require('underscorem')

exports.basicAdult = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('basic', function(err, c){
				//console.log('got basic')
				done.poll(function(){
					//console.log('size: ' + c.t.size())
					if(c.has('displayedName')){
						done()
						return true
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('empty', function(err, v){
						//console.log('making entity')
						v.make('entity', {name: 'Bill', age: 20})
					})
				})
				
			})
		})
	})
}

exports.basicAdultName = function(config, done){
	//console.log('***')
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('basic', function(err, c){
				done.poll(function(){
					//console.log('got basic: ' + JSON.stringify(c.toJson()))
					//console.log('size: ' + c.t.size())
					if(c.has('displayedName')){
						//console.log('displayedName: ' + c.displayedName.value())
						if(c.displayedName.value() === 'Bill'){
							done()
							return true
						}
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('empty', function(err, v){
						//console.log('making entity')
						v.make('entity', {name: 'Bill', age: 20, category: 'adult'})
					})
				})
				
			})
		})
	})
}

exports.basicChildName = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('basic', function(err, c){
				//console.log('got basic')
				done.poll(function(){
					//console.log('size: ' + c.t.size())
					if(c.has('displayedName')){
						//console.log('displayedName: ' + c.displayedName.value())
						if(c.displayedName.value() === '<anonymized>'){
							done()
							return true
						}
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('empty', function(err, v){
						//console.log('making entity')
						v.make('entity', {name: 'Bill', age: 17, category: 'child'})
					})
				})
				
			})
		})
	})
}

