"use strict";

var _ = require('underscorem')

var editFp = require('./tcp_shared').editFp
var editCodes = editFp.codes
var editNames = editFp.names


function PathUpdater(initialPath){
	this.path = initialPath||[]
	//this.typeCode;
	//var syncId;
	//this.update = PathUpdater.prototype.update.bind(this)
	//this.edits = []
}
PathUpdater.prototype.updateAll = function update(edits){
	for(var i=0;i<edits.length;++i){
		this.update(edits[i])
	}
}
PathUpdater.prototype.reset = function(){
	this.path = []
	this.typeCode = undefined
	this.syncId = undefined
}

PathUpdater.prototype.made = function(e){this.typeCode = e.edit.typeCode}
PathUpdater.prototype.madeFork = function(e){
	_.assertInt(e.edit.typeCode);
	this.typeCode = e.edit.typeCode
	this.path = []
	//_.errout('TODO')
}
PathUpdater.prototype.setSyncId = function(e){this.syncId = e.edit.syncId}
PathUpdater.prototype.selectProperty = function(e){this.path.push(e)}
PathUpdater.prototype.reselectProperty = function(e){this.path[this.path.length-1] = e}
PathUpdater.prototype.selectObject = function(e){this.path.push(e)}
PathUpdater.prototype.reselectObject = function(e){this.path[this.path.length-1] = e}
PathUpdater.prototype.selectStringKey = function(e){this.path.push(e)}
PathUpdater.prototype.selectLongKey = PathUpdater.prototype.selectStringKey
PathUpdater.prototype.selectIntKey = PathUpdater.prototype.selectStringKey
PathUpdater.prototype.selectBooleanKey = PathUpdater.prototype.selectStringKey
PathUpdater.prototype.selectObjectKey = PathUpdater.prototype.selectStringKey
PathUpdater.prototype.reselectStringKey = function(e){this.path[this.path.length-1] = e}
PathUpdater.prototype.reselectLongKey = PathUpdater.prototype.reselectStringKey
PathUpdater.prototype.reselectIntKey = PathUpdater.prototype.reselectStringKey
PathUpdater.prototype.reselectBooleanKey = PathUpdater.prototype.reselectStringKey
PathUpdater.prototype.reselectObjectKey = PathUpdater.prototype.reselectStringKey

PathUpdater.prototype.ascend = function(e){this.path = this.path.slice(0, this.path.length-e.edit.many)}
PathUpdater.prototype.ascend1 = function(e){this.path.pop()}// = this.path.slice(0, this.path.length-1)}
PathUpdater.prototype.ascend2 = function(e){this.path = this.path.slice(0, this.path.length-2)}
PathUpdater.prototype.ascend3 = function(e){this.path = this.path.slice(0, this.path.length-3)}
PathUpdater.prototype.ascend4 = function(e){this.path = this.path.slice(0, this.path.length-4)}
PathUpdater.prototype.ascend5 = function(e){this.path = this.path.slice(0, this.path.length-5)}

var upLookup = Object.create(null)
var arr = [ 'made','madeFork','setSyncId','selectProperty','reselectProperty','selectObject','reselectObject', 'selectStringKey',
			'selectLongKey','selectIntKey','selectBooleanKey',
			'selectObjectKey','reselectStringKey','reselectLongKey','reselectIntKey',
			'reselectBooleanKey','reselectObjectKey',
			'ascend','ascend1','ascend2','ascend3','ascend4','ascend5']
arr.forEach(function(key){
	upLookup[editCodes[key]] = true
})

exports.pathEditsLookup = upLookup

PathUpdater.prototype.update = function update(e){
	if(upLookup[e.op]){
		this[editNames[e.op]](e)
		return true
	}
}

PathUpdater.prototype.getPath = function(){
	return this.path
}
PathUpdater.prototype.getTypeCode = function(){
	//if(this.typeCode == undefined) _.errout('no typeCode defined: ' + JSON.stringify(this.edits))
	//_.assertInt(this.typeCode)
	return this.typeCode
}
PathUpdater.prototype.getSyncId = function(){
	return this.syncId
}

function makePathUpdater(initialPath){
	return new PathUpdater(initialPath)
}

exports.make = makePathUpdater
