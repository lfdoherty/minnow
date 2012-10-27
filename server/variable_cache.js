
var _ = require('underscorem')

function Cache(analytics){
	_.assertObject(analytics)
	this.cache = Object.create(null)
	this.analytics = analytics
}
Cache.prototype.has = function(key){
	var has = !!this.cache[key]
	//console.log('cache ' + key + ' ' + has)
	return has
}
Cache.prototype.get = function(key){
	this.analytics.cacheHit()
	return this.cache[key]
}
Cache.prototype.store = function(key, value){
	_.assertFunction(value.attach)
	//_.assertFunction(value.detach)

	this.analytics.cachePut()
	
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
	var local = this
	value.detach = function(listener, editId){
		//console.log('here: ' + oldDetach)
		oldDetach(listener, editId)
		--count
		if(count === 0){//TODO wait a bit, see if anyone uses it?
			//console.log('zeroed, evicting')
			local.analytics.cacheEvict()
			delete cache[key]//de-cache
		}
	}
	return value;
}

module.exports = Cache
