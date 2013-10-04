"use strict";

var u = require('./util')
var _ = require('underscorem')

var jsonutil = require('./../jsonutil')


var lookup = require('./../lookup')
var editCodes = lookup.codes
var editNames = lookup.names
_.assertObject(editCodes)
_.assertObject(editNames)

var seedrandom = require('seedrandom')

function TopObjectHandle(schema, typeSchema, edits, parent, id, isView){
	_.assertInt(edits.length)
	_.assertObject(parent)
	_.assertArray(edits)
	_.assertString(id)
	_.assertBoolean(isView)
	
	_.assertEqual(!!typeSchema.isView, isView)
	
	if(!isView){
		_.assertLength(id, 8)
	}
	
	_.assertFunction(parent.getFullSchema)
	
	this.schema = schema;
	this.typeSchema = typeSchema;

	this.obj = {}
	this.edits = edits
	
	this.parent = parent;
	
	this.objectId = id;
	this.objectTypeCode = typeSchema.code;
	this.outputProperty = id
	
	this.innerObjects = {}

	this._gg = Math.random()
	
	//console.log(this._gg+' making TopObject ' + id + ' ' + edits.length + ' ' + this.uid + ' '+this.getEditingId())
	//console.log(new Error().stack)
	
	this.lastEditId = -1
	
	this.edits.forEach(function(e){
		_.assertInt(e.editId)
	})
	
	this._isView = isView
	
	if(this.isView()){
		//console.log('is view object: ' + typeSchema.name)
		this.clearProperty = u.viewReadonlyFunction
		//this.setProperty = u.viewReadonlyFunction
		this.del = u.viewReadonlyFunction
		this.revert = u.viewReadonlyFunction
	}
	/*
	if(!forkedObject && edits.length > 1 && edits[1].op === editCodes.madeFork){
		forkedObject = this.getObjectApi(edits[1].edit.sourceId)
	}
	
	if(forkedObject){
	
		var fes = forkedObject._getEdits()
		this.edits = fes.concat(this.edits)
		this.manyForkedEdits = fes.length
		this._isFork = true
		this._forkedObject = forkedObject

		//console.log(this._gg + ' ' + JSON.stringify(this.edits))


		var local = this
		forkedObject._maintainFork(this)
	}*/

	this.log = this.parent.log
}

TopObjectHandle.prototype.getObjectApi = function(id){
	//console.log(this.historicalKey + ' -> ' + this.objectId + ' ' + id)
	return this.parent.getObjectApi(id, this.historicalKey)
}
/*
TopObjectHandle.prototype.getHistoricalKey = function(){
	return this.historicalKey
}*/
/*
TopObjectHandle.prototype.makeHistorical = function(historicalKey){
	_.assertInt(historicalKey)
	
	//console.log('made historical: ' + historicalKey + ' ' + this.objectId)
	
	this.currentHistoricalVersion = 0
	this.historicalKey = historicalKey
	
	this.nextVersion = function(version){
		//console.log('realEdits: ' + JSON.stringify(this.realEdits, null, 2))
		if(this.nextAdvanceTo > version){
			return this.nextAdvanceTo
		}
		var initialJump = this.isView() ? 0 : this.realEdits[1].edit.following
		_.assertInt(initialJump)
		for(var i=initialJump;i<this.realEdits.length;++i){
			var e = this.realEdits[i]
			if(e.editId > version){
				//console.log('next ' + e.editId + ' < ' + version)
				return e.editId
			}
		}
	}
	
	
	
	var s = this
	this.advanceTo = function(version){
		//_.errout('TODO')
		
		//if(!s.realEdits) _.errout('missing: ' + s.typeSchema.name)
		
		if(s.nextAdvanceTo > version) return

		//console.log('realEdits: ' + JSON.stringify(this.realEdits, null, 2))
		
		s.currentSyncId='-1'
		//this.log(this.objectId, ' preparing topobject with edits:', this.realEdits)
		
		//console.log('advancing edits: ' + s.realEdits.length + ' ' + version + ' ' + this.id())
		
		var applied = false// = s.currentHistoricalVersion
		var next
		//s.realEdits.forEach(function(e, index){
		for(var index=0;index<s.realEdits.length;++index){
			var e = s.realEdits[index]
			if(e.editId < s.currentHistoricalVersion || e.editId > version){
				//console.log('skipped edit: ' + e.editId + ' ' + editNames[e.op])
				if(e.editId > version){
					next = e.editId
					s.nextAdvanceTo = next
					break
				}
				continue
			}
			
			//console.log('applied edit: ' + e.editId + ' ' + editNames[e.op])
			
			if(e.op === editCodes.setSyncId){
				s.currentSyncId = e.edit.syncId
			}else if(e.op === editCodes.madeViewObject){
				//s.log('ignoring view object creation')
			}else if(e.op === editCodes.made){
				//s.log('ignoring object creation')
				//s.pathEdits = []
			}else{
				s.changeListener(s.inputSubObject, s.inputKey, e.op, e.edit, s.currentSyncId, e.editId, true)
				s.lastEditId = e.editId
				s.lastHistoricalEditId = e.editId
			}
			
			applied = true
			
			s.currentHistoricalVersion = e.editId
			//console.log('currentHistoricalVersion: ' + s.currentHistoricalVersion)
		}//)
		
		if(applied){
			++s.currentHistoricalVersion
		}
		//console.log('*currentHistoricalVersion: ' + s.currentHistoricalVersion)
		return next
	}
}
*/
TopObjectHandle.prototype.asAt = function(editId){
	//_.errout('TODO')
	var allowedEdits// = []
	
	for(var i=0;i<this.edits.length;++i){
		var e = this.edits[i]
		if(e.editId > editId){
			allowedEdits = this.edits.slice(0, i)//.push(e)
			break
		}
	}
	
	if(!allowedEdits) allowedEdits = [].concat(this.edits)
	
	var copy = new TopObjectHandle(this.schema, this.typeSchema, allowedEdits, this.parent, this.objectId, this.isView())
	copy.prepare()
	copy._isAtCopy = true
	return copy
}

TopObjectHandle.prototype.getObjectById = function(id){
	if(_.isString(id) && id.indexOf('_') === 22){
		var topStr = id.substr(0, id.indexOf('_'))
		var childStr = id.substr(id.indexOf('_')+1)
		var topId = seedrandom.uuidBase64ToString(topStr)
		var top = this.getObjectApi(topId)
		if(!top.objectApiCache) return
		var childId = seedrandom.uuidBase64ToString(childStr)
		var child = top.objectApiCache[childId]
		return child
	}else{
		return this.getObjectApi(id)
	}
}

//TopObjectHandle.prototype.creationEditI = function(cb){

