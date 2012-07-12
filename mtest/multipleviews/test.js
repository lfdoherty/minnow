
var minnow = require('./../../client/client')//this is the minnow include

function poll(f){var ci=setInterval(wf,10);function wf(){if(f()){clearInterval(ci)}}}

exports.updateMadeObject = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			client.onEdit(function(id, path, op, edit, syncId, editId){
				console.log('********** got edit: ' + op + ' ' + JSON.stringify(edit))
			})
			
			client.view('general', function(c){
			
				var bill = c.make('secondary', {name: 'bill'})
				
				var e1 = c.make('entity', {ref: bill}, function(){
					console.log('MADE ENTITY USING BILL')
					//_.assertDefined(e1)
					poll(function(){
						if(bill !== e1.ref){
							throw new Error('invalid handle duplication')
						}
						
						if(bill.name.value() === 'ted'){
							done()
							return true
						}else{
							console.log(JSON.stringify(bill.toJson()))
						}
					})

					minnow.makeClient(config.port, function(otherClient){
						otherClient.view('specific', [e1], function(v){
							v.e.ref.name.set('ted')
						})
					})
				})
			})
		})
	})
}

