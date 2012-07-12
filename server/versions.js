"use strict";

var _ = require('underscorem');

var Rate = 1.5;
var Base = 10;

var Window = 5;
var TemporaryWindow = 3;

var LogRate = Math.log(Rate);

//Composes a partition of the version id 0-latestVersionId range, through a combination
//of an exponential-gap-size partitioning and a new-chunk-merging (linear) partitioning.
//Note that 'latestVersionId' is actually just the length of the snapshot object's version ids list,
//hence we're segmenting that space, not the actual version id space.
//The segmenting is then mapped to the real version id space.
function computeSeveralSnapshotVersions(latestVersionId){
	if(latestVersionId < Base) return [];
	
	var k = Math.log(latestVersionId/Base) / LogRate;
	
	k = Math.floor(k);
	
	var arr = [];

	//exponential partitioning
	for(var nk=k;nk>=0 && arr.length < Window;--nk){
		arr.unshift(Math.floor(Base * Math.pow(Rate, nk)));
	}

	//console.log('before temporaries: ' + JSON.stringify(arr));
	
	//new chunk linear partitioning
	var lastVersion = arr[arr.length-1];
	var nextVersion = Math.floor(Base * Math.pow(Rate, k+1))
	//console.log(latestVersionId + ' k: ' + k);
	_.assertInt(nextVersion);
	for(var i=1;i<TemporaryWindow;++i){
		var t = lastVersion + Math.floor((nextVersion-lastVersion)*(i/(TemporaryWindow+1)));
		_.assertInt(t);
		//console.log(t + ' ' + latestVersionId + ' TTTT');
		if(t < latestVersionId){
			arr.push(t);
		}
	}
	
	
	
	//console.log('done: ' + JSON.stringify(arr));
	return arr;
}

_.assertLength(computeSeveralSnapshotVersions(10), 1);
_.assertEqual(computeSeveralSnapshotVersions(10)[0], 10);


exports.computeSnapshots = function(latestVersionId){
	
	return computeSeveralSnapshotVersions(latestVersionId);
}
