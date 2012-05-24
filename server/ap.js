"use strict";

var _ = require('underscorem');

var apf = require('./apf');

var objectstate = require('./objectstate');

var indexing = require('./indexing')

exports.make = function(dataDir, schema, ol, cb){
	_.assertLength(arguments, 4);
	
	var apState;

	var ap;
	
	//var doingRafization;
		
	//	var remaining = 0;
	apState = require('./ap_state').make(schema, ol);
	
	var inv = require('./inverse').make(apState.external);
	var broadcaster = require('./broadcast').make(inv);
	
	apState.external.setBroadcaster(broadcaster)
	
	indexing.load(dataDir, schema, ol, function(indexingObj){
	
		apf.load(dataDir, schema, apState.internal, ol.getLatestVersionId(), function(aph){
		
			apState.setIndexing(indexingObj);
			apState.setAp(aph)
			cb(apState.external, indexingObj, broadcaster, aph.close.bind(aph))
		})
	})

}
