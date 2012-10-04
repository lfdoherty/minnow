
var minnow = require('./../../client/client')//this is the minnow include

var _ = require('underscorem')

function poll(f){var ci=setInterval(wf,10);function wf(){if(f()){clearInterval(ci)}}}

exports.update = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', function(err, c){
			
				poll(function(){
					if(c.s.size() === 1){
						//console.log(JSON.stringify(c.s.toJson()))
						_.assertEqual(c.s.keys()[0], 'blah');
						_.assertEqual(c.s.value('blah'), 'vblah')
						done()
						return true
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('general', function(err, v){
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
			client.view('generalTop', function(err, c){

				var expected = JSON.stringify([21, 22, 28])
				poll(function(){
					if(c.threeOldest.size() === 3){
						//console.log(JSON.stringify(c.threeOldest.toJson()))
						var data = c.threeOldest.toJson()
						var ages = _.map(Object.keys(data), function(key){return data[key];})
						ages.sort()
						if(JSON.stringify(ages) === expected){
							done()
							return true
						}else{
							//console.log('value: ' + JSON.stringify(ages))
						}
					}else{
						//console.log('many: ' + c.threeOldest.size())
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('empty', function(err, v){
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
			client.view('mapReduce', function(err, c){

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
						//console.log('many: ' + c.oldestWithKey.size())
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('empty', function(err, v){
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

exports.topByValuesWithDel = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('generalTop', function(err, c){

				var expected = JSON.stringify([19, 22, 28])
				poll(function(){
					if(c.threeOldest.size() === 3){
						//console.log(JSON.stringify(c.threeOldest.toJson()))
						var data = c.threeOldest.toJson()
						var ages = _.map(Object.keys(data), function(key){return data[key];})
						ages.sort()
						if(JSON.stringify(ages) === expected){
							done()
							return true
						}else{
							//console.log('value: ' + JSON.stringify(ages))
						}
					}else{
						//console.log('many: ' + c.threeOldest.size())
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('empty', function(err, v){
						v.make('entity', {key: 'tim', age: 19})
						v.make('entity', {key: 'robert', age: 18})
						v.make('entity', {key: 'janice', age: 22})
						v.make('entity', {key: 'sue', age: 28})
						var toChange = v.make('entity', {key: 'bruce', age: 21})
						setTimeout(function(){
							toChange.age.set(17)
						},100)
					})
				})
			})
		})
	})
}

exports.topByValuesWithDelAndLimiter = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('empty', function(err, vv){
			
				var limit = vv.make('limiter', {minAge: 18}, function(){
			
					client.view('paramTop', [limit.id()], function(err, c){

						var expected = JSON.stringify([19, 21, 24, 28])
						var laterExpected = JSON.stringify([24, 28])
						var gotExpected = false
						poll(function(){
							if(c.threeOldest.size() === 4){
								//console.log(JSON.stringify(c.threeOldest.toJson()))
								var data = c.threeOldest.toJson()
								var ages = _.map(Object.keys(data), function(key){return data[key];})
								ages.sort()
								if(JSON.stringify(ages) === expected){
									gotExpected = true
									done()
									return true
								}else{
									console.log('value: ' + JSON.stringify(ages))
								}
							}else if(gotExpected && c.threeOldest.size() === 2){
								var ages = _.map(Object.keys(data), function(key){return data[key];})
								ages.sort()
								if(JSON.stringify(ages) === laterExpected){
									gotExpected = true
									done()
									return true
								}else{
									console.log('*value: ' + JSON.stringify(ages))
								}
							}else{
								console.log('many: ' + c.threeOldest.size())
							}
						})

						minnow.makeClient(config.port, function(otherClient){
							otherClient.view('empty', function(err, v){
								v.make('entity', {key: 'tim', age: 19})
								v.make('entity', {key: 'robert', age: 18})
								//v.make('entity', {key: 'janice', age: 22})
								v.make('entity', {key: 'horace', age: 24})
								v.make('entity', {key: 'sue', age: 28})
								var toChange = v.make('entity', {key: 'bruce', age: 21})
								setTimeout(function(){
									toChange.age.set(17)
									limit.minAge.set(20)
								},100)
							})
						})
					})
				})
			})
		})
	})
}

exports.testSyncInputSetRemoval = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('syncInputSetRemoval', function(err, c){

				var gotFirst = false
				poll(function(){
					//console.log('many: ' + c.manyStrings.value())
					if(c.manyStrings.value() === 3){
						gotFirst = true
					}
					if(gotFirst && c.manyStrings.value() === 2){
						done()
						return true
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('empty', function(err, v){
						v.make('entity', {key: 'tim', value:'bill'})
						var toChange = v.make('entity', {key: 'bruce', value: 'bill'})
						setTimeout(function(){
							toChange.key.set('bill')
						},500)
					})
				})
			})
		})
	})
}

