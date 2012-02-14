
var minnow = require('./../client/client');

/*

Run test.js first to add the event to be modified.

*/

function readEvent(out, id, cb){
	var obj = {attrs: {}};
	out.get('event', id, {
		_start: function(){
		},
			time: function(t){
				obj.time = t;
			},
			group: function(g){
				obj.group = g;
			},
			beginAttrs: function(){
			},
			attrs: function(key, value){
				obj.attrs[key] = value;
			},
			endAttrs: function(){
			},
		_end: function(){
			console.log('got event back: ' + JSON.stringify(obj));
			//ex.close();
			cb();
		}
	});
}
minnow.db('example', function(ex){
	console.log('got ex handle');
	var mod = ex.modify;
	var out = ex.output;
	
	mod.get('event', 0, function(h){
		
		console.log('setting time');
		
		h.property('time').setNow();
		readEvent(out, 0, function(){
			console.log('finished reading event, finishing');
			ex.close();
		});
	});

});
