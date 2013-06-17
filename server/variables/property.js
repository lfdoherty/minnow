"use strict";

var _ = require('underscorem')

var schema = require('./../../shared/schema')

var makeKeyParser = require('./map').makeKeyParser

var editFp = require('./../tcp_shared').editFp
var editCodes = editFp.codes
var editNames = editFp.names

function propertyType(rel, ch){

	_.assertLength(rel.params, 2)
	if(rel.params[1].schemaType === undefined) _.errout(JSON.stringify(rel))
	_.assertObject(rel.params[1].schemaType)
	
	var st = rel.params[1].schemaType
	var propertyName = rel.params[0].value

	//console.log('property(' + propertyName + ') type of ' + JSON.stringify(st))
	
	if(propertyName === 'values'){
		//_.assertEqual(st.value.type, 'primitive')//TODO
		if(st.value.type === 'set' || st.value.type === 'list') _.errout('TODO')
		return {type: 'set', members: st.value}
	}
	
	if(st.type === 'primitive') throw new Error('cannot compute property "' + propertyName + '" of a non-object: ' + st.primitive)
	if(st.type === 'object'){
		if(propertyName === 'id'){
			return {type: 'primitive', primitive: 'string'}
		}else if(propertyName === 'uuid'){
			return {type: 'primitive', primitive: 'string'}
		}else if(propertyName === 'copySource'){
			return st//{type: 'object', object: st.object}
		}else if(propertyName === 'creationSession'){
			return {type: 'primitive', primitive: 'int'}
		}else{
			var objSchema = ch.schema[st.object]
			if(objSchema === undefined) _.errout('cannot find object type: ' + st.object)
			if(objSchema.properties === undefined) _.errout('no properties: ' + JSON.stringify(objSchema) + ' - ' + propertyName)
			var p = objSchema.properties[propertyName]
			if(p === undefined) _.errout('cannot find property "' + propertyName + '" of ' + objSchema.name);
			return p.type
		}
	}else if(st.type === 'view'){
		var objSchema = ch.viewMap[st.view].schema
		if(objSchema === undefined) _.errout('cannot find view schema: ' + st.view);

		//if(objSchema.name === undefined) _.errout('no name for view schema: ' + st.view);

		//console.log(propertyName + ' ' + JSON.stringify(objSchema) + '\n'+JSON.stringify(ch.viewMap[st.view]))
		if(objSchema.properties === undefined){
			_.errout('cannot find property (or any properties) "' + propertyName + '" of ' + objSchema.name + ' (' + st.view + ')');
		}
		var p = objSchema.properties[propertyName]
		if(p === undefined) _.errout('cannot find property "' + propertyName + '" of ' + objSchema.name);
		return p.type
	}else{
		if(st.members.type === 'object'){
			if(propertyName === 'id'){
				return {type: 'set', members: {type: 'primitive', primitive: 'int'}}
			}else if(propertyName === 'uuid'){
				return {type: 'set', members: {type: 'primitive', primitive: 'string'}}
			}else{
				var objName = st.members.object
				var objSchema = ch.schema[objName]
				if(objSchema === undefined) throw new Error('cannot find object type: ' + objName + ' ' + JSON.stringify(st))
				var p = objSchema.properties[propertyName]
				if(p === undefined) _.errout('cannot find property "' + propertyName + '" of ' + objSchema.name);
				p = p.type
				if(p.type === 'set' || p.type === 'list'){
					p = p.members
				}
				if(p.type === 'map'){
					return p
				}
				return {type: st.type, members: p};
			}
		}else{
			var objName = st.members.view
			var objSchema = ch.viewMap[objName].schema
			if(objSchema === undefined) throw new Error('cannot find view/object type: ' + objName + ' ' + JSON.stringify(st))
			var kp = objSchema.properties[propertyName]
			if(kp === undefined) _.errout('cannot find property "' + propertyName + '" of ' + objSchema.name);
			var p = kp.type
			if(p.type === 'set' || p.type === 'list'){
				p = p.members
			}
			_.assert(p.type !== 'map')
			return {type: st.type, members: p};
		}
	}
}

schema.addFunction('property', {
	schemaType: propertyType,
	minParams: 2,
	maxParams: 2,
	callSyntax: 'property(propertyname,object|collection:object)'
})

