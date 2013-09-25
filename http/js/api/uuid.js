"use strict";

var u = require('./util')
var _ = require('underscorem')

var lookup = require('./../lookup')
var editCodes = lookup.codes

var random = require('seedrandom')

function UuidHandle(typeSchema, obj, part, parent){

	this.part = part;
	this.parent = parent;
	
	if(obj === undefined){
		if(typeSchema.tags){
			//_.each(typeSchema.tags, function(value, tag){
			Object.keys(typeSchema.tags).forEach(function(tag){
				if(tag.indexOf('default:') === 0){
					var defStr = tag.substr(tag.indexOf(':')+1);
					defStr = JSON.parse(defStr);
					obj = defStr;
				}
			});
		}
	}
	this.obj = obj;

	this.schema = typeSchema
}

UuidHandle.prototype.getName = function(){return this.schema.name;}

UuidHandle.prototype.getImmediateProperty = u.immediatePropertyFunction;

UuidHandle.prototype.adjustPathToSelf = u.adjustPathToPrimitiveSelf

function tryIncrementalUpdate(handle, a, b){

	var changes = diffText(a,b)

	var bad = false
	changes.forEach(function(c){
		if(c.type !== 'add') bad = true//TODO impl remove
	})
	if(bad) return

	changes.forEach(function(c){
		if(c.type === 'add'){
			handle.saveEdit(editCodes.insertString, c);
		}else{
			handle.saveEdit(editCodes.removeString, c);
		}
	})
	
	if(changes.length > 0){
		handle.emit({}, 'set', b)	
	}
	
	return true
}

UuidHandle.prototype.set = function(uuid){
	
	if(this.obj+'' === uuid+'') return;
	
	//console.log('setting to ' + str.length + ' from ' + this.obj.length)

	var did	

	var old = this.obj
	this.obj = uuid;
	
	if(old){
		did = tryIncrementalUpdate(this, old, uuid)
		if(did) return
	}

	_.assertDefined(this.obj)
	
	var e = {value: this.obj}

	this.saveEdit(editCodes.setUuid, e);
		
	this.emit(e, 'set', uuid)
}
UuidHandle.prototype.value = function(){
	return random.uuidStringToBase64(this.obj)
}

UuidHandle.prototype.toJson = function(){
	return this.obj?this.obj.toString():this.obj;
}

UuidHandle.prototype.changeListener = u.primitiveChangeListener;

module.exports = UuidHandle

