
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
	this.analytics.varName = value.name

	this.analytics.cachePut()
	
	var cache = this.cache
	cache[key] = value
	var oldDetach = value.detach
	var oldAttach = value.attach
	var count = 0
	
	var local = this
	value.attach = function(listener, editId){
		if(timingOut){
			//console.log('rescued cached variable')
			local.analytics.cacheRescue()
		}
		var res = oldAttach(listener, editId)
		++count
		return res
	}
	
	var timingOut = false
	
	var local = this
	value.detach = function(listener, editId){
		//console.log('here: ' + oldDetach)
		oldDetach(listener, editId)
		--count
		if(count === 0){//TODO wait a bit, see if anyone uses it?
			//console.log('zeroed, evicting')
			if(timingOut) return
			timingOut = true
			setTimeout(function(){
				
				if(count !== 0) return
				
				local.analytics.cacheEvict()

				if(!value.destroy) _.errout('missing destroy method: ' + value.name)
				value.destroy()

				delete cache[key]//de-cache
			},5000)
		}
	}
	return value;
}

module.exports = Cache
