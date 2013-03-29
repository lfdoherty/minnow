"use strict";

var minnow = require('./../../client/client')

var _ = require('underscorem')

function poll(f){var ci=setInterval(wf,0);function wf(){
	try{if(f()){clearInterval(ci)}}
	catch(e){clearInterval(ci);throw e;}
}}

exports.count = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', function(err, c){
			
				poll(function(){
					//console.log('count: ' + JSON.stringify(c.toJson()))
					if(c.c.value() === 1){
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

exports.countMap = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('emap', function(err, c){
			
				poll(function(){
					//console.log('count: ' + c.c.value())
					if(c.c.value() === 1){
						done()
						return true
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('empty', function(err, v){
						v.make('entity', {age: 10})
					})
				})
				
			})
		})
	})
}

exports.countMapWithRemoval = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('emapWithAge', function(err, c){
			
				var first
				poll(function(){
					//console.log('count: ' + c.c.value())
					if(c.c.value() === 1){
						first = true
					}else if(first && c.c.value() === 0){
						done()
						return true
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('empty', function(err, v){
						var e = v.make('entity', {age: 20})
						setTimeout(function(){
							e.age.set(30)
						},200)
					})
				})
				
			})
		})
	})
}

exports.makeAndForget = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', function(err, c){
			
				poll(function(){
					//console.log('count: ' + c.c.value())
					if(c.c.value() === 1){
						done()
						return true
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('general', function(err, v){
						v.make('entity', true)
					})
				})
				
			})
		})
	})
}

