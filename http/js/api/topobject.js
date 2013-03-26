"use strict";

var u = require('./util')
var _ = require('underscorem')

var jsonutil = require('./../jsonutil')

var ObjectHandle = require('./object')

var lookup = require('./../lookup')
var editCodes = lookup.codes
var editNames = lookup.names
_.assertObject(editCodes)
_.assertObject(editNames)


function TopObjectHandle(schema, typeSchema, edits, parent, id, forkedObject){
	_.assertInt(edits.length)
	_.assertObject(parent)
	
	if(id === -1) _.errout('invalid id: ' + id)
	
	if(!typeSchema.isView){
		_.assertInt(id)
	}else{
		_.assertString(id)
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

	//this.currentHandle = this
	//_.assertObject(this.currentHandle)
	//this.uid = Math.random()

	this._gg = Math.random()
	
	//console.log(this._gg+' making TopObject ' + id + ' ' + edits.length + ' ' + this.uid + ' '+this.getEditingId())
	//console.log(new Error().stack)
	
	this.lastEditId = -1
	
	this.edits.forEach(function(e){
		_.assertInt(e.editId)
	})
	
	if(this.isView()){
		//console.log('is view object: ' + typeSchema.name)
		this.clearProperty = u.viewReadonlyFunction
		//this.setProperty = u.viewReadonlyFunction
		this.del = u.viewReadonlyFunction
		this.revert = u.viewReadonlyFunction
	}
	
	if(!forkedObject && edits.length > 1 && edits[1].op === editCodes.madeFork){
		forkedObject = this.getObjectApi(edits[1].edit.sourceId)
	}
	
	if(forkedObject){
	
		var fes = forkedObject._getEdits()
		//console.log('forkedObject: ' + JSON.stringify(fes))
		//_.assert(fes.length >= 2)
		/*if(fes.length >= 2 && fes[1].op === editCodes.made){
			fes = [fes[0]].concat(fes.slice(2))
		}*/
		this.edits = fes.concat(this.edits)
		this.manyForkedEdits = fes.length
		this._isFork = true
		this._forkedObject = forkedObject

		//console.log(this._gg + ' ' + JSON.stringify(this.edits))


		var local = this
		forkedObject._maintainFork(this)
	}

	this.log = this.parent.log
}

TopObjectHandle.prototype.getObjectApi = function(id){
	//console.log(this.historicalKey + ' -> ' + this.objectId + ' ' + id)
	return this.parent.getObjectApi(id, this.historicalKey)
}

TopObjectHandle.prototype.getHistoricalKey = function(){
	return this.historicalKey
}

TopObjectHandle.prototype.makeHistorical = function(historicalKey){
	_.assertInt(historicalKey)
	
	this.currentHistoricalVersion = 0
	this.historicalKey = historicalKey
	
	this.nextVersion = function(version){
		//console.log('realEdits: ' + JSON.stringify(this.realEdits, null, 2))
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
	
	
	this.advanceTo = function(version){
		//_.errout('TODO')
		
		var s = this

		//console.log('realEdits: ' + JSON.stringify(this.realEdits, null, 2))
		
		s.currentSyncId=-1
		//this.log(this.objectId, ' preparing topobject with edits:', this.realEdits)
		
		//console.log('advancing edits: ' + s.realEdits.length + ' ' + version)
		
		var applied = false// = s.currentHistoricalVersion
		var next
		s.realEdits.forEach(function(e, index){
			if(e.editId < s.currentHistoricalVersion || e.editId > version){
				//console.log('skipped edit: ' + e.editId + ' ' + editNames[e.op])
				if(e.editId > version && !next){
					next = e.editId
				}
				return
			}
			
			//console.log('applied edit: ' + e.editId + ' ' + editNames[e.op])
			
			if(e.op === editCodes.setSyncId){
				s.currentSyncId = e.edit.syncId
			}else if(e.op === editCodes.madeViewObject){
				//s.log('ignoring view object creation')
			}else if(e.op === editCodes.made){
				//s.log('ignoring object creation')
				s.pathEdits = []
			}else{
				s.changeListener(s.inputSubObject, s.inputKey, e.op, e.edit, s.currentSyncId, e.editId, true)
				s.lastEditId = e.editId
			}
			
			applied = true
			
			s.currentHistoricalVersion = e.editId
			//console.log('currentHistoricalVersion: ' + s.currentHistoricalVersion)
		})
		
		if(applied){
			++s.currentHistoricalVersion
		}
		//console.log('*currentHistoricalVersion: ' + s.currentHistoricalVersion)
		return next
	}
}

TopObjectHandle.prototype.getImmediateProperty = function(){
	_.errout('logic error')
}

TopObjectHandle.prototype.getForked = function(){
	return this._forkedObject
}
TopObjectHandle.prototype.isFork = function(){
	return this._forkedObject !== undefined
}

TopObjectHandle.prototype.locally = function(f){
	this.setLocalMode(true)
	f.call(this)
	this.setLocalMode(false)
}

TopObjectHandle.prototype._acceptForkChange = function(subObj, key, op, edit, syncId, editId){//, path){
	//TODO handle path switchover
	console.log('MAINTAINING FORK: ' + op + ' ' + JSON.stringify(edit) + ' on ' + this.objectId + ' ' + syncId + ' ' + this.getEditingId())
	//if(op === editCodes.refork){
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
		//_.errout('TODO forked reforked')
		//console.log('forked refork complete: ' + this)
	//}else{
	//	this._rebuild()
		/*this.prepare()
		
		//this.edits.push({op: op, edit: edit, editId: editId})
		
		changeOnPath(this, op, edit, syncId, editId)
		this.special = this._gg
		console.log(this.special + ' after fork update: ' + this)*/
	//}
	//console.log('ERRR')
	//local.changeListener(op, edit, syncId, editId, false, true)
	//_.errout('TODO')
}

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
	_.assertInt(local.inputProperty)
	
	var ch;
	if(!local.inputObject || local.inputObject === local.objectId || 
			(local._forkedObject && local._forkedObject._internalId() === local.inputObject) ||
			local.inputObject === -1){//TODO handle case where inputObject is the forked object
		ch = local
	}else{
		//console.log('own: ' + local.objectId + ' ' + local.inputObject + ' ')// + local._forkedObject._internalId())
		if(local.objectApiCache){
			ch = local.objectApiCache[local.inputObject]
		}
		if(!ch){
			console.log('WARNING: not found ' + local.inputObject + ', only got: ' + JSON.stringify(Object.keys(local.objectApiCache||{})))
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
				_.errout('(' + editId + ') setObject called on non object type, type is: ' + JSON.stringify(property.type))
			}
			//_.assertEqual(ps.type.type, 'object')
		}
		var pv = local[property.name]//.cachedProperties[ps.name]
		if(pv && pv.objectId === edit.id){
			//already done
			//this.log('setObject redundant (local view object?), skipping')
		}else{
			//this.log('set to: ' + edit.id + ' ' + descentCode + ' ' + this.objectId + ' ' + ps.name)
			var setObj = local.getObjectApi(edit.id)
			if(setObj === undefined){
				local.log.warn('object not found, may have been del\'ed: ' + edit.id)
				local.log(new Error().stack)
				return
			}

			local.obj[local.inputProperty] = setObj;
			setObj.prepare()
			local[property.name] = setObj
			//console.log('EMITTING SET OBJECT ' + ps.name)
			local.emit(edit, 'set', property.name, setObj)			
		}
	}else if(op === editCodes.clearObject || op === editCodes.clearProperty){
		var ps = local.typeSchema.propertiesByCode[local.inputProperty];
		local[ps.name] = undefined
		local.obj[local.inputProperty] = undefined
	}else{
		
		//console.log(chp.constructor+'')
		var chp = ch.property(property.name)//[property.name]

		_.assertEqual(ch[property.name], chp)
		
		if(!chp){
			_.errout('property value missing: ' + property.name)
		}
		//console.log('HERERERERER')
		//console.log('editing ' + editNames[op] + ' ' + (chp.rally = Math.random()))
		chp.changeListener(local.inputSubObject, local.inputKey, op, edit, syncId, editId)
	}	
	//return
	//_.errout('TODO')
	/*
	
	if(op === editCodes.delKey || op === editCodes.setObject || op === editCodes.clearObject || 
			op === editCodes.clearProperty || op === editCodes.setViewObject || lookup.isPutCode[op] || lookup.isPutAddCode[op] || lookup.isPutRemoveCode[op] ||
			op === editCodes.del || op === editCodes.didPutNew || op === editCodes.remove || op === editCodes.addAfter || op === editCodes.addNewAfter || op === editCodes.addedNewAfter){
		_.assert(path.length > 0)
		var lastCode
		var lastEdit = path[path.length-1]
		if(lastEdit.op === editCodes.selectProperty){
			lastCode = lastEdit.edit.typeCode
		}else if(lastEdit.op === editCodes.reselectProperty){
			lastCode = lastEdit.edit.typeCode
		}else if(lastEdit.op === editCodes.selectObject || lastEdit.op === editCodes.reselectObject){
			lastCode = lastEdit.edit.id
		}else if(lookup.isKeyCode[lastEdit.op]){//lastEdit.op.indexOf('Key') !== -1){
			lastCode = lastEdit.edit.key
		}else{
			console.log(JSON.stringify(lookup.isKeyCode))
			_.errout('TODO: ' + op + ' ' + JSON.stringify(lastEdit))
		}
		//this.log('here: ' + local.currentHandle.constructor)
		var ch = descend(local, path.slice(0, path.length-1))
		
		if(ch !== undefined){
			//this.log(JSON.stringify(local.pathEdits))
			//local.log.info('calling elevated change listener ' + lastCode + ' ' + op + ' ', edit)
			//console.log('calling elevated change listener ' + lastCode + ' ' + op + ' ' + JSON.stringify(edit))
			ch.changeListenerElevated(lastCode, op, edit, syncId, editId)
		}else{
			local.log.info('cannot execute edit, descent failed: ' + op + ' ', edit)
		}
	}else{
		var currentHandle = descend(local, path)
		
		if(currentHandle === undefined){
			//local.log.warn('WARNING: cannot complete edit: ' + op + ' ', edit)
			return
		}

		_.assertObject(currentHandle)

		if(currentHandle === local){
			console.log(local.uid + ' YY: ' + JSON.stringify(local.edits, null, 2))
			if(op === editCodes.initializeUuid){
				this._uuid = edit.uuid
			}else{
				console.log(local.getEditingId()+ ' TODO(' + local.objectId + '): ' + op + ' ' + JSON.stringify(path) + ' ' + op + ' ' + JSON.stringify(edit))
				return
			}
		}else{
			//console.log('calling change listener: ' + JSON.stringify(local.pathEdits) + ': ' + op + ' ' + JSON.stringify(edit))
			currentHandle.changeListener(op, edit, syncId, editId)
		}
	}*/	
}

