
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
											console.log('cleared property')
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
