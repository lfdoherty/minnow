
//#requires minnow-service:all

listenForMinnow(function(api){
	console.log('got minnow api');
	
	api.property('events').each(function(event){
		console.log('event: ' + JSON.stringify(event.toJson()));
		event.property('time').setNow();
	});
	
	api.listenForRefresh(function(){
		console.log(api.toJson());
	});
});