exports.type = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', function(err, c){
			
				poll(function(){
					//console.log('size: ' + c.t.size())
					if(c.t.size() === 1){
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

exports.idProperty = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('idtest', function(err, c){
			
				poll(function(){
					//console.log(c.v.value())
					if(c.v.value() == 1){
						done()
						return true
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('empty', function(err, v){
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
			client.view('general', function(err, c){
			
				poll(function(){
					//console.log('json: ' + JSON.stringify(c.toJson()))
					if(c.oldestAge.value() === 22){
						done()
						return true
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('general', function(err, v){
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
			client.view('general', function(err, c){
			
				poll(function(){
					//console.log('youngest: ' + c.youngestAge.value())
					if(c.youngestAge.value() === 13){
						done()
						return true
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('general', function(err, v){
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
			client.view('general', function(err, c){
			
				poll(function(){
					console.log('adults: ' + c.adults.size())
					if(c.adults.size() === 1){
						//console.log('adults: ' + JSON.stringify(c.adults.toJson()))
						if(c.adults.toJson()[0].age === 22){
							done()
							return true
						}
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('general', function(err, v){
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
			client.view('general', function(err, c){
			
				poll(function(){
					console.log(JSON.stringify(c.toJson()))
					_.assertEqual(c.manyAdults.value(), c.adults.toJson().length)
					if(c.manyAdults.value() === 1 && c.adults.toJson()[0].age === 22){
						done()
						return true
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('general', function(err, v){
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
	return function(err, c){
			
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
			otherClient.view('general', function(err, v){
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

/*
exports.nowTest = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			//console.log('getting view')
			client.view('nowTest', [], function(err, v){
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
}*/

exports.mergeTest = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('mergeTest', function(err, c){
			
				poll(function(){
					//console.log(JSON.stringify(c.toJson()))
					if(c.allTags.has('big') && c.allTags.has('small') && c.allTags.has('important') && c.allTags.has('trivial')){
						done()
						return true
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('general', function(err, v){
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
			client.view('viewMergeTest', function(err, c){
			
				poll(function(){
					//console.log(JSON.stringify(c.flatTags.toJson()))
					if(c.flatTags.has('big') && c.flatTags.has('small') && c.flatTags.has('important') && c.flatTags.has('trivial')){
						done()
						return true
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('general', function(err, v){
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
			client.view('viewMergeTest', function(err, c){
			
				poll(function(){
					//console.log(JSON.stringify(c.toJson()))
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
					otherClient.view('general', function(err, v){
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
			client.view('empty', function(err, c){
				var cc = c.make('ageConfiguration', {ageOfMajority: 18}, function(){
					console.log('getting view')
					client.view('pairedFilterTest', [cc], function(err, pc){
						var gotTeenager = false
						var lostTeenager = false
						poll(function(){
							var json = pc.adults.toJson()
							
							//console.log(JSON.stringify(pc.toJson()))

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
							otherClient.view('empty', function(err, v){
								var teenager = v.make('entity', {age: 17, name: 'teenager'})
								teenager.age.set(18)
								setTimeout(function(){
									console.log('set to 19')
									cc.ageOfMajority.set(19)
								},200)
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
			client.view('general', function(err, c){
				var cc = c.make('ageConfiguration', {ageOfMajority: 18}, function(){
					client.view('pairedFilterTest', [cc], function(err, pc){
						var gotTeenager = false
						var lostTeenager = false
						poll(function(){
							var json = pc.adults.toJson()
							//console.log('@ ' + JSON.stringify(pc.toJson()))
							if(_.detect(json, function(e){return e.name === 'teenager' && e.age === 18})){
								//console.log('@ ' + JSON.stringify(pc.toJson()))
								gotTeenager = true
							}
							if(gotTeenager){
								if(!_.detect(json, function(e){return e.name === 'teenager' && e.age === 18})){
									//console.log('# ' + JSON.stringify(pc.toJson()))
									lostTeenager = true
								}
							}
							if(gotTeenager && lostTeenager){
								done()
								return true
							}
						})

						minnow.makeClient(config.port, function(otherClient){
							otherClient.view('empty', function(err, v){
								var teenager = v.make('entity', {age: 17, name: 'teenager'})
								var tt = v.make('entity', {age: 22})
								v.make('entity', {age: 13})
								setTimeout(function(){
									teenager.age.set(18)
									//console.log(JSON.stringify(tt.toJson()))
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
/*
exports.crazyPartials = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('crazyPartialMacroTest', function(err, c){
				var lookingFor = [16,21,22,25,26]
				poll(function(){
					if(JSON.stringify(c.crazy.toJson().sort()) === JSON.stringify(lookingFor)){
						done()
						return true
					}else{
						console.log(JSON.stringify([JSON.stringify(c.crazy.toJson().sort()) , JSON.stringify(lookingFor)]))
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('general', function(err, v){
						v.make('entity', {age: 22, numbers: [3,4]})
						v.make('entity', {age: 13, numbers: [3,8,9]})
					})
				})
				
			})
		})
	})
}*/

exports.nameCollision = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('nameCollisionTest', ['sue'], function(err, c){
				poll(function(){
					/*if(c.named.size() === 1){
						console.log('name: ' + c.named.toJson()[0].name)
					}*/
					//console.log(JSON.stringify(c.toJson()))
					if(c.named.size() === 1 && c.named.toJson()[0].name === 'sue'){
						done()
						return true
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('empty', function(err, v){
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
			client.view('booleanSetTest', ['sue'], function(err, c){
				poll(function(){
					//console.log(JSON.stringify(c.toJson()))
					if(c.truth.size() === 2){
						var set = c.truth.toJson()
						//console.log('got size')
						if(set.indexOf(true) !== -1 && set.indexOf(false) !== -1){
							done()
							return true
						}
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('empty', function(err, v){
						v.make('entity', {age: 22, name: 'brian'})
						v.make('entity', {age: 13, name: 'sue'})
					})
				})
				
			})
		})
	})
}

exports.stringUpdateTest = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('stringUpdateTest', [], function(err, c){
				var gotFirst
				poll(function(){
					//console.log(JSON.stringify(c.toJson()))
					if(c.name.value() === 'brian'){
						gotFirst = true
					}
					if(gotFirst && c.name.value() === 'bill'){
						done()
						return true
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('empty', function(err, v){
						var e = v.make('entity', {age: 22, name: 'brian'})
						setTimeout(function(){
							e.name.set('bill')
						},500)
					})
				})
				
			})
		})
	})
}

exports.objectSubsetProperty = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('objectSetProperty', ['sue'], function(err, c){
				poll(function(){
					/*if(c.named.size() === 1){
						console.log('name: ' + c.named.toJson()[0].name)
					}*/
					//console.log(c+'')
					if(c.ages.size() === 3){
						var ages = c.ages.toJson()
						ages.sort()
						_.assert(JSON.stringify(ages) === '[13,19,22]')
						done()
						return true
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('general', function(err, v){
						v.make('entity', {age: 22, name: 'sue'})
						v.make('entity', {age: 13, name: 'sue'})
						v.make('entity', {age: 18, name: 'brian'})
						v.make('entity', {age: 19, name: 'sue'})
					})
				})
				
			})
		})
	})
}

exports.childTypeSubsetUpdate = function(config, done){//checks that simple subsets track all objects of the child type as well as the selected type
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('childTypeSubsetUpdate', function(err, c){
			
				poll(function(){
					
					if(c.has('s') && c.s.name.value() === 'sue'){
					
						done()
						return true
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('general', function(err, v){
						v.make('child', {age: 53, name: 'sue'})
					})
				})
				
			})
		})
	})
}

