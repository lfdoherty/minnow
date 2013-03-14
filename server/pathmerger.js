
var _ = require('underscorem')

//var tcpShared = require('./tcp_shared')

function stub(){}

var log = require('quicklog').make('minnow/pathmerger')

var editFp = require('./tcp_shared').editFp
var editCodes = editFp.codes
var editNames = editFp.names

function editToMatch(c, n, cb){
	_.assertObject(c)
	_.assertObject(n)
	//if(!n.property) _.errout('missing property: ' + JSON.stringify(n))
	//_.assertInt(n.property)
	if(n.object && c.object !== n.object){
		c.object = n.object
		if(n.object === n.top){
			cb(editCodes.clearObject, {})
		}else{
			if(n.object === 36) _.errout('TODO: ' + n.top)
			if(n.object < 0) _.errout('TODO')
			cb(editCodes.selectObject, {id: n.object})
		}
	}
	if(n.sub && c.sub !== n.sub){
		c.sub = n.sub
		if(_.isInt(n.sub)){
			cb(editCodes.selectSubObject, {id: n.sub})
		}else{
			cb(editCodes.selectSubViewObject, {id: n.sub})
		}
	}
	if(n.property !== c.property){
		c.property = n.property
		cb(editCodes.selectProperty, {typeCode: n.property})
	}
	if(n.key !== c.key){
		if(n.key === undefined) return
		//console.log('emitting key: ' + n.key)
		_.assertInt(n.keyOp)
		c.key = n.key
		c.keyOp = n.keyOp
		cb(n.keyOp, {key: n.key})
	}
}

exports.editToMatch = editToMatch

function make(){
	return {
		selectCurrentObject: function(id, objId){
			_.errout('TODO: get current object, saveAp the new one if it is changing')
		}/*,
		forgetTemporary = function(real, temporary, syncId){
			var m = olMap[real]
			if(m){
				m.push({type: editCodes.forgetTemporary, real: real, temporary: temporary, syncId: syncId})
			}else{
				forgetTemporaryAp(real, temporary, syncId)
		}*/
	
	}
}

exports.make = make