TopObjectHandle.prototype.replay = function(cb){
	var cp
	var p
	var sub
	var key
	var keyIsObject = false
	
	var types = {}
	
	var curSchema = this.typeSchema
	
	var cur = this.objectId//this.id()
	var curObj = this
	var skip = 0
	var lastMade
	
	//TODO index all properties so that we can retrieve previous values
	
	var propertyIndex = {}
	
	for(var i=0;i<this.edits.length;++i){
		var e = this.edits[i]
		
		if(e.op === editCodes.setSyncId){
		}else if(e.op === editCodes.initializeUuid){
		}else if(e.op === editCodes.selectProperty){
			cp = e.edit.typeCode
			//var curSchema = this.getObjectApi(e.edit.id)

			p = curSchema.propertiesByCode[cp]
			if(!p){
				//_.errout('cannot find: ' + cp + ' in ' + JSON.stringify(this.typeSchema))
				p = undefined
				
			}
		}else if(e.op === editCodes.selectObject){
			cur = e.edit.id
			//_.errout('TODO setup schema')
			//var obj = this.getObjectApi(e.edit.id)
			if(this.objectApiCache){
				var obj = this.objectApiCache[e.edit.id]
				/*if(!obj){
					//curObj.getTopParent().objectApiCache
					obj = curObj.objectApiCache[e.edit.id]
				}*/
				if(!obj){
					console.log('cannot find object: ' + e.edit.id)
					curObj = undefined
					//curObj = undefined
				}else{
					curSchema = obj.typeSchema
					curObj = obj
				}
			}
			//curSchema = types[e.edit.id]
		}else if(e.op === editCodes.selectSubObject){
			sub = e.edit.id
		}else if(e.op === editCodes.selectObjectKey){
			key = e.edit.key
			keyIsObject = true
		}else if(e.op === editCodes.selectStringKey || e.op === editCodes.selectIntKey){
			key = e.edit.key
			keyIsObject = false
		}else if(e.op === editCodes.clearObject){
			cur = this.objectId
			curSchema = this.typeSchema
			curObj = this
		}
		
		if(skip > 0){
			//cb(cur, 'skip')
			--skip
			if(skip === 0){
				cb(lastMade, 'made', '', e.editId)
				lastMade = undefined
			}
			continue
		}
		
		if(!p) continue
		
		if(!curObj) continue
		
		var pkey = curObj.objectId+':'+p.code
		
		if(e.op === editCodes.setSyncId){
		}else if(e.op === editCodes.initializeUuid){
		}else if(e.op === editCodes.selectProperty){
		}else if(e.op === editCodes.selectObject){
		}else if(e.op === editCodes.selectSubObject){
		}else if(e.op === editCodes.selectObjectKey){
		}else if(e.op === editCodes.selectStringKey || e.op === editCodes.selectIntKey){
		}else if(e.op === editCodes.clearObject){
		}else if(e.op === editCodes.made){
			if(e.edit.id == this.objectId){//this.id()){//to ignore preforked
				skip = e.edit.following
				//console.log('following: ' + e.edit.following + ' ' + e.edit.id)
				lastMade = curObj
				if(skip === 0){
					cb(curObj, 'made', '', e.editId)			
				}
			}
			//console.log('skip: ' + skip)
		}else if(e.op === editCodes.setObject){
			if(!p) 
			//_.errout('TODO: ' + e.edit.id)
			/*var prev
			var subjAt = curObj.asAt(e.editId-1)
			if(subjAt.has(p.name)){
				var prevProp = subjAt[p.name]
				prev = prevProp.asAt(e.editId-1)
			}*/
			var prev = propertyIndex[pkey]
			
			var obj = this.getObjectApi(e.edit.id)
			obj.prepare()
			propertyIndex[pkey] = obj
			cb(curObj,'set', p.name, e.editId, obj, prev)
		}else if(e.op === editCodes.clearProperty){
			var prev = propertyIndex[pkey]
			/*var prev
			var subjAt = curObj.asAt(e.editId-1)
			if(subjAt.has(p.name)){
				var prevProp = subjAt[p.name]
				prev = prevProp.asAt(e.editId-1)
			}*/
			/*if(p.type.type === 'set' || p.type.type === 'list'){
				propertyIndex[pkey] = []
			}else if(p.type.type === 'map'){
				propertyIndex[pkey] = {}
			}else{*/
				propertyIndex[pkey] = undefined
			//}
			
			if(!prev){
				console.log('WARNING: cannot find prev: ' + pkey + ' ' + JSON.stringify(Object.keys(propertyIndex)))//subjAt.toJson()) + ' ' + p.name)
			}else{
				cb(curObj, 'clear', p.name, e.editId, prev)
			}
		}else if(e.op === editCodes.setString || e.op === editCodes.setBoolean || e.op === editCodes.setLong || e.op === editCodes.setInt || e.op === editCodes.setUuid){
			var beforeValue = propertyIndex[pkey]//curObj.asAt(e.editId-1)[p.name].value()
			propertyIndex[pkey] = e.edit.value
			cb(curObj, 'set', p.name, e.editId, e.edit.value, beforeValue)
		}else if(e.op === editCodes.insertString){
			var beforeValue = propertyIndex[pkey]//curObj.asAt(e.editId-1)[p.name].value()
			if(beforeValue === undefined){
				console.log('SERIOUS WARNING: cannot find prev for insert ' + pkey)
			}else{
				var newValue = beforeValue.substr(0, e.edit.index) + e.edit.value + beforeValue.substr(e.edit.index)
				propertyIndex[pkey] = newValue
				cb(curObj, 'insert', p.name, e.editId, e.edit.index, e.edit.value, beforeValue, newValue)
			}
		}else if(e.op === editCodes.addedNew || e.op === editCodes.addedNewAfter || e.op === editCodes.addedNewAt){
			var obj = curObj.isInner ? curObj.getTopParent().objectApiCache[e.edit.id] : curObj.objectApiCache[e.edit.id]
			cb(curObj, 'add', p.name, e.editId, obj, true)
		}else if(e.op === editCodes.addExisting || e.op === editCodes.addAfter || e.op === editCodes.unshiftExisting){
			var obj = this.getObjectApi(e.edit.id)
			obj.prepare()
			cb(curObj, 'add', p.name, e.editId, obj)//.asAt(e.editId))
		}else if(e.op === editCodes.addString){
			cb(curObj, 'add', p.name, e.editId, e.edit.value)
		}else if(e.op === editCodes.removeString){
			cb(curObj, 'remove', p.name, e.editId, e.edit.value)
		}else if(e.op === editCodes.remove){
			_.assertDefined(sub)
			var obj  = this.objectApiCache?this.objectApiCache[sub]:undefined
			if(!obj){
				obj = this.getObjectApi(sub)
			}
			obj.prepare()
			cb(curObj/*.asAt(e.editId)*/, 'remove', p.name, e.editId, obj)//.asAt(e.editId))
		}else if(e.op === editCodes.moveToAfter || e.op === editCodes.moveToFront || e.op === editCodes.moveToBack){
			_.assertDefined(sub)
			//console.log('sub: ' + JSON.stringify(sub))
			var obj  = this.objectApiCache?this.objectApiCache[sub]:undefined
			if(!obj){
				obj = this.getObjectApi(sub)
			}
			if(!obj){
				_.errout('cannot locate object: ' + sub)
			}
			obj.prepare()
			cb(curObj, 'move', p.name, e.editId, obj)//.asAt(e.editId))
		}else if(e.op === editCodes.putExisting){
			_.assertDefined(key)
			var k = key
			if(keyIsObject){
				k = this.getObjectApi(key)
				k.prepare()
			}
			var obj = this.getObjectApi(e.edit.id)
			obj.prepare()
			cb(curObj, 'put', p.name, e.editId, k, obj)//.asAt(e.editId))
		}else if(e.op === editCodes.putBoolean || e.op === editCodes.putString || e.op === editCodes.putInt || e.op === editCodes.putLong){
			_.assertDefined(key)
			var k = key
			if(keyIsObject){
				k = this.getObjectApi(key)
				k.prepare()
			}
			cb(curObj, 'put', p.name, e.editId, k, e.edit.value)
		}else{
			_.errout('TODO: ' + JSON.stringify([editNames[e.op], e]))
		}
	}
}
//TopObjectHandle.prototype.getParent = function(){
TopObjectHandle.prototype.getParent = function(){
	_.errout('top-level objects do not have parents')
}
TopObjectHandle.prototype.getImmediateProperty = function(){
	_.errout('logic error')
}
/*
TopObjectHandle.prototype.getForked = function(){
	return this._forkedObject
}
TopObjectHandle.prototype.isFork = function(){
	return this._forkedObject !== undefined
}
*/
TopObjectHandle.prototype.locally = function(f){
	this.setLocalMode(true)
	f.call(this)
	this.setLocalMode(false)
}

TopObjectHandle.prototype.getInnerObject = function(id){
	if(!this.objectApiCache) return
	var obj = this.objectApiCache[id]
	_.assertObject(obj)
	return obj
}
/*
TopObjectHandle.prototype._acceptForkChange = function(subObj, key, op, edit, syncId, editId){//, path){

	console.log('MAINTAINING FORK: ' + op + ' ' + JSON.stringify(edit) + ' on ' + this.objectId + ' ' + syncId + ' ' + this.getEditingId())

	var manyToRemove = 0
	for(var i=0;i<this.edits.length;++i){
		var e = this.edits[i]
		if((e.op === editCodes.made || e.op === editCodes.madeFork) && e.edit.sourceId === this._forkedObject._internalId()){
			break;
		}
		++manyToRemove
	}
	this.edits = this.edits.slice(manyToRemove)
	this.edits = [].concat(this._forkedObject._getEdits()).concat(this.edits)
		
	this._rebuild()
}*/

