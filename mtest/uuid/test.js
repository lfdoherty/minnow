
var minnow = require('./../../client/client')//this is the minnow include

function generalWrapCheck(f){
	return function(config, done){
		minnow.makeServer(config, function(){
			minnow.makeClient(config.port, function(client){
				client.view('general', function(err, c){
			
					done.poll(function(){
						if(f(c)){
							done()
						}
					})

					minnow.makeClient(config.port, function(otherClient){
						otherClient.view('empty', function(err, v){
							v.make('entity', {name: 'bill'})
							v.make('entity', {name: 'ted'})
						})
					})
				
				})
			})
		})
	}
}

exports.uuids = generalWrapCheck(function(c){
	console.log(JSON.stringify(c.toJson()))
	return c.uuids.count() === 2
})

exports.uuidsMap = generalWrapCheck(function(c){
	console.log(JSON.stringify(c.toJson()))
	//if(c.byUuid.values().length > 0) console.log(c.byUuid.values()[0].prepared)
	if(c.byUuid.count() === 2){
		var foundBill = false
		var foundTed = false
		c.byUuid.each(function(key, value){
			if(value.name.value() === 'bill') foundBill = true
			if(value.name.value() === 'ted') foundTed = true
		})
		return foundBill && foundTed
	}
})


exports.uuidsByName = generalWrapCheck(function(c){
	console.log(JSON.stringify(c.toJson()))
	return c.uuidsByName.count() === 2
})

exports.namesByUuid = generalWrapCheck(function(c){
	console.log(JSON.stringify(c.toJson()))
	if(c.namesByUuid.count() === 2){
		var foundBill = false
		var foundTed = false
		c.namesByUuid.each(function(uuid, name){
			if(name === 'bill') foundBill = true
			if(name === 'ted') foundTed = true
		})
		return foundBill && foundTed
	}
})
