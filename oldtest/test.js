
var minnow = require('./../client/client');

minnow.db('example', function(ex){
	console.log('got ex handle');
	var inp = ex.input;
	
	inp.makeObject('event');
		inp.set('time', Date.now());
		inp.set('group', 'test group');
		inp.map('attrs', 'windowName', 'test window name');
	inp.endObject(function(id){
		console.log('got event id back: ' + id);
		
		var obj = {attrs: {}};
		var out = ex.output;
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
				ex.close();
			}
		});
	});
	
});
