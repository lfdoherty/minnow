"use strict";

var _ = require('underscorem');

var Rate = 1.5;
var Base = 10;

var Window = 5;
var TemporaryWindow = 3;

var LogRate = Math.log(Rate);

function computeSeveralSnapshotVersions(latestVersionId){
	if(latestVersionId < Base) return [];
	
	var k = Math.log(latestVersionId/Base) / LogRate;
	
	k = Math.floor(k);
	
	var arr = [];

	for(var nk=k;nk>=0 && arr.length < Window;--nk){
		arr.unshift(Math.floor(Base * Math.pow(Rate, nk)));
	}

	//console.log('before temporaries: ' + JSON.stringify(arr));
	
	var lastVersion = arr[arr.length-1];
	var nextVersion = Math.floor(Base * Math.pow(Rate, k+1))
	console.log(latestVersionId + ' k: ' + k);
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
