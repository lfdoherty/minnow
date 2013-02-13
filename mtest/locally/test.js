
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

