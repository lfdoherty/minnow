
var _ = require('underscorem')

exports.make = function(s, staticBindings, rel, recurse){
	_.assertLength(arguments, 4)
	_.assertObject(s)
	_.assertDefined(s.facade)
	
	var contextType = rel.params[1].schemaType
	//var resultType = rel.schemaType
	var propertyName = rel.params[0].value
	
	if(contextType.type === 'set' || contextType.type === 'list'){
		var objTypeName = contextType.members.object
		var objSchema = s.schema[objTypeName]
		if(!objSchema) _.errout('cannot find object: ' + JSON.stringify(contextType))
		var p = objSchema.properties[propertyName]
		if(!p) _.errout('cannot find property: ' + propertyName)
		var propertyCode = p.code
	
		var index = staticBindings.makePropertyIndex(objSchema, objSchema.propertiesByCode[propertyCode])

		var context = recurse(rel.params[1])
		
		if(p.type.type === 'set' || p.type.type === 'list'){
			function setSetGetter(bindings){

				var contextIds = context(bindings)
				var all = []
				for(var i=0;i<contextIds.length;++i){
					var id = contextIds[i]
					var res = index.getValueAt(bindings, id)//, s.objectState.getCurrentEditId()-1)//TODO remove editId param
					all.push(res)
				}
				if(all.length > 0){
					//_.errout('*all: ' + JSON.stringify(all))
					var has = {}
					var result = []
					for(var i=0;i<all.length;++i){
						var arr = all[i]
						for(var j=0;j<arr.length;++j){
							var v = arr[j]
							if(has[v]) continue
							result.push(v)
							has[v] = true
						}
					}
					return result
				}else{
					return []
				}
			}
			setSetGetter.index = index
			return setSetGetter
		}else if(p.type.type === 'map'){
			if(p.type.value.type === 'set' || p.type.value.type === 'list'){
				_.errout('tODO: ' + JSON.stringify(p))
			}else{
				function mapSetGetter(bindings){

					var contextIds = context(bindings)
					var all = []
					var result
					if(!contextIds) return all
					for(var i=0;i<contextIds.length;++i){
						var id = contextIds[i]
						var res = index.getValueAt(bindings, id)//, s.objectState.getCurrentEditId()-1)//TODO remove editId param
						if(res !== undefined){
							//all.push(res)
							if(!result){
								result = res
							}else{
								var keys = Object.keys(res)
								for(var j=0;j<keys.length;++j){
									var k = keys[j]
									var v = res[k]
									result[k] = v
								}
							}
						}
					}
					//console.log('*all: ' + JSON.stringify(result))
					return result
				}
				mapSetGetter.index = index
				return mapSetGetter
			}
		}else{
			function setGetter(bindings){

				var contextIds = context(bindings)
				var all = []
				var has = {}
				if(!contextIds) return all
				for(var i=0;i<contextIds.length;++i){
					var id = contextIds[i]
					var res = index.getValueAt(bindings, id, s.objectState.getCurrentEditId()-1)//TODO remove editId param
					if(res !== undefined && !has[res]){
						has[res] = true
						all.push(res)
					}
				}
				
				return all
			}
			setGetter.index = index
			return setGetter
		}
	}else if(contextType.type === 'map'){
		//_.errout('TODO?: ' + JSON.stringify(rel) + '\n' + JSON.stringify(contextType))
		_.errout('bug: cannot take a property of a map: ' + JSON.stringify(rel))
	}else{
		var objSchema = s.schema[contextType.object]
		if(!objSchema) _.errout('cannot find object: ' + JSON.stringify(contextType))
		var p = objSchema.properties[propertyName]
		if(!p) _.errout('cannot find property: ' + propertyName)
		var propertyCode = p.code
	
		var index = staticBindings.makePropertyIndex(objSchema, objSchema.propertiesByCode[propertyCode])

		var context = recurse(rel.params[1])
		var getter = index.getValueAt
		function getterFunction(bindings){
			var contextId = context(bindings)
			//_.errout('tODO')
			if(contextId !== undefined){
				var res = getter(bindings, contextId)//, s.objectState.getCurrentEditId()-1)//TODO remove editId param
				//console.log(contextId+'['+contextType.object+']'+'.'+propertyName +' -> ' + JSON.stringify(res))
				return res
			}
			//console.log(contextId+'['+contextType.object+']'+'.'+propertyName)
		}
		getterFunction.index = index
		return getterFunction
		//_.errout('TODO: ' + JSON.stringify(rel))
	}
}
