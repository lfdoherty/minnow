
var minnow = require('./../../client/client')

var _ = require('underscorem')

function poll(f){
	var ci=setInterval(wf,10);
	//setTimeout(function(){
	//	clearInterval(ci)
	//}, 4000)
	function wf(){
		if(f()){
			//console.log('HERE HERE HERE')
			clearInterval(ci)
		}
	}
}

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
						var obj = c.make('entity', {value: 'test'})
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
						var obj = c.make('membrance', {value: 'test2'})
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
						var n = c.make('entity', {value: 'test'})
						var obj = c.make('membrance', {value: 'test', other: n})
						n.setProperty('other', obj)
					})
				})
				
			})
		})
	})
}

