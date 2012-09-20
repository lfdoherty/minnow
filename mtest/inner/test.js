
var minnow = require('./../../client/client')

var _ = require('underscorem')

function poll(f){var ci=setInterval(wf,10);function wf(){if(f()){clearInterval(ci)}}}

exports.inner = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', function(c){
			
				poll(function(){
					//console.log('polling: ' + JSON.stringify(c.toJson()) + ' ' + c.has('s'))
					if(c.has('s') && c.s.size() === 1){
						var d;
						//console.log('got s to 1')
						c.s.each(function(dd){d = dd;})
						if(d.wrappedValue.value() === 'test' && d.wrappedOtherValue.value() === 'test2'){
							done()
							return true
						}
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('general', function(v){
						var n = c.make('entity', {value: 'test'})
						var obj = n.other.setNew('membrance', {value: 'test2', other: n})
					})
				})
				
			})
		})
	})
}

exports.innerToggle = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('gen', function(c){
			
				var tog = false
				var wasOff = false
				poll(function(){
					if(c.has('s') && c.s.size() === 1){
						var d;
						c.s.each(function(dd){d = dd;})
						//console.log(tog + ' ' + wasOff + ' ' + JSON.stringify(c.toJson()))
						if(!d.has('other')) return
						//console.log('here')
						if(tog){
							if(!d.other.flag.value()){
								wasOff = true
							}
							if(!wasOff){
								done()
								return true
							}
						}else if(d.other.flag.value()){
							tog = true
						}
					}
				})

				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('gen', function(v){
						var n = c.make('entity', {value: 'test'})
						var obj = n.other.setNew('membrance', {value: 'test2', flag: true})
						
						setTimeout(function(){
							obj.flag.toggle()
							setTimeout(function(){
								obj.flag.toggle()
							}, 200)
						}, 200)
					})
				})
				
			})
		})
	})
}