TopObjectHandle.prototype.uuid = function(){
	//if(this.typeSchema.superTypes && this.typeSchema.superTypes.uuid
	if(!this._uuid) _.errout('type is not a uuid type: ' + this.typeSchema.name)
	return this._uuid
}

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
	/*if(!this._forkListeners){
		this._forkListeners = [fork]
	}else{
		this._forkListeners.push(fork)
	}*/
	this._forkListeners.splice(this._forkListeners.indexOf(fork), 1)
}
function destroyedWarning(){
	_.errout('this object has been destroyed, it is an error to still have a reference to it')
}

TopObjectHandle.prototype.replaceObjectHandle = ObjectHandle.prototype.replaceObjectHandle

TopObjectHandle.prototype.clearProperty = ObjectHandle.prototype.clearProperty

TopObjectHandle.prototype.isDefined = function(){return true;}

TopObjectHandle.prototype.getTopParent = function(){return this;}

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
}

TopObjectHandle.prototype.getImmediateKey = function(){}

TopObjectHandle.prototype._getVersions = function(source){
	//_.assert(path.length > 0)
	var fakeObject = {}
	var same = false
	var versions = [this.edits[0].editId]
	//console.log('looking over(' + source + '): ' + JSON.stringify(this.edits, null, 2))// + ' ' + path.length)
	for(var i=0;i<this.edits.length;++i){
		var e = this.edits[i]
		var did = updateInputPath(fakeObject, e.op, e.edit, e.editId)
		//console.log(JSON.stringify([same, versions, e]))
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

TopObjectHandle.prototype.fork = function fork(cb){

	var res = this.parent.createFork(this, cb)
	res.prepare();
	//console.log('forked: ' + res)
	return res;
}

TopObjectHandle.prototype.setForked = function fork(objHandle){
	//_.assert(this._isFork)

	/*var res = this.parent.createFork(this, cb)
	res.prepare();
	console.log('forked: ' + res)
	return res;*/
	//_.errout('TODO')
	var sourceId = objHandle._internalId()
	this.adjustTopObjectToOwn()
	this.persistEdit(editCodes.refork, {sourceId: sourceId})
	
	//this._rebuild()
	this._applyRefork(sourceId)
}

function sameState(a, b){
	//_.errout('TODO')
	return a.object === b.object && a.property === b.property
}

function applyReversions(edits){
	//console.log('applying reversions')
	
	var realEdits = []
	var reverts = []
	for(var i=edits.length-1;i>=0;--i){//note how we go backwards to ensure that we can revert reversions as well.
		var e = edits[i]
		if(e.op === editCodes.revert){
			reverts.push({version: e.edit.version, state: e.state})
			//console.log('reverting: ' + e.edit.version)
		}else{
			var skip = false
			if(e.state !== undefined){
				for(var j=0;j<reverts.length;++j){
					var r = reverts[j]
					if(r.version < e.editId){
						//console.log('[' + JSON.stringify(r) + ']')
						//console.log('{' + JSON.stringify(e.path) + '}')
						if(sameState(r.state, e.state)){//samePath(r.path, e.path))){
							//console.log('skip on')
							skip = true
						}
					}else{
						reverts.splice(j, 1)
						--j;
					}
				}
			}
			
			if(!skip){
				realEdits.push(e)
			}else{
				//console.log('skipping: ' + JSON.stringify(e))
			}
		}
	}
	return realEdits
}
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
			//cur = [].concat(fakeObject.pathEdits)
			cur = _.extend({}, fakeObject.state)
		}
	}
	//console.log('prepare: ' + JSON.stringify(this.edits))
	//first we apply reversions
	//var reverts = []
	var realEdits = applyReversions(this.edits)//[]//edits without reverts or reverted
	//applyReversions(realEdits)
	realEdits.reverse()
	
	/*console.log('prev edits: ' + JSON.stringify(this.edits))
	realEdits.forEach(function(e, index){
		console.log(index + ' ' + editNames[e.op] + ' ' + JSON.stringify(e.edit))
	})*/
	
	//apply edits
	this.realEdits = realEdits
	/*
	s.currentSyncId=-1
	//this.log(this.objectId, ' preparing topobject with edits:', this.realEdits)
	realEdits.forEach(function(e, index){
		if(e.op === editCodes.setSyncId){
			s.currentSyncId = e.edit.syncId
		}else if(e.op === editCodes.madeViewObject){
			//s.log('ignoring view object creation')
		}else if(e.op === editCodes.made){
			//s.log('ignoring object creation')
			s.pathEdits = []
		}else{
			s.changeListener(e.op, e.edit, s.currentSyncId, e.editId, true)
			s.lastEditId = e.editId
		}
	})
	
	*/
	
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