function changeOnPath(local, op, edit, syncId, editId){
	_.assertInt(op)
	//console.log('path: ' + JSON.stringify(path))
	//_.assertArray(path)
	
	_.assertInt(editId)
	
	/*
	We need:
	- an index of every existing inner object by id
	*/
	
	//console.log('GAR: ' + editNames[op] + ' ' + JSON.stringify(edit))
	
	//console.log('inputObject: ' + local.inputObject)
	//console.log(JSON.stringify(local.edits))
	/*local.edits.forEach(function(e, index){
		console.log(index + ' ' + editNames[e.op] + ' ' + JSON.stringify(e))
	})*/
	//console.log('self: ' + local.id())
	_.assertInt(local.inputProperty)

	//console.log('own: ' + local.objectId + ' ' + local.inputObject + ' ')// + local._forkedObject._internalId())
	
	var ch;
	if(!local.inputObject || local.inputObject === local.objectId || local.inputObject === -1){//TODO handle case where inputObject is the forked object
		ch = local
	}else if(local.lastSelf === local.inputObject){
		ch = local
	}else{
		/*if(editId > 0 && editId !== local.getEditingId() && local.inputObject < 0){
			_.errout('invalid inputObject: ' + local.inputObject + '\t' + editId + ' !== ' + local.getEditingId())
		}*/
		
		if(local.objectApiCache){
			ch = local.objectApiCache[local.inputObject]
		}
		
		/*if(local.inputObject < 0){
			var v = local.parent.temporaryCache[local.inputObject]
			if(v){
				ch = v.n
				//console.log('looked up temporary ' + local.inputObject + ' got ' + Object.keys(ch))
			}
		}*/
		/*if(local.inputObject < 0){
			ch = local.temporary
		}*/
		if(!ch){
			console.log('WARNING: not found ' + local.inputObject + ', only got: ' + JSON.stringify(Object.keys(local.objectApiCache||{})) + ' in ' + local.objectId + ' --- ' + editId)
			console.log(JSON.stringify(local.edits, null, 2))
			throw new Error('here')
			return
		}
		_.assertObject(ch)
	}
	
	var property = ch.typeSchema.propertiesByCode[local.inputProperty]
	if(property === undefined){
		var candidates = ' ' + JSON.stringify(_.map(Object.keys(ch.typeSchema.propertiesByCode),function(p){
			return ch.typeSchema.propertiesByCode[p].name + ':'+ch.typeSchema.propertiesByCode[p].code}))
		if(TopObjectHandle.prototype.errorOnWarn){
			_.errout('WARNING: logic error or removed property, ' + ch.typeSchema.name + ' cannot find property with code: ' + local.inputProperty + candidates)
		}else{
			console.log('WARNING: logic error or removed property, ' + ch.typeSchema.name + ' cannot find property with code: ' + local.inputProperty + candidates)
		}
		return
	}	

	//console.log('modifying property: ' + property.name)
	
	if(op === editCodes.setObject || op === editCodes.setViewObject){
		//_.assertInt(descentCode)
		//var ps = this.typeSchema.propertiesByCode[descentCode];

		//_.assertObject(ps)
		if(op === editCodes.setObject){
			if(property.type.type !== 'object'){
				console.log(JSON.stringify(local.edits, null, 2))
				_.errout('(' + editId + ') setObject called on non object type, type is: ' + JSON.stringify(property.type))
			}
			//_.assertEqual(ps.type.type, 'object')
		}

		var subj
		if(local.inputObject === local.objectId || local.inputObject === local.lastSelf){
			subj = local
		}else{
			subj = local.inputObject!==undefined?local.objectApiCache[local.inputObject]:local
		}

		var pv = subj[property.name]//.cachedProperties[ps.name]
		if(pv && pv.objectId === edit.id){
			//already done
			//console.log('setObject redundant (local view object?), skipping: ' + pv.objectId + ' ' + edit.id)
		}else{
			//this.log('set to: ' + edit.id + ' ' + descentCode + ' ' + this.objectId + ' ' + ps.name)
			var setObj = local.getObjectApi(edit.id)
			if(setObj === undefined){
				local.log.warn('object not found, may have been del\'ed: ' + edit.id)
				local.log(new Error().stack)
				return
			}
			
			if(setObj.isDestroyed()) return

			//subj.obj[local.inputProperty] = setObj;
			setObj.prepare()
			subj[property.name] = setObj
			//console.log('EMITTING SET OBJECT ' + property.name)
			subj.emit(edit, 'set', property.name, setObj)			
		}
	}else if(op === editCodes.clearObject || op === editCodes.clearProperty){

		var subj = local.inputObject!==undefined?local.objectApiCache[local.inputObject]:local

		var ps = subj.typeSchema.propertiesByCode[local.inputProperty];
		
		var chp = ch.property(ps.name)
		
		if(ps.type.type === 'set' || ps.type.type === 'list'){
			chp.obj = []
		}else if(ps.type.type === 'map'){
			chp.obj = {}
		}else{
			chp.obj = undefined
		}
		//subj[ps.name] = undefined
		//subj.obj[local.inputProperty] = undefined
	}else{
		
		//console.log(chp.constructor+'')
		var chp = ch.property(property.name)//[property.name]

		_.assertEqual(ch[property.name], chp)
		
		if(!chp){
			_.errout('property value missing: ' + property.name)
		}
		
		if(!chp.changeListener){
			//console.dir(chp)
			_.errout('cannot determine current edit target(' + property.name+' in ' + ch.typeSchema.name + ' ' + ch.prepared + ' - ' + chp.constructor + ') failed to run edit: ' + JSON.stringify([editNames[op], edit, syncId, editId]))
			return
		}
		//console.log('HERERERERER')
		//console.log('editing ' + editNames[op] + ' ' + (chp.rally = Math.random()))
		
		//console.log(typeof(chp.changeListener))
		
		chp.changeListener(local.inputSubObject, local.inputKey, op, edit, syncId, editId)
	}
}

TopObjectHandle.prototype.uuid = function(){
	//if(this.typeSchema.superTypes && this.typeSchema.superTypes.uuid
	//if(!this._uuid) _.errout('type is not a uuid type: ' + this.typeSchema.name)
	//return this._uuid
	return this.objectId
}
/*
TopObjectHandle.prototype._maintainFork = function(fork){
	//_.errout('TODO')
	_.assertFunction(fork._acceptForkChange)
	if(!this._forkListeners){
		this._forkListeners = [fork]
	}else{
		this._forkListeners.push(fork)
	}
}
TopObjectHandle.prototype._stopMaintainingFork = function(fork){
	//_.errout('TODO')

	this._forkListeners.splice(this._forkListeners.indexOf(fork), 1)
}*/
function destroyedWarning(){
	_.errout('this object has been destroyed, it is an error to still have a reference to it')
}

var ObjectHandle = require('./object')
console.log(ObjectHandle)

TopObjectHandle.prototype.replaceObjectHandle = ObjectHandle.prototype.replaceObjectHandle

TopObjectHandle.prototype.clearProperty = ObjectHandle.prototype.clearProperty

TopObjectHandle.prototype.isDefined = function(){return true;}

TopObjectHandle.prototype.getTopParent = function(){return this;}

TopObjectHandle.prototype.isDestroyed = function(){return this._destroyed;}
/*
function samePath(a, b){
	//_.errout('TODO')
	if(a.length !== b.length) return false
	for(var i=0;i<a.length;++i){
		var av = a[i]
		var bv = b[i]
		//if(av.op !== bv.op && 're'+av.op !== bv.op && av.op !== 're'+bv.op) return false
		if(av.op !== bv.op && lookup.flipType[av.op] !== bv.op) return false
		if(JSON.stringify(av.edit) !== JSON.stringify(bv.edit)) return false
	}
	return true
}

function samePathCompact(compact, normal){
	if(compact.length !== normal.length) return false
	for(var i=0;i<compact.length;++i){
		var cv = compact[i]
		var nv = normal[i]
		//if(av.op !== bv.op) return false
		//if(JSON.stringify(av.edit) !== JSON.stringify(bv.edit)) return false
		var comp = nv.edit.id || nv.edit.key || nv.edit.typeCode
		if(comp !== cv) return false
	}
	return true
}*/

TopObjectHandle.prototype.getImmediateKey = function(){}

