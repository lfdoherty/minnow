"use strict";

var fixedPrimitive = require('./../fixed/primitive')
var fixedObject = require('./../fixed/object')

var _ = require('underscorem')

exports.make = function(s, setExpr, typeBindings){
	var paramName = setExpr.name
	var f = svgParam.bind(undefined, s, paramName)
	var typeBinding = typeBindings[paramName]
	//console.log(paramName + ': ' + JSON.stringify(typeBindings))
	//_.assertObject(typeBinding)

	//console.log('here: ' + JSON.stringify(setExpr))
	//console.log('type binding: ' + typeBinding)
	//console.log('type binding: ' + JSON.stringify(Object.keys(typeBinding)))
	//console.log(_.isFunction(typeBinding))
	if(_.isFunction(typeBinding)){
		f.wrapAsSet = function(v, editId, context){
			//console.log('wrapping via type binding: ' + typeBinding.wrapAsSet)
			return typeBinding.wrapAsSet(v, editId, context)//typeBinding(v);
		}
		f.wrappers = typeBinding.wrappers
		if(setExpr.schemaType.type === 'view'){
			//console.log(''+typeBinding.wrapAsSet)
			_.assertObject(f.wrappers)
		}
		/*if(setExpr.schemaType.type === 'object'){
			//f.getDescender = typeBinding.getDescender
			_.assertFunction(typeBinding.getDescender)
		}*/
	}else{

		if(typeBinding === undefined){
			if(setExpr.schemaType.type === 'view'){
				//console.log(''+f.wrapAsSet)
				_.assertObject(f.wrappers)
			}
			return f
		}
		
		if(typeBinding.type === 'object'){
			var objSchema = s.schema[typeBinding.object]
			
			var fo = fixedObject.make(s)
			f.wrapAsSet = function(v){
				_.assertInt(v)//should be an id
				return fo(v, {}, editId)
			}
			//f.getDescender = fo.getDescender
		}else if(typeBinding.type === 'primitive'){
			f.wrapAsSet = function(v){return fixedPrimitive.make(s)(v, {}, editId);}
		}else if(typeBinding.type === 'view'){
			_.assertObject(typeBinding.wrappers)
			f.wrappers = typeBinding.wrappers
			f.wrapAsSet = function(v){_.errout('TODO');}
			_.assertFunction(typeBinding.getDescender)
			//fo.getDescender = typeBinding.getDescender
		}else{
			_.errout('TODO: ' + JSON.stringify(typeBinding))
		}
	}
	return f
}

function svgParam(s, paramName, bindings, editId){
	if(bindings[paramName] === undefined){
		//console.log('got: ' + JSON.stringify(bindings))
		throw new Error('binding not found: ' + paramName)
	}else{
		//console.log('resolving binding: ' + paramName + '->'+JSON.stringify(bindings[paramName]))
	}
	_.assertString(bindings[paramName].name)
	//console.log('param(' + paramName + ') returning binding: ' + require('util').inspect(bindings[paramName]))
	return bindings[paramName]
}
