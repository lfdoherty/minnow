
var _ = require('underscorem')

var minnow = require('./../../client/client')//this is the minnow include

exports.requestingViewTwice = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(c){
		
			//c.make('entity', {name: 'test'})

			c.view('empty', function(err, v){
				//console.log('got empty')
				v.make('entity', {name: 'test'})
		
				var h
				var h2
				var cdl = _.latch(2, function(){
					_.assertEqual(h, h2)
					done()
				})
				c.view('general', [], function(err, handle){
					h = handle
					//console.log('got h')
					cdl()
				})
				c.view('general', [], function(err, otherHandle){
					h2 = otherHandle
					//console.log('got h2')
					cdl()
				})
			})
		})
	})
}

exports.requestingViewAgainAfterChanges = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(c){
		
			//c.make('entity', {name: 'test'})

			c.view('empty', function(err, v){
				//console.log('got empty')
		
				var h
				var h2
				var cdl = _.latch(2, function(){
					_.assertEqual(h, h2)
					done()
				})
				c.view('general', [], function(err, handle){
					h = handle
					//console.log('got h')
					v.make('entity', {name: 'test'})
					cdl()
					c.view('general', [], function(err, otherHandle){
						h2 = otherHandle
						//console.log('got h2')
						cdl()
					})
				})
			})
		})
	})
}


