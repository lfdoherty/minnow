
var analytics = require('./analytics')
var _ = require('underscorem')
var innerify = require('./innerId').innerify
var InnerId = require('./innerId').InnerId

function shallowCopy(b){
	var keys = Object.keys(b)
	var nb = {}
	for(var i=0;i<keys.length;++i){
		var k = keys[i]
		nb[k] = b[k]
	}
	return nb
}

function makePreforkedRel(s, rel, recurseSync, staticBindings){
	_.assertLength(arguments, 4)
	_.assertObject(staticBindings)
	
	var preforkedObjSync = recurseSync(rel.params[0])
	//_.errout('TODO deal with index wrapping')
	
	
	//var preforkedObj = recurse(rel.params[0])
	

	var preforkedObjSchema = s.schema[rel.params[0].schemaType.object]
	//_.errout(JSON.stringify(rel.params[0].schemaType))
	
	//var many = 0
	
	var a = analytics.make('preforked', [preforkedObjSync])
	var handle = {
		name: 'preforked('+preforkedObjSync.name+')',
		analytics: a,
		getPropertyValueAt: function(bindings, token, getter, id, editId, cb){
			_.assertLength(arguments, 6)
			
			//++many

			//console.log('many: ' + many + ' ' + JSON.stringify([token, getter.propertyCode, id, editId]))
			//if(many > 10*1000)console.log(new Error().stack)
			
			var pfId = token
			if(pfId === undefined || id === pfId){
				//console.log('pfId is undefined, or id is the pf id')
				a.gotProperty(getter.propertyCode)
				getter({}, id, editId, cb)
			}else{
				//_.assertEqual(editId, otherEditId)
				//_.errout('TODO: ' + JSON.stringify(arguments))
				a.gotProperty(getter.propertyCode)
				a.gotProperty(getter.propertyCode)
				getter({}, pfId, editId, function(pfValue){
					getter({}, id, editId, function(idValue){
						//console.log('merging: ' + JSON.stringify([pfValue, idValue]))
						if(_.isArray(pfValue)){
							var result = []
							pfValue.forEach(function(v){
								if(v.top) v = innerify(id.top||id,v.inner)
								result.push(v)
							})
							idValue.forEach(function(v){
								if(v.top) v = innerify(id.top||id, v.inner)
								if(result.indexOf(v) === -1) result.push(v)
							})
							cb(result)
						}else{
							if(idValue !== undefined){
								cb(idValue)
							}else{
								cb(pfValue)
							}
						}
					})								
				})
			}
		},
		getStateAt: function(bindings, otherEditId, cb){
			//return a mutator
			
			if(bindings[Object.keys(bindings)[0]] === 41 && Object.keys(bindings).length === 1){// && pfId === undefined){
				_.errout('missing: ' + JSON.stringify([bindings, preforkedObj.name]))
			}
			//console.log('getting preforked obj')
			var pfId = preforkedObjSync.getAt(bindings, otherEditId)//, function(pfId){
			if(pfId === undefined){
				//console.log('no prefork object, passing through ' + id + ' ' + editId)
				cb(undefined)
			}else{
				//_.errout('TODO')
				//console.log('pf id: ' + pfId)
				cb(pfId)
			}
			//})
			
		},
		getChangesBetween: function(bindings, startEditId, endEditId, cb){
			_.errout('TODO')
		},
		getHistoricalChangesBetween: function(bindings, startEditId, endEditId, cb){
			_.errout('TODO')
		}
	}
	
	if(rel.params[0].schemaType.type === 'object'){
		handle.getChangesBetween = function(bindings, startEditId, endEditId, cb){
			preforkedObj.getChangesBetween(bindings, startEditId, endEditId, function(changes){
				//console.log('preforked changes: ' + JSON.stringify(changes))
				cb(changes)
			})
			//_.errout('TODO')
		}
		handle.getHistoricalChangesBetween = function(bindings, startEditId, endEditId, cb){
			preforkedObj.getHistoricalChangesBetween(bindings, startEditId, endEditId, function(changes){
				//console.log('preforked changes: ' + JSON.stringify(changes))
				cb(changes)
			})
			//_.errout('TODO')
		}
		handle.getHistoricalBetween = function(bindings, startEditId, endEditId){
			return preforkedObj.getHistoricalBetween(bindings, startEditId, endEditId)
		}
	}
	
	var newStaticBindings = _.extend({}, staticBindings)
	
	newStaticBindings.makePropertyIndex = function(objSchema, property){
		//console.log(JSON.stringify(preforkedObjSchema))

		var originalIndex = staticBindings.makePropertyIndex(objSchema, property)

		/*if(((!preforkedObjSchema.subTypes || !preforkedObjSchema.subTypes[objSchema.name]) && preforkedObjSchema !== objSchema)){// || !preforkedObjSchema.propertiesByCode[property.code]){
			//no need to prefork this index since it concerns an object type which is never preforked
			//TODO?, or a property which the preforked type does not contain
			console.log('not preforking property index: ' + preforkedObjSchema.name+'.'+property.name)
			if(property.name === 'elements') _.errout('wtf: ' + preforkedObjSchema.name+'.'+property.name + ' ' + objSchema.name + ' ' + JSON.stringify(preforkedObjSchema.subTypes))
			return originalIndex
		}*/
		//console.log(preforkedObjSchema.name+'.'+property.name)
		
		//var indexOnPreforked = staticBindings.makePropertyIndex(objSchema, property)
		//_.errout('tODO')
		var handle = {
			getValueAt: function(bindings, key, editId){
				_.assertLength(arguments, 3)
				var originalValue = originalIndex.getValueAt(bindings, key, editId)
				
				var newBindings = shallowCopy(bindings)
				newBindings[staticBindings.mutatorImplicit]  = key
				//console.log('newBindings: ' + JSON.stringify(newBindings))
				var preforkId = preforkedObjSync.getAt(newBindings, editId)
				
				if(key.inner){
					var nb = shallowCopy(bindings)
					nb[staticBindings.mutatorImplicit]  = key.top
					var preforkTopId = preforkedObjSync.getAt(nb, editId)
					var preforkedInner = innerify(preforkTopId, key.inner)
					nb[staticBindings.mutatorImplicit]  = preforkedInner
					preforkId = preforkedObjSync.getAt(nb, editId) || preforkedInner
					//_.errout('TODO: ' + JSON.stringify([key, preforkTopId]))
				}
				
				if(!preforkId){
					//console.log(editId + ' returning originalValue because preforkId(' + key + ') null ' + preforkedObjSchema.name+'.'+property.name)
					return originalValue
				}
				var preforkedValue = originalIndex.getValueAt(bindings, preforkId, editId)
				var originalChanges = originalIndex.getValueChangesBetween(bindings, key, -1, editId)
				if(originalChanges.length === 0){
					//console.log(preforkedObjSchema.name+'.'+property.name)
					//console.log(preforkedValue)
					if(preforkedValue && preforkedValue.inner){
						var newResult = innerify(key, preforkedValue.inner)
						//console.log(editId + ' returning preforked*(' + key + ', ' + preforkId + '): ' + newResult + ' ' + JSON.stringify(originalValue) + ' ' + property.name)
						return newResult
					}else if(_.isArray(preforkedValue)){
						var newResult = []
						for(var i=0;i<preforkedValue.length;++i){
							var pv = preforkedValue[i]
							if(pv.inner){
								var nr = innerify(key, pv.inner)
								newResult.push(nr)
							}
						}
						//console.log(editId + ' returning preforked*(' + key + ', ' + preforkId + '): ' + JSON.stringify([newResult, originalValue]) + ' ' + property.name)
						return newResult
					}
					//console.log(editId + ' returning preforked(' + key + ', ' + preforkId + '): ' + preforkedValue + ' ' + JSON.stringify(originalValue) + ' ' + property.name)
					return preforkedValue
				}else{
					if(originalValue === undefined || _.isArray(originalValue) || _.isObject(originalValue)){
						if(originalValue === undefined){
							_.errout('tODO: ' + key + ' ' + JSON.stringify([originalValue, preforkedValue, originalChanges]))
						}else{
							//var preforkedChanges = originalIndex.getValueChangesBetween(bindings, preforkId, -1, editId)						
							var set = [].concat(preforkedValue)
							
							if(property.type.members.type === 'object'){
								set.forEach(function(id,index){
									if(id.inner) set[index] = innerify(key, id.inner)
								})
							}
							
							originalChanges.forEach(function(c){
								if(c.type === 'remove'){
									if(set.indexOf(c.value) !== -1){
										set.splice(set.indexOf(c.value), 1)
									}
								}else if(c.type === 'add'){
									//removedByOriginal[c.value] = false
									if(set.indexOf(c.value) === -1){
										set.push(c.value)
									}
								}else{
									_.errout('TODO: ' + JSON.stringify(c))
								}
							})
							
							
							//console.log('Computed: ' + key + ' ' + JSON.stringify([originalValue, preforkedValue, originalChanges, set]))
							return set
						}
					}else{
						//console.log('returning originalValue: ' + originalValue + ' also has preforkedValue: ' + preforkedValue + ' ' + preforkedObjSchema.name+'.'+property.name)
						return originalValue
					}
				}
			},
			getValueChangesBetween: function(bindings, key, startEditId, endEditId){
				_.assertLength(arguments, 4)
				//_.errout('tODO')		
				
				if(key.inner) _.errout('TODO: ' + JSON.stringify(key))		

				var originalChanges = originalIndex.getValueChangesBetween(bindings, key, startEditId, endEditId)
				
				var newBindings = shallowCopy(bindings)
				newBindings[staticBindings.mutatorImplicit]  = key
				var preforkIdChanges = preforkedObjSync.getHistoricalBetween(newBindings, startEditId, endEditId)
				
				if(preforkIdChanges.length === 0){
					//console.log(startEditId+', '+endEditId + ' returning originalValue because preforkId(' + key + ') null ' + preforkedObjSchema.name+'.'+property.name)
					return originalChanges
				}else if(preforkIdChanges.length === 1){
					var pc = preforkIdChanges[0]
					var preforkId = pc.value
					var preforkedChanges = originalIndex.getValueChangesBetween(bindings, preforkId, -1, endEditId)
					if(preforkedChanges.length === 0){
						return originalChanges
					}else if(originalChanges.length === 0){
						var res = []
						var temp = JSON.parse(JSON.stringify(preforkedChanges))
						for(var i=0;i<temp.length;++i){
							var e = temp[i]
							if(e.editId < pc.editId){
								e.editId = pc.editId
							}
							if(e.editId >= startEditId && e.editId <= endEditId){
								res.push(e)
							}
						}
						//_.errout(JSON.stringify([preforkedChanges, res, pc, startEditId, endEditId]))
						return res
					}else{
						_.errout('TODO: ' + JSON.stringify([preforkedChanges, originalChanges, startEditId, endEditId]))
					}
				}else{
					_.errout('TODO: ' + JSON.stringify(preforkIdChanges))
					/*var preforkedChanges = originalIndex.getValueChangesBetween(bindings, preforkId, startEditId, endEditId)
					if(preforkedChanges.length === 0 && originalChanges.length === 0){
						//console.log(startEditId+', '+endEditId + ' returning none')
						return []
					}else if(preforkedChanges.length === 0){
						return originalChanges
					}else{
						_.errout('TODO: ' + JSON.stringify([originalChanges, preforkedChanges]))
					}*/
				}
			},
			getPartialStateAt: function(bindings, ids, editId){
				_.assertLength(arguments, 3)
				var result = {}
				ids.forEach(function(id){
					result[id] = handle.getValueAt(bindings, id, editId)
				})
				return result
			}
		}
		return handle
	}
	newStaticBindings.makeReversePropertyIndex = function(objSchema, property){
		//_.errout('TODO')
		//console.log(JSON.stringify(preforkedObjSchema))

		var originalIndex = staticBindings.makeReversePropertyIndex(objSchema, property)

		var forwardIndex = staticBindings.makePropertyIndex(objSchema, property)
		
		//console.log(JSON.stringify(property))
		var keysAreBoolean = false
		if(property !== -2){
			keysAreBoolean = property.type.primitive === 'boolean'
		}

		/*if(((preforkedObjSchema.subTypes && !preforkedObjSchema.subTypes[objSchema.name]) && preforkedObjSchema !== objSchema)){// || !preforkedObjSchema.propertiesByCode[property.code]){
			//no need to prefork this index since it concerns an object type which is never preforked
			//TODO?, or a property which the preforked type does not contain
			return originalIndex
		}*/
		//console.log(preforkedObjSchema.name+'.'+property.name)
		
		//var indexOnPreforked = staticBindings.makeReversePropertyIndex(preforkedObjSchema, property)
		
		//_.errout('tODO')
		var handle = {
			getValueAt: function(bindings, key, editId){
				_.assertLength(arguments, 3)
				
				//_.errout('TODO')
				
				if(keysAreBoolean) key = !!key
				
				var result = []
				
				var ids = s.objectState.getAllIdsOfTypeAt(objSchema.code, editId)
				var newBindings = shallowCopy(bindings)
				for(var i=0;i<ids.length;++i){
					var id = ids[i]
					newBindings[staticBindings.mutatorImplicit]  = id
					var preforkId = preforkedObjSync.getAt(newBindings, editId)

					var value = forwardIndex.getValueAt(bindings, id, editId)
					var preforkValue = forwardIndex.getValueAt(bindings, preforkId, editId)
					
					if(keysAreBoolean){
						if(value !== undefined){
							if(!!value === key){
								result.push(id)
								//console.log('value - based inclusion: ' + id + ' = ' + value)
							}else{
								//console.log('wrong value: ' + id + ' = ' + value)
							}
						}else if(preforkValue !== undefined && !!preforkValue === key){
							result.push(id)
							//console.log('prefork value - based inclusion: ' + id + ' = ' + preforkValue)
						}else if(!value && !preforkValue && !key){
							result.push(id)
							//console.log('false boolean key inclusion')
						}else{
							//console.log('all wrong: ' + JSON.stringify([id, value, preforkValue]))
						}
					}else{
						if(value){
							if(value === key){
								result.push(id)
								//console.log('value - based inclusion: ' + id + ' = ' + value)
							}else{
								//console.log('wrong value: ' + id + ' = ' + value)
							}
						}else if(preforkValue && preforkValue === key){
							result.push(id)
							//console.log('prefork value - based inclusion: ' + id + ' = ' + preforkValue)
						}else{
							//console.log('all wrong: ' + JSON.stringify([id, value, preforkValue]))
						}
					}
				}
				
				//console.log('preforked computed result: ' + key + ' -> ' + JSON.stringify(result))
				
				return result
				/*
				var original = originalIndex.getValueAt(bindings, key, editId)
				//var preforked = originalIndex.getValueAt(bindings, key, editId)
				
				_.assert(key !== 'undefined')

				if(JSON.stringify(preforked) !== JSON.stringify(original)){
					if(_.isArray(preforked) && original.length === 0){
						console.log('[] original, returning preforked ' + preforkedObjSchema.name+'.'+property.name + ': ' + JSON.stringify(preforked))
						return preforked
					}else if(_.isArray(preforked) && preforked.length === 0){
						console.log('[] preforked, returning original ' + preforkedObjSchema.name+'.'+property.name + ': ' + JSON.stringify(original))
						return original
					}else{
						_.errout('tODO ' + preforkedObjSchema.name+'.'+property.name + ' ' + key + ' ' + JSON.stringify([original, preforked]))
					}
				}
				
				console.log('same, returning original ' + preforkedObjSchema.name+'.'+property.name + ': ' + JSON.stringify(original))
				return original*/
			},
			getValueChangesBetween: function(bindings, key, startEditId, endEditId){
				_.assertLength(arguments, 4)
				_.errout('tODO')				

				if(keysAreBoolean) key = !!key
			}
		}
		return handle
	}
	
	handle.newStaticBindings = newStaticBindings
	
	return handle
}

exports.makePreforkedRel = makePreforkedRel
