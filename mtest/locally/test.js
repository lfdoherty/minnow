
var minnow = require('./../../client/client')//this is the minnow include

var _ = require('underscorem')

function poll(f){var ci=setInterval(wf,10);function wf(){try{if(f()){clearInterval(ci)}}catch(e){clearInterval(ci);throw e;}}}

exports.localEdit = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', function(err, c){
			
				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('empty', function(err, v){
						var ev = v.make('entity', {name: 'original'})

						poll(function(){

							if(c.has('e') && c.e.name.value() === 'original'){
								ev.locally(function(){
									ev.name.set('local_name')
								})
								
								setTimeout(function(){
									if(c.e.name.value() !== 'original'){
										done.fail('locally made edit should not have been transmitted')
									}else{
										done()
										return true
									}
								},500)
								return true
							}
						})


					})
				})
				
			})
		})
	})
}
exports.localEdit.forbidSameClient = true

/*
exports.locallyFork = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', function(err, c){
			
				poll(function(){
					console.log(JSON.stringify(c.toJson()))
				})
				
				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('empty', function(err, v){
						var ev = v.make('entity', {name: 'original'})

						var form = v.make('entity', {name: 'form'})
						form.friends.addNew('entity', {name: 'billy'})

						ev.locally(function(){
							//ev.name.set('local_name')
							ev.setForked(form)
						})
						
						_.assertEqual(ev.friends.count(), 1)
						console.log(JSON.stringify([ev.toJson(),form.toJson()]))
						
						
						ev.friends.each(function(f){
							//f.name.set('myfriend')
							f.friends.addNew('entity', {name: 'm'})
						})

						console.log(JSON.stringify([ev.toJson(),form.toJson()]))

					})
				})
			})
		})
	})
}
exports.locallyFork.forbidSameClient = true*/

//TODO implement erroring out if someone tries to edit something created in a locally({...}) block outside of one.
/*
exports.localPathChange = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', function(err, c){
			
				poll(function(){
					if(c.has('e')){
						if(c.e.name.value() !== 'original'){
							_.errout('name was incorrectly changed to "' + c.e.name.value()+'"')
						}else{
							done()
							return true
						}
					}
				})
				
				minnow.makeClient(config.port, function(otherClient){
					otherClient.view('empty', function(err, v){
						var ev = v.make('entity', {name: 'original'})

						var f
						ev.locally(function(){
							f = ev.friends.addNew('entity', {name: 'billy'})
						})
						f.name.set('rally')
					})
				})
				
			})
		})
	})
}
exports.localPathChange.forbidSameClient = true
*/