TopObjectHandle.prototype._getVersionsSelf = function(source){
	//_.assert(path.length > 0)

	var edits = this.edits.concat(this.localEdits||[])

	var madeIndex = getMadeIndex(edits, this)
	
	if(madeIndex === -1){
		return []
	}

	var fakeObject = {
		objectId: this.objectId
	}
	var same = false
	var versions = [edits[madeIndex].editId]
	//console.log('looking over(' + source + '): ' + JSON.stringify(this.edits, null, 2))// + ' ' + path.length)
	for(var i=0;i<edits.length;++i){
		var e = edits[i]
		var did = updateInputPath(fakeObject, e.op, e.edit, e.editId, true)
		//console.log(JSON.stringify([same, versions, e]))
		if(!did){
			//if(e.op === editCodes.made){//symbolic of the first, empty state
			//	versions.push(e.editId)
			//}
			
			//if(!did && e.editId !== versions[versions.length-1] && i > madeIndex){
			if(same && (versions.length === 0 || versions[versions.length-1] !== e.editId) && i > madeIndex){
				versions.push(e.editId)
			}
		}else{
			//same = samePathCompact(path, fakeObject.pathEdits)
			same = 
				(fakeObject.inputObject === source.getImmediateObject() || (fakeObject.inputObject === undefined && source.getImmediateObject() === source.getTopId())) && 
				fakeObject.inputProperty === source.getImmediateProperty() &&
				fakeObject.inputKey === source.getImmediateKey()
			//console.log(same + '-' + fakeObject.inputObject + ' ' + fakeObject.inputProperty + ' ' + fakeObject.inputKey + ' ' + JSON.stringify(e))
			//console.log(same + ' ' + source.getImmediateObject()  + ' ' + source.getImmediateProperty() + ' ' + source.getImmediateKey() + ' ' + JSON.stringify(e))
		}
	}
	//console.log('done')
	return versions
}

TopObjectHandle.prototype._getVersions = function(source){
	//_.assert(path.length > 0)
	var fakeObject = {}
	var same = false
	if(this.edits.length === 0) return []
	var versions = [this.edits[0].editId]
	//console.log('looking over(' + source + '): ' + JSON.stringify(this.edits, null, 2))// + ' ' + path.length)
	for(var i=0;i<this.edits.length;++i){
		var e = this.edits[i]
		if(e.op === editCodes.setSyncId) continue
		var did = updateInputPath(fakeObject, e.op, e.edit, e.editId)
		//console.log(JSON.stringify([same, versions, e]))
		//console.log(JSON.stringify(fakeObject))
		if(!did){
			if(e.op === editCodes.made){//symbolic of the first, empty state
				versions.push(e.editId)
			}
			
			if(same && (versions.length === 0 || versions[versions.length-1] !== e.editId)){
				versions.push(e.editId)
			}
		}else{
			//same = samePathCompact(path, fakeObject.pathEdits)
			same = 
				(fakeObject.inputObject === source.getImmediateObject() || (fakeObject.inputObject === undefined && source.getImmediateObject() === source.getTopId())) && 
				fakeObject.inputProperty === source.getImmediateProperty() &&
				fakeObject.inputKey === source.getImmediateKey()
			//console.log(same + '-' + fakeObject.inputObject + ' ' + fakeObject.inputProperty + ' ' + fakeObject.inputKey + ' ' + JSON.stringify(e))
			//console.log(same + ' ' + source.getImmediateObject()  + ' ' + source.getImmediateProperty() + ' ' + source.getImmediateKey() + ' ' + JSON.stringify(e))
		}
	}
	//console.log('done')
	return versions
}

TopObjectHandle.prototype._getEdits = function(){
	var res = [].concat(this.edits)
	if(this.localEdits) res = res.concat(this.localEdits)
	return res
}
/*
TopObjectHandle.prototype.fork = function fork(cb){

	var res = this.parent.createFork(this, cb)
	res.prepare();
	//console.log('forked: ' + res)
	return res;
}*/
/*
TopObjectHandle.prototype.setForked = function fork(objHandle){
	_.assert(this.getLocalMode())
	
	if(this._forkedObject === objHandle) return
	
	var sourceId = objHandle._internalId()
	//this.adjustTopObjectToOwn()
	//this.persistEdit(editCodes.refork, {sourceId: sourceId})
	
	//console.log('set forked for ' + this.objectId + ' to ' + sourceId)
	
	//this._rebuild()
	this._applyRefork(sourceId)
}
*/
function sameState(a, b){
	return a.object === b.object && a.property === b.property
}
/*
TopObjectHandle.prototype.prepareHistorically = function prepareHistorically(version){

	//TODO make readonly
	
	if(this.isReadonlyAndEmpty) return
	if(this.prepared) return;
	if(this._destroyed){
		_.errout('cannot prepare destroyed object - internal error')
	}
	this.prepared = true;
	var s = this;

	var fakeObject = {}
	var cur = {}
	for(var i=0;i<this.edits.length;++i){
		var e = this.edits[i]
		var did = updateInputPath(fakeObject, e.op, e.edit, e.editId)
		if(!did){
			e.state = {
				property: fakeObject.inputProperty, 
				object: fakeObject.inputObject, 
				key: fakeObject.inputKey, 
				keyOp: fakeObject.inputKeyOp
			}
		}else{
			cur = _.extend({}, fakeObject.state)
		}
	}

	var realEdits = [].concat(this.edits)


	//apply edits
	this.realEdits = realEdits

	if(this.lastHistoricalEditId && this.lastHistoricalEditId > 0){
		//_.errout('TODO')
		var last = this.lastHistoricalEditId
		var lastFromForkIndex = this._forkedObject? -1 : this._forkedObject._getEdits().length
		realEdits.forEach(function(e, index){
			if(e.editId > last || lastFromForkIndex > index) return
			if(e.op === editCodes.setSyncId){
				s.inputSyncId = e.edit.syncId
			}else if(e.op === editCodes.madeViewObject){
				//s.log('ignoring view object creation')
			}else{
				s.changeListener(s.inputSubObject, s.inputKey, e.op, e.edit, s.inputSyncId, e.editId||-3, true)
				s.lastEditId = e.editId
			}
		})
	}
	
	if(s.typeSchema.properties){
		var keys = Object.keys(s.typeSchema.properties);
		keys.forEach(function(name){
			//console.log('preparing: ' + name)
			var p = s.typeSchema.properties[name];
			var v = s.property(name);
			v.prepareHistorically(version);
			s[name] = v;
		
		});
	}
}
*/
TopObjectHandle.prototype.prepare = function prepare(){
	//console.log('*prepare')
	//_.assertInt(this.objectId)
	//console.log(new Error().stack)
	
	//_.assertNot(this.historicalKey)
	/*if(this.historicalKey){
		this.prepareHistorically(this.historicalKey)
		return
	}*/
	
	if(this.isReadonlyAndEmpty) return
	if(this.prepared) return;
	if(this._destroyed){
		_.errout('cannot prepare destroyed object - internal error')
	}
	this.prepared = true;
	this.isPreparing = true
	var s = this;
	
	var realEdits = [].concat(this.edits).concat(this.localEdits||[])

	//apply edits
	s.inputSyncId='-1'
	s.inputObject = undefined
	//this.log(this.objectId, ' preparing topobject with edits:', this.realEdits)
	
	//console.log('realEdits: ' + JSON.stringify(realEdits, null, 2))
	
	for(var i=0;i<realEdits.length;++i){
		var e = realEdits[i]
		//console.log(JSON.stringify(e))
		if(e.op === editCodes.setSyncId){
			s.inputSyncId = e.edit.syncId
		}else if(e.op === editCodes.madeViewObject){
			//s.log('ignoring view object creation')
		}else{
			s.changeListener(s.inputSubObject, s.inputKey, e.op, e.edit, s.inputSyncId, e.editId||-3, true)
			s.lastEditId = e.editId
		}
	}
	
	if(!s._destroyed){
		if(s.typeSchema.properties){
			var keys = Object.keys(s.typeSchema.properties);
			//keys.forEach(function(name){
			for(var i=0;i<keys.length;++i){
				var name = keys[i]
				//console.log('preparing: ' + name)
				var p = s.typeSchema.properties[name];
				var v = s.property(name);
				v.prepare();
				s[name] = v;
		
			}
		}
	}
	
	this.isPreparing = false
}

TopObjectHandle.prototype._rebuild = function(){
	if(this.isReadonlyAndEmpty) _.errout('error')
	//console.log('rebuilding')
	if(!this.prepared) return
	if(this._destroyed) _.errout('cannot rebuild destroyed object')
	
	var s = this
	var keys = Object.keys(s.typeSchema.properties);
	keys.forEach(function(name){
		var p = s.typeSchema.properties[name];
		s[name] = undefined
	})
	this.prepared = false
	this.lastEditId = -1
	//this.pathEdits = []
	this.prepare()
}