TopObjectHandle.prototype.prepare = function prepare(){
	//console.log('*prepare')
	//console.log(new Error().stack)
	
	if(this.isReadonlyAndEmpty) return
	if(this.prepared) return;
	if(this._destroyed){
		_.errout('cannot prepare destroyed object - internal error')
	}
	this.prepared = true;
	var s = this;

	var fakeObject = {}//{state: {}}
	//var cur = {}
	for(var i=0;i<this.edits.length;++i){
		var e = this.edits[i]
		var did = updateInputPath(fakeObject, e.op, e.edit, e.editId)
		if(!did){
			e.state = {
				property: fakeObject.inputProperty, 
				object: fakeObject.inputObject, 
				key: fakeObject.inputKey, 
				keyOp: fakeObject.inputKeyOp
			}//_.extend({}, fakeObject.state)
		}else{
			//cur = [].concat(fakeObject.pathEdits)
			//cur = _.extend({}, fakeObject.state)
		}
	}
	
	//console.log('prepare: ' + JSON.stringify(this.edits))
	//first we apply reversions
	/*var reverts = []
	var realEdits = []//edits without reverts or reverted
	for(var i=this.edits.length-1;i>=0;--i){//note how we go backwards to ensure that we can revert reversions as well.
		var e = this.edits[i]
		if(e.op === editCodes.revert){
			reverts.push({version: e.edit.version, path: e.path})
			//console.log('reverting')
		}else{
			var skip = false
			if(e.path !== undefined){
				for(var j=0;j<reverts.length;++j){
					var r = reverts[j]
					if(r.version < e.editId){
						//console.log('[' + JSON.stringify(r) + ']')
						//console.log('{' + JSON.stringify(e.path) + '}')
						if(e.path && (r.path.length === 0 || samePath(r.path, e.path))){
							//console.log('skip on')
							skip = true
						}
					}else{
						reverts.splice(j, 1)
						--j;
					}
				}
			}
			
			if(!skip){
				realEdits.push(e)
			}else{
				//console.log('skipping: ' + JSON.stringify(e))
			}
		}
	}*/
	var realEdits = applyReversions(this.edits)
	realEdits.reverse()
	
	//console.log('prev edits: ' + JSON.stringify(this.edits))
	//realEdits.forEach(function(e, index){
	//	console.log(index + ' ' + e.editId + ' ' + editNames[e.op] + ' ' + JSON.stringify(e.edit))
	//})
	
	//apply edits
	s.inputSyncId=-1
	s.inputObject = undefined
	//this.log(this.objectId, ' preparing topobject with edits:', this.realEdits)
	realEdits.forEach(function(e, index){
		if(e.op === editCodes.setSyncId){
			s.inputSyncId = e.edit.syncId
		}else if(e.op === editCodes.madeViewObject){
			//s.log('ignoring view object creation')
		}/*else if(e.op === editCodes.made){
			//s.log('ignoring object creation')
			s.pathEdits = []
		}*/else{
			s.changeListener(s.inputSubObject, s.inputKey, e.op, e.edit, s.inputSyncId, e.editId||-3, true)
			s.lastEditId = e.editId
		}
	})
	
	if(s.typeSchema.properties){
		var keys = Object.keys(s.typeSchema.properties);
		keys.forEach(function(name){
			//console.log('preparing: ' + name)
			var p = s.typeSchema.properties[name];
			var v = s.property(name);
			v.prepare();
			s[name] = v;
		
		});
	}
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
	this.pathEdits = []
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
	if(this.objectId < 0) throw new Error('cannot get id of locally-created object yet - you need to provide a callback to your make(...) call to be notified when the id becomes available.')
	return this.objectId;
}
TopObjectHandle.prototype.getTopId = TopObjectHandle.prototype.id
/*TopObjectHandle.prototype.uid = function(){
	if(this.objectId < 0) throw new Error('cannot get id of locally-created object yet - you need to provide a callback to your make(...) call to be notified when the id becomes available.')
	return ''+this.objectId;
}*/
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

