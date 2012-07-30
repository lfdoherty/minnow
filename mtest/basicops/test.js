
var minnow = require('./../../client/client')

var _ = require('underscorem')

function poll(f){var ci=setInterval(wf,0);function wf(){if(f()){clearInterval(ci)}}}

exports.count = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', function(c){
			
				poll(function(){
					//console.log('count: ' + c.c.value())
					if(c.c.value() === 1){
						done()
						return true
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('general', function(v){
						v.make('entity')
					})
				})
				
			})
		})
	})
}

exports.type = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', function(c){
			
				poll(function(){
					//console.log('size: ' + c.t.size())
					if(c.t.size() === 1){
						done()
						return true
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('general', function(v){
						v.make('entity')
					})
				})
				
			})
		})
	})
}

exports.idProperty = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('idtest', function(c){
			
				poll(function(){
					//console.log('size: ' + c.t.size())
					if(c.v.value() === 1){
						done()
						return true
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('empty', function(v){
						v.make('entity')
					})
				})
				
			})
		})
	})
}

exports.max = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', function(c){
			
				poll(function(){
					//console.log('oldest: ' + c.oldestAge.value())
					if(c.oldestAge.value() === 22){
						done()
						return true
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('general', function(v){
						v.make('entity', {age: 13})
						v.make('entity', {age: 22})
						v.make('entity', {age: 15})
					})
				})
				
			})
		})
	})
}
exports.min = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', function(c){
			
				poll(function(){
					//console.log('youngest: ' + c.youngestAge.value())
					if(c.youngestAge.value() === 13){
						done()
						return true
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('general', function(v){
						v.make('entity', {age: 15})
						v.make('entity', {age: 22})
						v.make('entity', {age: 13})
					})
				})
				
			})
		})
	})
}
exports.eachFiltered = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', function(c){
			
				poll(function(){
					//console.log('adults: ' + c.adults.size())
					if(c.adults.size() === 1){
						//console.log('adults: ' + JSON.stringify(c.adults.toJson()))
						if(c.adults.toJson()[0].age === 22){
							done()
							return true
						}
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('general', function(v){
						v.make('entity', {age: 15})
						v.make('entity', {age: 22})
						v.make('entity', {age: 13})
					})
				})
				
			})
		})
	})
}

exports.countOfEachFiltered = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', function(c){
			
				poll(function(){
					//console.log('adults: ' + c.manyAdults.value())
					if(c.manyAdults.value() === 1 && c.adults.toJson()[0].age === 22){
						done()
						return true
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('general', function(v){
						v.make('entity', {age: 15})
						v.make('entity', {age: 22})
						v.make('entity', {age: 13})
					})
				})
				
			})
		})
	})
}

function testAgeThreshold(minnow, port, done){
	return function(c){
			
		poll(function(){
			//console.log('adults: ' + c.oldEnough.size())
			if(c.oldEnough.size() === 2){
				var ages = _.map(c.oldEnough.toJson(), function(a){return a.age;})
				if(ages.indexOf(22) !== -1 && ages.indexOf(15) !== -1){
					done()
					return true
				}
			}
		})

		minnow.makeClient(port, function(otherClient){
			otherClient.view('general', function(v){
				v.make('entity', {age: 15})
				v.make('entity', {age: 22})
				v.make('entity', {age: 13})
			})
		})
		
	}
}
exports.parameterizeEachFiltered = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('specific', [14], testAgeThreshold(minnow, config.port, done))
		})
	})
}

exports.partialApplication = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('specificPartial', [14], testAgeThreshold(minnow, config.port, done))
		})
	})
}

exports.globalMacroCall = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('reallySpecific', [14], testAgeThreshold(minnow, config.port, done))
		})
	})
}

exports.macroParameter = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('macroParameter', [14], testAgeThreshold(minnow, config.port, done))
		})
	})
}

exports.macroParameterAgain = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('macroParameterAgain', [14], testAgeThreshold(minnow, config.port, done))
		})
	})
}


exports.nowTest = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			//console.log('getting view')
			client.view('nowTest', [], function(v){
				var va = v.beat.value()
				//console.log('got view: ' + va)
				setTimeout(function(){
					//console.log('timed out ########################3')
					var vb = v.beat.value()
					//console.log('values: ' + JSON.stringify([va, vb]))
					_.assert(va !== vb)
					done()
				}, 1400)
			})
		})
	})
}

exports.mergeTest = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('mergeTest', function(c){
			
				poll(function(){
					if(c.allTags.has('big') && c.allTags.has('small') && c.allTags.has('important') && c.allTags.has('trivial')){
						done()
						return true
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('general', function(v){
						v.make('tagging', {tags: ['big', 'small']})
						v.make('tagging', {tags: ['important', 'trivial']})
					})
				})
				
			})
		})
	})
}

