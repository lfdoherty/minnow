
var minnow = require('./../../client/client')//this is the minnow include

var _ = require('underscorem')

function poll(f){var ci=setInterval(wf,10);function wf(){if(f()){clearInterval(ci)}}}

exports.update = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', function(c){
			
				poll(function(){
					if(c.s.size() === 1){
						console.log(JSON.stringify(c.s.toJson()))
						_.assertEqual(c.s.keys()[0], 'blah');
						_.assertEqual(c.s.value('blah'), 'vblah')
						done()
						return true
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('general', function(v){
						v.make('entity', {key: 'blah', value: 'vblah'})
					})
				})
			})
		})
	})
}

exports.topByValues = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('generalTop', function(c){

				var expected = JSON.stringify([21, 22, 28])
				poll(function(){
					if(c.threeOldest.size() === 3){
						console.log(JSON.stringify(c.threeOldest.toJson()))
						var data = c.threeOldest.toJson()
						var ages = _.map(Object.keys(data), function(key){return data[key];})
						ages.sort()
						if(JSON.stringify(ages) === expected){
							done()
							return true
						}else{
							console.log('value: ' + JSON.stringify(ages))
						}
					}else{
						console.log('many: ' + c.threeOldest.size())
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('empty', function(v){
						v.make('entity', {key: 'tim', age: 19})
						v.make('entity', {key: 'robert', age: 18})
						v.make('entity', {key: 'janice', age: 22})
						v.make('entity', {key: 'sue', age: 28})
						v.make('entity', {key: 'bruce', age: 21})
					})
				})
			})
		})
	})
}

exports.mapReduce = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('mapReduce', function(c){

				var expected = {a: 37, b: 50, c: 21}
				poll(function(){
					if(c.oldestWithKey.size() === 3){
						//console.log(JSON.stringify(c.oldestWithKey.toJson()))
						var data = c.oldestWithKey.toJson()
						var failed = false
						_.each(data, function(age, key){
							if(expected[key] !== age) failed = true
						})
						if(!failed){
							done()
							return true
						}
					}else{
						console.log('many: ' + c.oldestWithKey.size())
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('empty', function(v){
						v.make('entity', {key: 'a', age: 19})
						v.make('entity', {key: 'a', age: 18})
						v.make('entity', {key: 'b', age: 22})
						v.make('entity', {key: 'b', age: 28})
						v.make('entity', {key: 'c', age: 21})
					})
				})
			})
		})
	})
}

