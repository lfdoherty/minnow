"use strict";

var u = require('./util')
var _ = require('underscorem')

var lookup = require('./../lookup')
var editCodes = lookup.codes

function StringHandle(typeSchema, obj, part, parent){

	this.part = part;
	this.parent = parent;
	
	//this.rrr = Math.random()
	//console.log('made string handle ' + this.rrr)
	
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

	if(this.isView()){
		this.set = u.viewReadonlyFunction
	}
}
StringHandle.prototype.adjustPathToSelf = u.adjustPathToPrimitiveSelf
StringHandle.prototype.set = function(str){
	
	if(this.obj === str) return;
	
	this.obj = str;
	
	//console.log('path: ' + JSON.stringify(this.getPath()));
	//console.log(this.rrr + ' string set: ' + str)
	
	_.assertDefined(this.obj)
	
	var e = {value: this.obj}

	this.saveEdit(editCodes.setString, e);
		
	this.emit(e, 'set', str)//()
}
StringHandle.prototype.value = function(){
	return this.obj === undefined ? '' : this.obj;
}
StringHandle.prototype.toJson = function(){
	return this.obj;
}

StringHandle.prototype.changeListener = u.primitiveChangeListener;

module.exports = StringHandle
