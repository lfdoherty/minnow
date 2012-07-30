"use strict";

var _ = require('underscorem')

var Cache = require('./../variable_cache')
var listenerSet = require('./../variable_listeners')
var schema = require('./../../shared/schema')
var fixedObject = require('./../fixed/object')

function type(rel){
	_.assertString(rel.params[0].value)
	return {type: 'object', object: rel.params[0].value}
}
schema.addFunction('cast', {
	schemaType: type,
	implementation: maker,
	minParams: 2,
	maxParams: 2,
	callSyntax: 'cast(typename, object)'
})

function maker(s, self, rel, typeBindings){

	var elementsGetter = self(rel.params[1], typeBindings)

	var objSchema = s.schema[rel.params[0].value]

	//var cache = new Cache()

	var nf = svgCast.bind(undefined, s, elementsGetter)

	var fixedObjGetter = fixedObject.make(s)
	nf.wrapAsSet = function(id, editId, context){
		_.assertInt(editId)
		var fo = fixedObjGetter(id, editId, context)
		_.assertString(fo.name)
		return fo
	}
	
	return nf;
}

function svgCast(s, getter, bindings, editId){
	
	var element = getter(bindings, editId)
	_.assertString(element.name)
	
	return element
	
}