TopObjectHandle.prototype.isInner = function(){return false;}

TopObjectHandle.prototype.properties = ObjectHandle.prototype.properties;

TopObjectHandle.prototype.propertyIsPrimitive = ObjectHandle.prototype.propertyIsPrimitive

TopObjectHandle.prototype.removeParent = function(){}
TopObjectHandle.prototype._typeCode = function(){return this.objectTypeCode;}
TopObjectHandle.prototype.getPath = function(){return [];}
TopObjectHandle.prototype.type = function(){return this.typeSchema.name;}
TopObjectHandle.prototype.isa = ObjectHandle.prototype.isa
TopObjectHandle.prototype.id = function(){
	//if(this.objectId < 0) console.log('WARNING: should not get id of locally-created object yet - you need to provide a callback to your make(...) call to be notified when the correct id becomes available.')
	return seedrandom.uuidStringToBase64(this.objectId);
}
TopObjectHandle.prototype.getTopId = TopObjectHandle.prototype.id

TopObjectHandle.prototype._internalId = function(){
	return this.objectId;
}

TopObjectHandle.prototype.getObjectTypeCode = function(){
	return this.objectTypeCode;
}
TopObjectHandle.prototype.getObjectId = function(){
	return this.objectId;
}
TopObjectHandle.prototype.propertyTypes = ObjectHandle.prototype.propertyTypes;
TopObjectHandle.prototype.property = ObjectHandle.prototype.property;
TopObjectHandle.prototype.toJson = ObjectHandle.prototype.toJson;

TopObjectHandle.prototype.hasProperty = ObjectHandle.prototype.hasProperty;
TopObjectHandle.prototype.has = ObjectHandle.prototype.has;

TopObjectHandle.prototype.setProperty = ObjectHandle.prototype.setProperty
TopObjectHandle.prototype.setPropertyToNew = ObjectHandle.prototype.setPropertyToNew

TopObjectHandle.prototype.delayRefresh = function(){
	this.refreshDelayed = true;
}
/*
TopObjectHandle.prototype._rewriteObjectApiCache = function(){
}
*/
TopObjectHandle.prototype.isa = ObjectHandle.prototype.isa

TopObjectHandle.prototype.persistEdit = function(op, edit){
	//this.log('here: ' + this.getObjectId())
	//console.log('persisting: ' + op + ' ' + JSON.stringify(edit))
	_.assert(!this.isView())
	_.assertString(this.getObjectId())
	_.assertInt(op)
	
	var isRealEdit = false
	var isLocally = this.getLocalMode()
	if(op === editCodes.selectProperty){
		if(!isLocally) this.currentProperty = edit.typeCode
	}else if(op === editCodes.selectObject){
		if(!isLocally){
			this.currentObject = edit.id
			console.log('selected object: ' + edit.id)
			//if(edit.id < 0) this.listenForReification(edit.id, this.edits.length+(this.localEdits?this.localEdits.length:0), this)
		}else{
			console.log('not locally')
		}
	}else if(op === editCodes.clearObject){
		if(!isLocally) this.currentObject = undefined
	}else if(op === editCodes.selectSubObject){
		if(!isLocally) this.currentSubObject = edit.id
	}else if(op === editCodes.selectSubViewObject){
		if(!isLocally) this.currentSubObject = edit.id
	}else if(lookup.isKeySelectCode[op]){//op === 'selectStringKey' || op === 'selectLongKey' || op === 'selectIntKey' || op === 'selectBooleanKey'){
		if(!isLocally) this.currentKey = edit.key
	}else if(op === editCodes.addNew){
		//console.log(JSON.stringify(edit))

		if(edit.following === undefined){
			_.errout('invalid addNew missing following')
		}
		
		this.listenForReification(edit.temporary, this.edits.length+(this.localEdits?this.localEdits.length:0), this)
	}else if(op === editCodes.setObject || op === editCodes.addExisting){
		if(edit.id < 0) this.listenForReification(edit.id, this.edits.length+(this.localEdits?this.localEdits.length:0), this)
	}else{
		isRealEdit = true
	}

	this.currentSyncId = this.getEditingId()
	
	if(!this.localEdits) this.localEdits = []
	//console.log('pushing local edit: ' + editNames[op] + ' ' + this.localEdits.length)
	this.localEdits.push({op: op, edit: edit})
	
	this.parent.persistEdit(this.getObjectTypeCode(), this.getObjectId(), op, edit)
	/*
	if(isRealEdit && this._forkListeners){
		var local = this
		this._forkListeners.forEach(function(fl){
			fl._acceptForkChange(local.currentSubObject, local.currentKey, op, edit, local.currentSyncId, -4)//, local.pathEdits || [])
		})
	}*/
}

TopObjectHandle.prototype.saveEdit = function(op, edit){
	this.persistEdit(op, edit)
}

TopObjectHandle.prototype.registerSourceParent = function(sourceParent){
	if(this.sourceParents === undefined) this.sourceParents = [];
	if(this.sourceParents.indexOf(sourceParent) === -1){
		this.sourceParents.push(sourceParent);
		//this.log('registered source parent for ' + this.typeSchema.name + ' ' + this.objectId);
	}
}

TopObjectHandle.prototype.doRefresh = function(already, sourceOfRefresh, e){
	var cbs = [];
	var cba = this.basicDoRefresh(already, sourceOfRefresh, e);
	cbs.push(cba);
	//this.log('TopObjectHandle doRefresh calling source parents: ' + this.sourceParents.length);
	for(var i=0;i<this.sourceParents.length;++i){
		var sp = this.sourceParents[i];
		var cb = sp.doRefresh(already, false, e)
		cbs.push(cb);
	}
	return function(){
		for(var i=0;i<cbs.length;++i){
			cbs[i]();
		}
	}
}

//TODO provide handle with temporary id for objects created this way
TopObjectHandle.prototype.make = function(typeName, json,cb){
	if(_.isObject(typeName)){
		cb = json
		json = typeName
		typeName = undefined
	}
	if(json !== undefined && !_.isObject(json)){
		cb = json
		json = undefined
	}
	if(json === undefined) json = {}
	
	var forget = false;
	if(cb === true){
		cb = undefined
		forget = true
	}

	if(forget){
		this.createNewExternalObject(typeName, json, forget, undefined)//objEdits)
	}else{
		//console.log('not forgetting: ' + forget + ' ' + cb)

		var res = this.createNewExternalObject(typeName, json, forget, cb)
	
		res.prepare();

		return res;
	}
}

//TODO NOT FINISHED (see minnow_update_websocket copy method)
TopObjectHandle.prototype.copy = function(json,cb){

	//if(this.objectId < 0) throw new Error('cannot copy locally-created object yet - provide a callback to the make or copy function to be notified when it is ready.')
	if(this.isView()){
		throw new Error('cannot copy view object')
	}

	if(arguments.length === 1){
		if(!_.isObject(json)){//_.isFunction(json)){
			cb = json
			json = {}
		}
	}
	
	_.assert(cb === undefined || cb === true || _.isFunction(cb))
	
	json = json || {}
	//_.assertObject(json)

	var forget = false;
	if(cb === true){
		cb = undefined
		forget = true
	}
	
	//console.log('copying ' + this.objectId + ' ' + JSON.stringify(this.edits) + '\n\n' + JSON.stringify(this.localEdits))
	
	if(forget){
		this.copyExternalObject(this, json, forget, undefined)
	}else{
		var res = this.copyExternalObject(this, json, forget, cb)
		res.prepare();
		return res;
	}
}

