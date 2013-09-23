
var _ = require('underscorem')

var editFp = require('./tcp_shared').editFp
var editCodes = editFp.codes
var editNames = editFp.names

var makePropertyDiffer = require('./sync_property_diff').make
var makePropertyRefer = require('./sync_property_refer').make
var makeViewStateConverter = require('./sync_state_edits').make

var random = require('seedrandom')
var RandomSyncId = random.uid()

function stub(){}

function makeDiffer(objSchema){
	if(!objSchema.properties) return function(){return []}
	
	var propertyDiffers = []
	function differ(a, b){
		var changes = []
		for(var i=0;i<propertyDiffers.length;++i){
			var pd = propertyDiffers[i]
			var propertyChanges = pd(a[pd.code], b[pd.code])
			if(propertyChanges === undefined) _.errout('bad: ' + pd)
			if(propertyChanges.length > 0){
				changes.push({op: editCodes.selectProperty, edit: {typeCode: pd.code}})
				changes = changes.concat(propertyChanges)
				//_.errout('TODO: convert property changes to edits: ' + JSON.stringify(propertyChanges))
			}
			
		}
		return changes
	}
	//console.log(JSON.stringify(objSchema))
	Object.keys(objSchema.properties).forEach(function(propertyName){
		var p = objSchema.properties[propertyName]
		var pd = makePropertyDiffer(p)
		pd.code = p.code
		propertyDiffers.push(pd)
	})
	
	return differ
}

function makeRefer(objSchema){
	if(!objSchema.properties){
		return function(){
			var res = {
				viewIds: [],
				objectIds: []
			}
			return res
		}
	}
	
	var propertyRefer = []
	function refer(a){
		var res = {
			viewIds: [],
			objectIds: []
		}
		//_.errout('TODO: ' + JSON.stringify(a))
		//console.log(propertyRefer.length + ' ' + JSON.stringify(a))
		for(var i=0;i<propertyRefer.length;++i){
			var pr = propertyRefer[i]
			_.assertInt(pr.code)
			//console.log('code: ' + pr.code)
			pr(a[pr.code], res)
			
		}
		return res
	}
	Object.keys(objSchema.properties).forEach(function(propertyName){
		var p = objSchema.properties[propertyName]
		var pr = makePropertyRefer(p)
		pr.code = p.code
		propertyRefer.push(pr)
	})
	
	return refer
}


