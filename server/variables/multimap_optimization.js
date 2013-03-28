
var _ = require('underscorem')
var analytics = require('./../analytics')
var wu = require('./../wraputil')

exports.make = function(s, rel, recurse, handle, ws){

	console.log(JSON.stringify(rel, null, 2))
	
	var inputSet = recurse(rel.params[0])
	
	var propertyName = rel.params[1].expr.params[0].value
	var objectName = rel.params[0].schemaType.members.object
	var objSchema = s.schema[objectName]
	var propertyCode = objSchema.properties[propertyName].code

	var a = analytics.make('multimap-optimization', [inputSet])

	var getProperty = s.objectState.makeGetPropertyAt(objSchema.code, propertyCode)
	function getPropertyAt(id, editId, cb){
		a.gotProperty(propertyName)
		getProperty(id, editId, cb)
	}
	
	
	var keyValueSchemaType = rel.params[2].schemaType
	if(keyValueSchemaType.type !== 'set') keyValueSchemaType = {type: 'set', members: keyValueSchemaType}
	var kws = wu.makeUtilities(keyValueSchemaType)
	
	var permanentCache
	var cacheLastEditId = -1
	function updateCacheTo(editId, cb){
		if(editId > cacheLastEditId){
			handle.getHistoricalChangesBetween({}, cacheLastEditId, editId, function(changes){
				_.errout('TODO: ' + JSON.stringify(changes))
			})
		}else{
			cb()
		}
	}
	
	var handle = {
		name: 'multimap-optimization',
		analytics: a,
		getValueStateAt: function(key, bindings, editId, cb){
			updateCacheTo(endEditId, function(){
				var changes = permanentCache[key]||[]
				var state = []
				changes.forEach(function(c){
					if(c.type === 'add'){
						state.push(c.value)
					}else if(c.type === 'remove'){//TODO pre-mask?
						var i = state.indexOf(c.value)
						_.assert(i !== -1)
						state.splice(i, 1)
					}else{
						_.errout('TODO: ' + JSON.stringify(c))
					}
				})
				cb(state)
			})
			/*handle.getStateAt(bindings, editId, function(states){
				cb(states[key]||[])
			})*/
		},
		getValueChangesBetween: function(key, bindings, startEditId, endEditId, cb){
			updateCacheTo(endEditId, function(){
				var changes = permanentCache[key]||[]
				cb(changes)
			})
			/*handle.getValueStateAt(key, bindings, startEditId, function(startValues){
				handle.getValueStateAt(key, bindings, endEditId, function(endValues){
					if(startValues.length === 0 && endValues.length === 0){
						cb([])
					}else{
						//_.errout('TODO: ' + JSON.stringify([startValues, endValues]))
						var es = kws.diffFinder(startValues, endValues)
						var changes = []
						es.forEach(function(e){
							e.editId = endEditId
							changes.push(e)
						})
						cb(changes)
					}
				})
			})*/
		},
		getStateAt: function(bindings, editId, cb){
			_.errout('TODO')
			/*inputSet.getStateAt(bindings, editId, function(inputValues){
				
				var undefinedState = []
				var states = {}
				var has = {}
				var cdl = _.latch(inputValues.length, function(){
					//console.log('result: ' + JSON.stringify(states))
					cb(states)
				})
				
				inputValues.forEach(function(id){
					getPropertyAt(id, editId, function(v){
						if(v === undefined){
							undefinedState.push(id)
							cdl()
						}else{
							if(states[v] === undefined){
								states[v] = []
								has[v] = {}
							}
							if(!has[v][id]){
								states[v].push(id)
								has[v][id] = true
							}
							cdl()							
						}
					})
				})
			})*/
		},
		getChangesBetween: function(bindings, startEditId, endEditId, cb){
			_.errout('TODO')
		},
		getHistoricalChangesBetween: function(bindings, startEditId, endEditId, cb){
			inputSet.getHistoricalChangesBetween(bindings, startEditId, endEditId, function(changes){
				_.errout('TODO: ' + JSON.stringify(changes))
			})
			_.errout('TODO')
		}
	}
	return handle
}
