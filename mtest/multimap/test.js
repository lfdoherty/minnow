
var minnow = require('./../../client/client')

var _ = require('underscorem')

exports.index = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', function(err, c){
				if(err) throw err
			
				done.poll(function(){

					var values = c.index.value('tall')
					var v2 = c.index.value('old')
					var v3 = c.index.value('young')
					

					if(values === undefined || v2 === undefined || v3 === undefined) return
					
					if(values.indexOf('jim') !== -1 && values.indexOf('mary') !== -1 && values.length === 2){
						if(v2.length === 1 && v2[0] === 'mary' && v3.length === 1 && v3[0] === 'jim'){
							done()
							return true
						}
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('empty', function(err, v){

						v.make('entity', {name: 'jim', tags: ['young', 'tall']})
						v.make('entity', {name: 'mary', tags: ['old', 'tall']})
					})
				})
				
			})
		})
	})
}

exports.removeValue = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', function(err, c){
				if(err) throw err
			
				var gotFull
			
				done.poll(function(){
				
					if(c.index.count() === 3){
						gotFull = true
					}
					
					if(!gotFull) return
					
					console.log('count: ' + c.index.count())
					//console.log(JSON.stringify(c.toJson()))
					if(c.index.count() !== 2) return

					var values = c.index.value('tall')
					var v2 = c.index.value('old')
					var v3 = c.index.value('young')

					done()
					return true
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('general', function(err, v){

						var jim = v.make('entity', {name: 'jim', tags: ['young', 'tall']})
						v.make('entity', {name: 'mary', tags: ['old', 'tall']})
						
						setTimeout(function(){
							jim.tags.remove('young')
						},500)
					})
				})
				
			})
		})
	})
}

exports.reverseIndex = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', function(err, c){
				if(err) throw err
			
				done.poll(function(){

					if(c.reverseIndex.count() !== 2) return
					
					var jimTags = c.reverseIndex.value('jim')
					var maryTags = c.reverseIndex.value('mary')
					
					if(jimTags.length !== 2 || maryTags.length !== 2) return
					
					_.assertEqual(JSON.stringify(jimTags), '["young","tall"]')
					_.assertEqual(JSON.stringify(maryTags), '["old","tall"]')
					
					done()
					return true
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('general', function(err, v){
						if(err) throw err

						v.make('entity', {name: 'jim', tags: ['young', 'tall']})
						v.make('entity', {name: 'mary', tags: ['old', 'tall']})
					})
				})
				
			})
		})
	})
}

exports.reverseIndexDedup = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', function(err, c){
				if(err) throw err
				done.poll(function(){

					if(c.reverseIndex.count() !== 2) return
					
					var jimTags = c.reverseIndex.value('jim')
					var maryTags = c.reverseIndex.value('mary')
					
					if(jimTags.length !== 2 || maryTags.length !== 2) return
					
					_.assertEqual(JSON.stringify(jimTags), '["young","tall"]')
					_.assertEqual(JSON.stringify(maryTags), '["old","tall"]')
					
					done()
					return true
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('general', function(err, v){

						v.make('entity', {name: 'jim', tags: ['young', 'tall', 'tall']})
						v.make('entity', {name: 'mary', tags: ['old', 'tall']})
					})
				})
				
			})
		})
	})
}


exports.objectMultimap = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', function(err, c){
				if(err) throw err
			
				done.poll(function(){
				
					console.log(JSON.stringify(c.objectIndex.keys()) + ' ' + JSON.stringify(c.toJson()))
					
					if(c.objectIndex.count() === 2){
						var worked = false
						c.objectIndex.get('sue').each(function(e){
							if(e.name.value() === 'jim'){
								_.assertEqual(e.tags.count(), 2)
								worked = true
							}
						})
						if(!worked) return
						//_.assertEqual(c.objectIndex.get('sue').tags.count(), 2)
						done()
						return true
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('empty', function(err, v){

						var a = v.make('entity', {name: 'jim', tags: ['young', 'tall']})
						var b = v.make('entity', {name: 'mary', tags: ['old', 'tall'], refs: [a]})
						v.make('entity', {name: 'sue', tags: ['young', 'short'], refs: [a,b]})
					})
				})
				
			})
		})
	})
}