TopObjectHandle.prototype._rewriteObjectApiCache = function(){
}

TopObjectHandle.prototype.isa = ObjectHandle.prototype.isa
/*
TopObjectHandle.prototype.adjustPath = function(source){
	_.assertLength(arguments, 1)
	_.assertInt(source)
	_.assert(source > 0)
	
	var currentPath = this.currentPath
	//console.log('adjustPath: ' + JSON.stringify(currentPath))
	if(currentPath === undefined) currentPath = this.currentPath = []
	//this.log('adjust top path: ' + JSON.stringify(currentPath) + ' -> ' + source)
	
	if(currentPath.length === 0){
		this.persistEdit(editCodes.selectProperty, {typeCode: source})
		return []
	}else if(currentPath[0] !== source){
		if(currentPath.length > 1){
			//this.reduceBy(currentPath.length-1)
			if(currentPath.length-1 <= 5){
				this.persistEdit(editCodes['ascend'+(currentPath.length-1)], {})
			}else{
				this.persistEdit(editCodes.ascend, {many: currentPath.length-1})
			}
		}
		this.persistEdit(editCodes.reselectProperty, {typeCode: source})
		return []
	}else{
		return this.currentPath.slice(1)
	}
}*/
TopObjectHandle.prototype.persistEdit = function(op, edit){
	//this.log('here: ' + this.getObjectId())
	//console.log('persisting: ' + op + ' ' + JSON.stringify(edit))
	_.assertInt(this.getObjectId())
	_.assertInt(op)
	
	var isRealEdit = false
	var isLocally = this.getLocalMode()
	if(op === editCodes.selectProperty){
		if(!isLocally) this.currentProperty = edit.typeCode
	}else if(op === editCodes.selectObject){
		if(!isLocally) this.currentObject = edit.id
	}else if(op === editCodes.clearObject){
		if(!isLocally) this.currentObject = undefined
	}else if(op === editCodes.selectSubObject){
		if(!isLocally) this.currentSubObject = edit.id
	}else if(op === editCodes.selectSubViewObject){
		if(!isLocally) this.currentSubObject = edit.id
	}else if(lookup.isKeySelectCode[op]){//op === 'selectStringKey' || op === 'selectLongKey' || op === 'selectIntKey' || op === 'selectBooleanKey'){
		if(!isLocally) this.currentKey = edit.key
	}else{
		isRealEdit = true
	}

	this.currentSyncId = this.getEditingId()
	
	if(!this.localEdits) this.localEdits = []
	this.localEdits.push({op: op, edit: edit})
	
	this.parent.persistEdit(this.getObjectTypeCode(), this.getObjectId(), op, edit)
	
	if(isRealEdit && this._forkListeners){
		var local = this
		this._forkListeners.forEach(function(fl){
			fl._acceptForkChange(local.currentSubObject, local.currentKey, op, edit, local.currentSyncId, -4)//, local.pathEdits || [])
		})
	}
}
/*
TopObjectHandle.prototype.getCurrentPath = function(){
	if(this.currentPath === undefined) this.currentPath = []
	return this.currentPath
}*/
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
	
   // var objSchema = this.schema[typeName]
   // if(objSchema  === undefined) throw new Error('unknown type: ' + typeName)
	//var typeCode = objSchema.code;
	//var objEdits = jsonutil.convertJsonToEdits(this.schema, typeName, json);

	
	if(forget){
		this.createNewExternalObject(typeName, json, forget, undefined)//objEdits)
	}else{
		//console.log('not forgetting: ' + forget + ' ' + cb)

		var res = this.createNewExternalObject(typeName, json, forget, cb)
	
		res.prepare();

		/*if(cb){
			if(this.parent.objectCreationCallbacks === undefined) this.parent.objectCreationCallbacks = {};
			this.parent.objectCreationCallbacks[temporary] = cb;
		}*/

		return res;
	}
}

