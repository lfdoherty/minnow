"use strict";

var _ = require('underscorem')

function PathUpdater(initialPath){
	this.path = initialPath||[]
	//this.typeCode;
	//var syncId;
	//this.update = PathUpdater.prototype.update.bind(this)
	this.edits = []
}
PathUpdater.prototype.updateAll = function update(edits){
	for(var i=0;i<edits.length;++i){
		this.update(edits[i])
	}
}
PathUpdater.prototype.update = function update(e){
	_.assertDefined(this)
	this.edits.push(e)
	var op = e.op
	//console.log(JSON.stringify(e))
	if(op === 'made'){
		this.typeCode = e.edit.typeCode
	}else if(op === 'setSyncId'){
		this.syncId = e.edit.syncId
	}else if(op === 'reset'){
		this.path = []
	}else if(op === 'selectProperty'){
		_.assert(e.edit.typeCode > 0)
		this.path.push(e)
	}else if(op === 'reselectProperty'){
		_.assert(e.edit.typeCode > 0)
		this.path[this.path.length-1] = e
	}else if(op === 'selectObject'){
		//_.assert(e.edit.id > 0)
		this.path.push(e)
	}else if(op === 'reselectObject'){
		//_.assert(e.edit.id > 0)
		this.path[this.path.length-1] = e
	}else if(op === 'selectStringKey' || op === 'selectLongKey' || op === 'selectIntKey' || op === 'selectBooleanKey' || op==='selectObjectKey'){
		if(op === 'selectIntKey') _.assertInt(e.edit.key)
		this.path.push(e)
	}else if(op === 'reselectStringKey' || op === 'reselectLongKey' || op === 'reselectIntKey' || op === 'reselectBooleanKey' || op === 'reselectObjectKey'){
		if(op === 'reselectIntKey') _.assertInt(e.edit.key)
		this.path[this.path.length-1] = e
	}else if(op === 'ascend'){
		this.path = this.path.slice(0, this.path.length-e.edit.many)
	}else if(op === 'ascend1'){
		//console.log('pu-sourced ascend1')
		this.path = this.path.slice(0, this.path.length-1)
	}else if(op === 'ascend2'){
		this.path = this.path.slice(0, this.path.length-2)
	}else if(op === 'ascend3'){
		this.path = this.path.slice(0, this.path.length-3)
	}else if(op === 'ascend4'){
		this.path = this.path.slice(0, this.path.length-4)
	}else if(op === 'ascend5'){
		this.path = this.path.slice(0, this.path.length-5)
	}else{
		//_.assertInt(this.typeCode)
		return false
	}
	return true
}
PathUpdater.prototype.getPath = function(){
	return this.path
}
PathUpdater.prototype.getTypeCode = function(){
	if(this.typeCode == undefined) _.errout('no typeCode defined: ' + JSON.stringify(this.edits))
	_.assertInt(this.typeCode)
	return this.typeCode
}
PathUpdater.prototype.getSyncId = function(){
	return this.syncId
}

function makePathUpdater(initialPath){
	return new PathUpdater(initialPath)
}

exports.make = makePathUpdater
