
var minnow = require('./../../client/client')//this is the minnow include

exports.makeChangeNotification = function(config, done){
	minnow.makeServer(config, function(s){
		minnow.makeClient(config.port, function(c){
			c.view('general', [], function(handle){
				var e = handle.make('entity', {name: 'test name'})
				e.once('reify', function(){
					if(e.id() > 0){
						done()
					}
				})
			})
		})
	})
}


exports.updateTemporaryIdAddedElsewhere = function(config, done){
	minnow.makeServer(config, function(s){
		minnow.makeClient(config.port, function(c){
			c.view('general', [], function(handle){
				var e = handle.make('entity', {name: 'test name'})
				var col = handle.make('col')
				col.objs.add(e)
				e.on('reify', function(){
					return function(){
						if(e.id() > 0){
							if(col.objs.has(e)){
								done()
							}
						}
					}
				})
			})
		})
	})
}
