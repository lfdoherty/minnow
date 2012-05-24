
var minnow = require('./../client/client');

/*

Run test.js first to add events.

*/

minnow.db('example', function(ex){
	
	ex.modify.get('groupevents', ['test group'], function(h){

		console.log('got groupevents view: ' + h.property('group').value());
		
		h.property('events').each(function(ev){
			console.log('event: ' + JSON.stringify(ev.toJson()));
			console.log('event time: ' + ev.property('time').value());
		});
		
		ex.close();
	});

});
