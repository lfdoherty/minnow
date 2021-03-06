
var minnow = require('./../client/client');

/*

Run test.js first to add events.

*/

minnow.db('example', function(ex){
	
	var inp = ex.input;
	
	ex.modify.get('groupevents', ['test group'], function(h){

		//console.log('got groupevents view: ' + h.property('group').value());
		console.log('number of matched events before add: ' + h.property('events').count());
		
		inp.makeObject('event');
		inp.set('time', Date.now());
		inp.set('group', 'test group');
		inp.map('attrs', 'windowName', 'test window name');
		
		inp.endObject(function(id){
			
			setTimeout(function(){//wait long enough in case of asynchrony

				console.log('number of matched events after add: ' + h.property('events').count());
				
				var eachCount = 0;
				
				h.property('events').each(function(ev){
					console.log('event: ' + JSON.stringify(ev.toJson()));
					//console.log('event time: ' + ev.property('time').value());
					++eachCount;
				});
				console.log('each count: ' + eachCount);
		
				ex.close();
			}, 500);			
		});
	});

});