TopObjectHandle.prototype.getTopParent = function(){
	return this
}

TopObjectHandle.prototype.reifyParentEdits = function(temporaryId, realId){
	if(this.currentObject === temporaryId){
		this.currentObject = realId
	}
	if(this.currentSubObject === temporaryId){
		this.currentSubObject = realId
	}
	if(this.inputObject === temporaryId){
		//console.log('reified input object: ' + temporaryId)
		this.inputObject = realId
	}
	if(this.inputSubObject === temporaryId){
		this.inputSubObject = realId
	}
	if(this.objectApiCache && this.objectApiCache[temporaryId]){
		this.objectApiCache[realId] = this.objectApiCache[temporaryId]
		delete this.objectApiCache[temporaryId]
	}

	for(var i=0;i<this.edits.length;++i){
		var e = this.edits[i]
		if(e.op === editCodes.addNew){
			if(temporaryId !== e.edit.temporary) continue
			e.op = editCodes.addedNew
			e.edit = {id: realId, typeCode: e.edit.typeCode}
		}else if(e.op === editCodes.selectObject){
			if(e.edit.id  !== temporaryId) continue
			e.edit.id = realId
		}
	}
}

TopObjectHandle.prototype.changeListenerElevated = ObjectHandle.prototype.changeListenerElevated

TopObjectHandle.prototype.adjustTopObjectToOwn = function(){
	this.parent.adjustTopObjectTo(this.objectId)
}

