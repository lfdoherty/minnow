
var _ = require('underscorem')

function InnerId(objId, id){
	this.top = objId
	this.inner = id
}
InnerId.prototype.toString = function(){
	if(this.inner === undefined) return this.top
	return this.top + ':' + this.inner
}

function innerify(objId, id){
	//_.assertInt(id)
	if(id !== undefined) _.assertInt(id)
	//_.assertInt(objId)//TODO if not, use top from this
	if(!_.isInt(objId)) objId = objId.top
	return new InnerId(objId, id)//{top: objId, inner: id}
}

exports.innerify = innerify


exports.InnerId = InnerId
