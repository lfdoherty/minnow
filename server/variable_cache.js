
var _ = require('underscorem')

function Cache(){
	this.cache = Object.create(null)
}
Cache.prototype.has = function(key){
	var has = !!this.cache[key]
	//console.log('cache ' + key + ' ' + has)
	return has
}
Cache.prototype.get = function(key){
	return this.cache[key]
}
Cache.prototype.store = function(key, value){
	_.assertFunction(value.attach)
	//_.assertFunction(value.detach)
	
	var cache = this.cache
	cache[key] = value
	var oldDetach = value.detach
	var oldAttach = value.attach
	var count = 0
	value.attach = function(listener, editId){
		var res = oldAttach(listener, editId)
		++count
		return res
	}
	value.detach = function(listener, editId){
		//console.log('here: ' + oldDetach)
		oldDetach(listener, editId)
		--count
		if(count === 0){//TODO wait a bit, see if anyone uses it?
			delete cache[key]//de-cache
		}
	}
	return value;
}

module.exports = Cache