TopObjectHandle.prototype._resetInputState = function(){
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

function updateInputPath(local, op, edit, editId){
	if(op === editCodes.selectProperty){
		//console.log('updated property: ' + edit.typeCode)
		local.inputProperty = edit.typeCode
	}else if(op === editCodes.selectObject){
		//console.log('updated inputObject: ' + local.inputObject + ' -> ' + edit.id)
		local.inputObject = edit.id
	}else if(op === editCodes.clearObject){
		//console.log('updated inputObject: ' + local.inputObject + ' -> ' + edit.id)
		local.inputObject = undefined
	}else if(op === editCodes.selectSubObject){
		local.inputSubObject = edit.id
	}else if(op === editCodes.selectSubViewObject){
		local.inputSubObject = edit.id
	}else if(lookup.isKeySelectCode[op]){//op.indexOf('select') === 0 && op.indexOf('Key') === op.length-3){
		local.inputKey = edit.key
	}else if(op === editCodes.made){//op.indexOf('select') === 0 && op.indexOf('Key') === op.length-3){
		//console.log('updated inputObject: ' + local.inputObject + ' -> ' + edit.id)
		local.inputObject = undefined//edit.id
	}else{
		return false
	}
	return true
}

/*
function updatePath(local, op, edit, editId){
	_.assertLength(arguments, 4)

	if(local.pathEdits === undefined) local.pathEdits = []

	//console.log(JSON.stringify([op, edit, editId]))
	//console.log(new Error().stack)
	
	if(op === editCodes.reset){
		//local.path = []
		var dif = -local.pathEdits.length
		local.pathEdits = []
	}else if(op === editCodes.selectProperty){
		//local.path.push(edit.typeCode)
		//console.log(local.uid + ' selected property: ' + edit.typeCode)
		local.pathEdits.push({op: op, edit: edit})
	}else if(op === editCodes.reselectProperty){
		//_.assert(local.pathEdits.length > 0)
		if(local.pathEdits.length === 0) _.errout('invalid path state for reselectProperty operation: ' + JSON.stringify(local.pathEdits))
		local.pathEdits[local.pathEdits.length-1] = {op: op, edit: edit}
	}else if(op === editCodes.selectObject){
		local.pathEdits.push({op: op, edit: edit})
	}else if(op === editCodes.reselectObject){
		if(local.pathEdits.length === 0) _.errout('invalid path state for reselectProperty operation: ' + JSON.stringify(local.pathEdits))
		//_.assert(local.pathEdits.length > 0)
		local.pathEdits[local.pathEdits.length-1] = {op: op, edit: edit}
	}else if(lookup.isKeySelectCode[op]){//op.indexOf('select') === 0 && op.indexOf('Key') === op.length-3){
		local.pathEdits.push({op: op, edit: edit})		
	}else if(lookup.isKeyReselectCode[op]){//op.indexOf('reselect') === 0 && op.indexOf('Key') === op.length-3){
		local.pathEdits[local.pathEdits.length-1] = {op: op, edit: edit}
	}else if(op === editCodes.ascend1){
		local.pathEdits.pop()
	}else if(op === editCodes.ascend2){
		local.pathEdits = local.pathEdits.slice(0, local.pathEdits.length-2)
	}else if(op === editCodes.ascend3){
		local.pathEdits = local.pathEdits.slice(0, local.pathEdits.length-3)
	}else if(op === editCodes.ascend4){
		local.pathEdits = local.pathEdits.slice(0, local.pathEdits.length-4)
	}else if(op === editCodes.ascend5){
		local.pathEdits = local.pathEdits.slice(0, local.pathEdits.length-5)
	}else if(op === editCodes.ascend){
		local.pathEdits = local.pathEdits.slice(0, local.pathEdits.length-edit.many)
	}else if(op === editCodes.madeFork){
		local.pathEdits = []
	}else{
		return false
	}
	return true
}
*/
function maintainPath(local, op, edit, syncId, editId){
	_.assertInt(editId)
	//if(local.uid === undefined) local.uid = Math.random()
	//local.log.info('current path:' +JSON.stringify( local.pathEdits))
	//console.log(local.uid + ' current path(' + local.objectId + '): ' + JSON.stringify(local.pathEdits))
	//console.log('maintainPath: ' + JSON.stringify([editNames[op], edit, syncId, editId, local.inputProperty]))
	//console.log(new Error().stack)
	
	_.assertInt(op)

	/*if(local.lastEditId !== undefined && editId < local.lastEditId && editId >= 0){
		console.log('HERE**: ' + JSON.stringify(local.edits))
		_.errout('invalid old edit received: ' + editId + ' < ' + local.lastEditId + ': ' + JSON.stringify([op, edit, syncId, editId]))
	}*/

	if(local.lastEditId < editId){
		local.lastEditId = editId
	}
	
	/*if(local.pathEdits === undefined){
		//local.path = []
		local.pathEdits = []
	}*/
	
	var did = updateInputPath(local, op, edit, editId)
	if(did){
		return
	}else if(op === editCodes.made){
		//local.pathEdits = []
	}else if(op === editCodes.madeFork){
		//local.pathEdits = []
	}else if(op === editCodes.initializeUuid){
		local._uuid = edit.uuid
	}else if(op === editCodes.wasSetToNew && local.inputObject === local.objectId){

		
		var code = local.inputProperty//local.pathEdits[0].edit.typeCode
		var property = local.typeSchema.propertiesByCode[code]

		var objSchema = local.schema[property.type.object]
		var n = new ObjectHandle(objSchema, [], edit.id, [code], local);
		n.prepare()
		
		if(!local.objectApiCache) local.objectApiCache = {}
		local.objectApiCache[edit.id] = n

		if(local.getEditingId() === syncId){
			//_.assert(edit.temporary < -1)
			//console.log('NOT: ' + local[property.name].rere)
			//var temporary = local[property.name].objectId
			//console.log('temporary: ' + temporary)
			//_.assert(temporary < -1)
			//local[property.name].objectId = edit.id
			//local.replaceObjectHandle(local[property.name], n)
			return
		}
		local[property.name] = n
		
	}else{
		//console.log('pathEdits: ' + JSON.stringify(local.pathEdits))
		changeOnPath(local, op, edit, syncId, editId)
		
		/*if(op === editCodes.delKey || op === editCodes.setObject || op === editCodes.clearObject || 
				op === editCodes.clearProperty || op === editCodes.setViewObject || lookup.isPutCode[op] || lookup.isPutAddCode[op] || lookup.isPutRemoveCode[op] ||
				op === editCodes.del || op === editCodes.didPutNew || op === editCodes.remove || op === editCodes.addAfter || op === editCodes.addNewAfter || op === editCodes.addedNewAfter){
			_.assert(local.pathEdits.length > 0)
			var lastCode
			var lastEdit = local.pathEdits[local.pathEdits.length-1]
			if(lastEdit.op === editCodes.selectProperty){
				lastCode = lastEdit.edit.typeCode
			}else if(lastEdit.op === editCodes.reselectProperty){
				lastCode = lastEdit.edit.typeCode
			}else if(lastEdit.op === editCodes.selectObject || lastEdit.op === editCodes.reselectObject){
				lastCode = lastEdit.edit.id
			}else if(lookup.isKeyCode[lastEdit.op]){//lastEdit.op.indexOf('Key') !== -1){
				lastCode = lastEdit.edit.key
			}else{
				console.log(JSON.stringify(lookup.isKeyCode))
				_.errout('TODO: ' + op + ' ' + JSON.stringify(lastEdit))
			}
			//this.log('here: ' + local.currentHandle.constructor)
			var ch = descend(local, local.pathEdits.slice(0, local.pathEdits.length-1))
			
			if(ch !== undefined){
				//this.log(JSON.stringify(local.pathEdits))
				//local.log.info('calling elevated change listener ' + lastCode + ' ' + op + ' ', edit)
				//console.log('calling elevated change listener ' + lastCode + ' ' + op + ' ' + JSON.stringify(edit))
				ch.changeListenerElevated(lastCode, op, edit, syncId, editId)
			}else{
				local.log.info('cannot execute edit, descent failed: ' + op + ' ', edit)
			}
		}else{
			var currentHandle = descend(local, local.pathEdits)
			_.assertObject(currentHandle)
			
			if(currentHandle === undefined){
				local.log.warn('WARNING: cannot complete edit: ' + op + ' ', edit)
				return
			}
			if(currentHandle === local){
				console.log(local.uid + ' YY: ' + JSON.stringify(local.edits, null, 2))
				_.errout(local.getEditingId()+ ' TODO(' + local.objectId + '): ' + op + ' ' + JSON.stringify(local.pathEdits))
			}else{
				//console.log('calling change listener: ' + JSON.stringify(local.pathEdits) + ': ' + op + ' ' + JSON.stringify(edit))
				currentHandle.changeListener(op, edit, syncId, editId)
			}
		}*/
	}
	//local.log.info(local.objectId + ' maintained: ', [op, edit, syncId, editId])
	//local.log('new path: ' + JSON.stringify(local.pathEdits))

	//console.log(local.objectId + ' maintained: ' + JSON.stringify([op, edit, syncId, editId]))
	//console.log('new path: ' + JSON.stringify(local.pathEdits))

}
exports.maintainPath = maintainPath

TopObjectHandle.prototype.adjustCurrentObject = function(id){
	if(this.getLocalMode()) return

	this.parent.adjustTopObjectTo(this.objectId)
	
	_.assertInt(id)
	if(this.currentObject !== id){
		//console.log('adjusted current object: ' + this.currentObjectId + ' -> ' + id)
		//console.log(new Error().stack)
		if(id === this.objectId){
			this.persistEdit(editCodes.clearObject, {})
		}else{
			if(id === 36) _.errout('TODO FIXME: ' + this.objectId)
			this.persistEdit(editCodes.selectObject, {id: id})
		}
		//this.edits.push({op: editCodes.selectObject, edit: {id: id}})
	}
	this.currentObject = id
	this.currentProperty = undefined
}
TopObjectHandle.prototype.adjustCurrentSubObject = function(id){
	if(this.getLocalMode()) return

	_.assertInt(id)
	if(this.currentSubObject !== id){
		//console.log('adjusted current object: ' + this.currentSubObject + ' -> ' + id)
		//console.log(new Error().stack)
		this.persistEdit(editCodes.selectSubObject, {id: id})
		//this.edits.push({op: editCodes.selectSubObject, edit: {id: id}})
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
		//this.edits.push({op: editCodes.selectProperty, edit: {typeCode: typeCode}})
	}
	this.currentProperty = typeCode
}
TopObjectHandle.prototype.adjustCurrentKey = function(key, keyOp){
	if(this.getLocalMode()) return

	_.assertInt(keyOp)
	//_.assertInt(typeCode)
	if(this.currentKey !== key){
		//console.log('adjusted current key')//: ' + this.currentProperty + ' -> ' + typeCode)
		//console.log(new Error().stack)
		this.persistEdit(keyOp, {key: key})
		//this.edits.push({op: keyOp, edit: {key: key}})
	}
	this.currentKey = key
	this.currentKeyOp = keyOp
}
TopObjectHandle.prototype.getImmediateObject = function(){
	return this.objectId
}
TopObjectHandle.prototype.changeListener = function(subObj, key, op, edit, syncId, editId, isNotExternal, isForkChange){
	//console.log(JSON.stringify(arguments))
	
	if(!subObj) subObj = this.inputSubObject
	_.assertEqual(subObj, this.inputSubObject)
	if(!key) key = this.inputKey
	_.assertEqual(key, this.inputKey)
	
	_.assertInt(op)
	_.assertObject(edit)
	_.assertInt(syncId)
	
	if(!isNotExternal){
		_.assertInt(editId)
	}
	
	if(!this.prepared){
		this.prepare()//TODO optimize by appending edit if not prepared, applying if prepared?
		this.pathEdits = undefined
	}

	//console.log(this.getEditingId() + ': ' + this.objectId + ' got edit: ' + JSON.stringify([op, edit, syncId, editId]))
	
	this.inputSyncId = syncId
	
	if(!isNotExternal){
		//console.log('is external')
		this.edits.push({op: op, edit: edit, editId: editId})
		
		if(this.localEdits && this.getEditingId() === syncId){
			this.localEdits.shift()
		}
	}
	
	/*if(!this.prepared){
		//console.log('NOT PREPARED')
		if(this._editListeners){
			this.prepare()
		}else{
			return
		}
	}*/

	//console.log('updating path?: ' + editNames[op])
	var did = updateInputPath(this, op, edit, editId)

	if(!did && this._forkListeners && !isNotExternal && op !== editCodes.refork){
		var local = this
		//_.errout('SENDING UPDATE TO FORK')
		this._forkListeners.forEach(function(fl){
			fl._acceptForkChange(subObj, key, op, edit, syncId, editId, local.pathEdits || [])
		})
	}else if(this._forkListeners){
		//console.log('ignoring because of did: ' + op)
	}
	
	if(op === editCodes.revert){
		var before = this.edits.length
		this._rebuild()
		_.assertEqual(this.edits.length, before)
	}else if(op === editCodes.refork){
		//_.assert(this._forkedObject)
		_.assertInt(edit.sourceId)
		if(!this._forkedObject || this._forkedObject._internalId() !== edit.sourceId){
			//_.errout('TODO')
			this._applyRefork(edit.sourceId)
			
			//console.log('rebuilt')
			//console.log(JSON.stringify(this.edits))
		}
	}else{
		if(this.getEditingId() === syncId && !isNotExternal){
			//console.log('just updating path?: ' + editNames[op])
			//var did = updatePath(this, op, edit, editId)
			return;
		}
		//console.log('maintaining path')
		if(!did){
			maintainPath(this, op, edit, syncId, editId)
		}
	}
}

TopObjectHandle.prototype._makeAndSaveNew = function(json, type, source){

	var temporary = this.makeTemporaryId();
	var edits = jsonutil.convertJsonToEdits(this.getFullSchema(), type.name, json, this.makeTemporaryId.bind(this), temporary);

	if(edits.length > 0){
		//this.adjustPath(temporary)
		//this.parent.adjustPath(this.part)
		source.adjustCurrentObject(temporary)
		source.adjustCurrentProperty(source.part)
		//this.persistEdit(editCodes.selectObject, {id: temporary})
		for(var i=0;i<edits.length;++i){
			var e = edits[i]
			this.persistEdit(e.op, e.edit)
		}
	}
	
	var n = new ObjectHandle(type, edits, temporary, [temporary], this);
	if(this.objectApiCache === undefined) this.objectApiCache = {}
	this.objectApiCache[temporary] = n;
	
	//console.log('cached ' + temporary + ' in ' + this.objectId)
	
	this.saveTemporaryForLookup(temporary, n, this)
	
	//console.log('made and saved new: '+ temporary)
	
	n.prepare()
	
	return n
}

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
}

