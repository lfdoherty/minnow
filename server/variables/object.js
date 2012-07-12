"use strict";

var Cache = require('./../variable_cache')
var listenerSet = require('./../variable_listeners')

var variableView = require('./view')

exports.make = function(s, self, setExpr){
	//_.errout('HERE')
	var cache = new Cache()
	
	//1. one set for each property
	var relSets = {}
	var attachRelFuncs = {}
	Object.keys(setExpr.rels).forEach(function(relName){
		var rel = setExpr.rels[relName];
		var relFunc = relSets[rel.code] = self(rel)
		attachRelFuncs[rel.code] = variableView.makeAttachFunction(s, viewSchema.code, relFunc, rel, rel.code);
	})

	
	return svgGeneralObject.bind(undefined, s, cache, relSets, viewSchema.code, attachRelFuncs)
}

function svgGeneralObject(s, cache, relSetGetters, paramNames, typeCode, attachRelFuncs, id, bindings, editId){

	var key = paramKeysStr+'_' + typeCode
	if(cache.has(key)) return cache.get(key)

	var listeners = listenerSet()
	
	var rels = {}
	Object.keys(relSetGetters).forEach(function(relCode){
		rels[relCode] = relSetGetters(bindings, editId)
	})

	Object.keys(rels).forEach(function(relCode){
		var rel = rels[relCode]
		attachRelFuncs[relCode](listeners, rel, key, editId)
	})

			console.log('TODO LISTEN FOR CHANGES %%%%%%%%%%%%%%%%%5')
	
	var handle = {
		attach: function(listener, editId){
			listeners.add(listener)
			//TODO emit for each property
			console.log('TODO LISTEN FOR CHANGES %%%%%%%%%%%%%%%%%5')
			s.objectState.getObjectState(id, function(obj){
				//listener.setObject(
			})
		},
		detach: function(listener, editId){
			listeners.remove(listener)
			//TODO emit for each property?
		},
		oldest: function(){
			var old = s.objectState.getCurrentEditId();
			function reduceOldest(v){
				var oldValue = v.oldest()
				if(oldValue < old) old = oldValue
			}
			values(localBindings, reduceOldest)
			values(rels, reduceOldest)
			return old
		},
		key: key,
		getProperty: function(elem, propertyCode){
			var rel = rels[propertyCode]
			return rel;
		},
		getPropertyValue: function(elem, propertyCode, cb){//for primitives only
			var rel = rels[propertyCode]
			cb(rel.getValues())
		},
		getId: function(){
			_.errout('TODO')
		}
	}
	
	return cache.store(key, handle)
}

