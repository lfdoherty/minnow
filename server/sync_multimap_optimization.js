
var _ = require('underscorem')

exports.make = function makeWithIndex(s, rel, recurse, staticBindings){

	var propertyName = rel.params[1].expr.params[0].value
	var objectName = rel.params[0].schemaType.members.object
	var objSchema = s.schema[objectName]
	var propertyCode
	if(propertyName === 'uuid'){
		propertyCode = -2
	}else{
		var p = objSchema.properties[propertyName]
		if(p === undefined) _.errout('no property found: ' + objSchema.name+'.'+propertyName + ', got: ' + JSON.stringify(Object.keys(objSchema.properties)))
		propertyCode = p.code
	}

	var keyValueSchemaType = rel.params[2].schemaType
	if(keyValueSchemaType.type !== 'set') keyValueSchemaType = {type: 'set', members: keyValueSchemaType}
	var keysAreBoolean = rel.params[1].expr.schemaType.primitive === 'boolean'

	var p = propertyCode===-2?propertyCode:objSchema.propertiesByCode[propertyCode]
	
	var index = staticBindings.makeReversePropertyIndex(objSchema, p)
	
	//_.assertFunction(index.getValueChangesBetween)
	_.assertDefined(index.getValueAt)
	
	var inputSet = recurse(rel.params[0])

	var forwardIndex = staticBindings.makePropertyIndex(objSchema, p)
	
	function compute(bindings){
		var ids = inputSet(bindings)
		var m = {}
		for(var i=0;i<ids.length;++i){
			var id = ids[i]
			var v = forwardIndex.getValueAt(bindings, id)
			var arr = m[v]
			if(!arr){
				arr = m[v] = []
			}
			arr.push(id)
		}
		//console.log('m: ' + JSON.stringify(m))
		return m
	}
	
	compute.getValue = function(bindings, key){
		return index.getValueAt(bindings, key)
	}
	
	return compute
	/*
	
	var handle = {
		name: 'multimap-optimization',
		analytics: a,
		getValueStateAt: function(key, bindings, editId, cb){
			cb(removeInner(index.getValueAt(bindings, key, editId)))
		},
		getValueAt: function(key, bindings, editId){
			return removeInner(index.getValueAt(bindings, key, editId))
		},
		getAt: function(bindings, editId){
			_.assertLength(arguments, 2)
			
			var ids = inputSet.getAt(bindings, editId)
			var m = {}
			for(var i=0;i<ids.length;++i){
				var id = ids[i]
				var v = forwardIndex.getValueAt(bindings, id, editId)
				var arr = m[v]
				if(!arr){
					arr = m[v] = []
				}
				arr.push(id)
			}
			//console.log('m: ' + JSON.stringify(m))
			return m
		}
	}
	handle.getChangesBetween = handle.getHistoricalChangesBetween

	return handle*/
}