TopObjectHandle.prototype.errorOnWarn = false

TopObjectHandle.prototype.propertyByCode = ObjectHandle.prototype.propertyByCode
function descend(start, pathEdits){
	var ch = start
	//start.log(JSON.stringify(pathEdits))
	//console.log(JSON.stringify(pathEdits))
	for(var i=0;i<pathEdits.length;++i){
		var pe = pathEdits[i]
		if(pe.op === editCodes.selectProperty || pe.op === editCodes.reselectProperty){
			var oldCh = ch
			ch = ch.propertyByCode(pe.edit.typeCode)
			if(!ch){
				if(TopObjectHandle.prototype.errorOnWarn){
					_.errout('warning: cannot descend, property not found: ' + pe.edit.typeCode)
				}else{
					console.log('warning: cannot descend, property not found: ' + pe.edit.typeCode)
				}
				return
			}
			_.assertObject(ch)
			//console.log('selecting property: ' + pe.edit.typeCode + ' ' + ch.rere + ' ' + ch.objectId + ' ' + JSON.stringify(pathEdits))
			//console.log('ch: ' + oldCh.objectId)
		}else if(pe.op === editCodes.selectObject || pe.op === editCodes.reselectObject){
			_.assert(pe.edit.id !== 0)
			if(ch.getObjectValue){//map descent
				ch = ch.getObjectValue(pe.edit.id)
				if(ch === undefined){
					//start.log('WARNING: might be ok, but cannot descend into path due to id not found: ' + JSON.stringify(pathEdits.slice(0,i+1)))
					//console.log('WARNING: might be ok, but cannot descend into path due to id not found: ' + JSON.stringify(pathEdits.slice(0,i+1)))
					return
				}
			}else if(ch.get){//list/set descent?
				ch = ch.get(pe.edit.id)
				if(ch === undefined){
					//start.log('WARNING: might be ok, but cannot descend into path due to id not found: ' + JSON.stringify(pathEdits.slice(0,i+1)))
					//console.log('WARNING: might be ok, but cannot descend into path due to id not found: ' + JSON.stringify(pathEdits.slice(0,i+1)))
					return
				}
			}else{
				//we don't actually do anything except check that the object property's object hasn't changed
				if(ch.objectId !== pe.edit.id){
					//start.log('WARNING: might be ok, but cannot descend into path due to id not found: ' + JSON.stringify(pathEdits.slice(0,i+1)))
					//console.log('*WARNING: might be ok, but cannot descend into path due to id not found(' + ch.objectId + ' !=- ' + pe.edit.id+'): ' + JSON.stringify(pathEdits.slice(0,i+1)))
					return
				}
			}
			//this.log('id: ' + pe.edit.id)
			_.assertDefined(ch)
		}else if(lookup.isKeyCode[pe.op]){//pe.op.indexOf('Key') === pe.op.length-3){
			ch = ch.get(pe.edit.key)
			_.assertObject(ch)
		}else{
			_.errout('TODO: ' + JSON.stringify(pathEdits))
		}
	}
	return ch
}

