
var minnow = require('./../../client/client')

var _ = require('underscorem')

function poll(f){var ci=setInterval(wf,10);function wf(){if(f()){clearInterval(ci)}}}

exports.singleTraverse = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(otherClient){
			otherClient.view('empty', function(err, v){

				var a = v.make('entity', {value: 'a'})
				var b = v.make('entity', {value: 'b', e: a})
				var cc = v.make('entity', {value: 'c', e: b})
				var d = v.make('entity', {value: 'd', e: cc})
				var e = v.make('entity', {value: 'e', e: d}, function(){

					minnow.makeClient(config.port, function(client){
						client.view('general', [e], function(err, c){
							if(err) throw err
	
							poll(function(){
								//console.log('polling: ' + c.entities.size() + ' ' + JSON.stringify(c.toJson()))
								if(c.entities.size() === 4){
									var arr = []
									var res = c.entities.toJson()
				
									res.forEach(function(e){
										arr.push(e.value)
									})

									arr.sort(function(a,b){return a.localeCompare(b)})
									//console.log(JSON.stringify(arr))

									var json = JSON.stringify(arr)
									if(json === JSON.stringify(['a','b','c','d'])){
										done()
										return true
									}
								}
							})
						})
					})

				
				})
			})
		})
		
	})
}

exports.singleTraverseBroken = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(otherClient){
			otherClient.view('empty', function(err, v){

				var a = v.make('entity', {value: 'a'})
				var b = v.make('entity', {value: 'b', e: a})
				var cc = v.make('entity', {value: 'c', e: b})
				var d = v.make('entity', {value: 'd', e: cc})
				
				var e = v.make('entity', {value: 'e', e: d}, function(){

					minnow.makeClient(config.port, function(client){
						client.view('general', [e], function(err, c){
							if(err) throw err
							
							var first = false
	
							poll(function(){
								//console.log('polling: ' + c.entities.size() + ' ' + JSON.stringify(c.toJson()))
								if(c.entities.size() === 4){
									var arr = []
									var res = c.entities.toJson()
				
									res.forEach(function(e){
										arr.push(e.value)
									})

									arr.sort(function(a,b){return a.localeCompare(b)})
									//console.log(JSON.stringify(arr))

									var json = JSON.stringify(arr)
									if(!first && json === JSON.stringify(['a','b','c','d'])){

										first = true
										
										setTimeout(function(){
											cc.clearProperty('e')
											//console.log('cleared property')
										},0)
									}
								}
								
								if(first && c.entities.size() === 2){
									done()
									return true
								}
								
							})
						})
					})

				
				})
			})
		})
		
	})
}

exports.fibonacciTraverse = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(otherClient){
			otherClient.view('fibonacci', [20], function(err, v){
				if(err) throw err
			
				if(JSON.stringify(v.value.toJson()) === '[0,1,2,3,5,8,13,21,34,55,89,144,233,377,610,987,1597,2584,4181,6765]'){
					done()
				}
			})
		})
		
	})
}

exports.fibonacciShorterThenLonger = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(otherClient){

			otherClient.view('empty', function(err, ev){
			
				var control = ev.make('control',{value: 20}, function(){
		
					otherClient.view('fibonacciProbe', [control], function(err, v){
						if(err) throw err
					
						function arr(){
							var arr = v.value.toJson()
							arr.sort(function(a,b){return a-b;})
							return arr
						}
			
						if(JSON.stringify(arr()) === '[0,1,2,3,5,8,13,21,34,55,89,144,233,377,610,987,1597,2584,4181,6765]'){
							control.value.set(19)
							//console.log('shortening')
							poll(function(){
								//console.log('now: ' + JSON.stringify(arr()))
								if(JSON.stringify(arr()) === '[0,1,2,3,5,8,13,21,34,55,89,144,233,377,610,987,1597,2584,4181]'){
								//console.log('lengthening')
									control.value.set(21)
									poll(function(){
									//	console.log('now: ' + JSON.stringify(arr()))
										if(JSON.stringify(arr()) === '[0,1,2,3,5,8,13,21,34,55,89,144,233,377,610,987,1597,2584,4181,6765,10946]'){
											done()
											return true
										}
									})
									return true
								}
							})
						}
					})
				})
			})
		})	
	})
}


