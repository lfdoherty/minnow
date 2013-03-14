
var minnow = require('./../../client/client')

var _ = require('underscorem')

function poll(f){var ci=setInterval(wf,0);function wf(){
	try{if(f()){clearInterval(ci)}}
	catch(e){clearInterval(ci);throw e;}
}}

exports.simplest = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('simpleOther', function(err, c){
			
				poll(function(){
					//console.log('polling: ' + JSON.stringify(c.toJson()) + ' ' + c.has('s'))
					if(c.has('s')){
						if(c.s.wrappedValue.value() === 'test'/* && d.wrappedOtherValue.value()*/){
							done()
							//console.log('DONE')
							return true
						}
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('empty', function(err, v){
						var obj = c.make('entity', {v: 'test'})
						//var obj = c.make('membrance', {value: 'test'})
						
					})
				})
				
			})
		})
	})
}

exports.simpleOther = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('simpleOther2', function(err, c){
			
				poll(function(){
					if(c.has('s')){
						var d = c.s
						//console.log('polling: ' + JSON.stringify(c.toJson()) + ' ' + c.has('s'))
						if(d.wrappedOtherValue.value() === 'test2'){
							done()
							return true
						}
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('empty', function(err, v){
						var obj = c.make('membrance', {v: 'test2'})
						c.make('entity', {other: obj})
					})
				})
				
			})
		})
	})
}

exports.complex = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', function(err, c){
			
				poll(function(){
					//console.log('polling: ' + JSON.stringify(c.toJson()) + ' ' + c.has('s'))
					if(c.has('s') && c.s.size() === 1){
						var d;
						//console.log('got s to 1')
						c.s.each(function(dd){d = dd;})
						if(d.wrappedValue.value() === 'test' && d.wrappedOtherValue.value()){
							done()
							return true
						}
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('general', function(err, v){
						var n = c.make('entity', {v: 'test'})
						var obj = c.make('membrance', {v: 'test', other: n})
						n.setProperty('other', obj)
					})
				})
				
			})
		})
	})
}

