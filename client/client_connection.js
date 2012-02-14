"use strict";

exports.make = function(serverConnection){
	
	var sc = serverConnection;
	
	var currentPaths = {};
	
	return {
		serverInstanceUid: sc.serverInstanceUid,
		makeObject: sc.makeObject,
		setEntireObject: sc.setEntireObject,
		streamObject: sc.streamObject,
		//makeSyncHandle: sc.makeSyncHandle,
		getSnapshots: sc.getSnapshots,
		getAllSnapshots: sc.getAllSnapshots,
		getSnapshot: sc.getSnapshot,
		
		getSyncId: function(cb){cb(sc.getSyncId());},
		beginSync: sc.beginSync,
		endSync: sc.endSync,
		
		persistEdit: sc.persistEdit,
		objectExists: sc.objectExists
		/*
		setContext: function(shId, path){
			sc.setSyncHandle(shId);
			var cp = currentPaths[shId];
			if(cp === undefined){
				sc.descendSyncPath(path);
			}else{
				var ml = Math.min(path.length, cp.length);
				for(var i=0;i<ml;++i){
					if(path[i] !== cp[i]) break;
				}
				if(cp.length > i){
					sc.ascendSyncPath(cp.length-i);
				}
				if(path.length > i){
					sc.descendSyncPath(path.slice(i));
				}
			}
			currentPaths[shId] = path;
		},
		setString: sc.setString,
		setTimestamp: sc.setTimestamp*/
	};
}
