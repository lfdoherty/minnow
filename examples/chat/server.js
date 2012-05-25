
var minnow = require('../..')

var Port = 4039

minnow.makeServer(
	__dirname, //the directory in which to find the schema files
	'.', //the directory to store data
	Port/*, //the port on which to accept client connections via TCP
	function(){//a callback that returns once the server is fully loaded and accepting connections
		console.log('minnow server started on port ' + Port)
	}*/)