TopObjectHandle.prototype.getTopParent = function(){
	return this
}
/*
TopObjectHandle.prototype.reifyEdit = function(index, temporary, real){
	var e
	//var source
	//var sourceIndex
	if(index >= this.edits.length){
		e = this.localEdits[index-this.edits.length]
		//source = this.localEdits
		//sourceIndex = index - this.edits.length
	}else{
		e = this.edits[index]
		//source = this.edits
		//sourceIndex = index
	}
	//console.log(this.objectId + ' ' + this.edits.length + ' ' + index + ' ' + temporary + ' ' + real + ' ' + this.localEdits.length + ' ' + e.edit.id)
	if(e){
		_.assertDefined(e)
		if(e.op === editCodes.addNew){
			_.assertEqual(e.edit.temporary, temporary)
			e.op = editCodes.addedNew
			e.edit = {id: real, typeCode: e.edit.typeCode}
		//	this.source[sourceIndex] = {
		}else{
			if(e.edit.id !== temporary){
				console.log('ERROR - could not reify: ' + editNames[e.op] + ' ' + JSON.stringify(e))
			}else{
				//_.assertEqual(e.edit.id, temporary)
				e.edit.id = real
			}
		}
	}else{
		console.log('could not locate edit: ' + index + ' to reify ' + temporary + ' -> ' + real)
	}
}*/
/*
TopObjectHandle.prototype.reifyParentEdits = function(temporaryId, realId){

	if(this.lastReificationIndex === this.edits.length){
		return
	}
	
	if(this.currentObject === temporaryId){
		this.currentObject = realId
	}
	if(this.currentSubObject === temporaryId){
		this.currentSubObject = realId
	}
	if(this.inputObject === temporaryId){
		//console.log('reified input object: ' + temporaryId + ' -> ' + realId)
		this.inputObject = realId
	}
	if(this.inputSubObject === temporaryId){
		this.inputSubObject = realId
	}
	if(this.objectApiCache && this.objectApiCache[temporaryId]){
		var obj = this.objectApiCache[temporaryId]
		obj.objectId = realId
		this.objectApiCache[realId] = obj
		this.objectApiCache[temporaryId] = undefined
		//console.log('found object for reification in top object ' + obj.type() + ' ' + this.objectId + ' cache: ' + temporaryId + ' -> ' + realId)
	}
	
}*/

TopObjectHandle.prototype.adjustTopObjectToOwn = function(){
	this.parent.adjustTopObjectTo(this.objectId)
}

TopObjectHandle.prototype._resetInputState = function(){
	//console.log('RESET INPUT STATE')
	this.inputProperty = undefined
	this.inputObject = undefined
	this.inputSubObject = undefined
	this.inputKey = undefined
}

TopObjectHandle.prototype._resetOutputState = function(){
	this.currentProperty = undefined
	this.currentObject = undefined
	this.currentSubObject = undefined
	this.currentKey = undefined
}

function updateInputPath(local, op, edit, editId, supressWarnings){
	if(op === editCodes.selectProperty){
		//console.log(local.objectId + ' updated property: ' + edit.typeCode)
		local.inputProperty = edit.typeCode
	}else if(op === editCodes.selectObject){
		//console.log('updated inputObject: ' + local.inputObject + ' -> ' + edit.id)
		//console.log(new Error().stack)
		local.inputObject = edit.id
		if(edit.id !== local.objectId && (!local.objectApiCache || !local.objectApiCache[edit.id])){
			if(!supressWarnings){
				console.log('WARNING: cannot find object locally: ' + edit.id + ' (in ' + local.objectId + ')' + ' ' + JSON.stringify(Object.keys(local.objectApiCache||{})))
			}
		}
	}else if(op === editCodes.clearObject){
		//console.log('updated inputObject: ' + local.inputObject + ' -> ' + edit.id)
		local.inputObject = undefined
	}else if(op === editCodes.selectSubObject){
		local.inputSubObject = edit.id
		_.assertString(local.inputSubObject)
	}else if(op === editCodes.selectSubViewObject){
		local.inputSubObject = edit.id
		_.assertString(local.inputSubObject)
		if(local.inputSubObject === "undefined") _.errout('invalid sub object view id: ' + local.inputSubObject)
	}else if(lookup.isKeySelectCode[op]){//op.indexOf('select') === 0 && op.indexOf('Key') === op.length-3){
		local.inputKey = edit.key
	}else if(op === editCodes.made){//op.indexOf('select') === 0 && op.indexOf('Key') === op.length-3){
		//console.log('made cleared everything for ' + local.objectId + ' ' + editId)
		//console.log(new Error().stack)
		local.inputObject = edit.id//edit.id
		local.lastSelf = edit.id
		local.inputSubObject = undefined
		local.inputProperty = undefined
		local.inputKey = undefined
	}else if(op === editCodes.copied){//op.indexOf('select') === 0 && op.indexOf('Key') === op.length-3){
		//console.log('updated inputObject: ' + local.inputObject + ' -> ' + edit.id)
		local.inputObject = undefined//edit.id
		local.inputSubObject = undefined
		//local.inputProperty = undefined
		//local.inputKey = undefined
	}else{
		return false
	}
	return true
}

function maintainPath(local, op, edit, syncId, editId, forceOwnProcessing){
	_.assertInt(editId)
	//if(local.uid === undefined) local.uid = Math.random()
	//local.log.info('current path:' +JSON.stringify( local.pathEdits))
	//console.log(local.uid + ' current path(' + local.objectId + '): ' + JSON.stringify(local.pathEdits))
	
	//console.log('maintainPath: ' + JSON.stringify([editNames[op], edit, syncId, editId, local.inputProperty]))
	
	//console.log(new Error().stack)
	
	_.assertInt(op)


	if(local.lastEditId < editId){
		local.lastEditId = editId
	}

	
	var did = updateInputPath(local, op, edit, editId)
	if(did){
		return
	}else if(op === editCodes.made || op === editCodes.copied){
		local.lastSelf = edit.id
		console.log('lastSelf: ' + edit.id + ' for ' + local.objectId)
	}else if(op === editCodes.initializeUuid){
		local._uuid = edit.uuid
	}else if((op === editCodes.wasSetToNew) && (!local.inputObject || local.inputObject === local.objectId)){

		
		var code = local.inputProperty//local.pathEdits[0].edit.typeCode
		var property = local.typeSchema.propertiesByCode[code]

		var objSchema = local.schema[property.type.object]
		var n = new ObjectHandle(objSchema, [], edit.id, [code], local);
		n.prepare()
		
		if(!local.objectApiCache) local.objectApiCache = {}
		local.objectApiCache[edit.id] = n

		if(local.getEditingId() === syncId && !forceOwnProcessing){
			return
		}
		local[property.name] = n
		
	}else{
		//console.log('pathEdits: ' + JSON.stringify(local.pathEdits))
		changeOnPath(local, op, edit, syncId, editId)
	}
}

module.exports = TopObjectHandle
exports.maintainPath = maintainPath

