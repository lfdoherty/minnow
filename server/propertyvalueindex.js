
var indexFile = require('indexfilestream')
var parsicle = require('parsicle')
var set = require('structures').set;

var _ = require('underscorem')

exports.load = function(dataDir, schema, typeCode, propertyCode, ol, cb){
	_.assertString(dataDir)
	
	var objSchema = schema._byCode[typeCode]
	var prop = objSchema.propertiesByCode[propertyCode]
	
	if(prop.type.type !== 'primitive') throw new Error('TODO')
	
	var format = parsicle.make(function(parser){

		parser('add', 'object', function(p){
			p.key('id').int();
			var pk = p.key('value')
			var pvf = pk[prop.type.primitive]
			if(pvf === undefined) _.errout('no ast primitive: ' + prop.type.primitive + ' ' + JSON.stringify(prop))
			pvf.apply(pk);
			p.key('versionId').int()
		})
		parser('move', 'object', function(p){
			p.key('id').int();
			p.key('oldValue')[prop.type.primitive]();
			p.key('newValue')[prop.type.primitive]();
			p.key('versionId').int()
		})
	})
	
	var index = {}
	var undefinedSet = set.fromArray([])
	var idValues = {}
	var currentSegment = {}
	
	var values = [undefined]
	
	function add(id, value){
		idValues[id] = value
		if(value === undefined){
			undefinedSet.add(id)
		}else{
			var ii = index[value];
			if(ii === undefined){
				ii = index[value] = set.fromSingle(id);
				values.push(value)
			}else{
				ii.add(id);
			}
		}
	}
	function remove(id, value){
		if(value === undefined){
			undefinedSet.remove(id)
		}else{
			var ii = index[value];
			if(ii !== undefined){
				ii.remove(id);
			}
		}
	}
	
	var loadedVersionId = -1;
	
	var readers = {
		add: function(e, segmentIndex){
			add(e.id, e.value)
			currentSegment[e.id] = segmentIndex
			loadedVersionId = e.versionId
			return 1;
		},
		move: function(e, segmentIndex){
			remove(e.id, e.oldValue)
			add(e.id, e.newValue)
			w.replacedMapping(currentSegment[e.id])
			currentSegment[e.id] = segmentIndex
			loadedVersionId = e.versionId
			return 1;
		}
	}
	
	var rewriters = {
		add: function(e, oldSegmentIndex){
			if(currentSegment[e.id] === oldSegmentIndex){
				_.assert(index[e.value].contains(e.id));
				currentSegment[e.id] = w.writer.add(e, 1);
			}
		},
		move: function(e, oldSegmentIndex){
			if(currentSegment[e.id] === oldSegmentIndex){
				_.assert(index[e.newValue].contains(e.id));
				currentSegment[e.id] = w.writer.move(e, 1);
			}
		}
	}
	
	var config = {
		path: dataDir + '/minnow_data/'+objSchema.code + '.' + prop.code + '.propertyvalueindex', 
		readers: readers, 
		rewriters: rewriters, 
		format: format,
		maxSegmentLength: 100*1024
	}
	
	function update(id, propertyValue, versionId){

		if(propertyValue === idValues[id]) return;
		
		if(propertyValue === undefined){
			remove(id, idValues[id])
			add(id, propertyValue)
		}else{
			if(idValues[id] !== undefined || undefinedSet.contains(id)){
				remove(id, idValues[id])
			}
			add(id, propertyValue)
		}
		//console.log('writing: ' + prop.name)
		currentSegment[id] = w.writer.add({id: id, value: propertyValue, versionId: versionId}, 1)
	}

	var handle = {
		get: function(value){
			var ii;
			if(value === undefined) ii = undefinedSet;
			else ii = index[value]
		
			if(ii === undefined) return set.empty;
			else return ii.invariant()
		},
		getValues: function(){
			return [].concat(values)
		},
		update: update
	}
			
	var w = indexFile.open(config, function(){
		ol.getPropertyValueForChangedSince(typeCode, propertyCode, loadedVersionId, update, function doneCb(){
			console.log('loaded pvi index ' + objSchema.name + '.' + prop.name)
			cb(handle)
		})
	})
}
