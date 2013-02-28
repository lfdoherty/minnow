"use strict";

var _ = require('underscorem')

var editFp = require('./tcp_shared').editFp
var editCodes = editFp.codes
var editNames = editFp.names


function PathUpdater(initialPath){
	/*
	this.currentObject
	this.currentProperty
	this.currentKey
	this.currentSubObject
	*/
	//this.path = initialPath||[]
	//this.typeCode;
	//var syncId;
	//this.update = PathUpdater.prototype.update.bind(this)
	//this.edits = []
}
PathUpdater.prototype.updateAll = function update(edits){
	//console.log(JSON.stringify(edits))
	for(var i=0;i<edits.length;++i){
		this.update(edits[i])
	}
}
PathUpdater.prototype.reset = function(){
	//this.path = []
	console.log('reset')
	//console.log(new Error().stack)
	this.typeCode = undefined
	this.syncId = undefined
	this.currentObject = undefined
	this.currentProperty = undefined
	this.currentKey = undefined
	this.currentSubObject = undefined
}

PathUpdater.prototype.made = function(e){this.typeCode = e.edit.typeCode}
PathUpdater.prototype.madeFork = function(e){
	_.assertInt(e.edit.typeCode);
	this.typeCode = e.edit.typeCode
	this.path = []
	//_.errout('TODO')
}
PathUpdater.prototype.setSyncId = function(e){this.syncId = e.edit.syncId}
PathUpdater.prototype.selectProperty = function(e){
	_.assertInt(e.edit.typeCode)
	this.currentProperty = e.edit.typeCode
	console.log('setting current property: ' + e.edit.typeCode)
	console.log(new Error().stack)
}//this.path.push(e)}
//PathUpdater.prototype.reselectProperty = function(e){this.path[this.path.length-1] = e}
PathUpdater.prototype.selectObject = function(e){
	this.currentObject = e.edit.id
}//this.path.push(e)}
PathUpdater.prototype.selectSubObject = function(e){
	this.currentSubObject = e.edit.id
}//this.path.push(e)}
//PathUpdater.prototype.reselectObject = function(e){this.path[this.path.length-1] = e}
PathUpdater.prototype.selectStringKey = function(e){
	_.assertInt(e.op)
	//console.log('selecting key: ' + e.op + ' ' + e.edit.key)
	this.currentKey = e.edit.key
	this.currentKeyOp = e.op
}
PathUpdater.prototype.selectLongKey = PathUpdater.prototype.selectStringKey
PathUpdater.prototype.selectIntKey = PathUpdater.prototype.selectStringKey
PathUpdater.prototype.selectBooleanKey = PathUpdater.prototype.selectStringKey
PathUpdater.prototype.selectObjectKey = PathUpdater.prototype.selectStringKey
/*PathUpdater.prototype.reselectStringKey = function(e){this.path[this.path.length-1] = e}
PathUpdater.prototype.reselectLongKey = PathUpdater.prototype.reselectStringKey
PathUpdater.prototype.reselectIntKey = PathUpdater.prototype.reselectStringKey
PathUpdater.prototype.reselectBooleanKey = PathUpdater.prototype.reselectStringKey
PathUpdater.prototype.reselectObjectKey = PathUpdater.prototype.reselectStringKey*/
/*
PathUpdater.prototype.ascend = function(e){this.path = this.path.slice(0, this.path.length-e.edit.many)}
PathUpdater.prototype.ascend1 = function(e){this.path.pop()}// = this.path.slice(0, this.path.length-1)}
PathUpdater.prototype.ascend2 = function(e){this.path = this.path.slice(0, this.path.length-2)}
PathUpdater.prototype.ascend3 = function(e){this.path = this.path.slice(0, this.path.length-3)}
PathUpdater.prototype.ascend4 = function(e){this.path = this.path.slice(0, this.path.length-4)}
PathUpdater.prototype.ascend5 = function(e){this.path = this.path.slice(0, this.path.length-5)}
*/
var upLookup = Object.create(null)
var arr = [ 'made','madeFork','setSyncId','selectProperty',
			//'reselectProperty',
			'selectObject',
			'selectSubObject',
			//'reselectObject', 
			'selectStringKey',
			'selectLongKey','selectIntKey','selectBooleanKey',
			'selectObjectKey'//,
			//'reselectStringKey','reselectLongKey','reselectIntKey',
			//'reselectBooleanKey','reselectObjectKey',
			//'ascend','ascend1','ascend2','ascend3','ascend4','ascend5'
			]
arr.forEach(function(key){
	upLookup[editCodes[key]] = true
})

exports.pathEditsLookup = upLookup

PathUpdater.prototype.update = function update(e){
	if(upLookup[e.op]){
		//s[editNames[e.op]](topId, e)
		//console.log('upping: ' + JSON.stringify(e))
		this[editNames[e.op]](e)
		return true
	}
}


PathUpdater.prototype.setTop = function(id){
	this.top = id
}
PathUpdater.prototype.setObject = function(id){
	this.object = id
}
/*PathUpdater.prototype.getPath = function(){
	return this.path
}*/
PathUpdater.prototype.getTypeCode = function(){
	//if(this.typeCode == undefined) _.errout('no typeCode defined: ' + JSON.stringify(this.edits))
	//_.assertInt(this.typeCode)
	return this.typeCode
}
PathUpdater.prototype.getSyncId = function(){
	return this.syncId
}
PathUpdater.prototype.getObject = function(){
	return this.currentObject
}
PathUpdater.prototype.getProperty = function(){
	return this.currentProperty
}
PathUpdater.prototype.getSubObject = function(){
	return this.currentSubObject
}
PathUpdater.prototype.getAll = function(){
	var v = {
		object: this.currentObject,
		sub: this.currentSubObject,
		property: this.currentProperty,
		key: this.currentKey,
		keyOp: this.currentKeyOp,
		top: this.top
	}
	//console.log('all: ' + JSON.stringify(v))
	return v
}

function makePathUpdater(initialPath){
	return new PathUpdater(initialPath)
}

exports.make = makePathUpdater