exports.make = function(schema, objectState, query){

	var differs = {}
	var refers = {}
	var viewStateConverters = {}
	
	//TODO generate differs and refers for each view object type
	_.each(schema, function(objSchema){
		if(objSchema.isView){
			
			differs[objSchema.code] = makeDiffer(objSchema)
			refers[objSchema.code] = makeRefer(objSchema)
			viewStateConverters[objSchema.code] = makeViewStateConverter(objSchema)
		}
	})

	var snapcache = require('./viewcache').make(objectState)
	
	function get(viewId, editId){
		var res = snapcache.get(viewId, editId)
		if(!res) _.errout('TODO')
		return res
	}
	
	function getFromUpdate(viewId, oldEditId, oldCache){
		var state = oldCache[viewId]
		if(state === undefined){
			state = snapcache.get(viewId, oldEditId)
			/*if(state === undefined){
				 _.errout('TODO?: ' + viewId + ' ' + oldEditId)
			}*/
		}
		return state
	}
	
	function getQuery(viewId){

		var res = snapcache.get(viewId, objectState.getCurrentEditId()-1)
		if(res) return res
		
		var cur = query.get(viewId)
		
		snapcache.put(viewId, cur)
		
		return cur
	}
	
	function getQueryFromUpdate(viewId, newCache){
		var cached = newCache[viewId]//TODO will this ever happen?
		if(cached) return cached
		
		var cur = query.get(viewId)
		
		newCache[viewId] = cur
		
		return cur
	}
	
	
	
	function getTypeCode(viewId){
		
		//console.log('viewId: ' + JSON.stringify(viewId))
		var typeCode = parseInt(viewId.substring(1, viewId.indexOf('[')))	
		//if(typeCode === 161) console.log('uh oh: ' + viewId + ' ' + new Error().stack)
		return typeCode
	}
	
	function updateObject(id, diff, oldEditId){
		_.assertString(id)
		_.assertInt(oldEditId)
		
		if(diff.updated[id]){
			//console.log('already updated: ' + id)
			return
		}
		
		if(objectState.getLastVersion(id) <= oldEditId){
			//diff.updated[id] = true
			return
		}
		
		//console.log('updating: ' + id)
		//console.log(new Error().stack)
		
		diff.updated[id] = true
		var edits = objectState.getObjectEdits(id)//, oldEditId)
		var sinceEdits = []
		//console.log(oldEditId + ' edits: ' + JSON.stringify(edits))
		var syncId
		
		//edits.forEach(function(e){
		for(var i=0;i<edits.length;++i){
			var e = edits[i]
			if(e.op === editCodes.setSyncId){
				syncId = e.edit.syncId
			}
			//_.assertInt(e.syncId)
			if(e.editId > oldEditId){
				e.syncId = syncId
				sinceEdits.push(e)
			}
		}
		
		if(sinceEdits.length > 0){
			//console.log('updating object: ' + id + ' ' + oldEditId + ': ' + JSON.stringify(sinceEdits))
			diff.edits.push({op: editCodes.selectTopObject, edit: {id: id}, syncId: RandomSyncId, editId: sinceEdits[0].editId})
			diff.edits = diff.edits.concat(sinceEdits)
		}
		updateObjectReffed(id, diff, oldEditId)
	}
	
	function addObject(id, diff, oldEditId){
		_.assertNot(diff.got[id])
		diff.got[id] = true
		diff.added[id] = true
		_.assertString(id)
		var edits = objectState.getObjectBinary(id)//objectState.getObjectEdits(id)
		diff.addedObjects.push({id: id, edits: edits})
		updateObjectReffed(id, diff, oldEditId)
	}
	
	function addViewObject(id, diff, oldEditId, oldCache, newCache){
		_.assertString(id)
		//_.assertNot(diff.got[id])

		diff.got[id] = true
		diff.added[id] = true		

		var typeCode = getTypeCode(id)
		var state = getQueryFromUpdate(id, newCache)
		//console.log('state: ' + JSON.stringify(state))
		var stateEdits = convertViewStateToEdits(typeCode, id, state)//editifiers[typeCode](state)
		diff.addedViewObjects.push({id: id, edits: stateEdits})
		updateViewReffed(id, typeCode, state, diff, oldEditId, oldCache, newCache)
	}
	
	function updateObjectReffed(id, diff, oldEditId){
		var referenced = objectState.getObjectRefers(id)
		for(var j=0;j<referenced.length;++j){
			var reffedId = referenced[j]
			_.assertDefined(reffedId)
			if(diff.got[reffedId]){ 
				if(!diff.added[reffedId]){
					updateObject(reffedId, diff, oldEditId)
				}
			}else{
				addObject(reffedId, diff, oldEditId)
			}
		}
	}
	
	function updateViewReffed(id, typeCode, cur, diff, oldEditId, oldCache, newCache){
		var referenced = refers[typeCode](cur)
		//_.errout('TODO: ' + JSON.stringify(referenced))
		for(var j=0;j<referenced.viewIds.length;++j){
			var reffedId = referenced.viewIds[j]
			if(diff.got[reffedId]){
				updateViewObject(reffedId, diff, oldEditId, oldCache, newCache)
			}else{
				addViewObject(reffedId, diff, oldEditId, oldCache, newCache)
			}
		}
		//console.log('updating view reffed: ' + JSON.stringify(referenced))
		for(var j=0;j<referenced.objectIds.length;++j){
			var reffedId = referenced.objectIds[j]
			//console.log('reffedId: ' + reffedId)
			_.assertString(reffedId)
			if(diff.got[reffedId]){
				if(!diff.added[reffedId]){
					//console.log('updating: ' + reffedId)
					updateObject(reffedId, diff, oldEditId)
				}
			}else{// if(!diff.added[reffedId]){
				//console.log('adding object: ' + reffedId)
				addObject(reffedId, diff, oldEditId)
			}
		}
	}
	function updateViewObject(id, diff, oldEditId, oldCache, newCache){
		if(diff.updated[id] || diff.added[id]) return
		
		_.assert(_.isString(id) || _.isString(id.inner) || _.isString(id))
		
		if(id.substr(0,1) !== ':'){
			console.log('ERROR: invalid view id: ' + id)
			return
		}


		var typeCode = getTypeCode(id)
		
		if(diff.got[id]){
			//console.log('updating ' + id + ' ' + oldEditId)
			diff.updated[id] = true
			
			var cur = getQueryFromUpdate(id, newCache)
			var old = getFromUpdate(id, oldEditId, oldCache)//oldEditId)
			if(!old){
				/*var e = new Error('cache missing some previous state, must start fresh: ' + id + ' at ' + oldEditId)//throw new Error()
				e.code === 'MissingState'
				throw e*/
				//diff.added
				addViewObject(id, diff, oldEditId, oldCache, newCache)
				return
			}else{
				//_.errout('unknown ' + id + ' ' + oldEditId)
			
				var edits = differs[typeCode](old, cur)
				
				if(edits.length > 0){
					//_.errout('tODO: include any reffed ids: ' + JSON.stringify(cur))
					//TODO setTopObject, etc.
					//_.errout('TODO: ' + JSON.stringify(edits))
					var curEditId = objectState.getCurrentEditId()-1
					edits.forEach(function(e){e.syncId = RandomSyncId;e.editId = curEditId})
					diff.edits.push({op: editCodes.selectTopViewObject, edit: {id: id}, syncId: RandomSyncId, editId: curEditId})
					diff.edits = diff.edits.concat(edits)
				}
			}
			updateViewReffed(id, typeCode, cur, diff, oldEditId, oldCache, newCache)
			
			
		}else{
			addViewObject(id, diff, oldEditId, oldCache, newCache)
		}
	}
	
	function includeObjectInSnap(id, got, res){
		_.assertString(id)
		if(got[id]) return
		res.push({id: id, edits: objectState.getObjectBinary(id)})
		//_.assertBuffer(res[res.length-1].edits)
		got[id] = true
		var referenced = objectState.getObjectRefers(id)
		//console.log('including in snap: ' + id + ' ' + JSON.stringify(referenced))
		for(var i=0;i<referenced.length;++i){
			var reffId = referenced[i]
			_.assertString(reffId)
			includeObjectInSnap(reffId, got, res)
		}
	}
	
	function convertViewStateToEdits(typeCode, viewId, state){
		var converter = viewStateConverters[typeCode]
		return converter(viewId, state)
	}
	
	var handle = {
		
		update: function(addedObjects, addedViews, objectIds, viewIds, oldEditId, got, oldCache, newCache){
			_.assertLength(arguments, 8)
		
			var diff = {
				got: got,
				updated: {},
				added: {},
				addedObjects: [],
				addedViewObjects: [],
				edits: []
			}
			
			for(var i=0;i<viewIds.length;++i){
				updateViewObject(viewIds[i], diff, oldEditId, oldCache, newCache)
			}
			
			//console.log('updating objects: ' + JSON.stringify(objectIds))
			for(var i=0;i<objectIds.length;++i){
				updateObject(objectIds[i], diff, oldEditId)
			}
						
			addedViews.forEach(function(av){
				//console.log('adding view: ' + av.id + ' ' + av.lastEditId)
				_.assertNot(got[av.id])
				viewIds.push(av.id)
				got[av.id] = true
				updateViewObject(av.id, diff, av.lastEditId, oldCache, newCache)
			})
			addedObjects.forEach(function(id){
				_.assertString(id)
				if(!got[id]){
					addObject(id, diff, oldEditId)
				}
			})
			
			diff.updated = undefined
			diff.got = undefined
			diff.added = undefined
			
			return diff
		},
		snap: function(viewId, got){
			_.assertString(viewId)
			got = got || {}
			if(got[viewId]) return []
			got[viewId] = true

			//console.log('adding to snap: ' + viewId)			
			
			if(viewId.substr(0,1) !== ':'){
				_.errout('ERROR: invalid view id: ' + viewId)
			}

			
			var cur = getQuery(viewId)
			var typeCode = getTypeCode(viewId)
			var referenced = refers[typeCode](cur)
			var res = {viewObjects: [{id: viewId, edits: convertViewStateToEdits(typeCode, viewId, cur)}], objects: []}
			//console.log(JSON.stringify([referenced]))
			for(var i=0;i<referenced.viewIds.length;++i){
				var rvi = referenced.viewIds[i]
				_.assertString(rvi)
				var snapRes = handle.snap(rvi, got)
				res.viewObjects = res.viewObjects.concat(snapRes.viewObjects)
			}
			for(var i=0;i<referenced.objectIds.length;++i){
				var id = referenced.objectIds[i]
				includeObjectInSnap(id, got, res.objects)
			}
			//console.log('res: ' + JSON.stringify(res))
			return res
		}
	}
	
	return handle
}

