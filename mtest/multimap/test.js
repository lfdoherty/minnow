
var minnow = require('./../../client/client')

var _ = require('underscorem')

function poll(f){var ci=setInterval(wf,10);function wf(){if(f()){clearInterval(ci)}}}

exports.index = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.view('general', function(c){
			
				poll(function(){

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
					otherClient.view('general', function(v){

						v.make('entity', {name: 'jim', tags: ['young', 'tall']})
						v.make('entity', {name: 'mary', tags: ['old', 'tall']})
					})
				})
				
			})
		})
	})
}
