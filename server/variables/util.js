
/*
TODO standardize edit names (e.g. remove, addExisting)
*/

var _ = require('underscorem')

var typeSuffix = {
	int: 'Int',
	long: 'Long',
	string: 'String',
	boolean: 'Boolean',
	real: 'Real',
	timestamp: 'Long'
}

exports.setOp = function(t){
	if(t.type === 'primitive'){
		var ts = typeSuffix[t.primitive]
		if(ts === undefined) _.errout('TODO: ' + t.primitive)
		return 'set'+ts
	}else{
		return 'setObject'
	}
}

exports.putOp = function(t){
	if(t.value.type === 'primitive'){
		var ts = typeSuffix[t.value.primitive]
		if(ts === undefined) _.errout('TODO: ' + t.value.primitive)
		return 'put'+ts
	}else{
		if(t.value.type === 'view'){
			return 'putViewObject'
		}else{
			return 'putExisting'
		}
	}
}

exports.putAddOp = function(t){
	_.assertDefined(t.value.members.primitive)
	var ts = typeSuffix[t.value.members.primitive]
	return 'putAdd'+ts
}
exports.putRemoveOp = function(t){
	_.assertDefined(t.value.members.primitive)
	var ts = typeSuffix[t.value.members.primitive]
	return 'putRemove'+ts
}
exports.selectKeyOp = function(t){
	return 'select'+(typeSuffix[t.key.primitive]||'Object')+'Key'
}

exports.addOp = function(t){
	if(t.members.type === 'primitive'){
		var ts = typeSuffix[t.members.primitive]
		if(ts === undefined) _.errout('TODO: ' + t.members.primitive)
		return 'add'+ts
	}else{
		return 'addExisting'
	}
}
exports.removeOp = function(t){
	if(t.members.type === 'primitive'){
		var ts = typeSuffix[t.members.primitive]
		if(ts === undefined) _.errout('TODO: ' + t.members.primitive)
		return 'remove'+ts
	}else{
		return 'remove'
	}
}

exports.computeSharedObjectType = function(schema, objectNames){
	_.assert(objectNames.length > 0)
	
	if(objectNames.length === 1){
		return objectNames[0]
	}else{
		var currentBase = objectNames[0]
		var curSchema = schema[currentBase]
		objectNames.slice(1).forEach(function(n){

			var s = schema[n]
			if(currentBase === n) return
			if(s.superTypes && s.superTypes[currentBase]) return
			if(curSchema.superTypes && curSchema.superTypes[n]){
				currentBase = n
				curSchema = s
				return
			}
			
			if(curSchema.superTypes && s.superTypes){
				var found = false
				Object.keys(curSchema.superTypes).forEach(function(st){
					if(s.superTypes[st]){
						currentBase = st
						curSchema = schema[currentBase]
						found = true
					}
				})
				//TODO descend to more specific subtype if possible
				if(found) return
			}
			
			currentBase = 'object'
			curSchema = undefined
			
			//console.log(JSON.stringify(curSchema))
			//console.log(JSON.stringify(s))
			//_.errout('cannot find shared supertype for: ' + currentBase + ' and ' + n)
		})
		return currentBase
	}
}