TopObjectHandle.prototype.adjustCurrentObject = function(id){
	if(this.getLocalMode()) return

	this.parent.adjustTopObjectTo(this.objectId)
	
	_.assertString(id)
	if(this.currentObject !== id){
		//console.log('adjusted current object: ' + this.currentObjectId + ' -> ' + id)
		//console.log(new Error().stack)
		if(id === this.objectId){
			this.persistEdit(editCodes.clearObject, {})
		}else{
			//if(id === 36) _.errout('TODO FIXME: ' + this.objectId)
			this.persistEdit(editCodes.selectObject, {id: id})
		}
		//this.edits.push({op: editCodes.selectObject, edit: {id: id}})
	}
	this.currentObject = id
	this.currentProperty = undefined
}
TopObjectHandle.prototype.adjustCurrentSubObject = function(id){
	if(this.getLocalMode()) return

	_.assertString(id)
	if(this.currentSubObject !== id){
		//console.log('adjusted current object: ' + this.currentSubObject + ' -> ' + id)
		//console.log(new Error().stack)
		this.persistEdit(editCodes.selectSubObject, {id: id})
	}
	this.currentSubObject = id
}
TopObjectHandle.prototype.adjustCurrentProperty = function(typeCode){
	if(this.getLocalMode()) return

	_.assertInt(typeCode)
	if(this.currentProperty !== typeCode){
		//console.log('adjusted current property: ' + this.currentProperty + ' -> ' + typeCode)
		//console.log(new Error().stack)
		this.persistEdit(editCodes.selectProperty, {typeCode: typeCode})
	}
	this.currentProperty = typeCode
}
TopObjectHandle.prototype.adjustCurrentKey = function(key, keyOp){
	if(this.getLocalMode()) return

	if(keyOp === editCodes.selectObjectKey){
		_.assertString(key)
		_.assert(key !== -1)
	}
	_.assertInt(keyOp)
	//_.assertInt(typeCode)
	if(this.currentKey !== key){
		//console.log('adjusted current key')//: ' + this.currentProperty + ' -> ' + typeCode)
		//console.log(new Error().stack)
		this.persistEdit(keyOp, {key: key})
	}
	this.currentKey = key
	this.currentKeyOp = keyOp
}
TopObjectHandle.prototype.getImmediateObject = function(){
	return this.objectId
}
TopObjectHandle.prototype.changeListener = function(subObj, key, op, edit, syncId, editId, isNotExternal, isCopyChange){
	//console.log(JSON.stringify(arguments))
	
	if(this._destroyed) return
	
	if(!subObj) subObj = this.inputSubObject
	_.assertEqual(subObj, this.inputSubObject)
	if(!key) key = this.inputKey
	_.assertEqual(key, this.inputKey)
	
	_.assertInt(op)
	_.assertObject(edit)
	//_.assertString(syncId)
	
	var ownSyncId = this.getEditingId()
	
	if(!isNotExternal){
		_.assertInt(editId)
	}
	
	if(!this.prepared){
		this.prepare()//TODO optimize by appending edit if not prepared, applying if prepared?
	}
	
	if(this._destroyed) return

	//console.log(this.getEditingId() + ': ' + this.objectId + ' ' + editNames[op] + ' got edit: ' + JSON.stringify([op, edit, syncId, editId, isNotExternal]) + ' ' + syncId)
	
	this.inputSyncId = syncId
	
	
	
	//console.log('following*: ' + (this.edits?this.edits.length:0)+ ' ' + (this.localEdits?this.localEdits.length:0))

	//console.log(this.objectId + ' updating path?: ' + editNames[op])
	var did = updateInputPath(this, op, edit, editId)

	if(!isNotExternal || ownSyncId.toString() === syncId.toString()){
		if(!this.edits)_.errout('no this.edits: ' + this.objectId + ' ' + this.constructor + ' '+ this._destroyed)
		var skipPushing = false
		if(this.locallyCopied){
			for(var i=0;i<this.edits.length;++i){
				var e = this.edits[i]
				if(e.editId === editId){
					skipPushing = true
					break
				}
			}
		}
		if(!skipPushing){
			this.edits.push({op: op, edit: edit, editId: editId})
			//console.log(this.objectId + ' pushing edit: ' + JSON.stringify({op: op, edit: edit, editId: editId}))
		}
		
		if(ownSyncId.toString() === syncId.toString()){
			if(!this.localEdits || this.localEdits.length === 0){
				if(!this.isView()){
					//console.log('WARNING: no localEdits or zero length, but got an own edit(' + syncId+'): ' + JSON.stringify(this.localEdits))
					//console.log(JSON.stringify([editNames[op], edit, editId]))
				}
				//
			}else{
				if(!did || op === editCodes.made || op === editCodes.copied){
					while(this.localEdits.length > 0){
						var remd = this.localEdits.shift()
						//console.log('shifting ' + editNames[remd.op])
						if(remd.op === op){
							break
						}
					}
				}//else{
					//console.log('did: ' + editNames[op])
				//}
			}
		}
	}

	if(this.localEdits && ownSyncId.toString() === syncId.toString()){
	//	console.log('skipping own ' + syncId)
		return	
	}

	/*if(!did && this._forkListeners && !isNotExternal){// && op !== editCodes.refork){
		var local = this
		//_.errout('SENDING UPDATE TO FORK')
		this._forkListeners.forEach(function(fl){
			fl._acceptForkChange(subObj, key, op, edit, syncId, editId, local.pathEdits || [])
		})
	}else if(this._forkListeners){
		//console.log('ignoring because of did: ' + op)
	}*/
	
	if(op === editCodes.destroy){
		this._destroy(true)
	}else{
		if(isNotExternal && (syncId === ownSyncId || isCopyChange)){
			//console.log('just updating path?: ' + editNames[op])
			//console.log(new Error().stack)
			//var did = updatePath(this, op, edit, editId)
			return;
		}
		//console.log('maintaining path')
		if(!did){
			maintainPath(this, op, edit, syncId, editId)
		}
	}
}

TopObjectHandle.prototype._makeAndSaveNew = function(json, type, id, source, countCb){
	_.assertString(id)
	//_.assert(temporary < 0)
	//var temporary = this.makeTemporaryId();
	var edits = jsonutil.convertJsonToEdits(this.getFullSchema(), type.name, json, id);

	if(countCb) countCb(edits.length)
	
	if(edits.length > 0){
		source.adjustCurrentObject(id)
		//source.adjustCurrentProperty(source.part)
		for(var i=0;i<edits.length;++i){
			var e = edits[i]
			this.persistEdit(e.op, e.edit)
		}
	}
	
	var n = new ObjectHandle(type, [], id, [id], this);
	n.localEdits = edits
	if(this.objectApiCache === undefined) this.objectApiCache = {}
	this.objectApiCache[id] = n;
	
	console.log('cached ' + id + ' in ' + this.objectId)
	
	//this.saveTemporaryForLookup(id, n, this)
	
	console.log('made and saved new: '+ id)
	
	n.prepare()
	
	return n
}
/*
TopObjectHandle.prototype._applyRefork = function(sourceId){
	if(this._forkedObject){
		var manyToRemove = this._forkedObject._getEdits().length

		this._forkedObject._stopMaintainingFork(this)
		this.edits = this.edits.slice(manyToRemove)
	}

	this._forkedObject = this.getObjectApi(sourceId)
	if(this._forkedObject === undefined) _.errout('cannot find forked after refork: ' + sourceId)
	_.assertObject(this._forkedObject)
	//TODO switch fork maintenance

	this._forkedObject._maintainFork(this)

	//console.log('edits(' + manyToRemove + '): ' + JSON.stringify(this.edits))
	
	this.edits = [].concat(this._forkedObject._getEdits()).concat(this.edits)
	this._rebuild()
	//console.log('rebuilt: ' + JSON.stringify(this.edits))
}*/

TopObjectHandle.prototype.errorOnWarn = false

TopObjectHandle.prototype.propertyByCode = ObjectHandle.prototype.propertyByCode


TopObjectHandle.prototype.del = function(){
	ObjectHandle.prototype.del.apply(this)

	this.emit({}, 'del')

	this._destroy()
}

TopObjectHandle.prototype._destroy = function(isFromServer){
	if(!isFromServer) this.parent._destroyed(this)
	var local = this
	Object.keys(this).forEach(function(key){
		var v = local[key]
		if(_.isFunction(v)){
			local[key] = destroyedWarning
		}else{
			local[key] = undefined
		}
	})
	Object.keys(TopObjectHandle.prototype).forEach(function(key){
		if(key !== 'isDestroyed'){
			local[key] = destroyedWarning
		}
	})
	this._destroyed = true
}

TopObjectHandle.prototype.wrapObject = function(id, typeCode, part, sourceParent){
	_.assertLength(arguments, 4);
	_.assertString(id)
	_.assertInt(typeCode)
	//_.assertFunction(sourceParent.adjustPath)
	
	var t = this.schema._byCode[typeCode];
	//console.log('typeCode: ' + typeCode)
	_.assertDefined(t)
	var n = new ObjectHandle(t, [], id, part, sourceParent);
	if(!this.objectApiCache) this.objectApiCache = {}
	this.objectApiCache[id] = n
	//console.log('cached: ' + id)
	return n
}


TopObjectHandle.prototype.getLastEditor = function(){
	return this.inputSyncId
}

TopObjectHandle.prototype.isView = function(){
	return this._isView// _.isString(this.objectId)
}

//produces a non-editable copy of this object for the given version number
TopObjectHandle.prototype.version = function(editId){
	_.assertInt(editId)
	
	//TODO handle local version ids as well
	var edits = []
	for(var i=0;i<this.edits.length;++i){
		var e = this.edits[i]
		if(e.editId > editId){
			break;
		}
		edits.push(e)
	}

	var local = this

	var fakeParent = {
		log: this.parent.log,
		getEditingId: function(){return -10;},
		getObjectApi: function(id, sourceParent){
			var on = local.getObjectApi(id)
			//_.errout('cannot get: ' + id)
			var v = on.versions()
			return on.version(v[v.length-1])
		},
		wrapObject: function(id, typeCode, part, sourceParent){
			return local.wrapObject(id, typeCode, part, sourceParent)
		},
		getFullSchema: function(){
			return local.getFullSchema()
		}
	}
	//console.log('(' + editId + ') edits: ' + JSON.stringify(edits))
	var n = new TopObjectHandle(this.schema, this.typeSchema, edits, fakeParent, this.objectId, this.isView())
	n.prepare()
	
	n.replayTo = function(endEditId){
		var newEdits = []
		for(var i=0;i<local.edits.length;++i){
			var e = local.edits[i]
			if(e.editId > editId && e.editId <= endEditId){
				newEdits.push(e)
			}
		}
		n.inputSyncId='-1'
		for(var i=0;i<edits.length;++i){
			var e = edits[i]
			if(e.op === editCodes.setSyncId){
				n.inputSyncId = e.edit.syncId
			}
		}
		for(var i=0;i<newEdits.length;++i){
			var e = newEdits[i]

			if(e.op === editCodes.setSyncId){
				n.inputSyncId = e.edit.syncId
			}else if(e.op === editCodes.madeViewObject){
				//this.log('ignoring view object creation')
			}else if(e.op === editCodes.made || e.op === editCodes.copied){
				//this.log('ignoring object creation')
			}else{
				n.changeListener(e.op, e.edit, n.inputSyncId, e.editId, true)
				n.lastEditId = e.editId
			}
		}
	}
	return n
}

