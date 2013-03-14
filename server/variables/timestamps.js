
var _ = require('underscorem')

//var Cache = require('./../variable_cache')
var listenerSet = require('./../variable_listeners')
var fixedPrimitive = require('./../fixed/primitive')
var schema = require('./../../shared/schema')

function stub(){}

function timestampsType(rel){
	return {type: 'map', key: {type: 'primitive', primitive: 'int'}, value: {type: 'primitive', primitive: 'long'}}
}

schema.addFunction('timestamps', {
	schemaType: timestampsType,
	implementation: maker,
	minParams: 1,
	maxParams: 1,
	callSyntax: 'timestamps(versions)',
	computeAsync: function(z, cb, versions){
		var result = {}
		if(versions === undefined){
			cb(result)
			return
		}
		versions.forEach(function(v){
			var ts = z.objectState.getVersionTimestamp(v)
			result[v] = ts
		})
		//console.log('erkjewlrkjwerk: ' + JSON.stringify(result))
		cb(result)
	}
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

	var timestamps = {}
	var versions = []
	
	var handle = {
		name: 'timestamps',
		attach: function(listener, editId){
			listeners.add(listener)
			_.assertInt(editId)
			//console.log('attached: ' + JSON.stringify([versions, timestamps]))
			for(var i=0;i<versions.length;++i){
				var v = versions[i]
				var t = timestamps[v]
				listener.put(v,t,undefined,editId)
			}
		},
		detach: function(listener, editId){
			listeners.remove(listener)
			if(editId){
				for(var i=0;i<versions.length;++i){
					var v = versions[i]
					var t = timestamps[v]
					listener.del(v,editId)
				}
			}
		},
		oldest: oldest,
		key: key,
		descend: function(){_.errout('INVALID: NOT AN OBJECT TYPE');},
		destroy: function(){
			handle.descend = handle.oldest = handle.attach = handle.detach = function(){_.errout('destroyed');}
			element.detach(elementsListener)
			listeners.destroyed()
		}
	}
	
	
	var ongoingEditId;
	function oldest(){
		var oldestEditId = element.oldest()
		if(ongoingEditId !== undefined && ongoingEditId < oldestEditId) oldestEditId = ongoingEditId
		return oldestEditId
	}
	
	var elementsListener = {
		add: function(v, editId){
			_.assertInt(v)
			_.assert(v > 0)
			var ts = s.objectState.getVersionTimestamp(v)
			timestamps[v] = ts
			versions.push(v)
			//console.log('put ' + v + ' -> ' + ts)
			listeners.emitPut(v, ts, undefined, editId)
		},
		remove: function(v, editId){
			delete timestamps[v]
			versions.splice(versions.indexOf(v), 1)
			listeners.emitDel(v, editId)
		},
		includeView: stub,
		removeView: stub
	}
	element.attach(elementsListener, editId)
	return cache.store(key, handle)
}