TopObjectHandle.prototype.del = function(){
	ObjectHandle.prototype.del.apply(this)

	this.emit({}, 'del')

	this._destroy()
}

TopObjectHandle.prototype._destroy = function(){
	this.parent._destroyed(this)
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
		local[key] = destroyedWarning
	})
	this._destroyed = true
}

TopObjectHandle.prototype.wrapObject = function(id, typeCode, part, sourceParent){
	_.assertLength(arguments, 4);
	_.assertInt(id)
	_.assertInt(typeCode)
	_.assertFunction(sourceParent.adjustPath)
	
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
	return _.isString(this.objectId)
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
	var n = new TopObjectHandle(this.schema, this.typeSchema, edits, fakeParent, this.objectId)
	n.prepare()
	
	n.replayTo = function(endEditId){
		var newEdits = []
		for(var i=0;i<local.edits.length;++i){
			var e = local.edits[i]
			if(e.editId > editId && e.editId <= endEditId){
				newEdits.push(e)
			}
		}
		n.inputSyncId=-1
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
			}else if(e.op === editCodes.made){
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
//note that this array will include versions which were reverted later.
//TODO provide this for each sub-part of the top object as well
TopObjectHandle.prototype.versions = function(){
	var versions = [this.edits[0].editId]
	var fakeObject = {}
	//console.log(JSON.stringify(edits))
	for(var i=0;i<this.edits.length;++i){
		var e = this.edits[i]
		var did = updateInputPath(fakeObject, e.op, e.edit, e.editId)
		if(!did && e.editId !== versions[versions.length-1]){
			if(e.op === editCodes.setSyncId) continue
			//console.log('* ' + JSON.stringify(e))
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
TopObjectHandle.prototype.revert = function(editId){
	_.assert(editId > 0)//TODO support local editIds as well, REMOVEME
	//console.log('here&')
	//this.edits.push({op: 'revert', edit: {version: editId}})
	//TODO adjust path
	
	//_.errout('TODO')
	/*if(this.currentPath && this.currentPath.length > 0){
		//console.log('htere')
		this.persistEdit(editCodes.ascend, {many: this.currentPath.length})
		this.currentPath = []
	}*/
	//console.log('here*')
	this.adjustTopObjectToOwn()
	this.persistEdit(editCodes.revert, {version: editId})
	//this._rebuild()
}

module.exports = TopObjectHandle

