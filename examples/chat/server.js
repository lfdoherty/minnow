
var minnow = require('../..')

var config = {
	schemaDir: __dirname, //the directory where the schema files are to be found
	port: 4039 //the port on which to accept client connections via TCP
}

minnow.makeServer(config, function(){
	console.log('minnow server started on port: ' + config.port)
})

