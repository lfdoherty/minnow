"use strict";

var _ = require('underscorem');

var apf = require('./apf');

var objectstate = require('./objectstate');

exports.make = function(dataDir, schema, ol, cb){
	_.assertLength(arguments, 4);
	
	var apState;

	var ap;
	
	apState = require('./ap_state').make(schema, ol);

	//var inv = require('./inverse').make();
	
	//var broadcaster = require('./broadcast').make(schema);
	//inv.setBroadcaster(broadcaster)
	
	//apState.external.setBroadcaster(broadcaster)
	
	//TODO apf load should go straight to OLE
	
	ol.propertyIndex.endIndexAttaching()
	
	apf.load(dataDir, schema, ol.readers, ol.getLatestVersionId(), function(aph){
	
		apState.setAp(aph)
		cb(apState.external, aph.close.bind(aph))
	})

}
