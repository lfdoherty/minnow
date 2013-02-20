
var _ = require('underscorem')

function InnerId(objId, id){
	this.top = objId
	this.inner = id
}
InnerId.prototype.toString = function(){
	return this.top + ':' + this.inner
}

function innerify(objId, id){
	_.assertInt(id)
	_.assertInt(objId)//TODO if not, use top from this
	return new InnerId(objId, id)//{top: objId, inner: id}
}

exports.innerify = innerify

