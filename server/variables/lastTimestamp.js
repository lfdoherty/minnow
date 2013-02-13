
var _ = require('underscorem')

//var Cache = require('./../variable_cache')
var listenerSet = require('./../variable_listeners')
var fixedPrimitive = require('./../fixed/primitive')
var schema = require('./../../shared/schema')


function timestampType(rel){
	return {type: 'primitive', primitive: 'long'}
}

schema.addFunction('timestamp', {
	schemaType: timestampType,
	implementation: maker,
	minParams: 1,
	maxParams: 1,
	callSyntax: 'timestamp(version)'
})

function maker(s, self, rel, typeBindings){
	var elementGetter = self(rel.params[0], typeBindings)
	
	var cache = s.makeCache()//new Cache(s.analytics)

	var f
	if(rel.params[0].schemaType.members.primitive === 'int'){
		f = svg.bind(undefined, s, cache, elementGetter)
	}else{
		_.errout('TODO?: ' + JSON.stringify(rel.params[0].schemaType))
	}
	
	f.wrapAsSet = function(v, editId, context){return fixedPrimitive.make(s)(v, {}, editId);}
	
	return f
}

function svg(s, cache, elementGetter, bindings, editId){

	//_.errout('TODO')

	var element = elementGetter(bindings, editId)	
	var key = element.key
	if(cache.has(key)) return cache.get(key)
	
	var listeners = listenerSet()

	var timestamp
	var version
	
	var handle = {
		name: 'timestamp',
		attach: function(listener, editId){
			listeners.add(listener)
			_.assertInt(editId)
			//for(var i=0;i<versions.length;++i){
				//var v = versions[i]
				//var t = timestamps[v]
				//listener.put(v,t,undefined,editId)
			//}
			if(timestamp !== undefined){
				listener.emitSet(timestamp, undefined, editId)
			}
		},
		detach: function(listener, editId){
			listeners.remove(listener)
			if(editId && timestamp){
				/*for(var i=0;i<versions.length;++i){
					var v = versions[i]
					var t = timestamps[v]
					listener.del(v,editId)
				}*/
				listener.emitSet(undefined, timestamp, editId)
			}
		},
		oldest: oldest,
		key: key,
		getType: function(){_.errout('INVALID: NOT AN OBJECT TYPE');},
		descend: function(){_.errout('INVALID: NOT AN OBJECT TYPE');}
	}
	
	
	var ongoingEditId;
	function oldest(){
		var oldestEditId = element.oldest()
		if(ongoingEditId !== undefined && ongoingEditId < oldestEditId) oldestEditId = ongoingEditId
		return oldestEditId
	}
	
	element.attach({
		set: function(v, oldV, editId){
			var ts = s.objectState.getVersionTimestamp(v)
			timestamp = ts
			version = v
			listeners.emitSet(timestamp, undefined, editId)
		}
	}, editId)
	return cache.store(key, handle)
}
