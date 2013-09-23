"use strict";

var _ = require('underscorem')

function InnerId(objId, id){
	this.top = objId
	this.inner = id
}
InnerId.prototype.toString = function(){
	if(this.inner === undefined) return this.top
	return this.top + '_' + this.inner
}

function innerify(objId, id){
	//_.assertInt(id)
	if(id !== undefined) _.assertString(id)
	//_.assertInt(objId)//TODO if not, use top from this
	if(objId.top) objId = objId.top//!_.isInt(objId)) objId = objId.top
	return new InnerId(objId, id)//{top: objId, inner: id}
}

exports.innerify = innerify


exports.InnerId = InnerId