exports.viewMergeTestFlatTags = function(config, done){
	minnow.makeServer(config, function(){
		//console.log('SERVER MADE')
		minnow.makeClient(config.port, function(client){
			//console.log('CLIENT MADE')
			client.view('viewMergeTest', function(c){
			
				poll(function(){
					//console.log(JSON.stringify(c.flatTags.toJson()))
					if(c.flatTags.has('big') && c.flatTags.has('small') && c.flatTags.has('important') && c.flatTags.has('trivial')){
						done()
						return true
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('general', function(v){
						//console.log('making taggings')
						v.make('tagging', {tags: ['big', 'small']})
						v.make('tagging', {tags: ['important', 'trivial']})
					})
				})
				
			})
		})
	})
}

exports.viewMergeTestAllTags = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('viewMergeTest', function(c){
			
				poll(function(){
					//console.log(JSON.stringify(c.allTags.toJson()))
					var desired = ['big', 'small', 'important', 'trivial']
					var actual = _.map(c.allTags.toJson(), function(v){return v.tag})
					if(actual.length === desired.length){
						var failed = false
						desired.forEach(function(v){if(actual.indexOf(v) === -1) failed = true})
						if(!failed){
							done()
							return true;
						}
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('general', function(v){
						v.make('tagging', {tags: ['big', 'small']})
						v.make('tagging', {tags: ['important', 'trivial']})
					})
				})
				
			})
		})
	})
}

exports.singlePairedFilterTest = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('empty', function(c){
				var cc = c.make('ageConfiguration', {ageOfMajority: 18}, function(){
					client.view('pairedFilterTest', [cc], function(pc){
						var gotTeenager = false
						var lostTeenager = false
						poll(function(){
							var json = pc.adults.toJson()
							//console.log('@ ' + JSON.stringify(json))
							if(_.detect(json, function(e){return e.name === 'teenager' && e.age === 18})){
								gotTeenager = true
							}
							if(gotTeenager){
								if(!_.detect(json, function(e){return e.name === 'teenager' && e.age === 18})){
									lostTeenager = true
								}
							}
							if(gotTeenager && lostTeenager){
								done()
								return true
							}
						})

						minnow.makeClient(config.port, function(otherClient){
							otherClient.view('empty', function(v){
								var teenager = v.make('entity', {age: 17, name: 'teenager'})
								teenager.age.set(18)
								setTimeout(function(){
									cc.ageOfMajority.set(19)
								},500)
							})
						})
					})
				})
			})
		})
	})
}


exports.pairedFilterTest = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', function(c){
				var cc = c.make('ageConfiguration', {ageOfMajority: 18}, function(){
					client.view('pairedFilterTest', [cc], function(pc){
						var gotTeenager = false
						var lostTeenager = false
						poll(function(){
							var json = pc.adults.toJson()
							//console.log('@ ' + JSON.stringify(json))
							if(_.detect(json, function(e){return e.name === 'teenager' && e.age === 18})){
								gotTeenager = true
							}
							if(gotTeenager){
								if(!_.detect(json, function(e){return e.name === 'teenager' && e.age === 18})){
									lostTeenager = true
								}
							}
							if(gotTeenager && lostTeenager){
								done()
								return true
							}
						})

						minnow.makeClient(config.port, function(otherClient){
							otherClient.view('empty', function(v){
								var teenager = v.make('entity', {age: 17, name: 'teenager'})
								v.make('entity', {age: 22})
								v.make('entity', {age: 13})
								setTimeout(function(){
									teenager.age.set(18)
									setTimeout(function(){
										cc.ageOfMajority.set(19)
									},500)
								}, 500)
							})
						})
					})
				})
			})
		})
	})
}

exports.crazyPartials = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('crazyPartialMacroTest', function(c){
				var lookingFor = [16,21,22,25,26]
				poll(function(){
					if(JSON.stringify(c.crazy.toJson().sort()) === JSON.stringify(lookingFor)){
						done()
						return true
					}else{
						//console.log(JSON.stringify([JSON.stringify(c.crazy.toJson().sort()) , JSON.stringify(lookingFor)]))
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('general', function(v){
						v.make('entity', {age: 22, numbers: [3,4]})
						v.make('entity', {age: 13, numbers: [3,8,9]})
					})
				})
				
			})
		})
	})
}

exports.nameCollision = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('nameCollisionTest', ['sue'], function(c){
				poll(function(){
					/*if(c.named.size() === 1){
						console.log('name: ' + c.named.toJson()[0].name)
					}*/
					if(c.named.size() === 1 && c.named.toJson()[0].name === 'sue'){
						done()
						return true
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('general', function(v){
						v.make('entity', {age: 22, name: 'brian'})
						v.make('entity', {age: 13, name: 'sue'})
					})
				})
				
			})
		})
	})
}

exports.booleanSetTest = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('booleanSetTest', ['sue'], function(c){
				poll(function(){
					if(c.truth.size() === 2){
						var set = c.truth.toJson()
						if(set.indexOf(true) !== -1 && set.indexOf(false) !== -1){
							done()
							return true
						}
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('general', function(v){
						v.make('entity', {age: 22, name: 'brian'})
						v.make('entity', {age: 13, name: 'sue'})
					})
				})
				
			})
		})
	})
}
