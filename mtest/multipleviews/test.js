
var minnow = require('./../../client/client')//this is the minnow include
var _ = require('underscorem')

exports.updateMadeObject = function(config, done){
	minnow.makeServer(config, function(){
		minnow.makeClient(config.port, function(client){
			//client.onEdit(function(id, path, op, edit, syncId, editId){
				//console.log('********** got edit: ' + op + ' ' + JSON.stringify(edit))
			//})
			
			client.view('general', function(err, c){
			
				var bill = c.make('secondary', {name: 'bill'})
				
				var e1 = c.make('entity', {ref: bill}, function(){
					//console.log('MADE ENTITY USING BILL')
					//_.assertDefined(e1)
					done.poll(function(){
					
						console.log(JSON.stringify([bill.toJson(),e1.toJson()]))
						
						if(bill !== e1.ref){
							throw new Error('invalid handle duplication')
						}
						
						if(bill.name.value() === 'ted'){
							done()
							return true
						}else{
							//console.log(JSON.stringify(bill.toJson()))
						}
					})

					minnow.makeClient(config.port, function(otherClient){
						otherClient.view('specific', [e1], function(err, v){
							_.assert(v.has('e'))
							console.log('in specific: ' + JSON.stringify(v.e.toJson()))
							_.assert(v.e.has('ref'))
							v.e.ref.name.set('ted')
						})
					})
				})
			})
		})
	})
}

