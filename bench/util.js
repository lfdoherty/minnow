
var rimraf = require('rimraf')

exports.reset = function(run){
	rimraf('minnow_data', function(err){
		if(err)	throw err
		run()
	})
}

var config = {
	port: 8877,
	schemaDir: '.'
}

exports.config = config
