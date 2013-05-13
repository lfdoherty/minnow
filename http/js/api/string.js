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
	this.schema = typeSchema
}

StringHandle.prototype.getName = function(){return this.schema.name;}

StringHandle.prototype.getImmediateProperty = u.immediatePropertyFunction;

StringHandle.prototype.adjustPathToSelf = u.adjustPathToPrimitiveSelf

function tryIncrementalUpdate(handle, a, b){
	//console.log('trying: "' + a + '" "' + b+'"')
	if(b.length > a.length){
		for(var i=0;i<a.length;++i){
			if(a[i] !== b[i]){
				break
			}
		}
		var firstChange = i

		for(var i=0;i<a.length;++i){
			//console.log(a[a.length-i-1] + ' ' + b[b.length-i-1] + ' ' + i)
			if(a[a.length-i-1] !== b[b.length-i-1]){
				break
			}
		}
		
		var lastChangeInB = b.length-i

		//console.log(JSON.stringify([firstChange, lastChangeInB, i, a, b]))

		if(lastChangeInB - firstChange === b.length - a.length){//is a pure insertion
			var inserted = b.substring(firstChange, lastChangeInB)
			
			//_.assertDefined(this.obj)
			var e = {index: firstChange, value: inserted}
			handle.saveEdit(editCodes.insertString, e);
			handle.emit(e, 'set', b)
			
			return true
		}
	}
}

StringHandle.prototype.set = function(str){
	
	if(this.obj === str) return;

	var did	

	var old = this.obj
	this.obj = str;
	
	if(old){
		did = tryIncrementalUpdate(this, old, str)
		if(did) return
	}
	
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
