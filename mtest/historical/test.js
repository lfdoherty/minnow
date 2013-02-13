
var _ = require('underscorem')

var minnow = require('./../../client/client')//this is the minnow include

exports.getOriginal = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(c){
		
			//c.make('entity', {name: 'test'})

			c.view('empty', function(err, v){

				v.make('entity', {name: 'test'})
		
				c.historicalView('general', [], function(err, handle){
					h = handle
					
					_.assert(handle.objects.count() === 0)
					
					done()
				})
				
			})
		})
	})
}

exports.advance = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(c){
		
			//c.make('entity', {name: 'test'})

			c.view('empty', function(err, v){

				v.make('entity', {name: 'test'})
		
				c.historicalView('general', [], function(err, handle){
					//_.assertObject(versionHandle)
					
					_.assert(handle.objects.count() === 0)
					
					//h.advanceToEnd()
					handle.advanceToEnd()
					
					_.assert(handle.objects.count() === 1)
					
					done()
				})
				
			})
		})
	})
}

exports.advanceWithRemove = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(c){
		
			//c.make('entity', {name: 'test'})

			c.view('empty', function(err, v){

				var e = v.make('entity', {name: 'test'})
				
				//e.del()
				e.name.set('billy')
		
				c.historicalView('general', [], function(err, handle){
					//_.assertObject(versionHandle)
					
					_.assert(handle.objects.count() === 0)
					
					//h.advanceToEnd()
					while(handle.objects.count() === 0 && !handle.isAtEnd()){
						handle.advance()
					}
					
					_.assert(handle.objects.count() === 1)

					while(handle.objects.count() === 1 && !handle.isAtEnd()){
						handle.advance()
					}
					
					_.assert(handle.objects.count() === 0)
					
					done()
				})
				
			})
		})
	})
}

exports.advanceWithRemoveAlreadyOpenedView = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(c){
		
			//c.make('entity', {name: 'test'})

			c.view('empty', function(err, v){

				var e = v.make('entity', {name: 'test'})
				
				//e.del()
				e.name.set('billy')

				c.view('general', [], function(err, dummy){
		
					c.historicalView('general', [], function(err, handle){
						//_.assertObject(versionHandle)
					
						_.assert(handle.objects.count() === 0)
					
						//h.advanceToEnd()
						while(handle.objects.count() === 0 && !handle.isAtEnd()){
							handle.advance()
						}
					
						_.assert(handle.objects.count() === 1)

						while(handle.objects.count() === 1 && !handle.isAtEnd()){
							handle.advance()
						}
					
						_.assert(handle.objects.count() === 0)
					
						done()
					})
				})				
			})
		})
	})
}

exports.objectCreation = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(c){
		
			c.view('empty', function(err, v){

				var e = v.make('entity', {name: 'test'})
				//e.name.set('billy')
		
				c.historicalView('all', [], function(err, handle){
					
					_.assert(handle.entities.count() === 0)
					
					while(handle.entities.count() === 0 && !handle.isAtEnd()){
						handle.advance()
					}
					
					_.assert(handle.entities.count() === 1)
					
					done()
				})
				
			})
		})
	})
}

exports.objectCreationAndChange = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(c){
		
			c.view('empty', function(err, v){

				var e = v.make('entity', {name: 'test'})
				e.name.set('billy')
		
				c.historicalView('all', [], function(err, handle){
					
					_.assert(handle.entities.count() === 0)
					
					while(handle.entities.count() === 0 && !handle.isAtEnd()){
						handle.advance()
					}
					
					console.log(handle.entities.count())
					_.assert(handle.entities.count() === 1)
					
					var ee
					handle.entities.each(function(e){
						ee = e
					})
					
					_.assert(ee.has('name'))
					console.log(ee)
					_.assert(ee.name.value() === 'test')
					
					while(!handle.isAtEnd()){
						handle.advance()
					}

					_.assert(ee.name.value() === 'billy')
										
					done()
				})
				
			})
		})
	})
}



exports.mappingObject = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(c){
		
			c.view('empty', function(err, v){

				var e = v.make('entity', {name: 'test'})
				e.name.set('billy')
		
				c.historicalView('mapping', [], function(err, handle){
					
					_.assert(handle.by.count() === 0)
					
					while(handle.by.count() === 0 && !handle.isAtEnd()){
						handle.advance()
					}
					
					console.log(handle.by.count())
					_.assert(handle.by.count() === 1)
					
					var ee
					handle.by.each(function(key, e){
						ee = e
					})
					
					_.assert(ee.has('name'))
					console.log(ee)
					_.assert(ee.name.value() === 'test')
					
					while(!handle.isAtEnd()){
						handle.advance()
					}

					_.assert(ee.name.value() === 'billy')
										
					done()
				})
				
			})
		})
	})
}

exports.mappingObjectKeys = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(c){
		
			c.view('empty', function(err, v){

				var e = v.make('entity', {name: 'test'})
				e.name.set('billy')
		
				c.historicalView('mapping', [], function(err, handle){
					
					_.assert(handle.by.count() === 0)
					
					while(handle.by.count() === 0 && !handle.isAtEnd()){
						handle.advance()
					}

					_.assert(handle.by.count() === 1)
					_.assertEqual(handle.by.get('test').name.value(), 'test')

					while(!handle.isAtEnd()){
						handle.advance()
					}

					_.assertEqual(handle.by.get('billy').name.value(), 'billy')
										
					done()
				})
				
			})
		})
	})
}
