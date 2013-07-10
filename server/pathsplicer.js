"use strict";

var _ = require('underscorem')

var editFp = require('./tcp_shared').editFp
var editCodes = editFp.codes
var editNames = editFp.names


function PathUpdater(initialPath){
}
PathUpdater.prototype.updateAll = function update(edits){
	//console.log(JSON.stringify(edits))
	for(var i=0;i<edits.length;++i){
		this.update(edits[i])
	}
}
PathUpdater.prototype.reset = function(){
	//this.path = []
	//console.log('reset')
	//console.log(new Error().stack)
	this.typeCode = undefined
	this.syncId = undefined
	this.currentObject = undefined
	this.currentProperty = undefined
	this.currentKey = undefined
	this.currentSubObject = undefined
}

PathUpdater.prototype.made = function(e){this.typeCode = e.edit.typeCode}
/*PathUpdater.prototype.madeFork = function(e){
	_.assertInt(e.edit.typeCode);
	this.typeCode = e.edit.typeCode
	this.path = []
	//_.errout('TODO')
}*/
PathUpdater.prototype.setSyncId = function(e){this.syncId = e.edit.syncId}
PathUpdater.prototype.selectProperty = function(e){
	_.assertInt(e.edit.typeCode)
	this.currentProperty = e.edit.typeCode
}
PathUpdater.prototype.selectObject = function(e){
	this.currentObject = e.edit.id
	this.currentProperty = undefined
}
PathUpdater.prototype.clearObject = function(e){
	this.currentObject = undefined
	this.currentProperty = undefined
}
PathUpdater.prototype.selectSubObject = function(e){
	this.currentSubObject = e.edit.id
}
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
/*
PathUpdater.prototype.wasSetToNew = function(e){
	_.assertInt(e.edit.id)
	this.currentObject = e.edit.id
	_.errout('here')
}

PathUpdater.prototype.setToNew = function(e){
	_.assertInt(e.edit.id)
	this.currentObject = e.edit.id
	_.errout('here')
}*/

var upLookup = Object.create(null)
var arr = [ 'made','setSyncId','selectProperty',
			'selectObject',
			'selectSubObject',
			'selectStringKey',
			'selectLongKey','selectIntKey','selectBooleanKey',
			'selectObjectKey',
			'clearObject'
			]
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


PathUpdater.prototype.setTop = function(id){
	this.top = id
}
PathUpdater.prototype.setObject = function(id){
	this.object = id
}
PathUpdater.prototype.getTypeCode = function(){
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
