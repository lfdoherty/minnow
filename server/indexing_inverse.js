
var sf = require('segmentedfile')

exports.make = function(ol, ap, cb){
	
	var dataWriter;
	
	function reader(){
	}
	function segmentCb(){
	}
	
	sf.open('inverse_index.data', reader, segmentCb, function(sfw){
		dataWriter = sfw;
		cb(handle)
	})
	
	var handle = {
		
	}
}