//produces an array of versions (editIds).
//TODO provide this for each sub-part of the top object as well
TopObjectHandle.prototype.versions = function(){
	var versions = [this.edits[0].editId]
	var fakeObject = {}
	//console.log(JSON.stringify(this.edits, null, 2))
	var skip = 0
	for(var i=0;i<this.edits.length;++i){
		var e = this.edits[i]
		var did = updateInputPath(fakeObject, e.op, e.edit, e.editId)
		if(skip > 0){
			--skip
			continue
		}
		if(e.op === editCodes.made || e.op === editCodes.copied){
			skip = e.edit.following
		}
		if(!did && e.editId !== versions[versions.length-1]){
			if(e.op === editCodes.setSyncId || e.op === editCodes.initializeUuid) continue
			//if(this.isa('quote')) console.log(this.id() + ' * ' + editNames[e.op] + ' ' + JSON.stringify(e))
			versions.push(e.editId)
		}
	}
	//console.log(JSON.stringify(versions))
	//versions.unshift(-1)
	return versions
}

function getMadeIndex(edits, top){
	var madeIndex
	for(var i=edits.length-1;i>=0;--i){
		var e = edits[i]
		if(e.op === editCodes.made || e.op === editCodes.copied){
			madeIndex = i
			break
		}
	}
	
	if(madeIndex === undefined){
		_.errout('cannot find made edit: ' + JSON.stringify(edits))
	}
	_.assertInt(madeIndex)
	return madeIndex
}
TopObjectHandle.prototype.hasLocalChanges = function(){
	//return this.localEdits && this.localEdits.length > 0
	if(!this.localEdits) return
	var found = false
	this.localEdits.forEach(function(e){
		if(!e.fromCopy) found = true
	})
	return found
}
TopObjectHandle.prototype.isCopyAncestor = function(obj){
	var id = this.objectId
	if(obj.type() !== this.type()) return false
	for(var i=0;i<obj.edits.length;++i){
		var e = obj.edits[i]
		if(e.op === editCodes.copied && e.edit.sourceId === id){
			return true
		}
	}
	return false
}

TopObjectHandle.prototype._getHasBeenEdited = function(obj){
	return obj.versionsSelf().length > 1
}

var otherUpdateOps = [editCodes.selectProperty,editCodes.selectObject,editCodes.clearObject,
	editCodes.selectSubObject,editCodes.selectSubViewObject,editCodes.made,editCodes.copied]

var isOtherUpdateOp = {}
otherUpdateOps.forEach(function(op){isOtherUpdateOp[op] = true;})

function isUpdateOp(op){
	if(lookup.isKeySelectCode[op]) return true
	else return isOtherUpdateOp[op]
}

TopObjectHandle.prototype.hasBeenEdited = function(){

	var edits = this.edits.concat(this.localEdits||[])

	var madeIndex
	var copiedIndex
	for(var i=0;i<this.edits.length;++i){
		var e = this.edits[i]
		if(e.op === editCodes.copied){
			copiedIndex = i
			break
		}
	}
	
	if(copiedIndex !== undefined){
		madeIndex = copiedIndex
	}else if(this.edits.length > 1 && this.edits[1].op === editCodes.copied){
		madeIndex = 1
		
	}else if(this.edits.length > 0 && this.edits[0].op === editCodes.copied){
		madeIndex = 0
	}else{	
		madeIndex = getMadeIndex(edits, this)
	}
	
	var skip = 0
	for(var i=0;i<this.edits.length;++i){
		var e = this.edits[i]
		if(e.op === editCodes.setSyncId) continue
		var did = isUpdateOp(e.op)
		if(skip > 0){
			--skip
			continue
		}
		if(e.op === editCodes.made){
			if(skip === 0){
				skip = e.edit.following
			}
		}else if(e.op === editCodes.copied){
			skip = e.edit.following - i
		}
		if(!did && i > madeIndex){
			if(e.op === editCodes.setSyncId || e.op === editCodes.initializeUuid) continue
			if(e.fromCopy) continue
			return true
		}
	}
}

TopObjectHandle.prototype.versionsSelf = function(){
	var fakeObject = {}

	var edits = this.edits.concat(this.localEdits||[])

	var versions
	var madeIndex
	
	var copiedIndex
	for(var i=0;i<this.edits.length;++i){
		var e = this.edits[i]
		if(e.op === editCodes.copied){
			copiedIndex = i
			break
		}
	}
	
	if(copiedIndex !== undefined){
		madeIndex = copiedIndex//this.edits[1].edit.following
		versions = [this.edits[copiedIndex].editId]
	}else if(this.edits.length > 1 && this.edits[1].op === editCodes.copied){
		
		madeIndex = 1//this.edits[1].edit.following
		versions = [this.edits[1].editId]
		
	}else if(this.edits.length > 0 && this.edits[0].op === editCodes.copied){
		madeIndex = 0//this.edits[1].edit.following
		versions = [this.edits[0].editId]
	}else{
	
		madeIndex = getMadeIndex(edits, this)
		versions = [edits[madeIndex].editId]
	}
	
	//console.log('madeIndex: ' + madeIndex)
	//console.log(JSON.stringify(this.edits, null, 2))

	//console.log(JSON.stringify(this.edits, null, 2))
	//console.log(JSON.stringify(edits))
	var skip = 0
	for(var i=0;i<this.edits.length;++i){
		var e = this.edits[i]
		var did = updateInputPath(fakeObject, e.op, e.edit, e.editId, true)
		if(e.op === editCodes.setSyncId) continue
		if(skip > 0){
			//console.log('skipping edit ' + editNames[e.op] + ' ' + i + ' ' + e.editId + ' ' + skip)
			--skip
			continue
		}
		//console.log('not skipping ' + editNames[e.op])
		if(e.op === editCodes.made){
			if(skip === 0){
				skip = e.edit.following
				//console.log('skipping ' + skip)
			}
		}else if(e.op === editCodes.copied){
			skip = e.edit.following - i
			//console.log('skipping ' + skip)
		}
		if(!did && e.editId !== versions[versions.length-1] && i > madeIndex){
			if(e.op === editCodes.setSyncId || e.op === editCodes.initializeUuid) continue
			if(e.fromCopy) continue
			//if(this.isa('quote')) console.log(this.id() + ' * ' + editNames[e.op] + ' ' + JSON.stringify(e))
			//console.log(i + ' added version for: ' + editNames[e.op] + ' ' + JSON.stringify(e))
			versions.push(e.editId)
		}
	}
	//console.log(JSON.stringify(versions))
	//versions.unshift(-1)
	return versions
}
//includes local versions as well as global ones, with local versions having negative edit ids, e.g. -1,-2,-3,...
//TopObjectHandle.prototype.localVersions = function(){
//}

//given a version or array of versions (editIds), retrieves the timestamps for those versions asynchronously
//the retrieval is async because by default we do not transmit timestamps for each edit (because they are usually not needed
//and take up considerable storage/bandwidth.)
//versions must not contain local editIds
//TopObjectHandle.prototype.getVersionTimestamps = function(versions, cb){
//	this.parent.getVersionTimestamps(versions, cb)

//}

//given a version number (editId), reverts the object to that version
//TODO should support specific reversion of parts of the top object,
//in order to allow more specific undo/redo
/*
TopObjectHandle.prototype.revert = function(editId){
	_.assert(editId > 0)//TODO support local editIds as well, REMOVEME
	//console.log('here&')
	//this.edits.push({op: 'revert', edit: {version: editId}})
	//TODO adjust path
	
	//_.errout('TODO')

	//console.log('here*')
	this.adjustTopObjectToOwn()
	this.persistEdit(editCodes.revert, {version: editId})
	//this._rebuild()
}*/



