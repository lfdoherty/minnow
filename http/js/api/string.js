"use strict";

var u = require('./util')
var _ = require('underscorem')

var lookup = require('./../lookup')
var editCodes = lookup.codes



//produces a *partial* update - call and apply repeatedly until a===b to get all the changes
function partiallyDiffText(a,b){
	if(b.length >= a.length){
		for(var i=0;i<a.length;++i){
			if(a[i] !== b[i]) break
		}
		var fi = i
		
		if(fi === a.length){
			return {type: 'add', index: fi, value: b.substr(fi)}
		}else{

			var ea = a.substr(fi)
			var eb = b.substr(fi)
		
			for(var i=0;i<ea.length;++i){
				if(ea[ea.length-i-1] !== eb[eb.length-i-1]){
					break
				}
			}

			var tailLength = i
			
			if(b.length-tailLength-fi > b.length-a.length){//if the changed region is larger than the difference in length	
				var manyToRemove = (b.length-tailLength-fi)-(b.length-a.length)
				return {type: 'remove', index: fi, many: manyToRemove}
			}else{
				return {type: 'add', index: fi, value: b.substring(fi,b.length-tailLength)}
			}
		}
	}else{
		var c = partiallyDiffText(b,a)
		if(c.type === 'remove'){
			return {type: 'add', index: c.index, value: b.substr(c.index,c.many)}
		}else{
			return {type: 'remove', index: c.index, many: c.value.length}
		}
	}
}

//produces one or two changes that succinctly describe the changes to the text
function diffText(a,b){
	var changes = []
	var text = a
	while(text !== b){
		var c = partiallyDiffText(text,b)
		if(c.type === 'add'){
			text = text.substr(0,c.index)+c.value+text.substr(c.index)
		}else{
			text = text.substr(0,c.index)+text.substr(c.index+c.many)
		}
		changes.push(c)
	}
	
	return changes
}


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

	//if(this.isView()){
	//	this.set = u.viewReadonlyFunction
	//}
	this.schema = typeSchema
}

StringHandle.prototype.getName = function(){return this.schema.name;}

StringHandle.prototype.getImmediateProperty = u.immediatePropertyFunction;

StringHandle.prototype.adjustPathToSelf = u.adjustPathToPrimitiveSelf

function tryIncrementalUpdate(handle, a, b){

	var changes = diffText(a,b)

	var bad = false
	changes.forEach(function(c){
		if(c.type !== 'add') bad = true
	})
	if(bad) return

	changes.forEach(function(c){
		if(c.type === 'add'){
		
			//var e = {index: firstChange, value: inserted}
			handle.saveEdit(editCodes.insertString, c);
			handle.emit(c, 'set', b)
		}else{
			//var e = {index: firstChange, many: inserted}
			handle.saveEdit(editCodes.removeString, c);//TODO impl removeString
			handle.emit(c, 'set', b)
		}
	})
	
	return true
		
	//console.log('trying: "' + a + '" "' + b+'"')
	/*if(b.length > a.length){
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

		if(lastChangeInB <= firstChange && b.length - a.length === 1){
			var inserted = b.substr(firstChange, 1)
			
			var e = {index: firstChange, value: inserted}
			handle.saveEdit(editCodes.insertString, e);
			handle.emit(e, 'set', b)
			
			return true
		
		}else if(lastChangeInB - firstChange === b.length - a.length){//is a pure insertion
			var inserted = b.substring(firstChange, lastChangeInB)
			
			//_.assertDefined(this.obj)
			var e = {index: firstChange, value: inserted}
			handle.saveEdit(editCodes.insertString, e);
			handle.emit(e, 'set', b)
			
			return true
		}
		return
	}
	return*/
}

StringHandle.prototype.set = function(str){
	
	if(this.obj === str) return;
	
	//console.log('setting to ' + str.length + ' from ' + this.obj.length)

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