exports.fibonacciLongerThenShorter = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(otherClient){

			otherClient.view('empty', function(err, ev){
			
				var control = ev.make('control',{value: 20}, function(){
		
					otherClient.view('fibonacciProbe', [control], function(err, v){
						if(err) throw err
					
						function arr(){
							var arr = v.value.toJson()
							arr.sort(function(a,b){return a-b;})
							return arr
						}
			
						if(JSON.stringify(arr()) === '[0,1,2,3,5,8,13,21,34,55,89,144,233,377,610,987,1597,2584,4181,6765]'){
							control.value.set(21)
							poll(function(){
								//console.log('now: ' + JSON.stringify(arr()))
								if(JSON.stringify(arr()) === '[0,1,2,3,5,8,13,21,34,55,89,144,233,377,610,987,1597,2584,4181,6765,10946]'){
									control.value.set(19)
									poll(function(){
									//	console.log('now: ' + JSON.stringify(arr()))
										if(JSON.stringify(arr()) === '[0,1,2,3,5,8,13,21,34,55,89,144,233,377,610,987,1597,2584,4181]'){
											done()
											return true
										}
									})
									return true
								}
							})
						}
					})
				})
			})
		})	
	})
}
exports.multipleTraverse = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(otherClient){
			otherClient.view('empty', function(err, v){

				var a = v.make('node', {value: 'a'})
				var b = v.make('node', {value: 'b', ns: [a]})
				var cc = v.make('node', {value: 'c', ns: [b]})
				var d = v.make('node', {value: 'd', ns: [a,cc]})
				var e = v.make('node', {value: 'e', ns: [d]}, function(){

					minnow.makeClient(config.port, function(client){
						client.view('multiple', [e], function(err, c){
							if(err) throw err
	
							poll(function(){
								//console.log('polling: ' + c.entities.size() + ' ' + JSON.stringify(c.toJson()))
								if(c.entities.size() === 4){
									var arr = []
									var res = c.entities.toJson()
				
									res.forEach(function(e){
										arr.push(e.value)
									})

									arr.sort(function(a,b){return a.localeCompare(b)})
									//console.log(JSON.stringify(arr))

									var json = JSON.stringify(arr)
									if(json === JSON.stringify(['a','b','c','d'])){
										done()
										return true
									}
								}
							})
						})
					})

				
				})
			})
		})
		
	})
}

exports.incrementTreeTraverse = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(otherClient){
			otherClient.view('incrementTree', function(err, v){
				if(err) throw err
			
				//console.log('got result: ' + JSON.stringify(v.values.toJson()))
				if(JSON.stringify(v.values.toJson()) === '[1,2,3,4,5,6,7,8,9]'){
					done()
				}
			})
		})
		
	})
}

exports.incrementTreeShorterThenLonger = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(otherClient){

			otherClient.view('empty', function(err, ev){
			
				var control = ev.make('control',{value: 8}, function(){

					otherClient.view('incrementTreeProbe', [control], function(err, v){
						if(err) throw err
			
						//console.log('got result: ' + JSON.stringify(v.values.toJson()))
						if(JSON.stringify(v.values.toJson()) === '[1,2,3,4,5,6,7,8,9]'){
							control.value.set(6)
							//console.log('shorter')
							poll(function(){
								//console.log('now: ' + JSON.stringify(v.values.toJson()))
								if(JSON.stringify(v.values.toJson()) === '[1,2,3,4,5,6,7]'){
									control.value.set(10)
									poll(function(){
										if(JSON.stringify(v.values.toJson()) === '[1,2,3,4,5,6,7,8,9,10,11]'){
											done()
											return true
										}
									})
									return true
								}
							})
						}
					})
				})
			})
		})		
	})
}
